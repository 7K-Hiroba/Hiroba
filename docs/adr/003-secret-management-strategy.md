# ADR 003: Secret Management Strategy

## Status

Accepted

## Context

Platform products need credentials for SSO, cloud providers, and alerting integrations.

## Decision

Use External Secrets Operator (ESO) with HashiCorp Vault as the primary backend, with native Kubernetes Secrets as a fallback.

## Consequences

- Centralized secret lifecycle management.
- No secrets stored in Git.
- Requires ESO and Vault to be operational.
