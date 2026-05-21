---
sidebar_position: 3
---

# Helm Libraries

Every Hiroba app ships two Helm charts (`helm/base/` and `helm/platform/`), but the *template content* of those charts lives once, in this repo, as two **Helm library charts** that every consumer chart depends on. This page covers why and how.

## What problem the libraries solve

Before the libraries existed, each scaffolded app repo contained a full copy of the base and platform chart templates — Deployment, Service, HPA, PDB, HTTPRoute, CNPG Cluster, ServiceMonitor, and so on. Fixing a bug in any one of them meant editing dozens of repos. Adding a feature meant the same churn.

The libraries flip that model. They own the YAML; consumer charts own the values surface.

## The two libraries

| Library | Lives in | Concern | Named templates |
| --- | --- | --- | --- |
| `hiroba-app-lib` | `helm/lib/app/` | Workload lifecycle | Deployment, Service, ServiceAccount, HPA, PDB, HTTPRoute |
| `hiroba-platform-lib` | `helm/lib/platform/` | Cross-cutting deps | Operator checks, CNPG Cluster + backups, S3 (Crossplane / Garage), ExternalSecret, ServiceMonitor, GrafanaDashboard ConfigMap, PrometheusRule |

Both are [Helm library charts](https://helm.sh/docs/topics/library_charts/) (`type: library`) — they ship only `define`d named templates, never installable resources on their own.

The split mirrors the [base/platform separation](./base-vs-platform.md): one library per chart concern.

## How a consumer chart uses them

Each scaffolded app's `helm/base/Chart.yaml` declares the dependency:

```yaml
apiVersion: v2
name: myapp
type: application
version: 0.1.0
appVersion: "0.1.0"
dependencies:
  - name: hiroba-app-lib
    version: ^0.1.0
    repository: oci://harbor.7kgroup.org/7khiroba/charts
```

`helm dependency update` pulls the library tarball into `charts/`. Each template file in the consumer chart is then a **thin wrapper** that includes one named template:

```yaml
# templates/deployment.yaml
{{- include "hiroba-app.deployment" . }}
```

```yaml
# templates/service.yaml
{{- include "hiroba-app.service" . }}
```

Same pattern for the platform chart (`hiroba-platform.cnpg-cluster`, `hiroba-platform.service-monitor`, etc.).

## Per-resource wrappers, not a monolithic include

Hiroba uses one wrapper file per resource instead of a single `all.yaml` that includes everything. Two reasons:

1. **Granular overrides** — if `myapp` needs a custom `Deployment` for some reason, the app author deletes `templates/deployment.yaml`'s wrapper line and writes their own YAML in the same file. The other resources keep coming from the library.
2. **Discoverability** — `ls templates/` still shows the same list of resources someone would expect to see in a Hiroba chart.

The cost is six lines of boilerplate per chart instead of one. Worth it.

## Values surface

Library charts ship `values.yaml` and `values.schema.json` as **reference** documentation — Helm does **not** merge library values into the consumer's `.Values`. Every consumer chart owns and validates its own values; the library files are a copy-paste starting point. The named templates read `.Values.x.y.z` directly from the consumer chart's scope at include time.

This means:

- Renaming a value in the library is a **breaking change** for every consumer.
- Adding a new optional value is non-breaking — consumers that don't set it get the template's default behaviour.
- A library bump must always be paired with a consumer-chart values check.

## Versioning and releases

Releases are automated via [release-please](https://github.com/googleapis/release-please) in this repo. Conventional-commit prefixes drive the bump:

| Commit | Bump |
| --- | --- |
| `fix(helm-app-lib): ...` | patch |
| `feat(helm-app-lib): ...` | minor |
| `feat(helm-app-lib)!:` or `BREAKING CHANGE:` in body | major |

Same for `helm-platform-lib`. Tagged releases publish the OCI artifact to `oci://harbor.7kgroup.org/7khiroba/charts/<name>`. Renovate then opens PRs in every consumer repo to bump the dependency version.

The two libraries version independently — a CNPG fix to `hiroba-platform-lib` does not bump `hiroba-app-lib`.

## CI

`helm/lib/**` changes run [`charts-ci.yml`](https://github.com/7K-Hiroba/Hiroba/blob/main/.github/workflows/charts-ci.yml), which:

1. Runs `helm lint` on both libraries.
2. Runs [`ct lint`](https://github.com/helm/chart-testing) against the changed library, including version-increment validation.

Consumer charts in scaffolded repos run `helm dependency update` first, then their usual lint + `helm-unittest` suite. This requires the `workflows-library` reusable workflows to call `helm dependency update` before lint / package — see [`AGENT-PROPAGATE.md`](https://github.com/7K-Hiroba/Hiroba/blob/main/AGENT-PROPAGATE.md) for the migration prerequisite.

## When to change the library vs the consumer

| Change | Where |
| --- | --- |
| New `value` for an existing resource | Library (template + reference `values.yaml`/schema) |
| Tightening defaults across all apps | Library |
| Adding a new resource kind every app should ship | Library + skeleton (new wrapper) |
| App-specific tweak that only one repo needs | Consumer chart only — replace the wrapper with bespoke YAML |
| Schema validation rule that applies to every consumer | Library reference schema; consumers copy on next sync |
