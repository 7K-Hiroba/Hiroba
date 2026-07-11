package handlers

import (
	"fmt"
	"os"

	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composed"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/7k-hiroba/hiroba/functions/platform"
)

const (
	grafanaChartRepo           = "https://grafana.github.io/helm-charts"
	defaultGrafanaChartVersion = "8.5.0"
	defaultLokiChartVersion    = "0.79.0"
)

// chartVersion resolves the Helm chart version for a product Release. Precedence:
// XR spec.chartVersion > environment variable (fleet-wide pin) > compiled default.
func chartVersion(oxr *resource.Composite, envKey, def string) string {
	if v := platform.SpecString(oxr, "chartVersion"); v != "" {
		return v
	}
	if v := os.Getenv(envKey); v != "" {
		return v
	}
	return def
}

// Grafana handles kind=GrafanaInstance. It emits:
//   - a child PostgresInstance XR (owned; hierarchical composition, ADR 007), and
//   - a provider-helm Release installing the official grafana/grafana chart, wired to the
//     child PostgresInstance connection secret for its database.
//
// NOTE: the PostgresInstance connection secret keys are normalized to the platform
// contract (POSTGRES_CONNECTION_KEYS) by the postgres handler; the chart values below
// reference that secret by its deterministic name (<xr>-db-conn). Confirm the GF_*
// mapping once the contract mapping is finalized.
func Grafana(oxr *resource.Composite) (platform.Desired, error) {
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	domain := platform.SpecString(oxr, "domain")
	provider := platform.SpecString(oxr, "provider")
	if provider == "" {
		provider = "cnpg"
	}
	// Map observability providers onto the postgres primitive's vocabulary.
	dbProvider := provider
	if provider == "garage" || provider == "local" {
		dbProvider = "cnpg"
	}

	desired := platform.Desired{}

	// 1. Child PostgresInstance (database for Grafana).
	pg := composed.New()
	pg.SetAPIVersion("platform.yourcompany.io/v1")
	pg.SetKind("PostgresInstance")
	pg.SetName(name + "-db")
	pg.SetNamespace(ns)
	pg.SetLabels(map[string]string{
		"team":                                platform.Team(oxr),
		"platform.yourcompany.io/stack":       "observability",
		"platform.yourcompany.io/consumed-by": name,
	})
	pgSpec := map[string]any{
		"profile":    platform.SpecString(oxr, "profile"),
		"provider":   dbProvider,
		"team":       platform.Team(oxr),
		"costCenter": platform.CostCenter(oxr),
		"database":   "grafana",
	}
	if region := platform.SpecString(oxr, "region"); region != "" {
		_ = unstructured.SetNestedField(pgSpec, region, "region")
	}
	pg.Object["spec"] = pgSpec
	desired[resource.Name(name+"-db")] = &resource.DesiredComposed{Resource: pg}

	// 2. Helm Release for the official Grafana chart.
	connSecret := name + "-db-conn"
	rel := composed.New()
	rel.SetAPIVersion("helm.crossplane.io/v1beta1")
	rel.SetKind("Release")
	rel.SetNamespace(ns)
	rel.SetName(name + "-grafana")
	ro := rel.Object
	_ = unstructured.SetNestedField(ro, "grafana", "spec", "forProvider", "chart", "name")
	_ = unstructured.SetNestedField(ro, grafanaChartRepo, "spec", "forProvider", "chart", "repository")
	_ = unstructured.SetNestedField(ro, chartVersion(oxr, "GRAFANA_CHART_VERSION", defaultGrafanaChartVersion), "spec", "forProvider", "chart", "version")
	_ = unstructured.SetNestedField(ro, ns, "spec", "forProvider", "namespace")
	_ = unstructured.SetNestedField(ro, true, "spec", "forProvider", "wait")
	platform.SetProviderConfigRef(ro, "default") // in-cluster helm provider config

	// Database via env sourced from the PostgresInstance connection secret.
	_ = unstructured.SetNestedField(ro, "postgres", "spec", "forProvider", "values", "grafana.ini", "database", "type")
	_ = unstructured.SetNestedField(ro, "disable", "spec", "forProvider", "values", "grafana.ini", "database", "ssl_mode")
	envFrom := []any{
		map[string]any{"secretRef": map[string]any{"name": connSecret}},
	}
	_ = unstructured.SetNestedField(ro, envFrom, "spec", "forProvider", "values", "extraEnvFrom")

	if domain != "" {
		_ = unstructured.SetNestedField(ro, domain, "spec", "forProvider", "values", "grafana.ini", "server", "root_url")
	}

	desired[resource.Name(name+"-grafana")] = &resource.DesiredComposed{Resource: rel}
	return desired, nil
}

