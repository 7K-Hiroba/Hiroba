# ADR 005: Feature Toggle Pattern

## Status

Accepted

## Context

Platform products need optional features (SSO, alerting, ingress) without duplicating Compositions.

## Decision

Use boolean feature toggles in the XRD schema and patch-based conditional resource creation via `function-patch-and-transform`. Future iterations may migrate to custom Composition Functions.

## Consequences

- Single Composition supports multiple configurations.
- Patch-based toggles set `replicas: 0` for disabled resources.
- Composition Functions enable true conditional creation in Phase 6.
