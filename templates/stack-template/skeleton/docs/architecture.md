---
sidebar_position: 2
---

# Architecture

## Stack Composition Model

This stack follows a **loose coupling** model. Each app in the stack is an independent Hiroba application with its own repository, Helm charts, CI/CD pipeline, and release lifecycle. The stack does not contain or fork app charts — it provides:

1. **Operator installation** — managed as individual ArgoCD Applications (or FluxCD HelmReleases) in the `common` project, each independently versionable
2. **Value overrides** that configure apps for this specific composition
3. **GitOps orchestration** that deploys everything in the right order

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Stack Repository                            │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────┐  ┌───────────────────────┐ │
│  │ gitops/*/common/     │  │ apps/    │  │ gitops/*/apps/        │ │
│  │                      │  │          │  │                       │ │
│  │ cert-manager.yaml    │  │ app-a/   │  │ app-a.yaml            │ │
│  │ cloudnative-pg.yaml  │  │  values  │  │ app-b.yaml            │ │
│  │ external-secrets.yaml│  │ app-b/   │  │                       │ │
│  │ kube-prom-stack.yaml │  │  values  │  │                       │ │
│  │                      │  │          │  │                       │ │
│  │ (add/remove files    │  │          │  │                       │ │
│  │  to manage operators)│  │          │  │                       │ │
│  └──────────────────────┘  └──────────┘  └───────────────────────┘ │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ references (does not contain)
          ┌──────────────────────┼──────────────────┐
          ▼                      ▼                  ▼
   ┌─────────────┐       ┌─────────────┐   ┌─────────────┐
   │ App A Repo  │       │ App B Repo  │   │ App C Repo  │
   │ helm/base   │       │ helm/base   │   │ helm/base   │
   │ helm/plat.  │       │ helm/plat.  │   │ helm/plat.  │
   │ (CRs for    │       │ (CRs for    │   │ (CRs for    │
   │  operators)  │       │  operators)  │   │  operators)  │
   └─────────────┘       └─────────────┘   └─────────────┘
```

## Deployment Order

### ArgoCD

Sync-waves control ordering within the root App-of-Apps sync:

| Wave | What | Directory |
|------|------|-----------|
| -10 | AppProject definitions | `common/project.yaml`, `apps/project.yaml` |
| -5 | Operator Applications | `common/*.yaml` |
| 0 | App Applications | `apps/<app>.yaml` |

### FluxCD

`dependsOn` chains ensure ordering:

```text
kustomization-common  →  app kustomizations
(operators)              (apps, dependsOn common)
```

## Security Model

Security is **not centralized** in the stack. Instead, each layer is responsible for its own concerns:

- **Pod security** — enforced by each app's `helm/base` chart (runAsNonRoot, readOnlyRootFilesystem, etc.)
- **Network policies** — added per-app in platform charts, or cluster-wide via policy engines
- **TLS** — cert-manager operator in `common/`, referenced by app Gateway/HTTPRoute resources
- **Secrets** — External Secrets Operator in `common/`, configured per-app via `values-platform.yaml`

## Relationship to Hiroba App Template

| Concern | App Template | Stack Template |
|---------|-------------|----------------|
| Backstage entity | `Component` (service) | `System` |
| Contains app code | Yes (Dockerfile) | No |
| Contains Helm charts | Yes (base + platform) | No |
| Installs operators | No (creates CRs, checks CRDs) | Yes (ArgoCD Applications) |
| GitOps | Self-deploying | Orchestrates multiple apps |
| CI/CD components | app, helm-base, helm-platform, docs, crossplane | docs |
