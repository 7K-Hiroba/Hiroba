# ObservabilityStack

This directory contains the KRO `ResourceGraphDefinition` (RGD) for the
`ObservabilityStack` product. The RGD composes:

- `ObjectBucket` + `PostgresInstance` primitives
- Helm Releases for Grafana, Loki, Prometheus/Mimir, and Alloy
- `HTTPRoute` for Grafana
- Datasource ConfigMap for Grafana auto-provisioning

For user-facing instructions on how to request and customize a stack, see:

- [Onboarding an ObservabilityStack](../../docs/runbooks/onboarding-observability-stack.md)

For deploying an agent in a remote/client cluster, see:

- [Onboarding an ObservabilityAgent](../../docs/runbooks/onboarding-observability-agent.md)

## Files

- `rg.yaml` — the `ResourceGraphDefinition` that orchestrates the stack.
