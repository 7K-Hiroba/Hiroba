---
sidebar_position: 3
---

# Backstage Software Templates (Internal)

:::info 7KGroup Maintainers Only
The Backstage instance is only accessible to 7KGroup representatives. Community members request new charts by [opening a Chart Request issue](https://github.com/7KGroup/hiroba/issues/new?template=chart_request.md) on GitHub.
:::

Hiroba uses [Backstage Software Templates](https://backstage.io/docs/features/software-templates/) internally to scaffold new application repositories when a chart request is approved.

## How It Works

1. A community member opens a **Chart Request** issue on GitHub
2. A 7KGroup maintainer reviews, evaluates and approves the request
3. The maintainer opens the Backstage portal and selects **"Application Template"**
4. They fill in parameters based on the issue:
   - **Application info** — name, description
   - **Deployment config** — container port, ingress hostname
   - **Included examples** — include or exclude example resource definitions (HTTPRoute, Postgres, S3)
   - **Repository** — where to publish on GitHub
5. Backstage scaffolds the repo:
   - Fetches the skeleton and renders `${{ values.* }}` placeholders
   - Publishes to GitHub
   - Registers the new component in the Backstage catalog
6. The maintainer links the new repo back to the original issue

## Template Structure

```
templates/app-template/
├── template.yaml           # Backstage template definition
└── skeleton/               # Files that get scaffolded
    ├── README.md
    ├── Dockerfile
    ├── catalog-info.yaml   # Backstage catalog entry
    ├── mkdocs.yml          # TechDocs config
    ├── helm/
    │   ├── base/           # Standard k8s Helm chart
    │   └── platform/       # Platform chart (example resource definitions)
    ├── crossplane/         # App-specific XRDs & Compositions
    ├── docs/               # Documentation
    └── .github/workflows/  # CI/CD referencing workflow-library
```

## Template Parameters

The `template.yaml` defines four parameter groups:

| Group | Fields | Purpose |
|---|---|---|
| Application Info | name, description, owner | Identity and ownership |
| Deployment Config | port | How the app is exposed |
| Included Examples | enableIngress, hostname, enablePostgres, enableS3 | Example resource definitions to include (all on by default) |
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
