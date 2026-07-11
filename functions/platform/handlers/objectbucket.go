package handlers

import (
	"fmt"

	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composed"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/7k-hiroba/hiroba/functions/platform"
)

// ObjectBucket handles kind=ObjectBucket, switching on spec.provider.
func ObjectBucket(oxr *resource.Composite) (platform.Desired, error) {
	provider := platform.SpecString(oxr, "provider")
	if provider == "" {
		provider = "garage" // in-cluster default
	}
	switch provider {
	case "s3":
		return bucketS3(oxr)
	case "garage":
		return bucketGarage(oxr)
	default:
		return nil, fmt.Errorf("provider %q is not yet implemented for ObjectBucket", provider)
	}
}

func bucketS3(oxr *resource.Composite) (platform.Desired, error) {
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	region := platform.SpecString(oxr, "region")
	if region == "" {
		region = "us-east-1"
	}
	bucket := platform.SpecString(oxr, "bucket")
	if bucket == "" {
		bucket = name
	}

	cd := composed.New()
	cd.SetAPIVersion("s3.aws.m.upbound.io/v1beta1")
	cd.SetKind("Bucket")
	cd.SetNamespace(ns)
	cd.SetGenerateName(name + "-bucket-")
	o := cd.Object
	_ = unstructured.SetNestedField(o, region, "spec", "forProvider", "region")
	_ = unstructured.SetNestedField(o, bucket, "spec", "forProvider", "bucket")
	platform.SetProviderConfigRef(o, platform.ResolveProviderConfig(oxr, "s3"))
	platform.WriteConnectionSecretToRef(o, ns, name+"-conn")
	platform.Tag(o, "team", platform.Team(oxr))
	if cc := platform.CostCenter(oxr); cc != "" {
		platform.Tag(o, "cost-center", cc)
	}

	return platform.Desired{resource.Name(name + "-bucket"): &resource.DesiredComposed{Resource: cd}}, nil
}

func bucketGarage(oxr *resource.Composite) (platform.Desired, error) {
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	cd := composed.New()
	cd.SetAPIVersion("garage.rajsingh.info/v1alpha1")
	cd.SetKind("GarageBucket")
	cd.SetName(name + "-bucket")
	cd.SetNamespace(ns)
	o := cd.Object
	// clusterRef falls back to the platform default GarageCluster when unset on the XR.
	_ = unstructured.SetNestedField(o, "default", "spec", "clusterRef", "name")

	return platform.Desired{resource.Name(name + "-bucket"): &resource.DesiredComposed{Resource: cd}}, nil
}
