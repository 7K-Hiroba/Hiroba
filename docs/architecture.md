# Architecture Overview

This repository implements an internal platform engineering framework using **Crossplane** for infrastructure orchestration and **CDK8s** for type-safe manifest generation.

## Products

- **ObservabilityStack**: Composite product assembling Grafana + Prometheus + Loki with inter-module wiring.
- **GrafanaInstance**: Standalone Grafana with profile-driven defaults, SSO, alerting, and TLS.
- **LokiInstance**: Log aggregation with S3 or local storage and configurable retention.
- **PrometheusInstance**: Metrics with alerting and federation.

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Control Plane | Crossplane v2 | Universal infrastructure reconciliation |
| Manifest Generation | CDK8s (TypeScript) | Type-safe YAML generation for XRDs, Compositions, and consumers |
| Secret Management | External Secrets Operator (ESO) | Sync secrets from Vault / AWS Secrets Manager |
| GitOps | ArgoCD | Continuous delivery |
| Cloud Provider | AWS | Managed resources (S3, RDS, IAM) |
| Kubernetes Operators | Grafana Operator, Prometheus Operator, Loki Operator | In-cluster workload management |
| Ingress / TLS | cert-manager + nginx-ingress + External-DNS | Automated DNS and certificates |
| CI/CD | GitHub Actions | Build, test, and publish |

## Repository Layout

```
platform-engineering/
├── packages/          # Primitive platform products
├── stacks/            # Composite platform products
├── consumer-sdk/      # Developer-facing libraries
├── infrastructure/    # Platform infrastructure
├── examples/          # Example consumer projects
├── policies/          # OPA / Kyverno policies
└── docs/              # Documentation
```

## Design Principles

1. **Modularity**: Each primitive product is independently packageable as a `.xpkg`.
2. **Profile-driven defaults**: Development, staging, and production profiles encode sensible defaults.
3. **Feature toggles**: SSO, alerting, and ingress can be enabled per instance.
4. **Developer experience**: Teams consume the platform via a typed TypeScript SDK.
5. **Guardrails**: Kyverno policies enforce cost-center labels and restrict production access.
