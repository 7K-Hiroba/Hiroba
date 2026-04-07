---
sidebar_position: 4
---

# GitOps Architecture

Hiroba's GitOps approach is split into two distinct layers: **application** and **orchestration**.

## Application Layer

Each app repository includes a `gitops/` directory with manifests that describe *how this app should be deployed* via common GitOps tools. These are **references** — they point GitOps controllers at the app's base and platform charts.

```
my-app/
└── gitops/
    ├── argocd/
    │   ├── base-application.yaml       # ArgoCD Application for helm/base
    │   └── platform-application.yaml   # ArgoCD Application for helm/platform
    └── fluxcd/
        ├── base-kustomization.yaml     # FluxCD Kustomization for helm/base
        └── platform-kustomization.yaml # FluxCD Kustomization for helm/platform
```

Base and platform get **separate Application/Kustomization manifests** because they have different lifecycles — the base chart (your app) deploys frequently, while platform resources (databases, storage) change rarely.

These manifests live in the app repo so the app is self-contained — everything needed to deploy it (charts, Dockerfile, GitOps references) is in one place.

## Orchestration Layer

The orchestration layer is where you assemble individual apps into a complete platform. This lives in a **separate repository** (not in the app repo) and uses patterns like:

- **ArgoCD App-of-Apps** — A root Application that references each app's ArgoCD Application manifests
- **ArgoCD ApplicationSets** — Dynamically generate Applications from a list of apps or Git directories
- **FluxCD Kustomizations** — A top-level Kustomization that composes individual app Kustomizations

This is where you define *what runs on your cluster* — which apps, in which order, with which environment-specific overrides.

### Example: ArgoCD App-of-Apps

```yaml
# In your orchestration repo: apps/my-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-app-base
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/7KGroup/my-app.git
    path: gitops/argocd
    targetRevision: main
  destination:
    server: https://kubernetes.default.svc
    namespace: my-app
```

A root App-of-Apps Application then points at the directory containing all these individual app manifests.

## What Exists Today vs What's Coming

**Today:** Each app template includes the `gitops/` directory with application-level ArgoCD and FluxCD manifests. These are ready to use.

**Coming soon:** Dedicated orchestration repositories with fully built and tested examples of how to assemble a homelab platform using App-of-Apps and similar patterns. These will be real, working setups — not just documentation — that you can fork and adapt for your own cluster.

## How the Layers Connect

```
Orchestration Repo                    App Repos
(your cluster platform)               (individual apps)
┌───────────────────┐
│  App-of-Apps /    │    references    ┌──────────────────┐
│  ApplicationSet   │───────────────► │ my-app/gitops/   │
│                   │                 │  ├── argocd/      │
│                   │    references    │  └── fluxcd/      │
│                   │───────────────► ├──────────────────┤
│                   │                 │ keycloak/gitops/  │
│                   │    references    │  ├── argocd/      │
│                   │───────────────► │  └── fluxcd/      │
└───────────────────┘                 └──────────────────┘
                                        │
                                        ▼
                                      helm/base + helm/platform
                                      (actual chart deployment)
```
