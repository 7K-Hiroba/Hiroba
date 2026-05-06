# Okura

**Kubernetes packaging for managed cloud and hybrid platforms.**

Okura (広場, "public square") is a 7KGroup community project that packages open-source applications into ready-to-deploy Helm charts, container images, and platform manifests — designed for teams running Kubernetes across managed cloud and hybrid environments.

---

## Mission

Great open-source software deserves packaging that works consistently across managed cloud platforms. Our goal is to:

- **Standardize** — Consistent patterns for deploying cloud-ready apps on Kubernetes
- **Containerize** — Lean, secure container images you can trust on your own hardware
- **Platform** — Opinionated Helm charts that wire up databases, storage, and auth using managed services
- **Document** — Clear guides written for real people, not enterprise consultants

## Repository Structure

```
okura/
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
│   │       ├── .github/workflows/     # CI/CD referencing 7K-Okura/workflows-library
│   │       └── docs/                  # Documentation
├── website/                           # Docusaurus documentation site
├── docs/                              # Project-level docs & ADRs
└── .github/                           # CI/CD workflows & issue templates
```

### Base vs Platform Charts

- **Platform chart** (`helm/platform/`) — Okura's focus. Always custom. Wires in databases (CNPG), storage (S3), auth (Keycloak), and observability using cluster operators — plug-and-play infrastructure without manual setup.
- **Base chart** (`helm/base/`) — The application itself. Often just an upstream third-party Helm chart used as a dependency — Okura doesn't rewrite what already works.

## Quick Start

### Clone and Deploy

```bash
git clone https://github.com/7K-Okura/Okura.git
cp -r okura/templates/app-template/skeleton ./my-app
cd my-app
```

Replace the `${{ values.* }}` placeholders with your values, then deploy:

```bash
# Deploy the application
helm install my-app ./helm/base

# Optionally add platform dependencies (managed Postgres, object storage, etc.)
helm install my-app-platform ./helm/platform
```

### Request a New Chart

Want a chart for an app we don't cover yet? [Open a Chart Request issue](https://github.com/7K-Okura/Okura/issues/new?template=chart_request.md) — a 7KGroup maintainer will scaffold and publish the new repo.

### Browse the Documentation

Visit the [Okura docs site](https://7kgroup.github.io/okura) for guides, roadmaps, and reference material.

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
