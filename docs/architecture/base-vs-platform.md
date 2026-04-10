---
sidebar_position: 2
---

# Base vs Platform Charts

This is a core architectural decision in Hiroba: every application gets **two separate Helm charts**. The platform chart is Hiroba's main focus.

## Why Two Charts?

Most Helm charts in the ecosystem bundle everything together. A "PostgreSQL-backed app" chart might include the app Deployment *and* a PostgreSQL StatefulSet. This creates problems:

- **Tight coupling** — Can't upgrade the app without touching the database
- **Lifecycle mismatch** — Apps deploy frequently; databases rarely change
- **Portability loss** — The chart only works if you run Postgres the same way

Hiroba separates these concerns. This matters just as much on a homelab as anywhere else — when your single-node cluster restarts at 3 AM, you want the app and database to recover independently.

## Platform Chart (`helm/platform/`) — Hiroba's Focus

The platform chart is **always custom** — this is where 7K-Hiroba adds its value. It wires in the infrastructure your app needs using cluster operators, so you don't have to figure out how to connect a managed database, provision storage, or set up auth yourself.

It contains third-party CRs organized into subdirectories:

| Category | Examples | Operators |
|---|---|---|
| `database/` | CNPG Cluster |
| `storage/` | S3 Bucket | Crossplane (AWS) | GarageBucket |
| `secrets/` | ExternalSecret | 
| `observability/` | ServiceMonitor, GrafanaDashboard, PrometheusRule |

**Important:** The platform chart **does not deploy or manage operators** — it creates CRs (Custom Resources) that existing operators reconcile. Operator lifecycle (installation, upgrades, CRD management) is your responsibility. We list required operators as dependencies in the documentation, but the platform chart only consumes them.

### Operator Dependency Checks

Because Operator CRDs are submitted to the API server but reconciled by controllers that may not be running, a missing operator causes **silent failures** — resources appear healthy but nothing happens. To prevent this, the platform chart includes a `_checks.yaml` template that validates operator availability at install time.

When a feature is **enabled** and its required CRD is **not registered** in the cluster, `helm install` fails immediately with a clear error message. When the feature is **disabled**, the check is skipped entirely.

| Feature Enabled | Operator Installed | Result |
|---|---|---|
| Yes | Yes | Installs normally |
| Yes | No | **Fails immediately** with a clear error |
| No | Yes | Skips feature resources |
| No | No | Skips feature resources |

The checks cover all operator-backed features:

| Feature | Required CRD |
|---|---|
| `postgres.enabled` | `postgresql.cnpg.io/v1` (CloudNativePG) |
| `s3.enabled` + `provider: crossplane` | `s3.aws.crossplane.io/v1beta1` (Crossplane AWS) |
| `externalSecrets.enabled` | `external-secrets.io/v1beta1` (External Secrets Operator) |
| `observability.serviceMonitor.enabled` | `monitoring.coreos.com/v1` (Prometheus Operator) |
| `observability.prometheusRules.enabled` | `monitoring.coreos.com/v1` (Prometheus Operator) |

Features that use only native Kubernetes resources (Garage S3 via ConfigMap/Job, Grafana dashboards via ConfigMap) do not require checks.

:::tip Offline rendering
When using `helm template` or rendering in CI/CD, pass `--api-versions` to simulate available APIs:
```bash
helm template my-app ./helm/platform \
  --api-versions postgresql.cnpg.io/v1 \
  --api-versions monitoring.coreos.com/v1
```
:::

With the right operators running on your cluster, the platform chart provides **plug-and-play infrastructure** — enable Postgres in one toggle and get a managed database without manually deploying StatefulSets.

Resources with multiple backends support a **provider switch** (e.g., `s3.provider: crossplane` vs `s3.provider: garage`).

## Base Chart (`helm/base/`)

The base chart follows the **near-native** principle: if the application has an official upstream Helm chart/Operator, we use it rather than writing our own. The base chart may be:

- **The upstream chart as a dependency** — `Chart.yaml` declares it, `values.yaml` overrides what's needed
- **A thin wrapper** — Minimal custom templates that extend the upstream chart
- **Operator CRs** — Direct references to CRs from a supported operator (e.g., a `Keycloak` CR for the Keycloak operator)
- **A from-scratch chart** — Only when no adequate upstream chart or operator exists

In most cases the base chart is just an upstream third-party chart. Hiroba doesn't rewrite what already works — the upstream maintainers know their app best.

The base chart works on **any Kubernetes cluster** — including single-node k3s, kind, or microk8s — with no special operators installed (beyond a Gateway API implementation if HTTPRoutes are enabled).

## Deployment Flow

```bash
# Deploy the application (often just the upstream chart)
helm install myapp ./helm/base

# Deploy the platform layer — databases, storage, auth
helm install myapp-platform ./helm/platform
```

The base chart does not depend on the platform chart. If platform resources are provisioned, the application discovers them through well-known Secret names and environment variables injected by the operators.

## When to Skip Platform

The platform chart is the default for Hiroba apps. You'd skip it when:

- You're connecting to an existing database you already run
- The cluster doesn't have the required operators installed yet
- You're doing local development or just testing things out
