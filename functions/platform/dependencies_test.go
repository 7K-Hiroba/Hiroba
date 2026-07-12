package platform

import (
	"context"
	"strings"
	"testing"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	"github.com/7k-hiroba/hiroba/functions/platform/internal/contract"
)

func newCRD(name string) *unstructured.Unstructured {
	crd := &unstructured.Unstructured{}
	crd.SetAPIVersion("apiextensions.k8s.io/v1")
	crd.SetKind("CustomResourceDefinition")
	crd.SetName(name)
	return crd
}

func TestDiscoveryCheckerMissing(t *testing.T) {
	client := dynamicfake.NewSimpleDynamicClient(runtime.NewScheme(), newCRD("clusters.postgresql.cnpg.io"))
	c := &discoveryChecker{client: client, present: map[string]bool{}}

	missing := c.Missing(context.Background(), []string{
		"clusters.postgresql.cnpg.io",
		"garagebuckets.garage.rajsingh.info",
	})
	if len(missing) != 1 || missing[0] != "garagebuckets.garage.rajsingh.info" {
		t.Errorf("missing = %v, want [garagebuckets.garage.rajsingh.info]", missing)
	}

	// Cached: a second call within TTL must not re-list (and still works).
	if got := c.Missing(context.Background(), []string{"clusters.postgresql.cnpg.io"}); len(got) != 0 {
		t.Errorf("missing = %v, want none", got)
	}
}

func TestDependencyErrorIsActionable(t *testing.T) {
	deps := []contract.Dependency{
		{CRD: "clusters.postgresql.cnpg.io", Hint: "install the CloudNativePG operator"},
	}
	err := DependencyError("PostgresInstance", "cnpg", deps, []string{"clusters.postgresql.cnpg.io"})
	msg := err.Error()
	for _, want := range []string{"PostgresInstance", "provider=cnpg", "clusters.postgresql.cnpg.io", "CloudNativePG operator"} {
		if !strings.Contains(msg, want) {
			t.Errorf("error message missing %q: %s", want, msg)
		}
	}
}

func TestContractRequiredDependencies(t *testing.T) {
	// Wildcard applies to any provider.
	deps := contract.RequiredDependencies("GrafanaInstance", "anything")
	if len(deps) != 1 || deps[0].CRD != "releases.helm.m.crossplane.io" {
		t.Errorf("GrafanaInstance deps = %+v, want helm release CRD", deps)
	}
	// Provider-specific.
	deps = contract.RequiredDependencies("PostgresInstance", "cnpg")
	if len(deps) != 1 || deps[0].CRD != "clusters.postgresql.cnpg.io" {
		t.Errorf("PostgresInstance/cnpg deps = %+v, want cnpg cluster CRD", deps)
	}
	// Unknown kind: no deps.
	if deps := contract.RequiredDependencies("ObservabilityStack", ""); len(deps) != 0 {
		t.Errorf("ObservabilityStack deps = %+v, want none (children are checked individually)", deps)
	}
}
