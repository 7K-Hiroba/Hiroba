package platform

import (
	"context"
	"testing"

	fnv1 "github.com/crossplane/function-sdk-go/proto/v1"
	"github.com/crossplane/function-sdk-go/resource"
	"github.com/crossplane/function-sdk-go/resource/composed"
	"github.com/crossplane/function-sdk-go/resource/composite"
	"google.golang.org/protobuf/types/known/structpb"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/7k-hiroba/hiroba/functions/platform/internal/contract"
)

func mustStruct(t *testing.T, obj any) *structpb.Struct {
	t.Helper()
	s, err := structpb.NewStruct(obj.(map[string]any))
	if err != nil {
		t.Fatalf("cannot build struct: %v", err)
	}
	return s
}

func newRequest(t *testing.T, xr *composite.Unstructured) *fnv1.RunFunctionRequest {
	t.Helper()
	xrStruct, err := structpb.NewStruct(xr.Object)
	if err != nil {
		t.Fatalf("cannot marshal xr: %v", err)
	}
	return &fnv1.RunFunctionRequest{
		Observed: &fnv1.State{
			Composite: &fnv1.Resource{Resource: xrStruct},
		},
		Desired: &fnv1.State{
			Composite: &fnv1.Resource{Resource: mustStruct(t, map[string]any{})},
		},
	}
}

func newTestXR(apiVersion, kind, name, ns string) *composite.Unstructured {
	xr := composite.New()
	xr.SetAPIVersion(apiVersion)
	xr.SetKind(kind)
	xr.SetName(name)
	xr.SetNamespace(ns)
	return xr
}

func severityOf(rsp *fnv1.RunFunctionResponse) []fnv1.Severity {
	out := []fnv1.Severity{}
	for _, r := range rsp.GetResults() {
		out = append(out, r.GetSeverity())
	}
	return out
}

func hasFatal(rsp *fnv1.RunFunctionResponse) bool {
	for _, s := range severityOf(rsp) {
		if s == fnv1.Severity_SEVERITY_FATAL {
			return true
		}
	}
	return false
}

func TestRunFunctionUnknownKindIsFatal(t *testing.T) {
	fn := &Function{Registry: NewRegistry()}
	rsp, err := fn.RunFunction(context.Background(), newRequest(t, newTestXR(contract.APIGroupVersion, "Nope", "x", "ns")))
	if err != nil {
		t.Fatalf("unexpected transport error: %v", err)
	}
	if !hasFatal(rsp) {
		t.Errorf("expected fatal result for unregistered kind, got %v", severityOf(rsp))
	}
}

func TestRunFunctionHandlerErrorIsFatal(t *testing.T) {
	reg := NewRegistry()
	reg.Register(contract.APIGroupVersion, "Boom", func(hc *HandlerContext) (*Result, error) {
		return nil, context.DeadlineExceeded
	})
	fn := &Function{Registry: reg}
	rsp, err := fn.RunFunction(context.Background(), newRequest(t, newTestXR(contract.APIGroupVersion, "Boom", "x", "ns")))
	if err != nil {
		t.Fatalf("unexpected transport error: %v", err)
	}
	if !hasFatal(rsp) {
		t.Errorf("expected fatal result for handler error, got %v", severityOf(rsp))
	}
}

func TestRunFunctionNilResultIsFatal(t *testing.T) {
	reg := NewRegistry()
	reg.Register(contract.APIGroupVersion, "Nil", func(hc *HandlerContext) (*Result, error) {
		return nil, nil
	})
	fn := &Function{Registry: reg}
	rsp, _ := fn.RunFunction(context.Background(), newRequest(t, newTestXR(contract.APIGroupVersion, "Nil", "x", "ns")))
	if !hasFatal(rsp) {
		t.Errorf("expected fatal result for nil handler result, got %v", severityOf(rsp))
	}
}

