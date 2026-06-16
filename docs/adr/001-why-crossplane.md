# ADR 001: Why Crossplane

## Status

Accepted

## Context

We need a control plane to orchestrate infrastructure across multiple Kubernetes clusters and cloud providers.

## Decision

Use Crossplane v2 as the universal control plane.

## Consequences

- Enables declarative infrastructure as Kubernetes resources.
- Supports composition of higher-level abstractions (XRDs).
- Requires investment in provider management and function pipelines.
