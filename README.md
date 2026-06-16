# Platform Engineering

Internal platform engineering framework using **Crossplane** (infrastructure orchestration) and **CDK8s** (type-safe manifest generation) to deliver self-service "platform products" to development teams.

## Products

- **ObservabilityStack**: Grafana + Prometheus + Loki
- **GrafanaInstance**: Standalone Grafana with SSO, alerting, and TLS
- **LokiInstance**: Log aggregation with S3 or local storage
- **PrometheusInstance**: Metrics with alerting and federation

## Quick Start

```bash
# Install dependencies
make install

# Run lint and tests
make test

# Generate manifests
make synth

# Validate against Crossplane
make validate
```

## Repository Structure

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

## Documentation

- [Usage Guide](docs/usage-guide.md) — how to use the project, create applications, stacks, and products
- [Architecture](docs/architecture.md)
- [Developer Guide](docs/developer-guide.md)
- [API Reference](docs/api-reference)
- [Runbooks](docs/runbooks)
- [ADRs](docs/adr)
