package platform

import (
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/crossplane/function-sdk-go/resource"

	"github.com/7k-hiroba/hiroba/functions/platform/internal/contract"
)

// SpecString reads a nested string from the observed composite's spec.
func SpecString(oxr *resource.Composite, path ...string) string {
	full := append([]string{"spec"}, path...)
	v, _, _ := unstructured.NestedString(oxr.Resource.Object, full...)
	return v
}

// SpecStringDefault reads a nested string from spec, returning fallback when unset.
func SpecStringDefault(oxr *resource.Composite, fallback string, path ...string) string {
	if v := SpecString(oxr, path...); v != "" {
		return v
	}
	return fallback
}

// SpecInt64 reads a nested integer from the observed composite's spec.
func SpecInt64(oxr *resource.Composite, path ...string) (int64, bool) {
	full := append([]string{"spec"}, path...)
	v, found, _ := unstructured.NestedInt64(oxr.Resource.Object, full...)
	return v, found
}

// SpecBool reads a nested boolean from the observed composite's spec.
func SpecBool(oxr *resource.Composite, path ...string) (bool, bool) {
	full := append([]string{"spec"}, path...)
	v, found, _ := unstructured.NestedBool(oxr.Resource.Object, full...)
	return v, found
}

// FeatureEnabled reports whether spec.features.<name>.enabled is true.
func FeatureEnabled(oxr *resource.Composite, name string) bool {
	v, found := SpecBool(oxr, "features", name, "enabled")
	return found && v
}

// Team returns the owning team. spec.team is authoritative (it is a required XRD
// field); the metadata label is a legacy fallback.
func Team(oxr *resource.Composite) string {
	if t := SpecString(oxr, "team"); t != "" {
		return t
	}
	if t := oxr.Resource.GetLabels()[contract.LabelTeam]; t != "" {
		return t
	}
	return "default"
}

// CostCenter returns the cost center. spec.costCenter is authoritative.
func CostCenter(oxr *resource.Composite) string {
	if c := SpecString(oxr, "costCenter"); c != "" {
		return c
	}
	return oxr.Resource.GetLabels()[contract.LabelCostCenter]
}

// Profile returns spec.profile, defaulting to development.
func Profile(oxr *resource.Composite) string {
	return SpecStringDefault(oxr, "development", "profile")
}

// ProfileDefaults resolves the contract defaults for the XR's profile.
func ProfileDefaults(oxr *resource.Composite) contract.ProfileDefaults {
	if d, ok := contract.Profiles[Profile(oxr)]; ok {
		return d
	}
	return contract.Profiles["development"]
}

// ResolveProviderConfig returns the namespaced ProviderConfig name for the given
// provider. An explicit spec.providerConfigRef.name wins; otherwise the convention is
// `<team>-<provider>` (e.g. `team-api-aws`), matching the per-tenant namespaced
// providers described in ADR 007.
func ResolveProviderConfig(oxr *resource.Composite, provider string) string {
	if name := SpecString(oxr, "providerConfigRef", "name"); name != "" {
		return name
	}
	return Team(oxr) + "-" + provider
}

// SetProviderConfigRef stamps a namespaced ProviderConfig reference onto a composed
// managed resource. Namespaced (m.*) provider APIs require the kind discriminator;
// cluster-scoped legacy APIs forbid it, so callers pass the composed resource's
// apiVersion and we include kind only for namespaced groups.
func SetProviderConfigRef(obj map[string]any, apiVersion, name string) {
	if strings.Contains(apiVersion, ".m.") {
		_ = unstructured.SetNestedField(obj, map[string]any{
			"kind": "ProviderConfig",
			"name": name,
		}, "spec", "providerConfigRef")
		return
	}
	_ = unstructured.SetNestedField(obj, name, "spec", "providerConfigRef", "name")
}

// WriteConnectionSecretToRef configures where Crossplane writes a managed resource's
// connection details, aligned to the primitive connection contract (ADR 007).
func WriteConnectionSecretToRef(obj map[string]any, namespace, name string) {
	_ = unstructured.SetNestedField(obj, map[string]any{
		"name":      name,
		"namespace": namespace,
	}, "spec", "writeConnectionSecretToRef")
}

// Tag sets a single forProvider.tags entry on a cloud managed resource.
func Tag(obj map[string]any, key, value string) {
	_ = unstructured.SetNestedField(obj, value, "spec", "forProvider", "tags", key)
}

// TagOwnership stamps the standard team/cost-center/environment tags.
func TagOwnership(obj map[string]any, oxr *resource.Composite) {
	Tag(obj, contract.LabelTeam, Team(oxr))
	Tag(obj, "environment", Profile(oxr))
	if cc := CostCenter(oxr); cc != "" {
		Tag(obj, contract.LabelCostCenter, cc)
	}
}

// SetLabel sets a metadata label on a composed resource.
func SetLabel(obj map[string]any, key, value string) {
	_ = unstructured.SetNestedField(obj, value, "metadata", "labels", key)
}

// LabelOwnership stamps the standard ownership labels on a composed resource.
func LabelOwnership(obj map[string]any, oxr *resource.Composite) {
	SetLabel(obj, contract.LabelTeam, Team(oxr))
	if cc := CostCenter(oxr); cc != "" {
		SetLabel(obj, contract.LabelCostCenter, cc)
	}
}

// ObservedReady reports whether the named observed composed resource is ready:
// either it carries a Ready=True condition, or its status.phase reads as a
// healthy state (CNPG convention). Used by handlers to set explicit readiness
// on desired resources (function pipeline treats unset readiness as unready).
func ObservedReady(hc *HandlerContext, name resource.Name) bool {
	obs, ok := hc.Observed[name]
	if !ok || obs.Resource == nil {
		return false
	}
	if c := obs.Resource.GetCondition("Ready"); c.Status == "True" {
		return true
	}
	phase, _, _ := unstructured.NestedString(obs.Resource.Object, "status", "phase")
	switch phase {
	case "Cluster in healthy state", "Ready", "Available", "Running":
		return true
	}
	return false
}

// MarkReady sets explicit readiness on a desired composed resource when the
// observed counterpart is ready.
func MarkReady(res *Result, hc *HandlerContext, name resource.Name) {
	d, ok := res.Desired[name]
	if !ok {
		return
	}
	if ObservedReady(hc, name) {
		d.Ready = resource.ReadyTrue
	} else {
		d.Ready = resource.ReadyFalse
	}
}
