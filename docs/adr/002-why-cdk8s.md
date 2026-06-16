# ADR 002: Why CDK8s

## Status

Accepted

## Context

Platform manifests (XRDs, Compositions) must be maintainable, type-safe, and testable.

## Decision

Use CDK8s with TypeScript for manifest generation.

## Consequences

- Type safety and IDE support.
- Reusable constructs and snapshot testing.
- Additional build step before deploying YAML.
