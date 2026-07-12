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
// composite's apiVersion/kind via the Registry (ADR 007).
type Function struct {
	fnv1.UnimplementedFunctionRunnerServiceServer

	Log      logging.Logger
	Registry *Registry
	Config   Config
}

// RunFunction is the gRPC entrypoint invoked by Crossplane for each reconciliation.
func (f *Function) RunFunction(ctx context.Context, req *fnv1.RunFunctionRequest) (*fnv1.RunFunctionResponse, error) {
	rsp := response.To(req, response.DefaultTTL)

	log := f.Log
	if log == nil {
		log = logging.NewNopLogger()
	}

	oxr, err := request.GetObservedCompositeResource(req)
	if err != nil {
		response.Fatal(rsp, fmt.Errorf("cannot get observed composite resource: %w", err))
		return rsp, nil
	}

	dxr, err := request.GetDesiredCompositeResource(req)
	if err != nil {
		response.Fatal(rsp, fmt.Errorf("cannot get desired composite resource: %w", err))
		return rsp, nil
	}

	observed, err := request.GetObservedComposedResources(req)
	if err != nil {
		response.Fatal(rsp, fmt.Errorf("cannot get observed composed resources: %w", err))
		return rsp, nil
	}

	var input map[string]any
	if req.GetInput() != nil {
		input = req.GetInput().AsMap()
	}

	apiVersion := oxr.Resource.GetAPIVersion()
	kind := oxr.Resource.GetKind()
	name := oxr.Resource.GetName()
	ns := oxr.Resource.GetNamespace()

	handler, ok := f.Registry.Get(apiVersion, kind)
	if !ok {
		response.Fatal(rsp, fmt.Errorf("no orchestrator handler registered for %s/%s", apiVersion, kind))
		return rsp, nil
	}

	log.Debug("orchestrating composite", "apiVersion", apiVersion, "kind", kind, "namespace", ns, "name", name)

	res, err := handler(&HandlerContext{
		Ctx:      ctx,
		Log:      log,
		Config:   f.Config,
		OXR:      oxr,
		DXR:      dxr,
		Observed: observed,
		Input:    input,
	})
	if err != nil {
		response.Fatal(rsp, fmt.Errorf("handler for %s/%s failed: %w", apiVersion, kind, err))
		return rsp, nil
	}
	if res == nil {
		response.Fatal(rsp, fmt.Errorf("handler for %s/%s returned no result", apiVersion, kind))
		return rsp, nil
	}

	if len(res.Desired) > 0 {
		if err := response.SetDesiredComposedResources(rsp, res.Desired); err != nil {
			response.Fatal(rsp, fmt.Errorf("cannot set desired composed resources: %w", err))
			return rsp, nil
		}
	}

	for path, value := range res.Status {
		if err := dxr.Resource.SetValue("status."+path, value); err != nil {
			response.Fatal(rsp, fmt.Errorf("cannot set status.%s: %w", path, err))
			return rsp, nil
		}
	}

	if len(res.ConnectionDetails) > 0 {
		if dxr.ConnectionDetails == nil {
			dxr.ConnectionDetails = map[string][]byte{}
		}
		for k, v := range res.ConnectionDetails {
			dxr.ConnectionDetails[k] = v
		}
		// Ensure the XR publishes its connection secret under a deterministic name.
		if name := SpecString(dxr, "writeConnectionSecretToRef", "name"); name == "" {
			_ = dxr.Resource.SetValue("spec.writeConnectionSecretToRef.name", oxr.Resource.GetName()+"-conn")
		}
	}

	if err := response.SetDesiredCompositeResource(rsp, dxr); err != nil {
		response.Fatal(rsp, fmt.Errorf("cannot set desired composite resource: %w", err))
		return rsp, nil
	}

	for _, w := range res.Warnings {
		response.Warning(rsp, fmt.Errorf("%s/%s %s/%s: %s", apiVersion, kind, ns, name, w))
	}

	response.Normalf(rsp, "orchestrated %d composed resource(s) for %s/%s (kind=%s)",
		len(res.Desired), ns, name, kind)
	return rsp, nil
}
