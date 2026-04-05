# Hiroba

**The community hub for 7KGroup's open-source Kubernetes platform initiative.**

Hiroba (広場, "public square") is the central repository for the 7KGroup community effort to standardize open-source solutions into production-ready, containerized, Kubernetes-native applications — delivered as Helm charts, platform manifests, and curated container images.

---

## Mission

We believe great open-source software deserves great packaging. Our goal is to:

- **Standardize** — Establish consistent patterns for deploying OSS on Kubernetes
- **Containerize** — Provide well-maintained, secure container images for popular applications
- **Platform** — Deliver opinionated but flexible Helm charts and manifests that work out of the box
- **Document** — Maintain comprehensive, community-driven documentation for every solution we ship

## Repository Structure

```
hiroba/
├── templates/
│   ├── app-template/                  # Backstage Software Template
│   │   ├── template.yaml              # Template definition (parameters, steps)
│   │   └── skeleton/                  # Scaffolded app repo structure
│   │       ├── helm/
│   │       │   ├── base/              # Core k8s resources (Deployment, Service, Ingress)
│   │       │   └── platform/          # Platform deps (CNPG, S3, Keycloak via Crossplane)
│   │       ├── Dockerfile
│   │       ├── crossplane/             # App-specific Crossplane compositions
│   │       ├── gitops/
│   │       │   ├── argocd/            # ArgoCD Application manifests
│   │       │   └── fluxcd/            # FluxCD Kustomization manifests
│   │       ├── .github/workflows/     # CI/CD referencing 7KGroup/workflow-library
│   │       ├── docs/                  # TechDocs content
│   │       └── catalog-info.yaml      # Backstage catalog entry
├── website/                           # Docusaurus documentation site
├── docs/                              # Project-level docs & ADRs
└── .github/                           # CI/CD workflows & issue templates
```

### Base vs Platform Charts

- **Base chart** (`helm/base/`) — Standard Kubernetes resources: Deployment, Service, Ingress, ServiceAccount, HPA. Everything needed to run the application.
- **Platform chart** (`helm/platform/`) — Third-party operator and Crossplane resources: CNPG PostgreSQL clusters, S3 buckets, Keycloak realms. Plug-and-play infrastructure that extends the application with managed dependencies.

## Quick Start

### Scaffold a New Application (via Backstage)

1. Open Backstage and navigate to **Create > Application Template**
2. Fill in application details, deployment config, and platform dependencies
3. Backstage scaffolds a full repo with Helm charts, Dockerfile, TechDocs, and CI/CD

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

**Part of the [7KGroup](https://github.com/7KGroup) open-source ecosystem.**
