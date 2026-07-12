package handlers

import (
	"fmt"

	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composed"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/7k-hiroba/hiroba/functions/platform"
	"github.com/7k-hiroba/hiroba/functions/platform/internal/contract"
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
	platform.SetProviderConfigRef(o, platform.ResolveProviderConfig(oxr, "s3"))
	platform.TagOwnership(o, oxr)

	endpoint := fmt.Sprintf("https://s3.%s.amazonaws.com", region)
	return &platform.Result{
		Desired: platform.Desired{
			resource.Name("bucket"): {Resource: cd},
		},
		Status: map[string]any{
			"phase":    "Ready",
			"endpoint": endpoint,
		},
		ConnectionDetails: resource.ConnectionDetails{
			"endpoint": []byte(endpoint),
			"bucket":   []byte(bucket),
			"region":   []byte(region),
			"uri":      []byte(fmt.Sprintf("s3://%s", bucket)),
		},
		Warnings: []string{
			"accessKeyId/secretAccessKey are sourced from the team's provider credentials (ESO), not the bucket itself",
		},
	}, nil
}

func bucketGarage(hc *platform.HandlerContext) (*platform.Result, error) {
	oxr := hc.OXR
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	clusterRef := platform.SpecStringDefault(oxr, "default", "clusterRef", "name")
	bucket := platform.SpecStringDefault(oxr, name, "bucket")

	cd := composed.New()
	cd.SetAPIVersion("garage.rajsingh.info/v1alpha1")
	cd.SetKind("GarageBucket")
	cd.SetName(name + "-bucket")
	cd.SetNamespace(ns)
	o := cd.Object
	_ = unstructured.SetNestedField(o, clusterRef, "spec", "clusterRef", "name")
	platform.LabelOwnership(o, oxr)

	return &platform.Result{
		Desired: platform.Desired{
			resource.Name("bucket"): {Resource: cd},
		},
		Status: map[string]any{
			"phase": "Provisioning",
		},
		ConnectionDetails: resource.ConnectionDetails{
			"bucket": []byte(bucket),
			"uri":    []byte(fmt.Sprintf("s3://%s", bucket)),
		},
		Warnings: []string{
			"endpoint and credentials are issued by the Garage operator; see the GarageCluster connection secret",
		},
	}, nil
}
