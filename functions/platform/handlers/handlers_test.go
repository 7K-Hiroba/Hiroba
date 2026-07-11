package handlers

import (
	"testing"

	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composite"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/7k-hiroba/hiroba/functions/platform"
)

func toComposite(xr *composite.Unstructured) *resource.Composite {
	return &resource.Composite{Resource: xr}
}

func newXR(kind, name, ns, team string) *composite.Unstructured {
	xr := composite.New()
	xr.SetAPIVersion("platform.yourcompany.io/v1")
	xr.SetKind(kind)
	xr.SetName(name)
	xr.SetNamespace(ns)
	xr.SetLabels(map[string]string{"team": team, "cost-center": "cc-123"})
	return xr
}

func setSpec(xr *composite.Unstructured, kvs map[string]any) {
	for k, v := range kvs {
		_ = unstructured.SetNestedField(xr.Object, v, "spec", k)
	}
}

func TestPostgresAWSProviderConfigConvention(t *testing.T) {
	xr := newXR("PostgresInstance", "checkout-db", "team-api", "team-api")
	setSpec(xr, map[string]any{"provider": "aws", "profile": "production", "region": "eu-west-1"})

	desired, err := Postgres(toComposite(xr))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(desired) != 1 {
		t.Fatalf("want 1 composed resource, got %d", len(desired))
	}
	var obj map[string]any
	var apiVersion, ns string
	for _, dc := range desired {
		obj = dc.Resource.Object
		apiVersion = dc.Resource.GetAPIVersion()
		ns = dc.Resource.GetNamespace()
	}
	if apiVersion != "rds.aws.m.upbound.io/v1beta1" {
		t.Errorf("apiVersion = %q, want namespaced rds.aws.m.upbound.io/v1beta1", apiVersion)
	}
	if ns != "team-api" {
		t.Errorf("MR namespace = %q, want XR namespace %q", ns, "team-api")
	}
	assertField(t, obj, "team-api-aws", "spec", "providerConfigRef", "name")
	assertField(t, obj, "ProviderConfig", "spec", "providerConfigRef", "kind")
	assertField(t, obj, "postgres", "spec", "forProvider", "engine")
	assertField(t, obj, "eu-west-1", "spec", "forProvider", "region")
	assertField(t, obj, "db.t3.medium", "spec", "forProvider", "instanceClass")
}

func TestPostgresExplicitProviderConfigWins(t *testing.T) {
	xr := newXR("PostgresInstance", "db", "ns", "team-x")
	setSpec(xr, map[string]any{"provider": "aws"})
	_ = unstructured.SetNestedField(xr.Object, "custom-aws", "spec", "providerConfigRef", "name")

	desired, err := Postgres(toComposite(xr))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, dc := range desired {
		assertField(t, dc.Resource.Object, "custom-aws", "spec", "providerConfigRef", "name")
	}
}

func TestPostgresDefaultProviderIsCNPG(t *testing.T) {
	xr := newXR("PostgresInstance", "db", "ns", "team-x")
	setSpec(xr, map[string]any{"profile": "development"}) // no provider

	desired, err := Postgres(toComposite(xr))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, dc := range desired {
		if got := dc.Resource.GetKind(); got != "Cluster" {
			t.Fatalf("default provider want CNPG Cluster, got %s", got)
		}
	}
}

func TestPostgresUnknownProviderErrors(t *testing.T) {
	xr := newXR("PostgresInstance", "db", "ns", "team-x")
	setSpec(xr, map[string]any{"provider": "azure"})
	if _, err := Postgres(toComposite(xr)); err == nil {
		t.Fatal("expected error for unimplemented provider")
	}
}

func TestObjectBucketDefaultIsGarage(t *testing.T) {
	xr := newXR("ObjectBucket", "logs", "ns", "team-x") // no provider
	desired, err := ObjectBucket(toComposite(xr))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, dc := range desired {
		if got := dc.Resource.GetKind(); got != "GarageBucket" {
			t.Fatalf("default provider want GarageBucket, got %s", got)
		}
	}
}

func TestObjectBucketS3(t *testing.T) {
	xr := newXR("ObjectBucket", "assets", "team-api", "team-api")
	setSpec(xr, map[string]any{"provider": "s3", "region": "us-east-1"})
	desired, err := ObjectBucket(toComposite(xr))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, dc := range desired {
		if got := dc.Resource.GetAPIVersion(); got != "s3.aws.m.upbound.io/v1beta1" {
			t.Errorf("apiVersion = %q, want namespaced s3.aws.m.upbound.io/v1beta1", got)
		}
		if got := dc.Resource.GetNamespace(); got != "team-api" {
			t.Errorf("MR namespace = %q, want XR namespace %q", got, "team-api")
		}
		assertField(t, dc.Resource.Object, "team-api-s3", "spec", "providerConfigRef", "name")
		assertField(t, dc.Resource.Object, "ProviderConfig", "spec", "providerConfigRef", "kind")
		if got := dc.Resource.GetKind(); got != "Bucket" {
			t.Fatalf("want S3 Bucket, got %s", got)
		}
	}
}

func assertField(t *testing.T, obj map[string]any, want string, path ...string) {
	t.Helper()
	got, _, err := unstructured.NestedString(obj, path...)
	if err != nil {
		t.Fatalf("field %v: %v", path, err)
	}
	if got != want {
		t.Errorf("field %v = %q, want %q", path, got, want)
	}
}

func kindsOf(d platform.Desired) map[string]map[string]any {
	out := map[string]map[string]any{}
	for _, dc := range d {
		out[dc.Resource.GetKind()] = dc.Resource.Object
	}
	return out
}

