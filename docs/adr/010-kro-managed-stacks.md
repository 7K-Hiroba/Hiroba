# ADR 010: Product Stacks are Managed by KRO and Deployed by ArgoCD

## Status

Accepted. Supersedes ADR 008.

## Context

ADR 008 placed product-stack composition inside the Go orchestrator
(`function-platform`). That worked for the first observability stack, but as the
number of Helm charts, cross-component wiring rules, and per-team overrides grew,
the orchestrator became a chokepoint:

- Every new module, chart version bump, or wiring rule required a Go change,
  image rebuild, and Crossplane package rollout in the control plane.
- Values overrides lived in the XR schema (`spec.modules.<name>.values`), which
  forced stack authors to choose between a small schema and an endless escape
  hatch.
- Crossplane v2 drops XR-level connection secrets, so stack wiring had to be
  derived from observed child `status`. That is correct for primitives, but
  awkward for Helm-heavy stacks where the desired state is mostly chart values.
- The orchestrator is the right place for provider-aware primitives
  (`PostgresInstance`, `ObjectBucket`) that need dependency gating and provider
  config resolution. It is not the right place for stitching together Helm
  releases that teams want to iterate on via GitOps.

Meanwhile, the platform adopted **KRO** (Kubernetes Resource Orchestrator) for
higher-order abstractions and **ArgoCD** for GitOps-driven Helm delivery.

## Decision

Product **stacks** move out of `function-platform` and into **KRO**
`ResourceGraphDefinition`s that emit **ArgoCD Applications**:

1. **Primitives stay in the orchestrator.** `PostgresInstance` and
   `ObjectBucket` remain Crossplane XRs reconciled by `function-platform`. They
   are the stable backend contracts that stacks consume.
2. **Stacks become KRO RGDs.** `ObservabilityStack` and `ObservabilityAgent`
   live as plain YAML RGDs under `stacks/`. They define a schema and use CEL to
   wire primitives and ArgoCD Applications.
3. **ArgoCD executes Helm.** Each module is an ArgoCD Application using
   multi-source: the upstream Helm chart plus a per-client values file. Platform
   wiring (endpoints, bucket names, credential secret refs, Alloy remote
   endpoints) is injected through `valuesObject` and always wins over the values
   file.
4. **Per-client fast lane.** Teams place chart overrides in their Git repo at
   `clients/<team>/observability/<component>.yaml`. Merging those files triggers
   ArgoCD sync without touching the RGD.
5. **No stack code in `function-platform`.** Stack handlers are removed from
   `cmd/main.go`; the Go function only dispatches primitives.

## Consequences

- Stacks can evolve independently of the orchestrator image. A chart version
  bump is a YAML change.
- Teams get a Git-native override path that platform wiring cannot accidentally
  override.
- The runtime contract for a stack shifts from "child XR status" to "the
  deterministic names and values emitted by the RGD". ArgoCD health becomes the
  consumer-visible signal.
- The control plane must run KRO and ArgoCD (with `application.namespaces`
  enabled) in addition to Crossplane.
- Stack authors must think in KRO (CEL, `includeWhen`, resource DAG) instead of
  Go + Crossplane function SDK.
