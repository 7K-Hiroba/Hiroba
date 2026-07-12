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
	"github.com/7k-hiroba/hiroba/functions/platform/internal/contract"
)

const postgresPort = 5432

// Postgres handles kind=PostgresInstance, switching on spec.provider.
// Precedence for provider selection: spec.provider > platform config default >
// contract default (cnpg).
func Postgres(hc *platform.HandlerContext) (*platform.Result, error) {
	oxr := hc.OXR
	provider := platform.SpecString(oxr, "provider")
	if provider == "" {
		provider = hc.Config.DefaultProvider("postgres", contract.PostgresDefaultProvider)
	}
	switch provider {
	case "aws":
		return postgresRDS(hc)
	case "cnpg":
		return postgresCNPG(hc)
	default:
		return nil, fmt.Errorf("provider %q is not implemented for PostgresInstance (supported: %v)",
			provider, contract.PostgresProviders)
	}
}

func postgresRDS(hc *platform.HandlerContext) (*platform.Result, error) {
	oxr := hc.OXR
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()
	defaults := platform.ProfileDefaults(oxr)

	region := platform.SpecStringDefault(oxr, contract.PostgresDefaultRegion, "region")
	version := platform.SpecStringDefault(oxr, "15", "version")
	database := platform.SpecStringDefault(oxr, "app", "database")
	username := "dbadmin"

	class := platform.SpecStringDefault(oxr, defaults.InstanceClass, "instanceClass")
	storageGB, found := platform.SpecInt64(oxr, "storageGB")
	if !found || storageGB < 1 {
		storageGB = 20
	}

	// High availability: explicit feature toggle wins over the profile default.
	multiAZ := defaults.MultiAZ
	if _, found := platform.SpecBool(oxr, "features", "ha", "enabled"); found {
		multiAZ = platform.FeatureEnabled(oxr, "ha")
	}

	// Backups: profile default retention; an explicit backup.enabled=false disables.
	backupRetention := defaults.BackupRetentionDays
	if b, found := platform.SpecBool(oxr, "features", "backup", "enabled"); found && !b {
		backupRetention = 0
	}

	deletionPolicy := platform.SpecStringDefault(oxr, defaults.DeletionPolicy, "deletionPolicy")

	cd := composed.New()
	cd.SetAPIVersion("rds.aws.m.upbound.io/v1beta1")
	cd.SetKind("Instance")
	cd.SetNamespace(ns)
	cd.SetName(name + "-pg")
	o := cd.Object
	_ = unstructured.SetNestedField(o, "postgres", "spec", "forProvider", "engine")
	_ = unstructured.SetNestedField(o, version, "spec", "forProvider", "engineVersion")
	_ = unstructured.SetNestedField(o, class, "spec", "forProvider", "instanceClass")
	_ = unstructured.SetNestedField(o, storageGB, "spec", "forProvider", "allocatedStorage")
	_ = unstructured.SetNestedField(o, defaults.StorageEncrypted, "spec", "forProvider", "storageEncrypted")
	_ = unstructured.SetNestedField(o, multiAZ, "spec", "forProvider", "multiAZ")
	_ = unstructured.SetNestedField(o, backupRetention, "spec", "forProvider", "backupRetentionPeriod")
	_ = unstructured.SetNestedField(o, defaults.DeletionProtection, "spec", "forProvider", "deletionProtection")
	_ = unstructured.SetNestedField(o, false, "spec", "forProvider", "publiclyAccessible")
	_ = unstructured.SetNestedField(o, region, "spec", "forProvider", "region")
	_ = unstructured.SetNestedField(o, database, "spec", "forProvider", "dbName")
	_ = unstructured.SetNestedField(o, username, "spec", "forProvider", "username")
	_ = unstructured.SetNestedField(o, deletionPolicy, "spec", "deletionPolicy")
	platform.SetProviderConfigRef(o, platform.ResolveProviderConfig(oxr, "aws"))
	platform.WriteConnectionSecretToRef(o, ns, name+"-conn")
	platform.TagOwnership(o, oxr)

	res := &platform.Result{
		Desired: platform.Desired{
			resource.Name("pg"): {Resource: cd},
		},
		Status: map[string]any{
			"phase":               "Provisioning",
			"connectionSecretRef": map[string]any{"name": name + "-conn"},
		},
	}

	// Normalize the provider-native connection details (endpoint/port/username/
	// password) onto the stable contract keys once RDS publishes them.
	obs, ok := hc.Observed[resource.Name("pg")]
	if !ok || len(obs.ConnectionDetails) == 0 {
		res.Warnings = append(res.Warnings, "connection details not yet available from RDS instance")
		return res, nil
	}
	host := string(obs.ConnectionDetails["endpoint"])
	port := string(obs.ConnectionDetails["port"])
	if port == "" {
		port = fmt.Sprintf("%d", postgresPort)
	}
	user := string(obs.ConnectionDetails["username"])
	if user == "" {
		user = username
	}
	password := obs.ConnectionDetails["password"]

	res.ConnectionDetails = resource.ConnectionDetails{
		"host":     []byte(host),
		"port":     []byte(port),
		"username": []byte(user),
		"password": password,
		"database": []byte(database),
		"uri": []byte(fmt.Sprintf("postgresql://%s:%s@%s:%s/%s",
			user, string(password), host, port, database)),
	}
	res.Status["endpoint"] = fmt.Sprintf("%s:%s", host, port)
	res.Status["phase"] = "Ready"
	return res, nil
}

