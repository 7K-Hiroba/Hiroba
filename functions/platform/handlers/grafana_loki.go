package handlers

import (
	"fmt"
	"os"

	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composed"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/7k-hiroba/hiroba/functions/platform"
	"github.com/7k-hiroba/hiroba/functions/platform/internal/contract"
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

// stackLabels labels a child primitive XR as part of the observability stack.
func stackLabels(oxr *resource.Composite, consumedBy string) map[string]string {
	return map[string]string{
		"team":                             platform.Team(oxr),
		"platform.7kgroup.org/stack":       "observability",
		"platform.7kgroup.org/consumed-by": consumedBy,
	}
}

// childConnectionDetails returns the resolved connection details of a child
// primitive XR (composed resource), or nil when not yet available.
func childConnectionDetails(hc *platform.HandlerContext, name resource.Name) resource.ConnectionDetails {
	obs, ok := hc.Observed[name]
	if !ok {
		return nil
	}
	return obs.ConnectionDetails
}

// Grafana handles kind=GrafanaInstance. It emits:
//   - a child PostgresInstance XR (owned; hierarchical composition, ADR 007), and
//   - a provider-helm Release installing the official grafana/grafana chart, wired to
//     the child PostgresInstance connection details for its database.
//
// Non-secret database settings (host/port/name/user) are injected into the chart
// values from the child XR's resolved connection details; the password is sourced at
// pod runtime via envValueFrom from the child's connection secret (<child>-conn).
func Grafana(hc *platform.HandlerContext) (*platform.Result, error) {
	oxr := hc.OXR
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	domain := platform.SpecString(oxr, "domain")

	desired := platform.Desired{}

	// 1. Child PostgresInstance (database for Grafana). The child's provider comes
	// from the platform/contract default unless overridden via spec.dbProvider.
	pg := composed.New()
	pg.SetAPIVersion(contract.APIGroupVersion)
	pg.SetKind("PostgresInstance")
	pg.SetName(name + "-db")
	pg.SetNamespace(ns)
	pg.SetLabels(stackLabels(oxr, name))
	pgSpec := map[string]any{
		"profile":    platform.Profile(oxr),
		"team":       platform.Team(oxr),
		"costCenter": platform.CostCenter(oxr),
		"database":   "grafana",
	}
	if p := platform.SpecString(oxr, "dbProvider"); p != "" {
		_ = unstructured.SetNestedField(pgSpec, p, "provider")
	}
	if region := platform.SpecString(oxr, "region"); region != "" {
		_ = unstructured.SetNestedField(pgSpec, region, "region")
	}
	pg.Object["spec"] = pgSpec
	desired[resource.Name("db")] = &resource.DesiredComposed{Resource: pg}

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

	_ = unstructured.SetNestedField(ro, "postgres", "spec", "forProvider", "values", "grafana.ini", "database", "type")
	_ = unstructured.SetNestedField(ro, "disable", "spec", "forProvider", "values", "grafana.ini", "database", "ssl_mode")

	// Password is always sourced from the child connection secret at runtime.
	envValueFrom := map[string]any{
		"GF_DATABASE_PASSWORD": map[string]any{
			"secretKeyRef": map[string]any{"name": connSecret, "key": "password"},
		},
	}

	res := &platform.Result{Desired: desired}

	// Inject non-secret database settings once the child publishes them.
	if cd := childConnectionDetails(hc, resource.Name("db")); len(cd) > 0 {
		host := string(cd["host"])
		port := string(cd["port"])
		database := string(cd["database"])
		user := string(cd["username"])
		if host != "" {
			if port != "" {
				host = fmt.Sprintf("%s:%s", host, port)
			}
			_ = unstructured.SetNestedField(ro, host, "spec", "forProvider", "values", "grafana.ini", "database", "host")
		}
		if database != "" {
			_ = unstructured.SetNestedField(ro, database, "spec", "forProvider", "values", "grafana.ini", "database", "name")
		}
		if user != "" {
			_ = unstructured.SetNestedField(ro, user, "spec", "forProvider", "values", "grafana.ini", "database", "user")
		}
	} else {
		res.Warnings = append(res.Warnings, "database connection details not yet available from child PostgresInstance; Release will be updated when ready")
	}
	_ = unstructured.SetNestedField(ro, envValueFrom, "spec", "forProvider", "values", "envValueFrom")

	if domain != "" {
		_ = unstructured.SetNestedField(ro, domain, "spec", "forProvider", "values", "grafana.ini", "server", "root_url")
	}

	desired[resource.Name("grafana")] = &resource.DesiredComposed{Resource: rel}
	res.Status = map[string]any{"phase": "Provisioning"}
	return res, nil
}

// Loki handles kind=LokiInstance. It emits:
//   - a child ObjectBucket XR (owned; hierarchical composition, ADR 007), and
//   - a provider-helm Release installing the official grafana/loki-distributed chart,
//     wired to the child ObjectBucket connection details for object storage.
//
// Non-secret storage settings (bucket/endpoint/region) are injected into the chart
// values from the child XR's resolved connection details; credentials are sourced at
// pod runtime via env from the child's connection secret (<child>-conn).
func Loki(hc *platform.HandlerContext) (*platform.Result, error) {
	oxr := hc.OXR
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	desired := platform.Desired{}

	// 1. Child ObjectBucket (log storage for Loki). Provider from platform/contract
	// default unless overridden via spec.bucketProvider.
	ob := composed.New()
	ob.SetAPIVersion(contract.APIGroupVersion)
	ob.SetKind("ObjectBucket")
	ob.SetName(name + "-bucket")
	ob.SetNamespace(ns)
	ob.SetLabels(stackLabels(oxr, name))
	obSpec := map[string]any{
		"profile":    platform.Profile(oxr),
		"team":       platform.Team(oxr),
		"costCenter": platform.CostCenter(oxr),
	}
	if p := platform.SpecString(oxr, "bucketProvider"); p != "" {
		_ = unstructured.SetNestedField(obSpec, p, "provider")
	}
	if region := platform.SpecString(oxr, "region"); region != "" {
		_ = unstructured.SetNestedField(obSpec, region, "region")
	}
	ob.Object["spec"] = obSpec
	desired[resource.Name("bucket")] = &resource.DesiredComposed{Resource: ob}

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

	// Credentials at runtime from the child connection secret.
	extraEnv := []any{
		map[string]any{
			"name": "AWS_ACCESS_KEY_ID",
			"valueFrom": map[string]any{
				"secretKeyRef": map[string]any{"name": connSecret, "key": "accessKeyId", "optional": true},
			},
		},
		map[string]any{
			"name": "AWS_SECRET_ACCESS_KEY",
			"valueFrom": map[string]any{
				"secretKeyRef": map[string]any{"name": connSecret, "key": "secretAccessKey", "optional": true},
			},
		},
	}
	_ = unstructured.SetNestedField(ro, extraEnv, "spec", "forProvider", "values", "extraEnv")

	_ = unstructured.SetNestedField(ro, "s3", "spec", "forProvider", "values", "loki", "storage", "type")
	_ = unstructured.SetNestedField(ro, true, "spec", "forProvider", "values", "loki", "storage", "s3", "s3forcepathstyle")

	res := &platform.Result{Desired: desired}

	// Inject non-secret storage settings once the child publishes them.
	if cd := childConnectionDetails(hc, resource.Name("bucket")); len(cd) > 0 {
		if bucket := string(cd["bucket"]); bucket != "" {
			_ = unstructured.SetNestedField(ro, bucket, "spec", "forProvider", "values", "loki", "storage", "s3", "bucketnames")
		}
		if endpoint := string(cd["endpoint"]); endpoint != "" {
			_ = unstructured.SetNestedField(ro, endpoint, "spec", "forProvider", "values", "loki", "storage", "s3", "endpoint")
		}
		if region := string(cd["region"]); region != "" {
			_ = unstructured.SetNestedField(ro, region, "spec", "forProvider", "values", "loki", "storage", "s3", "region")
		}
	} else {
		res.Warnings = append(res.Warnings, "object storage connection details not yet available from child ObjectBucket; Release will be updated when ready")
	}

	desired[resource.Name("loki")] = &resource.DesiredComposed{Resource: rel}
	res.Status = map[string]any{"phase": "Provisioning"}
	return res, nil
}
