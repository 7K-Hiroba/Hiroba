# hiroba-platform-lib

Helm **library** chart for Hiroba application *platform* (cross-cutting dependency) charts. It defines named templates for the resources that surround a Hiroba workload but aren't part of its lifecycle — CloudNativePG `Cluster`, S3 `Bucket`s (Crossplane or Garage), `ExternalSecret`, `ServiceMonitor`, Grafana dashboard `ConfigMap`s, `PrometheusRule`, and operator-presence checks.

> Library charts are not installable on their own. Add this as a `dependency` from your application platform chart and include the resources you need.

## Quick start

`Chart.yaml`:

```yaml
apiVersion: v2
name: myapp-platform
type: application
version: 0.1.0
appVersion: "0.1.0"
dependencies:
  - name: hiroba-platform-lib
    version: ^0.1.0
    repository: oci://harbor.7kgroup.org/7khiroba/charts
```

Pull the dependency:

```bash
helm dependency update
```

Wrappers (one per resource, following the Hiroba skeleton convention):

```yaml
# templates/checks.yaml
{{- include "hiroba-platform.checks" . }}
```

```yaml
# templates/database/cnpg-cluster.yaml
{{- include "hiroba-platform.cnpg-cluster" . }}
```

…and so on. Delete or replace any wrapper whose resource you don't want.

## Named templates

| Template | Renders | Gated on |
| --- | --- | --- |
| `hiroba-platform.checks` | Render-time `fail` calls when an enabled feature's Operator CRD is missing | always (no-op if all features disabled) |
| `hiroba-platform.cnpg-cluster` | CNPG `Cluster` + optional Garage backup bucket / key / barman ObjectStore | `postgres.enabled` (+ `postgres.backup.enabled`) |
| `hiroba-platform.cnpg-scheduled-backup` | CNPG `ScheduledBackup` | `postgres.enabled` AND `postgres.backup.enabled` |
| `hiroba-platform.s3-crossplane` | Crossplane S3 `Bucket` | `s3.enabled` AND `s3.provider==crossplane` |
| `hiroba-platform.s3-garage` | Garage `GarageBucket` + `GarageKey` | `s3.enabled` AND `s3.provider==garage` |
| `hiroba-platform.external-secret` | external-secrets.io `ExternalSecret` | `externalSecrets.enabled` |
| `hiroba-platform.service-monitor` | Prometheus `ServiceMonitor` targeting the base chart's pods | `observability.serviceMonitor.enabled` |
| `hiroba-platform.grafana-dashboard` | `ConfigMap` shipping consumer's `dashboards/*.json` | `observability.grafanaDashboard.enabled` |
| `hiroba-platform.prometheus-rules` | Prometheus `PrometheusRule` (`groups` are `tpl`-rendered) | `observability.prometheusRules.enabled` |

Helper templates safe to reuse from consumer templates: `hiroba-platform.name`, `hiroba-platform.labels`, `hiroba-platform.baseSelectorLabels`.

## Values surface

[`values.yaml`](values.yaml) ships the reference defaults and [`values.schema.json`](values.schema.json) documents the shape. Library values are **not** merged into the consumer — copy what you need into your own chart and validate there.

## Versioning

Semver, automated via [release-please](https://github.com/googleapis/release-please) in the [Hiroba repo](https://github.com/7K-Hiroba/Hiroba):

- `fix(helm-platform-lib): ...` → patch
- `feat(helm-platform-lib): ...` → minor
- `feat(helm-platform-lib)!: ...` or `BREAKING CHANGE:` → major

Tagged releases publish the OCI artifact to `oci://harbor.7kgroup.org/7khiroba/charts/hiroba-platform-lib`.

## Companion chart

For the workload itself (Deployment, Service, HPA, PDB, HTTPRoute) see [`hiroba-app-lib`](../app/README.md).

## Documentation

<https://hiroba.7kgroup.org/docs/architecture/helm-libraries>
