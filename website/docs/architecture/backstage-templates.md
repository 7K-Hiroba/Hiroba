---
sidebar_position: 3
---

# Backstage Software Templates

Hiroba templates are designed as [Backstage Software Templates](https://backstage.io/docs/features/software-templates/) — the primary way developers create new applications.

## How It Works

1. A developer opens Backstage and selects **"Application Template"**
2. They fill in parameters across several steps:
   - **Application info** — name, description, owning team
   - **Deployment config** — container port, ingress hostname
   - **Platform dependencies** — toggle Postgres, S3, Keycloak
   - **Repository** — where to publish on GitHub
3. Backstage runs the template steps:
   - Fetches the skeleton and renders `${{ values.* }}` placeholders
   - Publishes to GitHub
   - Registers the new component in the Backstage catalog
4. The developer gets a fully wired repository with Helm charts, Dockerfile, CI/CD, and TechDocs

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
    │   └── platform/       # Platform dependencies chart
    ├── crossplane/         # App-specific XRDs & Compositions
    ├── docs/               # TechDocs content
    └── .github/workflows/  # CI/CD referencing workflow-library
```

## Template Parameters

The `template.yaml` defines four parameter groups:

| Group | Fields | Purpose |
|---|---|---|
| Application Info | name, description, owner | Identity and ownership |
| Deployment Config | port, enableIngress, hostname | How the app is exposed |
| Platform Dependencies | enablePostgres, enableS3, enableKeycloak | What infra to provision |
| Repository | repoUrl | Where to publish |

## Customizing Templates

To add a new template variant (e.g., a worker/queue consumer that doesn't need Ingress):

1. Create a new directory under `templates/` (e.g., `worker-template/`)
2. Add a `template.yaml` with appropriate parameters
3. Create the `skeleton/` with the desired file structure
4. Register the template in Backstage's `app-config.yaml`

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