func postgresCNPG(hc *platform.HandlerContext) (*platform.Result, error) {
	oxr := hc.OXR
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	version := platform.SpecStringDefault(oxr, "15", "version")
	database := platform.SpecStringDefault(oxr, "app", "database")
	username := "app"

	storageGB, found := platform.SpecInt64(oxr, "storageGB")
	if !found || storageGB < 1 {
		storageGB = 20
	}

	instances := int64(1)
	if platform.FeatureEnabled(oxr, "ha") || platform.Profile(oxr) == "production" {
		instances = 3
	}

	cd := composed.New()
	cd.SetAPIVersion("postgresql.cnpg.io/v1")
	cd.SetKind("Cluster")
	cd.SetName(name + "-pg")
	cd.SetNamespace(ns)
	o := cd.Object
	_ = unstructured.SetNestedField(o, instances, "spec", "instances")
	_ = unstructured.SetNestedField(o, fmt.Sprintf("%dGi", storageGB), "spec", "storage", "size")
	_ = unstructured.SetNestedField(o,
		fmt.Sprintf("ghcr.io/cloudnative-pg/postgresql:%s", version), "spec", "imageName")
	_ = unstructured.SetNestedField(o, database, "spec", "bootstrap", "initdb", "database")
	_ = unstructured.SetNestedField(o, username, "spec", "bootstrap", "initdb", "owner")
	platform.LabelOwnership(o, oxr)

	// CNPG publishes deterministic in-cluster service DNS names, so host/port/
	// database/username are known immediately. The operator-generated password
	// lives in the `<name>-pg-app` secret; the function cannot read arbitrary
	// cluster secrets, so password/uri are intentionally omitted and surfaced
	// via the operator secret (documented in the API reference).
	host := fmt.Sprintf("%s-pg-rw.%s.svc", name, ns)
	res := &platform.Result{
		Desired: platform.Desired{
			resource.Name("pg"): {Resource: cd},
		},
		Status: map[string]any{
			"phase":               "Provisioning",
			"endpoint":            fmt.Sprintf("%s:%d", host, postgresPort),
			"connectionSecretRef": map[string]any{"name": name + "-conn"},
		},
		ConnectionDetails: resource.ConnectionDetails{
			"host":     []byte(host),
			"port":     []byte(fmt.Sprintf("%d", postgresPort)),
			"username": []byte(username),
			"database": []byte(database),
		},
		Warnings: []string{
			fmt.Sprintf("password and uri are published by the CNPG operator secret %q (keys: username, password, dbname, host, port, uri)", name+"-pg-app"),
		},
	}
	return res, nil
}