// Loki handles kind=LokiInstance. It emits:
//   - a child ObjectBucket XR (owned; hierarchical composition, ADR 007), and
//   - a provider-helm Release installing the official grafana/loki-distributed chart,
//     wired to the child ObjectBucket connection secret for object storage.
//
// Mirrors the proven Mimir Release shape (structuredConfig + extraEnvFrom). The ObjectBucket
// connection secret keys follow OBJECT_STORAGE_CONNECTION_KEYS; confirm the s3 env-key
// mapping once the contract mapping is finalized.
func Loki(oxr *resource.Composite) (platform.Desired, error) {
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	provider := platform.SpecString(oxr, "provider")
	if provider == "" {
		provider = "garage"
	}
	// Map observability providers onto the object-storage primitive's vocabulary.
	bucketProvider := provider
	switch provider {
	case "aws":
		bucketProvider = "s3"
	case "cnpg":
		bucketProvider = "garage"
	}
	if bucketProvider != "s3" && bucketProvider != "garage" && bucketProvider != "gcs" && bucketProvider != "azureBlob" {
		return nil, fmt.Errorf("provider %q is not supported for Loki storage", provider)
	}

	desired := platform.Desired{}

	// 1. Child ObjectBucket (log storage for Loki).
	ob := composed.New()
	ob.SetAPIVersion("platform.yourcompany.io/v1")
	ob.SetKind("ObjectBucket")
	ob.SetName(name + "-bucket")
	ob.SetNamespace(ns)
	ob.SetLabels(map[string]string{
		"team":                                platform.Team(oxr),
		"platform.yourcompany.io/stack":       "observability",
		"platform.yourcompany.io/consumed-by": name,
	})
	obSpec := map[string]any{
		"profile":    platform.SpecString(oxr, "profile"),
		"provider":   bucketProvider,
		"team":       platform.Team(oxr),
		"costCenter": platform.CostCenter(oxr),
	}
	if region := platform.SpecString(oxr, "region"); region != "" {
		_ = unstructured.SetNestedField(obSpec, region, "region")
	}
	ob.Object["spec"] = obSpec
	desired[resource.Name(name+"-bucket")] = &resource.DesiredComposed{Resource: ob}

	// 2. Helm Release for the official Loki (distributed) chart.
	connSecret := name + "-bucket-conn"
	rel := composed.New()
	rel.SetAPIVersion("helm.crossplane.io/v1beta1")
	rel.SetKind("Release")
	rel.SetNamespace(ns)
	rel.SetName(name + "-loki")
	ro := rel.Object
	_ = unstructured.SetNestedField(ro, "loki-distributed", "spec", "forProvider", "chart", "name")
	_ = unstructured.SetNestedField(ro, grafanaChartRepo, "spec", "forProvider", "chart", "repository")
	_ = unstructured.SetNestedField(ro, chartVersion(oxr, "LOKI_CHART_VERSION", defaultLokiChartVersion), "spec", "forProvider", "chart", "version")
	_ = unstructured.SetNestedField(ro, ns, "spec", "forProvider", "namespace")
	_ = unstructured.SetNestedField(ro, true, "spec", "forProvider", "wait")
	platform.SetProviderConfigRef(ro, "default")

	// Object storage via structuredConfig sourced from the ObjectBucket connection secret.
	_ = unstructured.SetNestedField(ro, "s3", "spec", "forProvider", "values", "loki", "storage", "type")
	_ = unstructured.SetNestedField(ro, "${OBJECT_STORAGE_BUCKET}", "spec", "forProvider", "values", "loki", "storage", "s3", "bucketnames")
	_ = unstructured.SetNestedField(ro, "${OBJECT_STORAGE_ENDPOINT}", "spec", "forProvider", "values", "loki", "storage", "s3", "endpoint")
	_ = unstructured.SetNestedField(ro, "${OBJECT_STORAGE_REGION}", "spec", "forProvider", "values", "loki", "storage", "s3", "region")
	_ = unstructured.SetNestedField(ro, "${OBJECT_STORAGE_ACCESS_KEY_ID}", "spec", "forProvider", "values", "loki", "storage", "s3", "access_key_id")
	_ = unstructured.SetNestedField(ro, "${OBJECT_STORAGE_SECRET_ACCESS_KEY}", "spec", "forProvider", "values", "loki", "storage", "s3", "secret_access_key")
	_ = unstructured.SetNestedField(ro, "boltdb-shipper", "spec", "forProvider", "values", "loki", "schemaConfig", "configs", "store")
	envFrom := []any{map[string]any{"secretRef": map[string]any{"name": connSecret}}}
	_ = unstructured.SetNestedField(ro, envFrom, "spec", "forProvider", "values", "extraEnvFrom")

	desired[resource.Name(name+"-loki")] = &resource.DesiredComposed{Resource: rel}
	return desired, nil
}
