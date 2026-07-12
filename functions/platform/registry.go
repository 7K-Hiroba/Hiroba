// Package platform is the central Crossplane composition orchestrator (ADR 007).
//
// Every primitive and stack Composition runs a single Pipeline step that calls this
// function. RunFunction dispatches on the observed composite's apiVersion/kind via the
// Registry, and the matched Handler emits the desired composed resources — including
// child primitive XRs for stacks, and managed resources (RDS, CNPG, S3, Garage, ...)
// for primitives.
package platform

import (
	"context"
	"fmt"

	"github.com/crossplane/function-sdk-go/logging"
	"github.com/crossplane/function-sdk-go/resource"
)

// Config holds platform-wide defaults for the orchestrator, loaded from the
// function's environment at startup (see cmd/main.go). Precedence for provider
// selection: XR spec.provider > Config default > contract default.
type Config struct {
	// DefaultProviders maps a product key (e.g. "postgres", "objectStorage")
	// to the provider the platform operator wants XRs to use when
	// spec.provider is unset.
	DefaultProviders map[string]string
}

// DefaultProvider returns the configured default provider for a product,
// falling back to the contract default when unset.
func (c Config) DefaultProvider(product, contractDefault string) string {
	if c.DefaultProviders != nil {
		if p := c.DefaultProviders[product]; p != "" {
			return p
		}
	}
	return contractDefault
}

// Desired is the set of composed resources a handler wants for its composite.
type Desired map[resource.Name]*resource.DesiredComposed

// HandlerContext carries everything a handler needs to render desired state.
type HandlerContext struct {
	Ctx context.Context
	Log logging.Logger

	// Config holds platform-wide defaults (provider selection etc.).
	Config Config

	// OXR is the observed composite (spec + metadata as last applied).
	OXR *resource.Composite
	// DXR is the desired composite accumulated by earlier pipeline steps. Handlers
	// may read it but should return status/connection details via Result instead.
	DXR *resource.Composite
	// Observed holds the previously composed resources, keyed by composition
	// resource name, including their resolved connection details.
	Observed map[resource.Name]resource.ObservedComposed
	// Input is the pipeline step's input object, if the Composition set one.
	Input map[string]any
}

// Result is what a handler returns for its composite.
type Result struct {
	// Desired composed resources, keyed by composition resource name.
	Desired Desired
	// Status is shallow-merged into the composite's status (e.g. "endpoint").
	Status map[string]any
	// ConnectionDetails are merged into the composite's connection secret.
	ConnectionDetails resource.ConnectionDetails
	// Warnings are surfaced as non-fatal results on the response.
	Warnings []string
}

// Handler renders the desired state for one composite kind.
type Handler func(hc *HandlerContext) (*Result, error)

// Registry maps a composite apiVersion/kind to its Handler (ADR 007 dispatch).
type Registry struct {
	handlers map[string]Handler
}

// NewRegistry returns an empty handler registry.
func NewRegistry() *Registry {
	return &Registry{handlers: map[string]Handler{}}
}

func registryKey(apiVersion, kind string) string {
	return apiVersion + "/" + kind
}

// Register associates a composite apiVersion/kind with a Handler. It panics on
// duplicate registration: that is a programming error and must fail at startup.
func (r *Registry) Register(apiVersion, kind string, h Handler) {
	key := registryKey(apiVersion, kind)
	if _, exists := r.handlers[key]; exists {
		panic(fmt.Sprintf("orchestrator handler already registered for %s", key))
	}
	r.handlers[key] = h
}

// Get returns the Handler for a composite apiVersion/kind.
func (r *Registry) Get(apiVersion, kind string) (Handler, bool) {
	h, ok := r.handlers[registryKey(apiVersion, kind)]
	return h, ok
}

// Keys returns the registered apiVersion/kind keys (for startup validation and tests).
func (r *Registry) Keys() []string {
	keys := make([]string, 0, len(r.handlers))
	for k := range r.handlers {
		keys = append(keys, k)
	}
	return keys
}
