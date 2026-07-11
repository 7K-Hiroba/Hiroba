// Package platform is the central Crossplane composition orchestrator (ADR 007).
//
// Every primitive and stack Composition runs a single Pipeline step that calls this
// function. RunFunction dispatches on the observed composite's Kind via the Registry,
// and the matched Handler emits the desired composed resources — including child
// primitive XRs for stacks, and managed resources (RDS, CNPG, S3, Garage, ...) for
// primitives.
package platform

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/crossplane/function-sdk-go/resource"
)

const (
	labelTeam       = "team"
	labelCostCenter = "cost-center"
)

// SpecString reads a nested string from the observed composite's spec.
func SpecString(oxr *resource.Composite, path ...string) string {
	full := append([]string{"spec"}, path...)
	v, _, _ := unstructured.NestedString(oxr.Resource.Object, full...)
	return v
}

// Team returns the owning team label (used for naming and provider-config convention).
func Team(oxr *resource.Composite) string {
	if t := oxr.Resource.GetLabels()[labelTeam]; t != "" {
		return t
	}
	return "default"
}

// CostCenter returns the cost-center label when present.
func CostCenter(oxr *resource.Composite) string {
	return oxr.Resource.GetLabels()[labelCostCenter]
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
// managed resource.
func SetProviderConfigRef(obj map[string]any, name string) {
	_ = unstructured.SetNestedField(obj, map[string]any{
		"kind": "ProviderConfig",
		"name": name,
	}, "spec", "providerConfigRef")
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
