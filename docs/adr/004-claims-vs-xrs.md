# ADR 004: Claims vs XRs

## Status

Superseded by [ADR 007](007-orchestrator-function.md) — Crossplane v2 uses namespaced XRDs;
the Claim model no longer exists and consumers create XRs directly in their namespaces.

## Context

Developers need namespace-scoped access to platform resources.

## Decision

Expose namespace-scoped Claims (e.g., `GrafanaInstanceClaim`) that bind to cluster-scoped Composite Resources (XRs).

## Consequences

- Teams can create resources in their own namespaces.
- Platform team retains control over XR lifecycle and policies.
- Claims simplify RBAC and multi-tenancy.
