// Package handlers contains the per-kind orchestrator handlers registered in cmd/main.
// Each handler reads the observed composite XR and emits the desired composed resources
// for its primitive; provider branching (ADR 007) lives here, not in Composition files.
package handlers

import (
	"fmt"

	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composed"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/7k-hiroba/hiroba/functions/platform"
)

// instanceClassByProfile maps a profile to a default RDS instance class when the XR does
// not set spec.instanceClass.
var instanceClassByProfile = map[string]string{
	"development": "db.t3.micro",
	"staging":     "db.t3.small",
	"production":  "db.t3.medium",
}

// Postgres handles kind=PostgresInstance, switching on spec.provider.
func Postgres(oxr *resource.Composite) (platform.Desired, error) {
	provider := platform.SpecString(oxr, "provider")
	if provider == "" {
		provider = "cnpg" // in-cluster default
	}
	switch provider {
	case "aws":
		return postgresRDS(oxr)
	case "cnpg":
		return postgresCNPG(oxr)
	default:
		return nil, fmt.Errorf("provider %q is not yet implemented for PostgresInstance", provider)
	}
}

func postgresRDS(oxr *resource.Composite) (platform.Desired, error) {
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	region := platform.SpecString(oxr, "region")
	if region == "" {
		region = "us-east-1"
	}
	class := platform.SpecString(oxr, "instanceClass")
	if class == "" {
		class = instanceClassByProfile[platform.SpecString(oxr, "profile")]
	}
	version := platform.SpecString(oxr, "version")
	if version == "" {
		version = "15"
	}
	db := platform.SpecString(oxr, "database")
	if db == "" {
		db = "app"
	}

	cd := composed.New()
	cd.SetAPIVersion("rds.aws.m.upbound.io/v1beta1")
	cd.SetKind("Instance")
	cd.SetNamespace(ns)
	cd.SetGenerateName(name + "-pg-")
	o := cd.Object
	_ = unstructured.SetNestedField(o, "postgres", "spec", "forProvider", "engine")
	_ = unstructured.SetNestedField(o, version, "spec", "forProvider", "engineVersion")
	_ = unstructured.SetNestedField(o, class, "spec", "forProvider", "instanceClass")
	_ = unstructured.SetNestedField(o, int64(20), "spec", "forProvider", "allocatedStorage")
	_ = unstructured.SetNestedField(o, true, "spec", "forProvider", "storageEncrypted")
	_ = unstructured.SetNestedField(o, false, "spec", "forProvider", "publiclyAccessible")
	_ = unstructured.SetNestedField(o, region, "spec", "forProvider", "region")
	_ = unstructured.SetNestedField(o, db, "spec", "forProvider", "dbName")
	_ = unstructured.SetNestedField(o, "Orphan", "spec", "deletionPolicy")
	platform.SetProviderConfigRef(o, platform.ResolveProviderConfig(oxr, "aws"))
	platform.WriteConnectionSecretToRef(o, ns, name+"-conn")
	platform.Tag(o, "team", platform.Team(oxr))
	if cc := platform.CostCenter(oxr); cc != "" {
		platform.Tag(o, "cost-center", cc)
	}

	return platform.Desired{resource.Name(name + "-pg"): &resource.DesiredComposed{Resource: cd}}, nil
}

func postgresCNPG(oxr *resource.Composite) (platform.Desired, error) {
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	db := platform.SpecString(oxr, "database")
	if db == "" {
		db = "app"
	}

	cd := composed.New()
	cd.SetAPIVersion("postgresql.cnpg.io/v1")
	cd.SetKind("Cluster")
	cd.SetName(name + "-pg")
	cd.SetNamespace(ns)
	o := cd.Object
	_ = unstructured.SetNestedField(o, int64(1), "spec", "instances")
	_ = unstructured.SetNestedField(o, "10Gi", "spec", "storage", "size")
	_ = unstructured.SetNestedField(o, db, "spec", "bootstrap", "initdb", "database")

	return platform.Desired{resource.Name(name + "-pg"): &resource.DesiredComposed{Resource: cd}}, nil
}
