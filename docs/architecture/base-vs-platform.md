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

The platform chart is **always custom** — this is where Hiroba adds its value. It wires in the infrastructure your app needs using cluster operators, so you don't have to figure out how to connect a managed database, provision storage, or set up auth yourself.

It contains third-party CRD resources organized into subdirectories:

| Category | Examples | Operators |
|---|---|---|
| `database/` | CNPG Cluster | CloudNativePG |
| `storage/` | S3 Bucket | Crossplane (AWS), Garage |
| `secrets/` | ExternalSecret | external-secrets-operator |
| `observability/` | ServiceMonitor, GrafanaDashboard, PrometheusRule | prometheus-operator, Grafana sidecar |

The platform chart requires the relevant operators to be installed on the cluster. It provides **plug-and-play infrastructure** — enable Postgres in one toggle and get a managed database without manually deploying StatefulSets.

Resources with multiple backends support a **provider switch** (e.g., `s3.provider: crossplane` vs `s3.provider: garage`). This is particularly useful for homelab setups where you might use [Garage](https://garagehq.deuxfleurs.fr/) for S3-compatible storage instead of AWS.

## Base Chart (`helm/base/`)

The base chart follows the **near-native** principle: if the application has an official upstream Helm chart, we use it rather than writing our own. The base chart may be:

- **The upstream chart as a dependency** — `Chart.yaml` declares it, `values.yaml` overrides what's needed
- **A thin wrapper** — Minimal custom templates that extend the upstream chart
- **A from-scratch chart** — Only when no adequate upstream chart exists

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
