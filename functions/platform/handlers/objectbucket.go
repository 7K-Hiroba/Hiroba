package handlers

import (
	"fmt"

	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composed"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/7k-hiroba/hiroba/functions/platform"
	"github.com/7k-hiroba/hiroba/functions/platform/internal/contract"
)

const (
	garageAPIVersion = "garage.rajsingh.info/v1beta1"
	garageS3Port     = 3900
)

// ObjectBucket handles kind=ObjectBucket, switching on spec.provider.
// Precedence for provider selection: spec.provider > platform config default >
// contract default (garage).
func ObjectBucket(hc *platform.HandlerContext) (*platform.Result, error) {
	oxr := hc.OXR
	provider := platform.SpecString(oxr, "provider")
	if provider == "" {
		provider = hc.Config.DefaultProvider("objectStorage", contract.ObjectStorageDefaultProvider)
	}
	switch provider {
	case "s3":
		return bucketS3(hc)
	case "garage":
		return bucketGarage(hc)
	default:
		return nil, fmt.Errorf("provider %q is not implemented for ObjectBucket (supported: %v)",
			provider, contract.ObjectStorageProviders)
	}
}

func bucketS3(hc *platform.HandlerContext) (*platform.Result, error) {
	oxr := hc.OXR
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	region := platform.SpecStringDefault(oxr, contract.ObjectStorageDefaultRegion, "region")
	bucket := platform.SpecStringDefault(oxr, name, "bucket")

	cd := composed.New()
	cd.SetAPIVersion("s3.aws.m.upbound.io/v1beta1")
	cd.SetKind("Bucket")
	cd.SetNamespace(ns)
	cd.SetName(name + "-bucket")
	o := cd.Object
	_ = unstructured.SetNestedField(o, region, "spec", "forProvider", "region")
	_ = unstructured.SetNestedField(o, bucket, "spec", "forProvider", "bucket")
	if platform.FeatureEnabled(oxr, "versioning") {
		_ = unstructured.SetNestedField(o, "Enabled", "spec", "forProvider", "versioning", "status")
	}
	platform.SetProviderConfigRef(o, cd.GetAPIVersion(), platform.ResolveProviderConfig(oxr, "s3"))
	platform.TagOwnership(o, oxr)

	endpoint := fmt.Sprintf("https://s3.%s.amazonaws.com", region)
	credsSecret := platform.Team(oxr) + "-s3-credentials"
	return &platform.Result{
		Desired: platform.Desired{
			resource.Name("bucket"): {Resource: cd},
		},
		Status: map[string]any{
			"phase":                "Ready",
			"endpoint":             endpoint,
			"credentialsSecretRef": map[string]any{"name": credsSecret},
		},
		ConnectionDetails: resource.ConnectionDetails{
			"endpoint": []byte(endpoint),
			"bucket":   []byte(bucket),
			"region":   []byte(region),
			"uri":      []byte(fmt.Sprintf("s3://%s", bucket)),
		},
		Warnings: []string{
			fmt.Sprintf("accessKeyId/secretAccessKey must be supplied by ESO in the %q secret (keys: accessKeyId, secretAccessKey)", credsSecret),
		},
	}, nil
}

func bucketGarage(hc *platform.HandlerContext) (*platform.Result, error) {
	oxr := hc.OXR
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	clusterRef := platform.SpecStringDefault(oxr, "default", "clusterRef", "name")
	clusterNs := platform.SpecStringDefault(oxr, "garage", "clusterRef", "namespace")
	bucket := platform.SpecStringDefault(oxr, name, "bucket")
	bucketResourceName := name + "-bucket"
	credsSecret := name + "-creds"

	bucketObj := composed.New()
	bucketObj.SetAPIVersion(garageAPIVersion)
	bucketObj.SetKind("GarageBucket")
	bucketObj.SetName(bucketResourceName)
	bucketObj.SetNamespace(ns)
	o := bucketObj.Object
	_ = unstructured.SetNestedField(o, map[string]any{"name": clusterRef, "namespace": clusterNs}, "spec", "clusterRef")
	platform.LabelOwnership(o, oxr)

	keyObj := composed.New()
	keyObj.SetAPIVersion(garageAPIVersion)
	keyObj.SetKind("GarageKey")
	keyObj.SetName(name + "-key")
	keyObj.SetNamespace(ns)
	ko := keyObj.Object
	_ = unstructured.SetNestedField(ko, map[string]any{"name": clusterRef, "namespace": clusterNs}, "spec", "clusterRef")
	_ = unstructured.SetNestedField(ko, true, "spec", "neverExpires")
	_ = unstructured.SetNestedField(ko, []any{
		map[string]any{
			"bucketRef": map[string]any{"name": bucketResourceName, "namespace": ns},
			"read":      true,
			"write":     true,
			"owner":     true,
		},
	}, "spec", "bucketPermissions")
	_ = unstructured.SetNestedField(ko, map[string]any{
		"name":               credsSecret,
		"accessKeyIdKey":     "accessKeyId",
		"secretAccessKeyKey": "secretAccessKey",
		"endpointKey":        "endpoint",
		"regionKey":          "region",
		"bucketNameKey":      "bucket",
		"includeEndpoint":    true,
		"includeRegion":      true,
		"includeBucketName":  true,
	}, "spec", "secretTemplate")
	platform.LabelOwnership(ko, oxr)

	endpoint := fmt.Sprintf("http://%s.%s.svc:%d", clusterRef, clusterNs, garageS3Port)
	return &platform.Result{
		Desired: platform.Desired{
			resource.Name("bucket"): {Resource: bucketObj},
			resource.Name("key"):    {Resource: keyObj},
		},
		Status: map[string]any{
			"phase":                "Provisioning",
			"endpoint":             endpoint,
			"credentialsSecretRef": map[string]any{"name": credsSecret},
		},
		ConnectionDetails: resource.ConnectionDetails{
			"endpoint": []byte(endpoint),
			"bucket":   []byte(bucket),
			"region":   []byte("garage"),
			"uri":      []byte(fmt.Sprintf("s3://%s", bucket)),
		},
		Warnings: []string{
			fmt.Sprintf("endpoint and credentials are issued by the Garage operator in the %q secret", credsSecret),
		},
	}, nil
}
