# Hiroba

**Kubernetes packaging for self-hosters and homelab enthusiasts.**

Hiroba (広場, "public square") is a 7KGroup community project that packages open-source applications into ready-to-deploy Helm charts, container images, and platform manifests — designed for people running Kubernetes at home or on their own infrastructure.

---

## Mission

Great open-source software deserves packaging that just works on a single-node cluster or a small homelab. Our goal is to:

- **Standardize** — Consistent patterns for deploying self-hosted apps on Kubernetes
- **Containerize** — Lean, secure container images you can trust on your own hardware
- **Platform** — Opinionated Helm charts that wire up databases, storage, and auth with minimal fuss
- **Document** — Clear guides written for real people, not enterprise consultants

## Repository Structure

```
hiroba/
├── templates/
│   ├── app-template/                  # Application template
│   │   ├── template.yaml              # Template definition (parameters, steps)
│   │   └── skeleton/                  # App repo structure
│   │       ├── helm/
│   │       │   ├── base/              # Core k8s resources (Deployment, Service, Ingress)
│   │       │   └── platform/          # Platform deps (CNPG, S3, Keycloak via Crossplane)
│   │       ├── Dockerfile
│   │       ├── crossplane/             # App-specific Crossplane compositions
│   │       ├── gitops/
│   │       │   ├── argocd/            # ArgoCD Application manifests
│   │       │   └── fluxcd/            # FluxCD Kustomization manifests
│   │       ├── .github/workflows/     # CI/CD referencing 7K-Hiroba/workflows-library
│   │       └── docs/                  # Documentation
├── website/                           # Docusaurus documentation site
├── docs/                              # Project-level docs & ADRs
└── .github/                           # CI/CD workflows & issue templates
```

### Base vs Platform Charts

- **Platform chart** (`helm/platform/`) — Hiroba's focus. Always custom. Wires in databases (CNPG), storage (S3), auth (Keycloak), and observability using cluster operators — plug-and-play infrastructure without manual setup.
- **Base chart** (`helm/base/`) — The application itself. Often just an upstream third-party Helm chart used as a dependency — Hiroba doesn't rewrite what already works.

## Quick Start

### Clone and Deploy

```bash
git clone https://github.com/7KGroup/hiroba.git
cp -r hiroba/templates/app-template/skeleton ./my-app
cd my-app
```

Replace the `${{ values.* }}` placeholders with your values, then deploy:

```bash
# Deploy the application
helm install my-app ./helm/base

# Optionally add platform dependencies (Postgres, S3, etc.)
helm install my-app-platform ./helm/platform
```

### Request a New Chart

Want a chart for an app we don't cover yet? [Open a Chart Request issue](https://github.com/7KGroup/hiroba/issues/new?template=chart_request.md) — a 7KGroup maintainer will scaffold and publish the new repo.

### Browse the Documentation

Visit the [Hiroba docs site](https://7kgroup.github.io/hiroba) for guides, roadmaps, and reference material.

### Run the Docs Site Locally

```bash
cd website
npm install
npm start
```

## Contributing

We welcome contributions from the community! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

All contributors are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Governance

See [GOVERNANCE.md](GOVERNANCE.md) for details on how decisions are made and how the project is organized.

## License

This project is licensed under the [Apache License 2.0](LICENSE).

---

**Part of the [7K-Group](https://7kgroup.org/) open-source effort.**
