package handlers

import (
	"testing"

	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composite"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/7k-hiroba/hiroba/functions/platform"
	"github.com/7k-hiroba/hiroba/functions/platform/internal/contract"
)

func newHandlerContext(xr *composite.Unstructured, observed map[resource.Name]resource.ObservedComposed) *platform.HandlerContext {
	return &platform.HandlerContext{
		OXR:      &resource.Composite{Resource: xr},
		Observed: observed,
	}
}

func newXR(kind, name, ns, team string) *composite.Unstructured {
	xr := composite.New()
	xr.SetAPIVersion(contract.APIGroupVersion)
	xr.SetKind(kind)
	xr.SetName(name)
	xr.SetNamespace(ns)
	return xr
}

func setSpec(xr *composite.Unstructured, kvs map[string]any) {
	for k, v := range kvs {
		_ = unstructured.SetNestedField(xr.Object, v, "spec", k)
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

func composedByKind(res *platform.Result) map[string]map[string]any {
	out := map[string]map[string]any{}
	for _, dc := range res.Desired {
		out[dc.Resource.GetKind()] = dc.Resource.Object
	}
	return out
}

func TestPostgresAWSProviderConfigConvention(t *testing.T) {
	xr := newXR("PostgresInstance", "checkout-db", "team-api", "team-api")
	setSpec(xr, map[string]any{"provider": "aws", "profile": "production", "region": "eu-west-1", "team": "team-api"})

	res, err := Postgres(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res.Desired) != 1 {
		t.Fatalf("want 1 composed resource, got %d", len(res.Desired))
	}
	dc := res.Desired[resource.Name("pg")]
	if dc == nil {
		t.Fatal("missing composed resource keyed 'pg'")
	}
	obj := dc.Resource.Object
	if got := dc.Resource.GetAPIVersion(); got != "rds.aws.m.upbound.io/v1beta1" {
		t.Errorf("apiVersion = %q, want namespaced rds.aws.m.upbound.io/v1beta1", got)
	}
	if got := dc.Resource.GetNamespace(); got != "team-api" {
		t.Errorf("MR namespace = %q, want XR namespace %q", got, "team-api")
	}
	if got := dc.Resource.GetName(); got != "checkout-db-pg" {
		t.Errorf("MR name = %q, want deterministic checkout-db-pg", got)
	}
	assertField(t, obj, "team-api-aws", "spec", "providerConfigRef", "name")
	assertField(t, obj, "ProviderConfig", "spec", "providerConfigRef", "kind")
	assertField(t, obj, "postgres", "spec", "forProvider", "engine")
	assertField(t, obj, "eu-west-1", "spec", "forProvider", "region")
	// Contract profile defaults: production = db.r6g.xlarge, multiAZ, 30-day backups, Orphan.
	assertField(t, obj, "db.r6g.xlarge", "spec", "forProvider", "instanceClass")
	assertField(t, obj, "Orphan", "spec", "deletionPolicy")
}

func TestPostgresHonorsSpecOverrides(t *testing.T) {
	xr := newXR("PostgresInstance", "db", "ns", "team-x")
	setSpec(xr, map[string]any{
		"provider": "aws", "profile": "development", "team": "team-x",
		"storageGB": int64(100), "version": "16", "database": "shop",
		"instanceClass": "db.t3.large",
	})

	res, err := Postgres(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	obj := res.Desired[resource.Name("pg")].Resource.Object
	storage, _, _ := unstructured.NestedInt64(obj, "spec", "forProvider", "allocatedStorage")
	if storage != 100 {
		t.Errorf("allocatedStorage = %d, want 100 (spec.storageGB honored)", storage)
	}
	assertField(t, obj, "16", "spec", "forProvider", "engineVersion")
	assertField(t, obj, "shop", "spec", "forProvider", "dbName")
	assertField(t, obj, "db.t3.large", "spec", "forProvider", "instanceClass")
	// development profile -> Delete
	assertField(t, obj, "Delete", "spec", "deletionPolicy")
}

func TestPostgresExplicitProviderConfigWins(t *testing.T) {
	xr := newXR("PostgresInstance", "db", "ns", "team-x")
	setSpec(xr, map[string]any{"provider": "aws", "team": "team-x"})
	_ = unstructured.SetNestedField(xr.Object, "custom-aws", "spec", "providerConfigRef", "name")

	res, err := Postgres(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	assertField(t, res.Desired[resource.Name("pg")].Resource.Object, "custom-aws", "spec", "providerConfigRef", "name")
}

func TestPostgresConnectionDetailsMappedFromObserved(t *testing.T) {
	xr := newXR("PostgresInstance", "db", "ns", "team-x")
	setSpec(xr, map[string]any{"provider": "aws", "team": "team-x", "database": "shop"})

	observed := map[resource.Name]resource.ObservedComposed{
		resource.Name("pg"): {
			ConnectionDetails: resource.ConnectionDetails{
				"endpoint": []byte("db.abc.rds.amazonaws.com"),
				"port":     []byte("5432"),
				"username": []byte("dbadmin"),
				"password": []byte("s3cret"),
			},
		},
	}
	res, err := Postgres(newHandlerContext(xr, observed))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	cd := res.ConnectionDetails
	// Contract keys normalized from provider-native keys.
	for _, key := range contract.PostgresConnectionKeys {
		if _, ok := cd[key]; !ok {
			t.Errorf("connection details missing contract key %q", key)
		}
	}
	if got := string(cd["host"]); got != "db.abc.rds.amazonaws.com" {
		t.Errorf("host = %q, want mapped from endpoint", got)
	}
	if got := string(cd["database"]); got != "shop" {
		t.Errorf("database = %q, want shop", got)
	}
	wantURI := "postgresql://dbadmin:s3cret@db.abc.rds.amazonaws.com:5432/shop"
	if got := string(cd["uri"]); got != wantURI {
		t.Errorf("uri = %q, want %q", got, wantURI)
	}
	if got := res.Status["endpoint"]; got != "db.abc.rds.amazonaws.com:5432" {
		t.Errorf("status.endpoint = %v", got)
	}
	if got := res.Status["phase"]; got != "Ready" {
		t.Errorf("status.phase = %v, want Ready", got)
	}
}

func TestPostgresConfigDefaultProviderOverridesContract(t *testing.T) {
	xr := newXR("PostgresInstance", "db", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x"}) // no spec.provider

	hc := newHandlerContext(xr, nil)
	hc.Config = platform.Config{DefaultProviders: map[string]string{"postgres": "aws"}}

	res, err := Postgres(hc)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := res.Desired[resource.Name("pg")].Resource.GetKind(); got != "Instance" {
		t.Errorf("config default aws want RDS Instance, got %s", got)
	}
}

func TestPostgresDefaultProviderIsCNPG(t *testing.T) {
	xr := newXR("PostgresInstance", "db", "ns", "team-x")
	setSpec(xr, map[string]any{"profile": "development", "team": "team-x"}) // no provider

	res, err := Postgres(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	dc := res.Desired[resource.Name("pg")]
	if got := dc.Resource.GetKind(); got != "Cluster" {
		t.Fatalf("default provider want CNPG Cluster, got %s", got)
	}
	// Static contract keys available immediately.
	for _, key := range []string{"host", "port", "username", "database"} {
		if _, ok := res.ConnectionDetails[key]; !ok {
			t.Errorf("CNPG connection details missing %q", key)
		}
	}
	if got := string(res.ConnectionDetails["host"]); got != "db-pg-rw.ns.svc" {
		t.Errorf("host = %q, want db-pg-rw.ns.svc", got)
	}
	// Storage honored: default 20Gi.
	assertField(t, dc.Resource.Object, "20Gi", "spec", "storage", "size")
}

func TestPostgresCNPGStorageAndHA(t *testing.T) {
	xr := newXR("PostgresInstance", "db", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x", "storageGB": int64(50)})
	_ = unstructured.SetNestedField(xr.Object, true, "spec", "features", "ha", "enabled")

	res, err := Postgres(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	obj := res.Desired[resource.Name("pg")].Resource.Object
	assertField(t, obj, "50Gi", "spec", "storage", "size")
	instances, _, _ := unstructured.NestedInt64(obj, "spec", "instances")
	if instances != 3 {
		t.Errorf("instances = %d, want 3 with ha enabled", instances)
	}
}

func TestPostgresUnknownProviderErrors(t *testing.T) {
	xr := newXR("PostgresInstance", "db", "ns", "team-x")
	setSpec(xr, map[string]any{"provider": "azure", "team": "team-x"})
	if _, err := Postgres(newHandlerContext(xr, nil)); err == nil {
		t.Fatal("expected error for unimplemented provider")
	}
}

func TestObjectBucketDefaultIsGarage(t *testing.T) {
	xr := newXR("ObjectBucket", "logs", "ns", "team-x") // no provider
	setSpec(xr, map[string]any{"team": "team-x"})
	res, err := ObjectBucket(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := res.Desired[resource.Name("bucket")].Resource.GetKind(); got != "GarageBucket" {
		t.Fatalf("default provider want GarageBucket, got %s", got)
	}
	if got := string(res.ConnectionDetails["bucket"]); got != "logs" {
		t.Errorf("bucket = %q, want logs (XR name)", got)
	}
}

func TestObjectBucketS3(t *testing.T) {
	xr := newXR("ObjectBucket", "assets", "team-api", "team-api")
	setSpec(xr, map[string]any{"provider": "s3", "region": "us-east-1", "team": "team-api", "bucket": "my-assets"})
	res, err := ObjectBucket(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	dc := res.Desired[resource.Name("bucket")]
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
	// Static contract keys.
	cd := res.ConnectionDetails
	if got := string(cd["bucket"]); got != "my-assets" {
		t.Errorf("bucket = %q, want my-assets", got)
	}
	if got := string(cd["uri"]); got != "s3://my-assets" {
		t.Errorf("uri = %q, want s3://my-assets", got)
	}
	if got := string(cd["endpoint"]); got != "https://s3.us-east-1.amazonaws.com" {
		t.Errorf("endpoint = %q", got)
	}
}

func TestGrafanaEmitsPostgresAndRelease(t *testing.T) {
	xr := newXR("GrafanaInstance", "obs", "team-api", "team-api")
	setSpec(xr, map[string]any{"profile": "production", "team": "team-api", "domain": "grafana.example.com"})

	res, err := Grafana(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res.Desired) != 2 {
		t.Fatalf("want 2 composed resources (PostgresInstance + Release), got %d", len(res.Desired))
	}
	byKind := composedByKind(res)
	pg, ok := byKind["PostgresInstance"]
	if !ok {
		t.Fatal("expected a child PostgresInstance")
	}
	if got, _, _ := unstructured.NestedString(pg, "apiVersion"); got != "" {
		_ = got
	}
	rel, ok := byKind["Release"]
	if !ok {
		t.Fatal("expected a helm Release")
	}
	if got, _, _ := unstructured.NestedString(rel, "spec", "forProvider", "chart", "name"); got != "grafana" {
		t.Errorf("chart = %q, want grafana", got)
	}
	// Password wired from the child connection secret.
	secretName, _, _ := unstructured.NestedString(rel,
		"spec", "forProvider", "values", "envValueFrom", "GF_DATABASE_PASSWORD", "secretKeyRef", "name")
	if secretName != "obs-db-conn" {
		t.Errorf("GF_DATABASE_PASSWORD secretRef = %q, want obs-db-conn", secretName)
	}
}

func TestGrafanaInjectsObservedDBDetails(t *testing.T) {
	xr := newXR("GrafanaInstance", "obs", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x"})
	observed := map[resource.Name]resource.ObservedComposed{
		resource.Name("db"): {
			ConnectionDetails: resource.ConnectionDetails{
				"host":     []byte("obs-pg-rw.ns.svc"),
				"port":     []byte("5432"),
				"database": []byte("grafana"),
				"username": []byte("app"),
			},
		},
	}
	res, err := Grafana(newHandlerContext(xr, observed))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	rel := composedByKind(res)["Release"]
	assertField(t, rel, "obs-pg-rw.ns.svc:5432", "spec", "forProvider", "values", "grafana.ini", "database", "host")
	assertField(t, rel, "grafana", "spec", "forProvider", "values", "grafana.ini", "database", "name")
	assertField(t, rel, "app", "spec", "forProvider", "values", "grafana.ini", "database", "user")
}

func TestGrafanaDBProviderOverride(t *testing.T) {
	xr := newXR("GrafanaInstance", "obs", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x", "dbProvider": "aws"})
	res, err := Grafana(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	pg := composedByKind(res)["PostgresInstance"]
	assertField(t, pg, "aws", "spec", "provider")
}

func TestLokiEmitsBucketAndRelease(t *testing.T) {
	xr := newXR("LokiInstance", "logs", "team-api", "team-api")
	setSpec(xr, map[string]any{"profile": "production", "team": "team-api"})

	res, err := Loki(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res.Desired) != 2 {
		t.Fatalf("want 2 composed resources (ObjectBucket + Release), got %d", len(res.Desired))
	}
	byKind := composedByKind(res)
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
	// Credentials env wired from the child connection secret with contract keys.
	keyID, _, _ := unstructured.NestedString(rel,
		"spec", "forProvider", "values", "extraEnv", "0", "valueFrom", "secretKeyRef", "key")
	_ = keyID
	env, _, _ := unstructured.NestedSlice(rel, "spec", "forProvider", "values", "extraEnv")
	if len(env) != 2 {
		t.Fatalf("want 2 extraEnv entries, got %d", len(env))
	}
	first, _ := env[0].(map[string]any)
	key, _, _ := unstructured.NestedString(first, "valueFrom", "secretKeyRef", "key")
	if key != "accessKeyId" {
		t.Errorf("first extraEnv key = %q, want accessKeyId (contract key)", key)
	}
	secretName, _, _ := unstructured.NestedString(first, "valueFrom", "secretKeyRef", "name")
	if secretName != "logs-bucket-conn" {
		t.Errorf("secretRef name = %q, want logs-bucket-conn", secretName)
	}
}

func TestLokiInjectsObservedBucketDetails(t *testing.T) {
	xr := newXR("LokiInstance", "logs", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x"})
	observed := map[resource.Name]resource.ObservedComposed{
		resource.Name("bucket"): {
			ConnectionDetails: resource.ConnectionDetails{
				"bucket":   []byte("logs-bucket"),
				"endpoint": []byte("https://s3.us-east-1.amazonaws.com"),
				"region":   []byte("us-east-1"),
			},
		},
	}
	res, err := Loki(newHandlerContext(xr, observed))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	rel := composedByKind(res)["Release"]
	assertField(t, rel, "logs-bucket", "spec", "forProvider", "values", "loki", "storage", "s3", "bucketnames")
	assertField(t, rel, "https://s3.us-east-1.amazonaws.com", "spec", "forProvider", "values", "loki", "storage", "s3", "endpoint")
	assertField(t, rel, "us-east-1", "spec", "forProvider", "values", "loki", "storage", "s3", "region")
}

func TestLokiBucketProviderOverride(t *testing.T) {
	xr := newXR("LokiInstance", "logs", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x", "bucketProvider": "s3"})
	res, err := Loki(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	ob := composedByKind(res)["ObjectBucket"]
	assertField(t, ob, "s3", "spec", "provider")
}

func releaseChartVersion(t *testing.T, res *platform.Result) string {
	t.Helper()
	rel, ok := composedByKind(res)["Release"]
	if !ok {
		t.Fatal("no Release composed")
	}
	v, _, _ := unstructured.NestedString(rel, "spec", "forProvider", "chart", "version")
	return v
}

func TestGrafanaChartVersionSpecOverridesEnv(t *testing.T) {
	t.Setenv("GRAFANA_CHART_VERSION", "8.4.0")
	xr := newXR("GrafanaInstance", "obs", "ns", "team-x")
	setSpec(xr, map[string]any{"chartVersion": "9.1.0", "team": "team-x"})
	res, err := Grafana(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := releaseChartVersion(t, res); got != "9.1.0" {
		t.Errorf("chart version = %q, want spec override 9.1.0", got)
	}
}

func TestGrafanaChartVersionEnvOverridesDefault(t *testing.T) {
	t.Setenv("GRAFANA_CHART_VERSION", "8.4.7")
	xr := newXR("GrafanaInstance", "obs", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x"}) // no spec.chartVersion
	res, err := Grafana(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := releaseChartVersion(t, res); got != "8.4.7" {
		t.Errorf("chart version = %q, want env override 8.4.7", got)
	}
}

func TestLokiChartVersionDefault(t *testing.T) {
	t.Setenv("LOKI_CHART_VERSION", "")
	xr := newXR("LokiInstance", "logs", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x"}) // no spec.chartVersion, no env
	res, err := Loki(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := releaseChartVersion(t, res); got != "0.79.0" {
		t.Errorf("chart version = %q, want default 0.79.0", got)
	}
}
