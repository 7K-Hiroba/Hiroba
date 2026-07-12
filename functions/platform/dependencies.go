package platform

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"

	"github.com/crossplane/function-sdk-go/logging"

	"github.com/7k-hiroba/hiroba/functions/platform/internal/contract"
)

// DependencyChecker reports which of the given CRDs are not installed in the
// cluster. The orchestrator gates every reconcile on the declared dependencies
// of the XR kind + resolved provider (contract.Dependencies) so a missing
// operator surfaces as one clear, actionable error instead of a cascade of
// apply failures. Installing the operator is the platform operator's job; the
// function only verifies and reports.
type DependencyChecker interface {
	Missing(ctx context.Context, crds []string) []string
}

// NoopChecker reports nothing missing. Used when no in-cluster config is
// available (crossplane render, unit tests, local development).
type NoopChecker struct{}

func (NoopChecker) Missing(_ context.Context, _ []string) []string { return nil }

var crdGVR = schema.GroupVersionResource{
	Group:    "apiextensions.k8s.io",
	Version:  "v1",
	Resource: "customresourcedefinitions",
}

// discoveryChecker checks CRD presence through the dynamic client and caches
// results for ttl. CRD install state changes rarely, and Crossplane retries
// reconciles with backoff, so a short TTL keeps checks cheap without hiding a
// freshly installed operator for long.
type discoveryChecker struct {
	client dynamic.Interface
	ttl    time.Duration

	mu        sync.Mutex
	checkedAt time.Time
	present   map[string]bool
}

// NewInClusterChecker builds a DependencyChecker from the in-cluster config.
// Returns NoopChecker when not running in a cluster or when the config cannot
// be built, so local rendering keeps working.
func NewInClusterChecker(log logging.Logger) DependencyChecker {
	cfg, err := rest.InClusterConfig()
	if err != nil {
		if log != nil {
			log.Info("dependency check disabled: no in-cluster config (render/local mode)")
		}
		return NoopChecker{}
	}
	client, err := dynamic.NewForConfig(cfg)
	if err != nil {
		if log != nil {
			log.Info("dependency check disabled: cannot build dynamic client", "error", err)
		}
		return NoopChecker{}
	}
	return &discoveryChecker{client: client, ttl: 60 * time.Second, present: map[string]bool{}}
}

func (c *discoveryChecker) Missing(ctx context.Context, crds []string) []string {
	if len(crds) == 0 {
		return nil
	}
	c.refresh(ctx)

	c.mu.Lock()
	defer c.mu.Unlock()
	var missing []string
	for _, crd := range crds {
		if !c.present[crd] {
			missing = append(missing, crd)
		}
	}
	return missing
}

// refresh reloads the CRD inventory when the cache is stale. On API errors the
// previous snapshot is kept (fail open on transient API issues; a stale cache
// never exceeds 2x ttl because the next successful refresh replaces it).
func (c *discoveryChecker) refresh(ctx context.Context) {
	c.mu.Lock()
	fresh := time.Since(c.checkedAt) < c.ttl
	c.mu.Unlock()
	if fresh {
		return
	}

	list, err := c.client.Resource(crdGVR).List(ctx, metav1.ListOptions{})
	if err != nil {
		return
	}
	present := make(map[string]bool, len(list.Items))
	for _, item := range list.Items {
		present[item.GetName()] = true
	}

	c.mu.Lock()
	c.present = present
	c.checkedAt = time.Now()
	c.mu.Unlock()
}

// DependencyError renders a client-actionable error for missing CRDs.
func DependencyError(kind, provider string, deps []contract.Dependency, missing []string) error {
	missingSet := map[string]bool{}
	for _, m := range missing {
		missingSet[m] = true
	}
	var hints []string
	for _, d := range deps {
		if missingSet[d.CRD] && d.Hint != "" {
			hints = append(hints, fmt.Sprintf("%s (%s)", d.CRD, d.Hint))
		}
	}
	sort.Strings(missing)
	msg := fmt.Sprintf("%s (provider=%s) cannot be reconciled: required CRDs are not installed: %s",
		kind, provider, strings.Join(missing, ", "))
	if len(hints) > 0 {
		msg += ". Install the required operator(s) first — " + strings.Join(hints, "; ")
	}
	return fmt.Errorf("%s", msg)
}
