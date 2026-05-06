# ${{ values.name }}-platform

Platform dependencies for the [${{ values.name }}](../base/README.md) chart — provisions the cross-cutting resources the workload needs but that aren't part of its lifecycle.

Install this **alongside** `${{ values.name }}`, typically in the same namespace.

**Documentation:** <https://hiroba.7kgroup.org/docs/apps/${{ values.name }}/helm-platform>

## TL;DR

```bash
helm install ${{ values.name }}-platform \
  oci://harbor.7kgroup.org/7khiroba/charts/${{ values.name }}-platform \
  --version 0.1.0
```

## Prerequisites

- Kubernetes 1.24+
- [External Secrets Operator](https://external-secrets.io/) — for the `ExternalSecret` resource
- [Prometheus Operator](https://prometheus-operator.dev/) — for the `ServiceMonitor` resource
- Grafana with dashboard sidecar enabled (optional, for shipped dashboards)
- [CloudNativePG](https://cloudnative-pg.io/) — if enabling the PostgreSQL example
- [Crossplane](https://www.crossplane.io/) — if enabling the S3 example

## What gets installed

| Resource | Purpose |
|---|---|
| `ExternalSecret` | Sources app secrets from your secret backend |
| `ServiceMonitor` | Scrape config for the workload's metrics endpoint |
| Grafana dashboards | Shipped as `ConfigMap`s in `dashboards/`, picked up by the Grafana sidecar |
| `Cluster` (CNPG) | Optional — PostgreSQL database, enabled via values |
| Crossplane `Bucket` | Optional — S3-compatible object storage, enabled via values |

## Configuration

Full values in [`values.yaml`](values.yaml), schema in [`values.schema.json`](values.schema.json). Artifact Hub renders the schema as an interactive form.

The chart is split so that **workload-lifecycle** resources (Deployment, HPA, PDB, HTTPRoute) live in [`${{ values.name }}`](../base/README.md), while **cross-cutting dependencies** (ESO, ServiceMonitor, dashboards, DB, storage) live here. This keeps each chart focused and lets operators opt out of platform wiring without losing the app.

## Part of the Hiroba ecosystem

Scaffolded with [Hiroba](https://github.com/7K-Hiroba/Hiroba). Source and issues: <https://github.com/7K-Hiroba/${{ values.name }}>.
