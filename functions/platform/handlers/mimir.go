package handlers

import (
	"fmt"

	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composed"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/7k-hiroba/hiroba/functions/platform"
	"github.com/7k-hiroba/hiroba/functions/platform/internal/contract"
)

const defaultMimirChartVersion = "5.6.0"

// Mimir handles kind=MimirInstance. It emits:
//   - a child ObjectBucket XR (block storage), and
//   - a provider-helm Release installing grafana/mimir-distributed, wired to the
//     child ObjectBucket connection details.
//
// Mimir replaces the retired inline-S3 composition: object storage is always claimed
// from the platform primitive (ADR 007 hierarchical composition).
func Mimir(hc *platform.HandlerContext) (*platform.Result, error) {
	oxr := hc.OXR
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	desired := platform.Desired{}

	// 1. Child ObjectBucket (block storage).
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

	// 2. Helm Release for grafana/mimir-distributed.
	connSecret := name + "-bucket-conn"
	fullname := name + "-mimir"

	wired := map[string]any{
		"fullnameOverride": fullname,
		"mimir": map[string]any{
			"structuredConfig": map[string]any{
				"blocks_storage": map[string]any{
					"backend": "s3",
					"s3":      map[string]any{},
				},
			},
		},
		"extraEnv": []any{
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
		},
	}

	// Inject non-secret storage settings once the child publishes them.
	res := &platform.Result{Desired: desired}
	if cd := childConnectionDetails(hc, resource.Name("bucket")); len(cd) > 0 {
		s3 := wired["mimir"].(map[string]any)["structuredConfig"].(map[string]any)["blocks_storage"].(map[string]any)["s3"].(map[string]any)
		if bucket := string(cd["bucket"]); bucket != "" {
			s3["bucket_name"] = bucket
		}
		if endpoint := string(cd["endpoint"]); endpoint != "" {
			s3["endpoint"] = endpoint
		}
		if region := string(cd["region"]); region != "" {
			s3["region"] = region
		}
	} else {
		res.Warnings = append(res.Warnings, "object storage connection details not yet available from child ObjectBucket; Release will be updated when ready")
	}

	merged := deepMerge(userValues(oxr), wired)
	rel := helmRelease(oxr, name+"-mimir", "mimir-distributed", grafanaChartsRepo,
		chartVersion(oxr, "MIMIR_CHART_VERSION", defaultMimirChartVersion), merged)
	desired[resource.Name("mimir")] = &resource.DesiredComposed{Resource: rel}

	endpoint := fmt.Sprintf("http://%s-nginx.%s.svc:80", fullname, ns)
	res.Status = map[string]any{
		"phase":    "Provisioning",
		"endpoint": endpoint,
	}
	res.ConnectionDetails = resource.ConnectionDetails{
		"url":            []byte(endpoint),
		"remoteWriteUrl": []byte(endpoint + "/api/v1/push"),
	}
	return res, nil
}
