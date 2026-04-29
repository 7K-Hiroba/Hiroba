---
sidebar_position: 3
---

# Backstage Software Templates (Internal)

:::info 7KGroup Maintainers Only
The Backstage instance is only accessible to 7KGroup representatives. Community members request new charts by [opening a Chart Request issue](https://github.com/7K-Hiroba/Hiroba/issues/new?template=chart_request.md) on GitHub.
:::

Hiroba uses [Backstage Software Templates](https://backstage.io/docs/features/software-templates/) internally to scaffold new repositories when a chart or stack request is approved.

## Available Templates

| Template | Backstage Entity | Purpose |
|----------|-----------------|---------|
| **Application Template** | `Component` (service) | Single app with Helm charts, Dockerfile, CI/CD, Crossplane compositions |
| **Stack Template** | `System` | Multi-app composition with GitOps orchestration, operator management, per-app value overrides |

## How It Works

1. A community member opens a **Chart Request** issue on GitHub
2. A 7KGroup maintainer reviews, evaluates and approves the request
3. The maintainer opens the Backstage portal and selects the appropriate template
4. They fill in parameters based on the issue
5. Backstage scaffolds the repo:
   - Fetches the skeleton and renders `${{ values.* }}` placeholders
   - Publishes to GitHub
   - Registers the new component in the Backstage catalog
6. The maintainer links the new repo back to the original issue

## Template Structure

### Application Template

```text
templates/app-template/
├── template.yaml           # Backstage template definition
└── skeleton/               # Files that get scaffolded
    ├── README.md
    ├── Dockerfile
    ├── catalog-info.yaml   # Backstage catalog entry (Component)
    ├── mkdocs.yml          # TechDocs config
    ├── helm/
    │   ├── base/           # Standard k8s Helm chart
    │   └── platform/       # Platform chart (example resource definitions)
    ├── crossplane/         # App-specific XRDs & Compositions
    ├── docs/               # Documentation
    └── .github/workflows/  # CI/CD referencing workflow-library
```

### Stack Template

```text
templates/stack-template/
├── template.yaml           # Backstage template definition
└── skeleton/               # Files that get scaffolded
    ├── README.md
    ├── catalog-info.yaml   # Backstage catalog entry (System)
    ├── apps/               # Per-app value overrides
    │   └── <app-name>/
    │       ├── values-base.yaml
    │       └── values-platform.yaml
    ├── gitops/
    │   ├── argocd/         # App-of-Apps orchestration
    │   │   ├── root.yaml
    │   │   └── applications/
    │   │       ├── common/  # Operator Applications
    │   │       └── apps/    # App Applications
    │   └── fluxcd/         # FluxCD Kustomization orchestration
    ├── docs/               # Stack documentation
    └── .github/workflows/  # CI/CD referencing workflow-library
```

## Template Parameters

### Application Template

The `template.yaml` defines four parameter groups:

| Group | Fields | Purpose |
|---|---|---|
| Application Info | name, description, owner | Identity and ownership |
| Deployment Config | port | How the app is exposed |
| Included Examples | enableIngress, hostname, enablePostgres, enableS3 | Example resource definitions to include (all on by default) |
| Repository | repoUrl | Where to publish |

### Stack Template

| Group | Fields | Purpose |
|---|---|---|
| Stack Info | name, description, owner | Identity and ownership |
| Repository | repoUrl | Where to publish |

## CI/CD Integration

Scaffolded workflows reference the centralized `7K-Hiroba/workflows-library`:

```yaml
jobs:
  build:
    uses: 7K-Hiroba/workflows-library/.github/workflows/build.yml@v1
    with:
      image-name: ghcr.io/7kgroup/my-app
    secrets: inherit
```

This ensures all applications share consistent build, test, and release pipelines.
