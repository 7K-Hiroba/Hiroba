---
name: helm-chart-release
description: Standards for releasing Hiroba Helm charts using Conventional Commits, release-please, and version bumping
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: release
---

## What I cover

How versioning, changelogs, and releases work for Helm charts in Hiroba repos.

## Release automation overview

Releases are fully automated via [release-please](https://github.com/googleapis/release-please). The workflow is:

1. Merge commits to `main` using Conventional Commits format.
2. release-please reads the commits, determines which components need a bump, and opens a Release PR.
3. When the Release PR is merged, release-please creates the Git tag and GitHub Release.
4. The publish job in CI is triggered by the tag and deploys the chart.

**Do not manually edit `Chart.yaml` version fields or `CHANGELOG.md`.** release-please owns these files.

## Conventional Commits — scopes that matter

The commit scope determines which component gets a version bump:

| Scope | Component | Release tag prefix |
| --- | --- | --- |
| `helm-base` | Base chart | `helm-base/v*` |
| `helm-platform` | Platform chart | `helm-platform/v*` |
| `app` | Application (Dockerfile) | `app/v*` |
| `docs` | Documentation | `docs/v*` |
| `crossplane` | Crossplane compositions | `crossplane/v*` |

### Bump rules

| Commit type | Version bump |
| --- | --- |
| `fix(<scope>):` | Patch (0.0.X) |
| `feat(<scope>):` | Minor (0.X.0) |
| `feat(<scope>)!:` or `BREAKING CHANGE:` | Major (X.0.0) |

### Examples

```
fix(helm-platform): correct CNPG backup secret key name
feat(helm-base): add PodDisruptionBudget support
feat(helm-platform)!: rename postgres.backup.schedule to postgres.backup.cron
```

The scope in the commit message must match the component path. release-please uses path-based detection alongside scope matching.

## Configuration files

### `release-please-config.json`

Defines the components and their release types:

```json
{
  "packages": {
    "helm/base": {
      "release-type": "helm",
      "changelog-path": "helm/base/CHANGELOG.md"
    },
    "helm/platform": {
      "release-type": "helm",
      "changelog-path": "helm/platform/CHANGELOG.md"
    }
  }
}
```

The `helm` release type updates `Chart.yaml` version on release. Do not change to `simple` for chart components.

### `.release-please-manifest.json`

Tracks the current version per component. **Managed entirely by release-please.** Do not edit manually — doing so will desync the release state.

## `Chart.yaml` version field

- `version` is the chart version (bumped by release-please on merge of Release PR).
- `appVersion` is the application version (updated manually or by a separate app release).
- Both must follow [semver](https://semver.org/).
- `apiVersion: v2` always.

## Breaking changes

A breaking change requires a `!` suffix on the commit type or a `BREAKING CHANGE:` footer:

```
feat(helm-platform)!: change default postgres provider from cnpg to native

BREAKING CHANGE: Apps using the default provider must explicitly set
postgres.provider: cnpg in their values override files.
```

This triggers a major version bump. Always document migration steps in the commit body or the PR description.

## Checklist before opening a PR

- [ ] Every commit uses Conventional Commits format with the correct scope
- [ ] Breaking changes include `!` or `BREAKING CHANGE:` in the commit
- [ ] `Chart.yaml` version **not** manually edited
- [ ] `CHANGELOG.md` **not** manually edited
- [ ] `.release-please-manifest.json` **not** manually edited
- [ ] CI passes (helm lint, helm-unittest, schema validation) before requesting review