func TestRunFunctionSuccessSetsDesiredStatusAndConnectionDetails(t *testing.T) {
	reg := NewRegistry()
	reg.Register(contract.APIGroupVersion, "Widget", func(hc *HandlerContext) (*Result, error) {
		cd := composed.New()
		cd.SetAPIVersion("example.org/v1")
		cd.SetKind("Thing")
		cd.SetName("x-thing")
		cd.SetNamespace(hc.OXR.Resource.GetNamespace())
		return &Result{
			Desired:           Desired{resource.Name("thing"): {Resource: cd}},
			Status:            map[string]any{"phase": "Ready", "endpoint": "thing.example.org:443"},
			ConnectionDetails: resource.ConnectionDetails{"host": []byte("thing.example.org")},
		}, nil
	})
	fn := &Function{Registry: reg}
	rsp, err := fn.RunFunction(context.Background(), newRequest(t, newTestXR(contract.APIGroupVersion, "Widget", "x", "ns")))
	if err != nil {
		t.Fatalf("unexpected transport error: %v", err)
	}
	if hasFatal(rsp) {
		t.Fatalf("unexpected fatal result: %v", rsp.GetResults())
	}

	// Desired composed resource present.
	got := rsp.GetDesired().GetResources()
	if len(got) != 1 {
		t.Fatalf("want 1 desired composed resource, got %d", len(got))
	}
	if _, ok := got["thing"]; !ok {
		t.Errorf("desired composed key 'thing' missing: %v", got)
	}

	// Status fields applied to the desired composite.
	comp := rsp.GetDesired().GetComposite().GetResource().AsMap()
	phase, _, _ := unstructured.NestedString(comp, "status", "phase")
	if phase != "Ready" {
		t.Errorf("status.phase = %q, want Ready", phase)
	}

	// Connection details merged and writeConnectionSecretToRef defaulted.
	cds := rsp.GetDesired().GetComposite().GetConnectionDetails()
	if string(cds["host"]) != "thing.example.org" {
		t.Errorf("connection details host = %q", string(cds["host"]))
	}
	secretName, _, _ := unstructured.NestedString(comp, "spec", "writeConnectionSecretToRef", "name")
	if secretName != "x-conn" {
		t.Errorf("writeConnectionSecretToRef.name = %q, want x-conn", secretName)
	}
}

func TestRunFunctionWarningsAreNonFatal(t *testing.T) {
	reg := NewRegistry()
	reg.Register(contract.APIGroupVersion, "Warner", func(hc *HandlerContext) (*Result, error) {
		return &Result{Warnings: []string{"details not yet available"}}, nil
	})
	fn := &Function{Registry: reg}
	rsp, _ := fn.RunFunction(context.Background(), newRequest(t, newTestXR(contract.APIGroupVersion, "Warner", "x", "ns")))
	if hasFatal(rsp) {
		t.Errorf("warnings must not be fatal: %v", rsp.GetResults())
	}
	foundWarning := false
	for _, s := range severityOf(rsp) {
		if s == fnv1.Severity_SEVERITY_WARNING {
			foundWarning = true
		}
	}
	if !foundWarning {
		t.Errorf("expected a warning result, got %v", severityOf(rsp))
	}
}

func TestRegistryDuplicateRegistrationPanics(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Error("expected panic on duplicate registration")
		}
	}()
	reg := NewRegistry()
	noop := func(hc *HandlerContext) (*Result, error) { return &Result{}, nil }
	reg.Register(contract.APIGroupVersion, "Widget", noop)
	reg.Register(contract.APIGroupVersion, "Widget", noop)
}

func TestRegistryDispatchIncludesAPIVersion(t *testing.T) {
	reg := NewRegistry()
	noop := func(hc *HandlerContext) (*Result, error) { return &Result{}, nil }
	reg.Register(contract.APIGroupVersion, "Widget", noop)
	if _, ok := reg.Get(contract.APIGroupVersion, "Widget"); !ok {
		t.Error("registered key not found")
	}
	if _, ok := reg.Get("platform.7kgroup.org/v9", "Widget"); ok {
		t.Error("different apiVersion must not match")
	}
}
