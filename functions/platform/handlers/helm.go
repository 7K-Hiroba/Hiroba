package handlers

import (
	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composed"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/7k-hiroba/hiroba/functions/platform"
)

const (
	grafanaChartsRepo     = "https://grafana.github.io/helm-charts"
	prometheusChartsRepo  = "https://prometheus-community.github.io/helm-charts"
	)

// helmRelease builds a provider-helm Release composed resource with the given chart
// coordinates. Values are applied with mergeValues precedence.
func helmRelease(oxr *resource.Composite, name, chart, repo, version string, values map[string]any) *composed.Unstructured {
	rel := composed.New()
	rel.SetAPIVersion("helm.m.crossplane.io/v1beta1")
	rel.SetKind("Release")
	rel.SetNamespace(oxr.Resource.GetNamespace())
	rel.SetName(name)
	o := rel.Object
	_ = unstructured.SetNestedField(o, chart, "spec", "forProvider", "chart", "name")
	_ = unstructured.SetNestedField(o, repo, "spec", "forProvider", "chart", "repository")
	_ = unstructured.SetNestedField(o, version, "spec", "forProvider", "chart", "version")
	_ = unstructured.SetNestedField(o, oxr.Resource.GetNamespace(), "spec", "forProvider", "namespace")
	_ = unstructured.SetNestedField(o, true, "spec", "forProvider", "wait")
	platform.SetProviderConfigRef(o, rel.GetAPIVersion(), platform.ResolveProviderConfig(oxr, "helm"))
	if len(values) > 0 {
		_ = unstructured.SetNestedField(o, values, "spec", "forProvider", "values")
	}
	return rel
}

// releaseValues returns the (possibly empty) values map of a helm Release object for
// incremental wiring.
func releaseValues(rel *composed.Unstructured) map[string]any {
	v, _, _ := unstructured.NestedMap(rel.Object, "spec", "forProvider", "values")
	if v == nil {
		v = map[string]any{}
	}
	return v
}

func setReleaseValues(rel *composed.Unstructured, values map[string]any) {
	_ = unstructured.SetNestedField(rel.Object, values, "spec", "forProvider", "values")
}

// deepMerge merges override into base recursively. Override wins on conflicts;
// maps merge, everything else (including slices) is replaced.
func deepMerge(base, override map[string]any) map[string]any {
	out := map[string]any{}
	for k, v := range base {
		out[k] = v
	}
	for k, v := range override {
		if baseMap, ok := out[k].(map[string]any); ok {
			if overrideMap, ok := v.(map[string]any); ok {
				out[k] = deepMerge(baseMap, overrideMap)
				continue
			}
		}
		out[k] = v
	}
	return out
}

// userValues reads the spec.values escape hatch of an XR.
func userValues(oxr *resource.Composite) map[string]any {
	v, found, _ := unstructured.NestedMap(oxr.Resource.Object, "spec", "values")
	if !found {
		return nil
	}
	return v
}

// applyValues merges chart values with precedence:
// defaults < user values (spec.values) < platform-wired values.
func applyValues(rel *composed.Unstructured, defaults, user, wired map[string]any) {
	merged := deepMerge(deepMerge(defaults, user), wired)
	setReleaseValues(rel, merged)
}
