---
sidebar_position: 4
---

# GitOps Architecture

Hiroba's GitOps approach is split into two distinct layers: **application** and **orchestration**.

## Application Layer

Each app repository includes a `gitops/` directory with manifests that describe *how this app should be deployed* via common GitOps tools. These are **references** — they point GitOps controllers at the app's base and platform charts.

```text
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

The orchestration layer is where you assemble individual apps into a complete platform. This is provided by the **stack template** — each stack repo scaffolded from the template includes:

- **ArgoCD App-of-Apps** — A root Application that watches `gitops/argocd/applications/` and automatically manages all child Applications
- **FluxCD Kustomizations** — A common Kustomization for operators with per-app Kustomizations that depend on it

Stacks use **multi-source** ArgoCD Applications to pull Helm charts from app repos while reading value overrides from the stack repo. This keeps apps loosely coupled — they retain their independent repos and release lifecycles.

### Example: ArgoCD App-of-Apps (from stack template)

The root Application bootstraps the entire stack:

```yaml
# gitops/argocd/root.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-stack
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/7K-Hiroba/my-stack.git
    targetRevision: main
    path: gitops/argocd/applications
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

Each app in the stack gets a multi-source Application:

```yaml
# gitops/argocd/applications/apps/my-app.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: my-stack-my-app
  namespace: argocd
spec:
  project: default
  sources:
    # Stack repo for value overrides
    - repoURL: https://github.com/7K-Hiroba/my-stack.git
      targetRevision: main
      ref: stack
    # App base chart from the app's own repo
    - repoURL: https://github.com/7K-Hiroba/my-app.git
      targetRevision: main
      path: helm/base
      helm:
        valueFiles:
          - $stack/apps/my-app/values-base.yaml
    # App platform chart from the app's own repo
    - repoURL: https://github.com/7K-Hiroba/my-app.git
      targetRevision: main
      path: helm/platform
      helm:
        valueFiles:
          - $stack/apps/my-app/values-platform.yaml
  destination:
    server: https://kubernetes.default.svc
    namespace: my-stack
```

## What Exists Today

**Application layer:** Each app template includes the `gitops/` directory with ArgoCD and FluxCD manifests. These are ready to use for standalone app deployment.

**Stack layer:** The stack template scaffolds complete orchestration repositories with App-of-Apps (ArgoCD) and Kustomizations (FluxCD), operator management, and per-app value overrides. These provide the "what runs on your cluster" answer.

## How the Layers Connect

```text
Stack Repo                             App Repos
(multi-app composition)                (individual apps)
┌───────────────────────┐
│  Root App-of-Apps     │
│  ┌─────────────────┐  │
│  │ common/         │  │  deploys      ┌──────────────────┐
│  │ (sync-wave: -5) │──┼──────────────►│ Operator charts  │
│  └─────────────────┘  │  (external)   │ (cert-manager,   │
│  ┌─────────────────┐  │  references   │  CNPG, ESO, etc) │
│  │ my-app.yaml     │──┼──────────────►├──────────────────┤
│  │ (multi-source)  │  │  (external)   │ my-app repo      │
│  └─────────────────┘  │               │  helm/base       │
│  ┌─────────────────┐  │  references   │  helm/platform   │
│  │ keycloak.yaml   │──┼──────────────►├──────────────────┤
│  │ (multi-source)  │  │  (external)   │ keycloak repo    │
│  └─────────────────┘  │               │  helm/base       │
│                       │               │  helm/platform   │
│  apps/                │               └──────────────────┘
│  ├── my-app/          │  value overrides applied via
│  │   ├── values-base  │  ArgoCD multi-source $ref
│  │   └── values-plat  │
│  └── keycloak/        │
│      ├── values-base  │
│      └── values-plat  │
└───────────────────────┘
```
