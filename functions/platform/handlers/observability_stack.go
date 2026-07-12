package handlers

import (
	"fmt"

	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composed"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/7k-hiroba/hiroba/functions/platform"
	"github.com/7k-hiroba/hiroba/functions/platform/internal/contract"
)

// ObservabilityStack handles kind=ObservabilityStack: the composite product that
// wires Grafana + Loki + a metrics backend (Prometheus or Mimir) + Alloy into one
// self-service stack (ADR 007 hierarchical composition).
//
// The handler emits child product XRs with deterministic names and reads their
// observed status/connection details to wire cross-product references:
//   - Alloy's remote_write endpoint comes from the metrics backend's status.endpoint
//   - Grafana datasources come from Loki and the metrics backend endpoints
//
// Module enable/disable is simply "don't create the child" — no managementPolicies
// patching. Each module's spec.values escape hatch is forwarded to the child XR.
func ObservabilityStack(hc *platform.HandlerContext) (*platform.Result, error) {
	oxr := hc.OXR
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	desired := platform.Desired{}
	res := &platform.Result{Desired: desired, Status: map[string]any{"phase": "Provisioning"}}

	baseSpec := map[string]any{
		"profile":    platform.Profile(oxr),
		"team":       platform.Team(oxr),
		"costCenter": platform.CostCenter(oxr),
	}

	child := func(kind, childName string, extra map[string]any) *composed.Unstructured {
		c := composed.New()
		c.SetAPIVersion(contract.APIGroupVersion)
		c.SetKind(kind)
		c.SetName(name + "-" + childName)
		c.SetNamespace(ns)
		c.SetLabels(stackLabels(oxr, name))
		spec := map[string]any{}
		for k, v := range baseSpec {
			spec[k] = v
		}
		for k, v := range extra {
			spec[k] = v
		}
		if uv := moduleValues(oxr, childName); len(uv) > 0 {
			spec["values"] = uv
		}
		c.Object["spec"] = spec
		return c
	}

	// Grafana (default enabled).
	if moduleEnabled(oxr, "grafana", true) {
		extra := map[string]any{}
		if domain := platform.SpecString(oxr, "modules", "grafana", "domain"); domain != "" {
			extra["domain"] = domain
		}
		desired[resource.Name("grafana")] = &resource.DesiredComposed{Resource: child("GrafanaInstance", "grafana", extra)}
	}

	// Loki (default enabled).
	if moduleEnabled(oxr, "loki", true) {
		desired[resource.Name("loki")] = &resource.DesiredComposed{Resource: child("LokiInstance", "loki", map[string]any{})}
	}

	// Metrics backend: prometheus (default) or mimir.
	metricsBackend := platform.SpecStringDefault(oxr, "prometheus", "modules", "metrics", "backend")
	var metricsKind, metricsChildName, writePath string
	switch metricsBackend {
	case "mimir":
		metricsKind, metricsChildName, writePath = "MimirInstance", "mimir", "/api/v1/push"
	default:
		metricsKind, metricsChildName, writePath = "PrometheusInstance", "prometheus", "/api/v1/write"
	}
	if moduleEnabled(oxr, "metrics", true) {
		extra := map[string]any{}
		if retention, found := platform.SpecInt64(oxr, "modules", "metrics", "retentionDays"); found {
			extra["retentionDays"] = retention
		}
		desired[resource.Name("metrics")] = &resource.DesiredComposed{Resource: child(metricsKind, metricsChildName, extra)}
	}

	// Alloy: remote_write target from the metrics backend's observed status.
	if moduleEnabled(oxr, "alloy", true) {
		extra := map[string]any{}
		if endpoint := childStatusString(hc, resource.Name("metrics"), "endpoint"); endpoint != "" {
			extra["remoteWriteEndpoint"] = endpoint + writePath
		} else {
			res.Warnings = append(res.Warnings, "metrics backend endpoint not yet available; Alloy remote_write will be wired when ready")
		}
		desired[resource.Name("alloy")] = &resource.DesiredComposed{Resource: child("AlloyInstance", "alloy", extra)}
	}

	// Grafana datasources from observed child endpoints. The grafana chart's
	// sidecar (enabled in the Grafana handler) picks up ConfigMaps labeled
	// grafana_datasource=1.
	if moduleEnabled(oxr, "grafana", true) {
		if cm := datasourceConfigMap(hc, oxr, name, ns, metricsBackend); cm != nil {
			desired[resource.Name("datasources")] = &resource.DesiredComposed{Resource: cm}
		} else {
			res.Warnings = append(res.Warnings, "datasource endpoints not yet available; Grafana datasources will be created when children report status")
		}
	}

	res.Status["endpoint"] = fmt.Sprintf("http://%s-grafana-grafana.%s.svc:80", name, ns)
	return res, nil
}

// moduleEnabled reads spec.modules.<name>.enabled with a default.
func moduleEnabled(oxr *resource.Composite, name string, def bool) bool {
	v, found := platform.SpecBool(oxr, "modules", name, "enabled")
	if !found {
		return def
	}
	return v
}

// moduleValues reads spec.modules.<name>.values (the escape hatch forwarded to the child).
func moduleValues(oxr *resource.Composite, name string) map[string]any {
	v, found, _ := unstructured.NestedMap(oxr.Resource.Object, "spec", "modules", name, "values")
	if !found {
		return nil
	}
	return v
}

// childStatusString reads status.<field> from an observed child XR.
func childStatusString(hc *platform.HandlerContext, name resource.Name, field string) string {
	obs, ok := hc.Observed[name]
	if !ok {
		return ""
	}
	v, _, _ := unstructured.NestedString(obs.Resource.Object, "status", field)
	return v
}

// datasourceConfigMap builds the Grafana sidecar datasource ConfigMap from observed
// child endpoints. Returns nil when no endpoint is available yet.
func datasourceConfigMap(hc *platform.HandlerContext, oxr *resource.Composite, name, ns, metricsBackend string) *composed.Unstructured {
	type ds struct {
		name string
		url  string
		typ  string
	}
	var sources []ds

	if lokiEndpoint := childStatusString(hc, resource.Name("loki"), "endpoint"); lokiEndpoint != "" {
		sources = append(sources, ds{name: "Loki", url: lokiEndpoint, typ: "loki"})
	}
	if metricsEndpoint := childStatusString(hc, resource.Name("metrics"), "endpoint"); metricsEndpoint != "" {
		dsName := "Prometheus"
		if metricsBackend == "mimir" {
			dsName = "Mimir"
		}
		sources = append(sources, ds{name: dsName, url: metricsEndpoint, typ: "prometheus"})
	}
	if len(sources) == 0 {
		return nil
	}

	yaml := "apiVersion: 1\ndatasources:\n"
	for i, s := range sources {
		yaml += fmt.Sprintf(`  - name: %s
    type: %s
    access: proxy
    url: %s
    isDefault: %t
    editable: false
`, s.name, s.typ, s.url, i == 0)
	}

	cm := composed.New()
	cm.SetAPIVersion("v1")
	cm.SetKind("ConfigMap")
	cm.SetName(name + "-datasources")
	cm.SetNamespace(ns)
	cm.SetLabels(map[string]string{"grafana_datasource": "1"})
	_ = unstructured.SetNestedField(cm.Object, yaml, "data", "stack-datasources.yaml")
	return cm
}