func firstEnvFromSecret(t *testing.T, obj map[string]any) string {
	t.Helper()
	sl, found, err := unstructured.NestedSlice(obj, "spec", "forProvider", "values", "extraEnvFrom")
	if err != nil || !found || len(sl) == 0 {
		t.Fatalf("extraEnvFrom missing/empty (err=%v found=%v len=%d)", err, found, len(sl))
	}
	first, _ := sl[0].(map[string]any)
	name, _, _ := unstructured.NestedString(first, "secretRef", "name")
	return name
}

func TestGrafanaEmitsPostgresAndRelease(t *testing.T) {
	xr := newXR("GrafanaInstance", "obs", "team-api", "team-api")
	setSpec(xr, map[string]any{"provider": "aws", "profile": "production", "domain": "grafana.example.com"})

	desired, err := Grafana(toComposite(xr))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(desired) != 2 {
		t.Fatalf("want 2 composed resources (PostgresInstance + Release), got %d", len(desired))
	}
	byKind := kindsOf(desired)
	if _, ok := byKind["PostgresInstance"]; !ok {
		t.Fatal("expected a child PostgresInstance")
	}
	rel, ok := byKind["Release"]
	if !ok {
		t.Fatal("expected a helm Release")
	}
	if got, _, _ := unstructured.NestedString(rel, "spec", "forProvider", "chart", "name"); got != "grafana" {
		t.Errorf("chart = %q, want grafana", got)
	}
	// Wired to the child PostgresInstance connection secret.
	if got := firstEnvFromSecret(t, rel); got != "obs-db-conn" {
		t.Errorf("extraEnvFrom secretRef = %q, want obs-db-conn", got)
	}
}

func TestGrafanaDefaultDBProviderIsCNPG(t *testing.T) {
	xr := newXR("GrafanaInstance", "obs", "ns", "team-x") // no provider
	desired, err := Grafana(toComposite(xr))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, dc := range desired {
		if dc.Resource.GetKind() == "PostgresInstance" {
			assertField(t, dc.Resource.Object, "cnpg", "spec", "provider")
			return
		}
	}
	t.Fatal("no child PostgresInstance found")
}

func TestLokiEmitsBucketAndRelease(t *testing.T) {
	xr := newXR("LokiInstance", "logs", "team-api", "team-api")
	setSpec(xr, map[string]any{"provider": "garage", "profile": "production"})

	desired, err := Loki(toComposite(xr))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(desired) != 2 {
		t.Fatalf("want 2 composed resources (ObjectBucket + Release), got %d", len(desired))
	}
	byKind := kindsOf(desired)
	if _, ok := byKind["ObjectBucket"]; !ok {
		t.Fatal("expected a child ObjectBucket")
	}
	rel, ok := byKind["Release"]
	if !ok {
		t.Fatal("expected a helm Release")
	}
	if got, _, _ := unstructured.NestedString(rel, "spec", "forProvider", "chart", "name"); got != "loki-distributed" {
		t.Errorf("chart = %q, want loki-distributed", got)
	}
	if got := firstEnvFromSecret(t, rel); got != "logs-bucket-conn" {
		t.Errorf("extraEnvFrom secretRef = %q, want logs-bucket-conn", got)
	}
}

func TestLokiAWSMapsToS3(t *testing.T) {
	xr := newXR("LokiInstance", "logs", "ns", "team-x")
	setSpec(xr, map[string]any{"provider": "aws"})
	desired, err := Loki(toComposite(xr))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, dc := range desired {
		if dc.Resource.GetKind() == "ObjectBucket" {
			assertField(t, dc.Resource.Object, "s3", "spec", "provider")
			return
		}
	}
	t.Fatal("no child ObjectBucket found")
}

func grafanaReleaseVersion(t *testing.T, d platform.Desired) string {
	t.Helper()
	rel, ok := kindsOf(d)["Release"]
	if !ok {
		t.Fatal("no Release composed")
	}
	v, _, _ := unstructured.NestedString(rel, "spec", "forProvider", "chart", "version")
	return v
}

func lokiReleaseVersion(t *testing.T, d platform.Desired) string {
	t.Helper()
	return grafanaReleaseVersion(t, d)
}

func TestGrafanaChartVersionSpecOverridesEnv(t *testing.T) {
	t.Setenv("GRAFANA_CHART_VERSION", "8.4.0")
	xr := newXR("GrafanaInstance", "obs", "ns", "team-x")
	setSpec(xr, map[string]any{"chartVersion": "9.1.0"})
	desired, err := Grafana(toComposite(xr))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := grafanaReleaseVersion(t, desired); got != "9.1.0" {
		t.Errorf("chart version = %q, want spec override 9.1.0", got)
	}
}

func TestGrafanaChartVersionEnvOverridesDefault(t *testing.T) {
	t.Setenv("GRAFANA_CHART_VERSION", "8.4.7")
	xr := newXR("GrafanaInstance", "obs", "ns", "team-x") // no spec.chartVersion
	desired, err := Grafana(toComposite(xr))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := grafanaReleaseVersion(t, desired); got != "8.4.7" {
		t.Errorf("chart version = %q, want env override 8.4.7", got)
	}
}

func TestLokiChartVersionDefault(t *testing.T) {
	t.Setenv("LOKI_CHART_VERSION", "")
	xr := newXR("LokiInstance", "logs", "ns", "team-x") // no spec.chartVersion, no env
	desired, err := Loki(toComposite(xr))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := lokiReleaseVersion(t, desired); got != "0.79.0" {
		t.Errorf("chart version = %q, want default 0.79.0", got)
	}
}
