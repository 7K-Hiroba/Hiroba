# ADR 006: Multi-Provider Compositions

## Status

Accepted

## Context

The Hiroba catalog needs to support multiple infrastructure backends for the same platform product. Clients may run on AWS, Azure, or GCP, and some may prefer in-cluster operators (Garage for object storage, CNPG for Postgres) over managed cloud services.

The Inari architecture defines the catalog layout as:

```
hiroba-catalog/
├── xrd/
├── compositions/
│   ├── aws/
│   ├── gcp/
│   ├── azure/
│   └── common/
└── profiles/
```

We evaluated three alternatives:

1. **Capability-discovery orchestrator function** — a Crossplane Function that discovers cluster capabilities and dynamically selects backends.
2. **Kratix** — an open-source platform framework based on Promises and workflow pipelines.
3. **Provider-per-composition** — one Crossplane Composition per product per backend, selected via `spec.provider` or composition labels.

## Decision

Use provider-per-composition (option 3). Each product XRD remains cloud-agnostic, and each backend is implemented as a separate Composition. Operator backends (Garage, CNPG) are treated as additional providers.

## Consequences

- Aligns directly with the Inari catalog structure (ADR-003).
- No new runtime components (no orchestrator function, no capability agent).
- Adding a new backend means adding a new composition directory, which is predictable and testable.
- Consumers may optionally specify `spec.provider`; otherwise the cluster default applies.
- Consumers may optionally specify `spec.providerConfigRef.name` and `spec.region` to control the backing provider configuration and AWS region; when omitted, the composition uses cluster defaults.
- Provider-specific logic is isolated, making it easier to maintain and debug.

## Related

- [ADR 003: Hiroba Framework](../7k-inari/docs/architecture/decisions/ADR-003-hiroba.md)
- [ADR 001: Why Crossplane](./001-why-crossplane.md)
