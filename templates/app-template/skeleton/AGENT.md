# Agent Guide

This file is for AI agents and automated tools making changes to this repository. Read this before modifying any files.

## Philosophy: Near-Native

This project follows a **near-native** approach. We prefer upstream, official solutions over custom implementations.

- If the application has an **official Helm chart**, use it as the base rather than writing one from scratch. The `helm/base/` directory may contain the upstream chart as a dependency or a thin wrapper around it.
- If the application has an **official Docker image**, use it. Only maintain a custom Dockerfile if the 7KGroup admins have determined the maintenance cost is justified (e.g., the official image is poorly maintained, insecure, or missing required features).
- The **platform chart** (`helm/platform/`) is always custom. This is where Hiroba adds value — wiring in databases, storage, secrets, observability, and other infrastructure that the upstream chart does not provide.

**Do not rewrite what upstream already does well.** The people who build the application know it best.

## Repository Structure

```
├── helm/
│   ├── base/                          # Application Helm chart
│   │   ├── Chart.yaml                 # May declare upstream chart as dependency
│   │   ├── values.yaml                # Overrides for upstream + custom values
│   │   └── templates/                 # Only if extending upstream; otherwise minimal
│   └── platform/                      # Platform dependencies (always custom)
│       ├── values.yaml
│       └── templates/
│           ├── database/              # CNPG clusters, etc.
│           ├── storage/               # S3 buckets (Crossplane, Garage, etc.)
│           ├── secrets/               # ExternalSecrets
│           └── observability/         # ServiceMonitors, Grafana dashboards, PrometheusRules
├── crossplane/                        # Crossplane XRDs & Compositions this app PROVIDES
│   └── examples/                      # Example Claims for consumers
├── gitops/
│   ├── argocd/                        # ArgoCD Application manifests
│   └── fluxcd/                        # FluxCD Kustomization manifests
├── docs/                              # TechDocs content (published via Backstage)
├── .github/workflows/                 # CI/CD — references 7K-Hiroba/workflows-library
├── Dockerfile                         # Only if a custom image is maintained
├── catalog-info.yaml                  # Backstage catalog registration
└── mkdocs.yml                         # TechDocs configuration
```

## Where to Add What

### Application changes (deployment, ports, probes, scaling)

Modify `helm/base/values.yaml` or, if using an upstream chart as a dependency, override values there. Do not duplicate upstream template logic — use the upstream chart's configuration surface.

### Database, storage, secrets, or observability

Add or modify resources under `helm/platform/templates/<category>/`. Each resource is gated by an `enabled` flag in `helm/platform/values.yaml`. Respect the subfolder organization:

| Category | Path | Examples |
|---|---|---|
| database | `templates/database/` | CNPG Cluster |
| storage | `templates/storage/` | S3 via Crossplane, S3 via Garage |
| secrets | `templates/secrets/` | ExternalSecret |
| observability | `templates/observability/` | ServiceMonitor, GrafanaDashboard, PrometheusRule |

### New platform provider variant

Platform resources support a `provider` switch. To add a new provider for an existing resource (e.g., a MinIO provider for S3):

1. Create `helm/platform/templates/storage/s3-minio.yaml`
2. Gate it with `{{- if and .Values.s3.enabled (eq .Values.s3.provider "minio") }}`
3. Add provider-specific values under `s3.minio:` in `values.yaml`

### Crossplane compositions this app provides

If this application exposes infrastructure that other apps can consume (e.g., a Keycloak deployment providing realm provisioning), add XRDs and Compositions under `crossplane/`. Place example Claims in `crossplane/examples/` so consumers know the API.

### GitOps orchestration

ArgoCD and FluxCD manifests live under `gitops/`. There are separate manifests for base and platform charts because they have different lifecycles — the base chart deploys frequently, platform resources change rarely.

### Documentation

All docs go under `docs/` and are published through Backstage TechDocs via `mkdocs.yml`. Keep docs in Markdown.

### CI/CD workflows

There are two workflow files — `ci.yml` and `release-please.yml` — each calling a **single reusable workflow** from `7K-Hiroba/workflows-library` with a `stack` parameter to differentiate behavior. Do not inline CI/CD logic — add capabilities to the library workflow instead.

| Stack | `stack` param | CI trigger (path) | Release tag | release-please type |
|---|---|---|---|---|
| App (Dockerfile) | `app` | `Dockerfile`, `src/` | `app/v*` | `simple` |
| Helm Base | `helm` | `helm/base/` | `helm-base/v*` | `helm` (bumps Chart.yaml) |
| Helm Platform | `helm` | `helm/platform/` | `helm-platform/v*` | `helm` (bumps Chart.yaml) |
| Docs | `docs` | `docs/`, `mkdocs.yml` | `docs/v*` | `simple` |
| Crossplane | `crossplane` | `crossplane/` | `crossplane/v*` | `simple` |

**CI** (`ci.yml`) — jobs run conditionally based on which paths changed. The library workflow decides what to do based on `stack`: lint+template+test for `helm`, build+scan for `app`, validate for `crossplane`, etc.

**Releases** (`release-please.yml`) — fully automated via [release-please](https://github.com/googleapis/release-please). On every push to `main`, release-please reads conventional commits, determines which stacks need a release, and opens separate release PRs per component. When a release PR is merged, it creates the tag + GitHub Release and triggers the publish job for that stack.

**Commit messages drive versioning** — use [Conventional Commits](https://www.conventionalcommits.org/):
- `fix(helm-base): correct probe path` → patch bump
- `feat(app): add health endpoint` → minor bump
- `feat(helm-platform)!: change CNPG API version` → major bump (breaking `!`)

The scope in the commit message should match the component path or name. Release-please uses path-based detection to assign commits to components.

**Configuration files:**
- `release-please-config.json` — component definitions, release types, changelog settings
- `.release-please-manifest.json` — tracks current version per component (committed by release-please)

## Technical Specifics

### Helm

- API version: `apiVersion: v2`
- All resources use `app.kubernetes.io/*` standard labels via `_helpers.tpl`
- All resources include `app.kubernetes.io/part-of: hiroba` for traceability
- Security defaults: `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, all capabilities dropped
- External traffic uses **Gateway API** (`gateway.networking.k8s.io/v1` HTTPRoute), not Ingress

### Platform chart conventions

- Every resource must be gated behind `<resource>.enabled` (default `false`)
- Resources with multiple backends must use a `<resource>.provider` switch
- Template files are named `<resource>-<provider>.yaml` inside the appropriate subfolder
- Use the `platform.name` and `platform.labels` helpers from `_helpers.tpl`

### Container images

- Prefer the official upstream image. Only build custom if justified.
- If custom: multi-stage build, non-root user (UID 1000), pinned base image versions, OCI labels
- Never use `:latest` tags

### Gateway API

- Use `gateway.networking.k8s.io/v1` HTTPRoute (not Ingress)
- Routes reference a parent Gateway via `parentRefs`
- Default is a catch-all PathPrefix `/` route to the Service

### External Secrets

- Use `external-secrets.io/v1beta1` ExternalSecret
- Reference a `ClusterSecretStore` by default
- Map individual keys via `data[]` or bulk-import via `dataFrom[]`

### Observability

- ServiceMonitor for Prometheus scraping (requires prometheus-operator)
- Grafana dashboards deployed as ConfigMaps with `grafana_dashboard: "1"` label (sidecar discovery)
- PrometheusRules for alerting (error rate, latency)
