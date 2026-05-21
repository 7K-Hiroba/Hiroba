---
name: helm-chart-release
description: Standards for releasing Hiroba Helm charts and libraries using Conventional Commits, release-please, and OCI publishing
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: release
---

## What I cover

How versioning, changelogs, and releases work for **two kinds** of Helm artefacts in the Hiroba ecosystem:

1. The two **library charts** (`hiroba-app-lib`, `hiroba-platform-lib`) released from the Hiroba repo itself.
2. Each **scaffolded app's consumer charts** (`helm/base/`, `helm/platform/`) released from that app's own repo.

Both pipelines use release-please + conventional commits. They are independent — a library bump does not trigger consumer releases, and vice versa.

## Release automation overview

Releases are fully automated via [release-please](https://github.com/googleapis/release-please). For every repo:

1. Merge commits to `main` using Conventional Commits format.
2. release-please reads the commits, determines which components need a bump, and opens a Release PR that updates `Chart.yaml` `version` and `CHANGELOG.md`.
3. When the Release PR is merged, release-please creates the Git tag and GitHub Release.
4. The publish job in CI is triggered by the tag, packages the chart, and pushes the OCI artefact to `harbor.7kgroup.org/7khiroba/charts/<name>`.

**Do not manually edit `Chart.yaml` version fields, `CHANGELOG.md`, or `.release-please-manifest.json`.** release-please owns these files.

## Library releases — from the Hiroba repo

`release-please-config.json` at the Hiroba repo root configures two components:

```json
{
  "packages": {
    "helm/lib/app":      { "component": "helm-app-lib",      "release-type": "helm" },
    "helm/lib/platform": { "component": "helm-platform-lib", "release-type": "helm" }
  }
}
```

The `release-please.yml` workflow calls `7K-Hiroba/workflows-library/.github/workflows/release-helm.yml@v1` per component to lint → package → push → sign (cosign keyless) → verify against Harbor. CI on PRs uses `ci-helm-library.yml@v1` from the same library (lint + ct lint + `values.schema.json` presence).

### Library commit scopes

| Scope | Component | Tag |
| --- | --- | --- |
| `helm-app-lib` | `hiroba-app-lib` (base templates) | `helm-app-lib-v*` |
| `helm-platform-lib` | `hiroba-platform-lib` (platform templates) | `helm-platform-lib-v*` |

Examples:

```
fix(helm-app-lib): correct fullname truncation when release name exceeds 53 chars
feat(helm-platform-lib): add Redis provider for cache backend
feat(helm-platform-lib)!: rename observability.prometheusRules.groups to observability.alerts.groups
```

A library release is breaking when **any** consumer chart's existing `values.yaml` would render differently — value renames, removed defaults, changed resource names, changed selector labels. When in doubt, ship as breaking and document the migration in the commit body.

## Consumer (scaffolded app) releases

Each scaffolded app's `release-please-config.json` configures its own components — typically `app`, `helm-base`, `helm-platform`, `docs`, `crossplane`. The release workflow uses the standard `release-helm.yml@v1` from workflows-library (no library-specific path).

### Consumer commit scopes

| Scope | Component | Tag prefix |
| --- | --- | --- |
| `helm-base` | Consumer base chart | `helm-base/v*` |
| `helm-platform` | Consumer platform chart | `helm-platform/v*` |
| `app` | Application (Dockerfile) | `app/v*` |
| `docs` | Documentation | `docs/v*` |
| `crossplane` | Crossplane compositions | `crossplane/v*` |

### Bump rules (both libraries and consumers)

| Commit type | Version bump |
| --- | --- |
| `fix(<scope>):` | Patch (0.0.X) |
| `feat(<scope>):` | Minor (0.X.0) |
| `feat(<scope>)!:` or `BREAKING CHANGE:` | Major (X.0.0) |

## Library → consumer propagation

When a library release lands:

1. Renovate detects the new tag/OCI version and opens a `chore(deps):` PR in every consumer repo bumping `Chart.yaml`'s `dependencies[].version`.
2. The consumer's CI runs `helm dependency update` and the usual lint / unittest / kubeconform pipeline.
3. Merging the Renovate PR generates a `fix(helm-base):` or `fix(helm-platform):` consumer release on the next release-please cycle.

This means library bumps quietly produce consumer chart releases without the app author touching anything — unless the library bump is breaking. Then the Renovate PR needs hand-fixing in the consumer's values, and the consumer release should be a major bump too.

## `Chart.yaml` version field

- `version` is the chart version (bumped by release-please on merge of Release PR).
- `appVersion` is the application version — for libraries this tracks the library's own semver, for consumer base charts it tracks the upstream application.
- Both must follow [semver](https://semver.org/). `apiVersion: v2` always.

## Breaking changes

```
feat(helm-platform-lib)!: change default postgres provider from cnpg to native

BREAKING CHANGE: Consumers using the default provider must explicitly set
postgres.provider: cnpg in their values override files before bumping past
hiroba-platform-lib v2.0.0.
```

Always document migration steps in the commit body or the PR description.

## Checklist before opening a PR

- [ ] Every commit uses Conventional Commits format
- [ ] Scope matches the right component: `helm-app-lib` / `helm-platform-lib` for library changes (Hiroba repo); `helm-base` / `helm-platform` for consumer changes (app repos)
- [ ] Breaking changes include `!` or `BREAKING CHANGE:` in the commit
- [ ] `Chart.yaml` version **not** manually edited
- [ ] `CHANGELOG.md` **not** manually edited
- [ ] `.release-please-manifest.json` **not** manually edited
- [ ] For library changes: `helm lint helm/lib/app` and `helm lint helm/lib/platform` clean locally
- [ ] For consumer changes: `helm dependency update` + `helm lint` + `helm unittest` clean locally
