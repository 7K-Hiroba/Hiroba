# Architecture Overview

Hiroba is an internal platform engineering framework built on **Crossplane v2**
(infrastructure orchestration) and **CDK8s** (type-safe manifest generation for
XRDs and Compositions). All reconciliation logic lives in a single Go composition
function; TypeScript packages only describe APIs.

## The Orchestrator (ADR 007)

`function-platform` is a single Crossplane composition function that dispatches on
the composite resource's `apiVersion`/`kind`. Every product — primitive or stack —
ships:

1. an XRD (`apiextensions.crossplane.io/v2`, `scope: Namespaced`), and
2. a thin Pipeline Composition with one step: invoke `function-platform`.

Provider branching, profile defaults, hierarchical composition, and readiness live
in the Go handlers (`functions/platform/handlers/`), not in Composition files.

```
packages/<product>/src/xrd.ts   -> XRD + thin Composition (cdk8s synth)
functions/platform/handlers/    -> one handler per kind, registered in cmd/main.go
contract/contract.json          -> single source of truth (ADR 009), codegen to TS + Go
```

## Products

Primitives (this repo):

- **PostgresInstance**: `spec.provider`: `cnpg` (CloudNativePG, default) or `aws` (RDS).
- **ObjectBucket**: `spec.provider`: `garage` (default) or `aws` (S3).

Observability (consumer repo, ADR 008):

- **GrafanaInstance**, **LokiInstance**, **PrometheusInstance**, **MimirInstance**,
  **AlloyInstance**: thin XRDs reconciled by orchestrator handlers that emit
  provider-helm Releases (namespaced `helm.m.crossplane.io` API).
- **ObservabilityStack**: emits child XRs per enabled module, wires Grafana
  datasources from observed child status, and is Ready when all children are Ready.

## Crossplane v2 Contract Notes

- **No XR connection secrets.** v2 drops `connectionSecretKeys`; function-returned
  connection details for child XRs are not persisted. The public contract is
  `status`: `phase`, `endpoint`, `connectionSecretRef` (pointing at the
  provider-native secret, e.g. the CNPG operator's `<name>-pg-app`).
- **Explicit readiness.** Pipeline composed resources are unready unless the
  function says otherwise; handlers derive readiness from the observed resource's
  `Ready` condition or a healthy `status.phase`.
- **Namespaced provider configs.** Composed managed resources reference
  `<team>-<provider>` ProviderConfigs in the XR namespace (e.g. `team-api-helm`,
  `team-api-aws`).

## Dependency Gate

The orchestrator fails fast when a required operator is missing. `contract/contract.json`
declares required CRDs per XR kind and provider (`dependencies`); before dispatching
to a handler, the function verifies those CRDs are installed (discovery API, 60s
cache). A missing dependency aborts the reconcile with a fatal, client-actionable
error naming the CRDs and the operator to install — installing operators stays the
platform operator's responsibility, and the error is visible via
`kubectl describe <xr>`. Outside a cluster (render, tests) the check is a no-op.

## Provider & Profile Defaults

Precedence: `spec.*` override > function env config (`PLATFORM_DEFAULT_*`) >
contract default. Profile (`development|staging|production`) supplies defaults for
instance class, HA, backups, and deletion policy per the contract.

## Repository Layout

```
hiroba/
├── contract/          # contract.json + codegen
├── functions/platform/# Go orchestrator (handlers, registry, provider config)
├── packages/          # shared lib + primitives (XRDs via cdk8s)
├── consumer-sdk/      # Developer-facing typed constructs
├── infrastructure/    # Control-plane manifests (providers)
├── scripts/           # e2e-setup.sh, team-setup.sh, render-validate.sh
├── examples/          # Example consumer projects
└── docs/              # Documentation + ADRs
```

## Design Principles

1. **One reconciliation brain**: all logic in the orchestrator; TS describes APIs only.
2. **Status is the contract**: deterministic names + status fields, not secrets.
3. **Profile-driven defaults**: development/staging/production encode sensible defaults.
4. **Escape hatch**: every Helm-backed module accepts `spec.values` (chart defaults <
   user values < platform wiring).
5. **Schema-first guardrails**: XRD schemas enforce structure; the contract codegen
   keeps TS and Go in lockstep.
