# Platform Engineering

Internal platform engineering framework using **Crossplane v2** (infrastructure
orchestration) and **CDK8s** (type-safe manifest generation) to deliver
self-service platform products to development teams. All reconciliation logic
lives in a single Go orchestrator function (ADR 007); TypeScript packages emit
XRDs and thin Pipeline Compositions only.

## Repository Structure

```
hiroba/
├── contract/           # contract.json: single source of truth (ADR 009)
├── functions/platform/ # Go orchestrator composition function
├── packages/           # shared lib + primitives (PostgresInstance, ObjectBucket)
├── consumer-sdk/       # developer-facing typed constructs
├── infrastructure/     # control-plane manifests
├── scripts/            # e2e-setup.sh, team-setup.sh, render-validate.sh
├── examples/           # example consumer projects
└── docs/               # docs + ADRs
```

## Product Repositories

- **Observability Stack**: `/mnt/local-nas/Projects/7K-Hiroba/Observability Stack/`
  - GrafanaInstance, LokiInstance, PrometheusInstance, MimirInstance,
    AlloyInstance, ObservabilityStack (ADR 008)

## Quick Start (local e2e)

```bash
# Bootstrap kind cluster: Crossplane, providers, ESO, CNPG, provider-helm,
# function-platform built from source and served from a local OCI registry.
scripts/e2e-setup.sh platform-e2e

# Per-team namespace: namespaced helm ProviderConfig + provider-helm RoleBinding.
scripts/team-setup.sh team-api platform-e2e

# Install primitives and create a database.
kubectl --context kind-platform-e2e apply \
  -f packages/postgres/dist/xrd.k8s.yaml \
  -f packages/postgres/dist/composition.k8s.yaml
```

## Development

```bash
bash scripts/pre-push-checks.sh   # contract check, lint, build, tests, synth, validate, go vet/test -race
npm run gen:contract              # regenerate TS + Go from contract/contract.json
HIROBA_ROOT=$PWD bash scripts/render-validate.sh packages/postgres
```

## Documentation

- [Usage Guide](docs/usage-guide.md)
- [Architecture](docs/architecture.md)
- [API Reference](docs/api-reference)
- [Runbooks](docs/runbooks)
- [ADRs](docs/adr)
