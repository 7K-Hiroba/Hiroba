package handlers

import (
	"testing"

	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composed"
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
	assertField(t, obj, "postgres", "spec", "forProvider", "engine")
	assertField(t, obj, "eu-west-1", "spec", "forProvider", "region")
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
	setSpec(xr, map[string]any{"team": "team-x"})

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
	setSpec(xr, map[string]any{"profile": "development", "team": "team-x"})

	res, err := Postgres(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	dc := res.Desired[resource.Name("pg")]
	if got := dc.Resource.GetKind(); got != "Cluster" {
		t.Fatalf("default provider want CNPG Cluster, got %s", got)
	}
	for _, key := range []string{"host", "port", "username", "database"} {
		if _, ok := res.ConnectionDetails[key]; !ok {
			t.Errorf("CNPG connection details missing %q", key)
		}
	}
	if got := string(res.ConnectionDetails["host"]); got != "db-pg-rw.ns.svc" {
		t.Errorf("host = %q, want db-pg-rw.ns.svc", got)
	}
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
	xr := newXR("ObjectBucket", "logs", "ns", "team-x")
	setSpec(xr, map[string]any{"team": "team-x"})
	res, err := ObjectBucket(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	byKind := composedByKind(res)
	if _, ok := byKind["GarageBucket"]; !ok {
		t.Fatal("expected a GarageBucket")
	}
	if _, ok := byKind["GarageKey"]; !ok {
		t.Fatal("expected a GarageKey")
	}
	if got := string(res.ConnectionDetails["bucket"]); got != "logs" {
		t.Errorf("bucket = %q, want logs (XR name)", got)
	}
	assertField(t, byKind["GarageBucket"], "default", "spec", "clusterRef", "name")
	assertField(t, byKind["GarageBucket"], "garage", "spec", "clusterRef", "namespace")
	if got := res.Status["endpoint"]; got != "http://default.garage.svc:3900" {
		t.Errorf("status.endpoint = %v", got)
	}
	creds, _, _ := unstructured.NestedString(byKind["GarageKey"], "spec", "secretTemplate", "name")
	if creds != "logs-creds" {
		t.Errorf("garage key secretTemplate.name = %q, want logs-creds", creds)
	}
}

func TestObjectBucketGarageClusterRef(t *testing.T) {
	xr := newXR("ObjectBucket", "logs", "ns", "team-x")
	setSpec(xr, map[string]any{
		"team":       "team-x",
		"clusterRef": map[string]any{"name": "storage", "namespace": "platform"},
	})
	res, err := ObjectBucket(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	byKind := composedByKind(res)
	assertField(t, byKind["GarageBucket"], "storage", "spec", "clusterRef", "name")
	assertField(t, byKind["GarageBucket"], "platform", "spec", "clusterRef", "namespace")
	if got := res.Status["endpoint"]; got != "http://storage.platform.svc:3900" {
		t.Errorf("status.endpoint = %v", got)
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
	if got := dc.Resource.GetKind(); got != "Bucket" {
		t.Fatalf("want S3 Bucket, got %s", got)
	}
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
	creds, _, _ := unstructured.NestedString(res.Status["credentialsSecretRef"].(map[string]any), "name")
	if creds != "team-api-s3-credentials" {
		t.Errorf("credentialsSecretRef.name = %q, want team-api-s3-credentials", creds)
	}
}

func TestPostgresCNPGReadinessFromObservedPhase(t *testing.T) {
	xr := newXR("PostgresInstance", "db", "ns", "team-x")
	setSpec(xr, map[string]any{"provider": "cnpg", "team": "team-x"})

	cluster := composed.New()
	cluster.SetAPIVersion("postgresql.cnpg.io/v1")
	cluster.SetKind("Cluster")
	_ = unstructured.SetNestedField(cluster.Object, "Cluster in healthy state", "status", "phase")

	observed := map[resource.Name]resource.ObservedComposed{
		resource.Name("pg"): {Resource: cluster},
	}
	res, err := Postgres(newHandlerContext(xr, observed))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Desired[resource.Name("pg")].Ready != resource.ReadyTrue {
		t.Errorf("pg desired readiness = %v, want ReadyTrue", res.Desired[resource.Name("pg")].Ready)
	}
	if got := res.Status["phase"]; got != "Ready" {
		t.Errorf("status.phase = %v, want Ready", got)
	}
	if got := res.Status["connectionSecretRef"].(map[string]any)["name"]; got != "db-pg-app" {
		t.Errorf("connectionSecretRef.name = %v, want db-pg-app (CNPG operator secret)", got)
	}
}

func TestPostgresCNPGNotReadyWhenObservedMissing(t *testing.T) {
	xr := newXR("PostgresInstance", "db", "ns", "team-x")
	setSpec(xr, map[string]any{"provider": "cnpg", "team": "team-x"})

	res, err := Postgres(newHandlerContext(xr, nil))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Desired[resource.Name("pg")].Ready != resource.ReadyFalse {
		t.Errorf("pg desired readiness = %v, want ReadyFalse", res.Desired[resource.Name("pg")].Ready)
	}
	if got := res.Status["phase"]; got != "Provisioning" {
		t.Errorf("status.phase = %v, want Provisioning", got)
	}
}
