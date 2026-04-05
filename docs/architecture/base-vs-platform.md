---
sidebar_position: 2
---

# Base vs Platform Charts

This is a core architectural decision in Hiroba: every application gets **two separate Helm charts**.

## Why Two Charts?

Most Helm charts in the ecosystem bundle everything together. A "PostgreSQL-backed app" chart might include the app Deployment *and* a PostgreSQL StatefulSet. This creates problems:

- **Tight coupling** — Can't upgrade the app without touching the database
- **Lifecycle mismatch** — Apps deploy frequently; databases rarely change
- **Portability loss** — The chart only works if you run Postgres the same way

Hiroba separates these concerns.

## Base Chart (`helm/base/`)

The base chart follows the **near-native** principle: if the application has an official upstream Helm chart, we use it rather than writing our own. The base chart may be:

- **The upstream chart as a dependency** — `Chart.yaml` declares it, `values.yaml` overrides what's needed
- **A thin wrapper** — Minimal custom templates that extend the upstream chart
- **A from-scratch chart** — Only when no adequate upstream chart exists

When using an upstream chart, the base directory contains standard Kubernetes resources:

| Resource | Purpose |
|---|---|
| Deployment | Run the application containers |
| Service | Internal network exposure |
| HTTPRoute | External access via Gateway API |
| ServiceAccount | Pod identity |
| HPA | Autoscaling |

The base chart works on **any Kubernetes cluster** with no special operators installed (beyond a Gateway API implementation if HTTPRoutes are enabled).

## Platform Chart (`helm/platform/`)

Unlike the base chart, the platform chart is **always custom** — this is where Hiroba adds its value. It contains third-party CRD resources managed by cluster operators, organized into subdirectories:

| Category | Examples | Operators |
|---|---|---|
| `database/` | CNPG Cluster | CloudNativePG |
| `storage/` | S3 Bucket | Crossplane (AWS), Garage |
| `secrets/` | ExternalSecret | external-secrets-operator |
| `observability/` | ServiceMonitor, GrafanaDashboard, PrometheusRule | prometheus-operator, Grafana sidecar |

The platform chart requires the relevant operators to be installed on the cluster. It provides **plug-and-play infrastructure** — enable Postgres in one toggle and get a fully managed database cluster.

Resources with multiple backends support a **provider switch** (e.g., `s3.provider: crossplane` vs `s3.provider: garage`).

## Deployment Flow

```bash
# Always deploy base first
helm install myapp ./helm/base

# Optionally deploy platform dependencies
helm install myapp-platform ./helm/platform
```

The base chart does not depend on the platform chart. If platform resources are provisioned, the application discovers them through well-known Secret names and environment variables injected by the operators.

## When to Use Platform

Use the platform chart when your application needs:

- A **dedicated database** (not a shared one)
- **Object storage** provisioned alongside the app
- **Identity/auth** resources that should live with the app's lifecycle

Skip it when:

- You're connecting to existing shared infrastructure
- The cluster doesn't have the required operators
- You're doing local development with mocked dependencies
