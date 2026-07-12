package handlers

import (
	"strings"
	"testing"

	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composed"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/7k-hiroba/hiroba/functions/platform/internal/contract"
)

func TestObservabilityStackDefaults(t *testing.T) {
	xr := newXR("ObservabilityStack", "obs", "team-api", "team-api")
	setSpec(xr, map[string]any{"profile": "production", "team": "team-api", "costCenter": "cc-1"})

	res, err := ObservabilityStack(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := map[resource.Name]string{
		resource.Name("grafana"): "GrafanaInstance",
		resource.Name("loki"):    "LokiInstance",
		resource.Name("metrics"): "PrometheusInstance",
		resource.Name("alloy"):   "AlloyInstance",
	}
	for key, kind := range want {
		dc, ok := res.Desired[key]
		if !ok {
			t.Errorf("missing composed child %q", key)
			continue
		}
		if got := dc.Resource.GetKind(); got != kind {
			t.Errorf("child %q kind = %q, want %q", key, got, kind)
		}
		if got := dc.Resource.GetName(); !strings.HasPrefix(got, "obs-") {
			t.Errorf("child %q name = %q, want deterministic obs-* name", key, got)
		}
		if got := dc.Resource.GetNamespace(); got != "team-api" {
			t.Errorf("child %q namespace = %q, want team-api", key, got)
		}
	}
	// No endpoints observed yet -> datasources deferred with warnings, not fatal.
	if _, ok := res.Desired[resource.Name("datasources")]; ok {
		t.Error("datasources ConfigMap should be deferred until children report status")
	}
	if len(res.Warnings) == 0 {
		t.Error("expected warnings for missing endpoints")
	}
}

func TestObservabilityStackModuleDisable(t *testing.T) {
	xr := newXR("ObservabilityStack", "obs", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x", "costCenter": "cc-1"})
	_ = unstructured.SetNestedField(xr.Object, false, "spec", "modules", "loki", "enabled")
	_ = unstructured.SetNestedField(xr.Object, false, "spec", "modules", "alloy", "enabled")

	res, err := ObservabilityStack(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, ok := res.Desired[resource.Name("loki")]; ok {
		t.Error("loki child should not exist when disabled")
	}
	if _, ok := res.Desired[resource.Name("alloy")]; ok {
		t.Error("alloy child should not exist when disabled")
	}
	if _, ok := res.Desired[resource.Name("grafana")]; !ok {
		t.Error("grafana child should exist (default enabled)")
	}
}

func TestObservabilityStackMimirBackend(t *testing.T) {
	xr := newXR("ObservabilityStack", "obs", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x", "costCenter": "cc-1"})
	_ = unstructured.SetNestedField(xr.Object, "mimir", "spec", "modules", "metrics", "backend")

	res, err := ObservabilityStack(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := res.Desired[resource.Name("metrics")].Resource.GetKind(); got != "MimirInstance" {
		t.Errorf("metrics child kind = %q, want MimirInstance", got)
	}
}

func TestObservabilityStackWiresEndpointsFromObserved(t *testing.T) {
	xr := newXR("ObservabilityStack", "obs", "team-api", "team-api")
	setSpec(xr, map[string]any{"team": "team-api", "costCenter": "cc-1"})

	mkObserved := func(kind, endpoint string) resource.ObservedComposed {
		c := composed.New()
		c.SetAPIVersion(contract.APIGroupVersion)
		c.SetKind(kind)
		c.SetName("obs-x")
		c.SetNamespace("team-api")
		_ = unstructured.SetNestedField(c.Object, endpoint, "status", "endpoint")
		return resource.ObservedComposed{Resource: c}
	}
	observed := map[resource.Name]resource.ObservedComposed{
		resource.Name("metrics"): mkObserved("PrometheusInstance", "http://obs-prom-prometheus.team-api.svc:9090"),
		resource.Name("loki"):    mkObserved("LokiInstance", "http://obs-loki-gateway.team-api.svc:80"),
	}

	res, err := ObservabilityStack(newHandlerContext(xr, observed))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Alloy gets remote_write endpoint from the metrics backend.
	alloy := res.Desired[resource.Name("alloy")]
	writeURL, _, _ := unstructured.NestedString(alloy.Resource.Object, "spec", "remoteWriteEndpoint")
	if writeURL != "http://obs-prom-prometheus.team-api.svc:9090/api/v1/write" {
		t.Errorf("alloy remoteWriteEndpoint = %q", writeURL)
	}

	// Datasource ConfigMap built from observed endpoints.
	cm, ok := res.Desired[resource.Name("datasources")]
	if !ok {
		t.Fatal("datasources ConfigMap missing")
	}
	yaml, _, _ := unstructured.NestedString(cm.Resource.Object, "data", "stack-datasources.yaml")
	for _, want := range []string{"name: Loki", "type: loki", "obs-loki-gateway", "name: Prometheus", "type: prometheus", "obs-prom-prometheus"} {
		if !strings.Contains(yaml, want) {
			t.Errorf("datasource yaml missing %q:\n%s", want, yaml)
		}
	}
	if got := cm.Resource.GetLabels()["grafana_datasource"]; got != "1" {
		t.Errorf("ConfigMap label grafana_datasource = %q, want 1", got)
	}
}

func TestObservabilityStackForwardsModuleValues(t *testing.T) {
	xr := newXR("ObservabilityStack", "obs", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x", "costCenter": "cc-1"})
	_ = unstructured.SetNestedField(xr.Object, true, "spec", "modules", "grafana", "values", "persistence", "enabled")

	res, err := ObservabilityStack(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	grafana := res.Desired[resource.Name("grafana")]
	enabled, _, _ := unstructured.NestedBool(grafana.Resource.Object, "spec", "values", "persistence", "enabled")
	if !enabled {
		t.Error("modules.grafana.values escape hatch was not forwarded to the child XR")
	}
}

func TestPrometheusEndpointAndRetention(t *testing.T) {
	xr := newXR("PrometheusInstance", "obs-prom", "team-api", "team-api")
	setSpec(xr, map[string]any{"profile": "production", "team": "team-api", "costCenter": "cc-1", "retentionDays": int64(14)})

	res, err := Prometheus(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	rel := res.Desired[resource.Name("prometheus")].Resource.Object
	assertField(t, rel, "obs-prom-prom", "spec", "forProvider", "values", "fullnameOverride")
	assertField(t, rel, "14d", "spec", "forProvider", "values", "prometheus", "prometheusSpec", "retention")
	if got := res.Status["endpoint"]; got != "http://obs-prom-prom-prometheus.team-api.svc:9090" {
		t.Errorf("status.endpoint = %v", got)
	}
	if got := string(res.ConnectionDetails["remoteWriteUrl"]); got != "http://obs-prom-prom-prometheus.team-api.svc:9090/api/v1/write" {
		t.Errorf("remoteWriteUrl = %q", got)
	}
}

func TestMimirClaimsObjectBucket(t *testing.T) {
	xr := newXR("MimirInstance", "obs-mimir", "team-api", "team-api")
	setSpec(xr, map[string]any{"team": "team-api", "costCenter": "cc-1"})

	res, err := Mimir(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	ob, ok := res.Desired[resource.Name("bucket")]
	if !ok {
		t.Fatal("expected a child ObjectBucket (mimir must claim the primitive, not inline S3)")
	}
	if got := ob.Resource.GetKind(); got != "ObjectBucket" {
		t.Errorf("child kind = %q, want ObjectBucket", got)
	}
	rel := res.Desired[resource.Name("mimir")].Resource.Object
	assertField(t, rel, "obs-mimir-mimir", "spec", "forProvider", "values", "fullnameOverride")
}

func TestAlloyEndpoint(t *testing.T) {
	xr := newXR("AlloyInstance", "obs-alloy", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x", "remoteWriteEndpoint": "http://prom:9090/api/v1/write"})

	res, err := Alloy(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	rel := res.Desired[resource.Name("alloy")].Resource.Object
	content, _, _ := unstructured.NestedString(rel, "spec", "forProvider", "values", "alloy", "configMap", "content")
	if !strings.Contains(content, "http://prom:9090/api/v1/write") {
		t.Errorf("river config missing remote write endpoint:\n%s", content)
	}
}

func TestValuesEscapeHatchPrecedence(t *testing.T) {
	xr := newXR("PrometheusInstance", "p", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x"})
	// User tries to override retention (platform-wired) and set a custom value.
	_ = unstructured.SetNestedField(xr.Object, "99d", "spec", "values", "prometheus", "prometheusSpec", "retention")
	_ = unstructured.SetNestedField(xr.Object, "team-x/prom", "spec", "values", "prometheus", "prometheusSpec", "image", "repository")

	res, err := Prometheus(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	rel := res.Desired[resource.Name("prometheus")].Resource.Object
	// Platform wiring wins over user values for invariants.
	assertField(t, rel, "3d", "spec", "forProvider", "values", "prometheus", "prometheusSpec", "retention")
	// User values pass through for everything else.
	assertField(t, rel, "team-x/prom", "spec", "forProvider", "values", "prometheus", "prometheusSpec", "image", "repository")
}
