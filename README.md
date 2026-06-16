# Platform Engineering

Internal platform engineering framework using **Crossplane** (infrastructure orchestration) and **CDK8s** (type-safe manifest generation) to deliver self-service "platform products" to development teams.

## Repository Structure

This repository is the central framework repository. It contains the shared platform library, consumer SDK, scaffolding tools, examples, and policies. Individual product stacks live in dedicated repositories.

```
platform-engineering/
├── packages/          # Shared platform library
├── consumer-sdk/      # Developer-facing libraries
├── tools/             # Scaffolding and documentation tools
├── infrastructure/    # Platform infrastructure
├── examples/          # Example consumer projects
├── policies/          # OPA / Kyverno policies
└── docs/              # Documentation
```

## Product Repositories

- **Observability Stack**: `/mnt/local-nas/Projects/7K-Hiroba/Observability Stack/`
  - GrafanaInstance
  - LokiInstance
  - PrometheusInstance
  - ObservabilityStack

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

## Documentation

- [Usage Guide](docs/usage-guide.md)
- [Architecture](docs/architecture.md)
- [Developer Guide](docs/developer-guide.md)
- [API Reference](docs/api-reference)
- [Runbooks](docs/runbooks)
- [ADRs](docs/adr)
