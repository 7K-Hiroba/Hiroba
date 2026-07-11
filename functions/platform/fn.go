package platform

import (
	"context"
	"fmt"

	"github.com/crossplane/function-sdk-go/logging"
	fnv1 "github.com/crossplane/function-sdk-go/proto/v1"
	"github.com/crossplane/function-sdk-go/request"
	"github.com/crossplane/function-sdk-go/response"
)

// Function is the central orchestrator. Every primitive/stack Composition runs a single
// Pipeline step that calls this Function; RunFunction dispatches on the observed
// composite's Kind via the Registry (ADR 007).
type Function struct {
	fnv1.UnimplementedFunctionRunnerServiceServer

	Log      logging.Logger
	Registry *Registry
}

// RunFunction is the gRPC entrypoint invoked by Crossplane for each reconciliation.
func (f *Function) RunFunction(_ context.Context, req *fnv1.RunFunctionRequest) (*fnv1.RunFunctionResponse, error) {
	rsp := response.To(req, response.DefaultTTL)

	oxr, err := request.GetObservedCompositeResource(req)
	if err != nil {
		response.Fatal(rsp, fmt.Errorf("cannot get observed composite resource: %w", err))
		return rsp, nil
	}

	kind := oxr.Resource.GetKind()
	handler, ok := f.Registry.Get(kind)
	if !ok {
		response.Fatal(rsp, fmt.Errorf("no orchestrator handler registered for kind %q", kind))
		return rsp, nil
	}

	desired, err := handler(oxr)
	if err != nil {
		response.Fatal(rsp, fmt.Errorf("handler for kind %q failed: %w", kind, err))
		return rsp, nil
	}

	if err := response.SetDesiredComposedResources(rsp, desired); err != nil {
		response.Fatal(rsp, fmt.Errorf("cannot set desired composed resources: %w", err))
		return rsp, nil
	}

	response.Normalf(rsp, "orchestrated %d composed resource(s) for %s/%s (kind=%s)",
		len(desired), oxr.Resource.GetNamespace(), oxr.Resource.GetName(), kind)
	return rsp, nil
}
