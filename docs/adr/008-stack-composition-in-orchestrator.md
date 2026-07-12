# ADR 008: Product Stacks Compose Inside the Orchestrator

## Status

Accepted.

## Context

The consumer "Observability Stack" repo originally shipped a full cdk8s/TypeScript
composition framework: per-module Composition files, a wiring layer that stitched
modules together, and vendored copies of Hiroba's `packages/shared`. With ADR 007,
Hiroba's TS packages already degenerated to XRD + thin Pipeline Composition; keeping
a parallel composition engine in the consumer repo duplicated the orchestrator's job
and drifted from the shared library (the vendored fork was ~170k LOC).

## Decision

Product stacks (`ObservabilityStack`) are composed **inside the Go orchestrator**,
exactly like primitives:

1. The consumer repo's packages emit only the XRD (`createPlatformXrd`) and a thin
   orchestrated Composition (`createOrchestratedComposition`). No composition logic
   lives in TypeScript.
2. `function-platform` registers a handler per stack kind
   (`ObservabilityStack`, ...). The stack handler emits **child XRs**
   (`GrafanaInstance`, `LokiInstance`, `PrometheusInstance`/`MimirInstance`,
   `AlloyInstance`) with deterministic names (`<stack>-<module>`), forwarding
   profile/team/costCenter and the per-module `spec.modules.<name>.values` escape
   hatch. Child XRs reconcile through their own thin Compositions back into the same
   orchestrator (hierarchical composition).
3. Cross-child wiring (Grafana datasources) is emitted by the stack handler as a
   ConfigMap labeled `grafana_datasource: 1`, built from **observed child `status`**
   (Crossplane v2 persists no XR-level connection details).
4. The stack is Ready when every enabled child is Ready; `status.endpoint` points at
   the Grafana service.

## Consequences

- One reconciliation brain for the whole platform; consumer repos need no Go or
  composition code, only XRD schemas and tests.
- Deleting the consumer composition framework removed ~170k LOC of dead code and the
  vendored shared fork; the consumer now depends on `@7k-hiroba/shared` directly.
- Stack handlers must be registered in `cmd/main.go`; adding a module to a stack is
  a Go change in Hiroba, not a consumer-repo change. The values escape hatch keeps
  chart-level customization in team hands.
- Crossplane v2 prunes child XRs automatically when a module is disabled (the
  handler drops them from desired state).
