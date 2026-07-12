# ADR 007: Central Orchestrator Function & Crossplane v2-Only

## Status

Accepted. Supersedes [ADR 006: Multi-Provider Compositions](./006-multi-provider-compositions.md).

## Context

Hiroba is being reshaped around a small set of **agnostic, reusable primitives**
(e.g. `PostgresInstance`, `ObjectBucket`) that any stack may compose, each with an
inherent backend toggle (`spec.provider`: `aws`, `gcp`, `azure`, `garage`, `cnpg`,
`s3`, `local`). Nothing in the catalog has been published as a product yet, so we are
free to remove code rather than migrate it.

ADR 006 implemented the provider toggle as **one Composition per backend**
(`compositions/aws.ts`, `compositions/cnpg.ts`, ...) selected by `spec.provider` via
`compositionSelector`. That approach:

- duplicates Composition scaffolding per backend;
- cannot cleanly compose a _primitive_ inside a _stack_ (patch-and-transform does not
  orchestrate child XRs well);
- still embeds provider branching in generated YAML rather than in testable code.

We also decided to standardize on **Crossplane v2 exclusively**: namespaced composite
resources (no legacy Claim model), v2 XRDs, and (optionally) namespaced providers for
per-team credential isolation.

## Decision

1. **Single central orchestrator Composition Function** (`function-platform`), written
   in Go with `function-sdk-go`. Every Composition — primitives _and_ stacks — runs in
   `Pipeline` mode with one step that calls `function-platform`. The function dispatches
   on the observed composite's `apiVersion/kind` via an internal registry and emits the
   desired composed resources for that kind.
2. **Provider branching lives in the function**, not in per-backend Composition files.
   A primitive handler reads `spec.provider` and emits the matching managed resource(s)
   (e.g. RDS `Instance` for `aws`, CNPG `Cluster` for `cnpg`).
3. **Hierarchical composition**: a stack handler emits child _primitive_ XRs as composed
   resources; those child XRs are reconciled by their own Composition (also calling
   `function-platform`), which emits the managed resources. One binary orchestrates the
   whole stack → primitive → managed tree.
4. **Crossplane v2 only**. All XRDs use `apiextensions.crossplane.io/v2` with
   `spec.scope: Namespaced`; the legacy `claimNames` / cluster-scoped Claim model is not
   used. Consumers create the XR directly in their namespace.
5. **Namespaced providers** (`pkg.m.crossplane.io`) for per-team credential isolation.
   The function resolves `spec.providerConfigRef` to a namespace-scoped `ProviderConfig`
   (convention `<team>-<provider>`, overridable on the XR).
6. A **stable connection-secret contract** is defined per primitive (see
   `packages/shared`) so stacks can later reference a primitive's connection details
   instead of inlining infrastructure.

## Consequences

- One Composition per product (not per backend); adding a backend is a branch in a
  handler, not a new Composition file.
- Shared concerns (provider → region / `providerConfigRef` mapping, mandatory labels,
  naming, connection-secret aggregation) live once in the function.
- Introduces a Go toolchain into a previously TypeScript-only repository: `go.mod`,
  Dockerfile, function-image/xpkg build and a CI lane.
- ADR 006's per-provider Composition file layout is retired.
- All existing v1 XRDs and `*Claim` usage are removed/rewritten as part of this change.

## v2-only / delete checklist (completed 2026-07-12)

- [x] All XRDs emit `apiextensions.crossplane.io/v2` with `spec.scope: Namespaced`.
- [x] No `claimNames` on any XRD; no `*Claim` kinds emitted by the consumer SDK.
- [x] CI lint gate rejects `apiextensions.crossplane.io/v1` XRDs and any `claimNames`.
- [x] Remove per-provider Composition file split (`compositions/{aws,cnpg,garage,...}.ts`).
- [x] Remove inline RDS/CNPG from `grafana` and inline S3/Garage from `loki`/`mimir`;
      replaced by child `PostgresInstance` / `ObjectBucket` XRs emitted by the handlers.
- [x] Remove dead `functions/grafana-sso/*` remnants.
- [x] Remove deprecated `CloudProvider` / `MultiCloudResourceConfig` aliases in
      `packages/shared/src/types.ts`.
- [x] Collapse the duplicated `packages/shared` in the Observability Stack repo; consume
      Hiroba's `@7k-hiroba/shared` as the single source of truth.

## v2 conformance notes (added 2026-07-12, live e2e on kind)

- Crossplane v2 drops XR-level connection secrets: `connectionSecretKeys` is not
  supported on v2 XRDs, and function-returned connection details for child XRs are
  not persisted. The contract surface is `status` (endpoint, phase,
  connectionSecretRef); cross-child wiring reads the child XR's `status`, not
  connection details.
- The v2 XRD -> CRD converter rejects `additionalProperties` combined with
  `properties` on nested object fields; keep nested schemas structural or free-form.
- Namespaced provider APIs (`*.m.*`, e.g. `helm.m.crossplane.io/v1beta1`,
  `*.m.upbound.io/v1beta1`) require `spec.providerConfigRef.kind`; legacy
  cluster-scoped APIs forbid it. `SetProviderConfigRef` branches on the composed
  resource's apiVersion.
- Function pipeline readiness is explicit: composed resources without a readiness
  verdict are treated as unready. Handlers set readiness from the observed
  resource's `Ready` condition or a healthy `status.phase`.
- The function container reads mTLS certs from `/tls/server` (Crossplane v2 mount).

## Related

- [ADR 006: Multi-Provider Compositions](./006-multi-provider-compositions.md) (superseded)
- [ADR 005: Feature Toggle Pattern](./005-feature-toggle-pattern.md)
- [ADR 001: Why Crossplane](./001-why-crossplane.md)
