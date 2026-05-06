# ${{ values.name }}

${{ values.description }}

A [Hiroba](https://hiroba.7kgroup.org) stack — a multi-app composition with GitOps-managed operators and per-app overrides.

## Overview

This stack composes multiple Hiroba applications into a single, deployable platform:

- **Operators** (CNPG, cert-manager, ESO, Prometheus) are individual ArgoCD Applications / FluxCD HelmReleases under `gitops/*/common/` — add or remove them by adding or deleting YAML files
- **Per-app value overrides** in `apps/<name>/` tailor each app without forking charts
- **GitOps orchestration** deploys everything in order via ArgoCD App-of-Apps or FluxCD Kustomizations

## Repository Structure

```text
├── apps/<app-name>/                 # Per-app value overrides
├── gitops/
│   ├── argocd/
│   │   ├── root.yaml                 # Bootstrap entry point
│   │   └── applications/
│   │       ├── common/               # Operators (cert-manager, CNPG, ESO, ...)
│   │       └── apps/                 # App Applications
│   └── fluxcd/
│       ├── common/                   # Operator HelmReleases
│       └── apps/                     # Per-app Kustomizations
├── docs/                            # Stack documentation
└── .github/workflows/               # CI/CD
```

## Quick Start

### 1. Review operators

Check `gitops/argocd/applications/common/` and remove any operators your stack doesn't need:

```bash
# Don't need Prometheus? Remove it.
rm gitops/argocd/applications/common/kube-prometheus-stack.yaml
```

### 2. Add your apps

See [docs/adding-apps.md](docs/adding-apps.md):

1. Copy `apps/example/` to `apps/<app-name>/`
2. Edit value overrides
3. Copy `gitops/argocd/applications/apps/example.yaml` to `<app-name>.yaml`
4. Commit and push

### 3. Deploy

**ArgoCD** (single command bootstraps everything):

```bash
kubectl apply -f gitops/argocd/root.yaml
```

**FluxCD:**

```bash
kubectl apply -f gitops/fluxcd/git-repository.yaml
kubectl apply -f gitops/fluxcd/kustomization-common.yaml
kubectl apply -f gitops/fluxcd/apps/
```

## License

[Apache 2.0](LICENSE)
