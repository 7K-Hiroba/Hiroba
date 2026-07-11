package platform

import (
	"github.com/crossplane/function-sdk-go/resource"
)

// Desired is the set of composed resources a handler wants for its composite.
type Desired map[resource.Name]*resource.DesiredComposed

// Handler renders the desired composed resources for one composite kind.
type Handler func(oxr *resource.Composite) (Desired, error)

// Registry maps a composite Kind to its Handler (ADR 007 kind-dispatch).
type Registry struct {
	handlers map[string]Handler
}

// NewRegistry returns an empty handler registry.
func NewRegistry() *Registry {
	return &Registry{handlers: map[string]Handler{}}
}

// Register associates a composite Kind with a Handler.
func (r *Registry) Register(kind string, h Handler) {
	r.handlers[kind] = h
}

// Get returns the Handler for a composite Kind.
func (r *Registry) Get(kind string) (Handler, bool) {
	h, ok := r.handlers[kind]
	return h, ok
}
