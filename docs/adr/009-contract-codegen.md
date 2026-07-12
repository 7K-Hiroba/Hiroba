# ADR 009: Contract Codegen From a Single JSON Source

## Status

Accepted.

## Context

The platform contract — API group/version, product kinds and plurals, profile
defaults per product, supported providers and defaults, connection key names — was
defined independently in TypeScript (`packages/shared`) and Go
(`functions/platform`). The two copies drifted silently; a provider added to the TS
enum but not the Go handler (or vice versa) only surfaced at runtime.

## Decision

`contract/contract.json` is the single source of truth. `npm run gen:contract`
(`scripts/gen-contract.ts`) generates:

- `packages/shared/src/contract.gen.ts` — consumed by the cdk8s packages and the
  consumer SDK;
- `functions/platform/internal/contract/contract.gen.go` — consumed by the
  orchestrator handlers.

Rules:

- Generated files carry a `// Code generated ... DO NOT EDIT` header and are never
  hand-edited.
- The Go output is passed through `gofmt` inside the generator so generated code
  matches gofmt'ed trees (otherwise `--check` oscillates).
- `npm run gen:contract -- --check` regenerates in memory and fails on drift; it
  runs in `scripts/pre-push-checks.sh` and CI, so a contract change without codegen
  cannot be committed.

## Consequences

- Adding a provider/profile/product key is a one-file change plus regeneration;
  both languages stay consistent by construction.
- The generator itself is small (~200 LOC) and has no third-party dependencies
  beyond ts-node and gofmt.
- Contract values that are environment-specific (cluster default provider) do NOT
  belong in the contract; they come from the function's env config
  (`PLATFORM_DEFAULT_*`), with the contract supplying the fallback default.
