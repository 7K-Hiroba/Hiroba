---
sidebar_position: 1
---

# ${{ values.name }}

${{ values.description }}

## Overview

This stack composes multiple Hiroba applications into a single, deployable platform. It provides:

- **Operators as ArgoCD Applications** — cert-manager, CNPG, External Secrets, Prometheus are individual Applications in the `common` project, each independently versionable and removable
- **Per-app value overrides** via `apps/<name>/` — tailored configuration without forking charts
- **GitOps orchestration** via ArgoCD App-of-Apps or FluxCD Kustomizations

## Quick Start

### Prerequisites

- Kubernetes cluster (k3s, kind, or similar)
- ArgoCD or FluxCD installed
- A Gateway controller installed (Envoy Gateway, Cilium, Traefik, etc.)

### Deploy with ArgoCD

```bash
kubectl apply -f gitops/argocd/root.yaml
```

This single command bootstraps the entire stack. ArgoCD will:

1. Create AppProjects (`common` and `${{ values.name }}`)
2. Deploy operators from `common/` (sync-wave -5)
3. Deploy each app using its Helm charts with stack-specific overrides

### Deploy with FluxCD

```bash
kubectl apply -f gitops/fluxcd/git-repository.yaml
kubectl apply -f gitops/fluxcd/kustomization-common.yaml
kubectl apply -f gitops/fluxcd/apps/
```

## Apps in This Stack

| App | Description | Base Chart | Docs |
|-----|-------------|------------|------|
| example | Example placeholder | `CHANGE_ME` | [values](../apps/example/) |

> Update this table as you add apps to the stack.

## Operators (common project)

Each operator is an individual ArgoCD Application in `gitops/argocd/applications/common/`. Remove files you don't need; add new ones for additional dependencies.

| Operator | File | Namespace | Purpose |
|----------|------|-----------|---------|
| cert-manager | `cert-manager.yaml` | cert-manager | TLS certificate management |
| CloudNativePG | `cloudnative-pg.yaml` | cnpg-system | PostgreSQL operator |
| External Secrets | `external-secrets.yaml` | external-secrets | Sync secrets from external stores |
| kube-prometheus-stack | `kube-prometheus-stack.yaml` | monitoring | Prometheus, Grafana, Alertmanager |
