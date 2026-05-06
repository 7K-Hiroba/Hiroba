---
name: gitops
description: Standards for ArgoCD and FluxCD manifests in Hiroba stack repos including App-of-Apps structure and sync policies
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: gitops
---

## What I cover

Standards for all GitOps manifests under `gitops/argocd/` and `gitops/fluxcd/`.

## Two-chart deployment model

Every application has **two separate GitOps resources** — one for the base chart and one for the platform chart — because they have different lifecycles:

| | Base chart | Platform chart |
| --- | --- | --- |
| Change frequency | High (every deploy) | Low (infrastructure changes) |
| Risk of change | Low | High |
| Auto-sync | Yes | No (manual sync recommended) |

Never bundle base and platform into a single ArgoCD Application or FluxCD Kustomization.

## ArgoCD

### App-of-Apps structure

```
gitops/argocd/
├── root.yaml                     # Bootstrap entry — apply once to the cluster
├── applications/
│   ├── common/                   # Cluster operators (cert-manager, cnpg, etc.)
│   │   └── <operator>.yaml
│   └── apps/
│       ├── <app>-base.yaml       # Application (base chart)
│       ├── <app>-platform.yaml   # Infrastructure (platform chart)
│       └── <app>-project.yaml    # AppProject scoping the app
```

### Application manifest conventions

Helm values are inlined via `valuesObject` — no separate values files. This keeps the Application self-contained and avoids the need for a `ref` source solely for value overrides.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: <app>-base
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: <app>
  source:
    repoURL: <repo>
    targetRevision: HEAD
    path: helm/base
    helm:
      valuesObject:
        replicaCount: 1
        image:
          repository: ghcr.io/7k-hiroba/<app>
          pullPolicy: IfNotPresent
        # ... additional values
  destination:
    server: https://kubernetes.default.svc
    namespace: <app>
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
```

Platform Application: same shape but **no `automated` sync** — platform resources (databases, buckets) must be reviewed before being applied:

```yaml
  source:
    repoURL: <repo>
    targetRevision: HEAD
    path: helm/platform
    helm:
      valuesObject:
        global:
          appName: <app>
        postgres:
          enabled: false
        # ... additional values
  syncPolicy:
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
    # No automated: block — sync manually after review
```

### AppProject

Every app must have its own `AppProject` that restricts source repos, destination namespaces, and cluster resources:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AppProject
metadata:
  name: <app>
  namespace: argocd
spec:
  sourceRepos:
    - <repo-url>
  destinations:
    - namespace: <app>
      server: https://kubernetes.default.svc
  clusterResourceWhitelist:
    - group: ""
      kind: Namespace
```

### API version

Always `argoproj.io/v1alpha1` for `Application` and `AppProject` — no GA version exists yet.

### Finalizer

Always include `resources-finalizer.argocd.argoproj.io`. Without it, deleting an Application leaves orphaned cluster resources.

## FluxCD

### Structure

```
gitops/fluxcd/
├── git-repository.yaml           # GitRepository source
├── kustomization-common.yaml     # Operators bootstrap Kustomization
├── common/
│   ├── helm-repository.yaml      # HelmRepository sources
│   └── <operator>.yaml           # HelmRelease per operator
└── apps/
    ├── <app>-base.yaml           # HelmRelease for base chart
    └── <app>-platform.yaml       # HelmRelease for platform chart
```

### HelmRelease conventions

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: <app>-base
  namespace: flux-system
spec:
  interval: 5m
  chart:
    spec:
      chart: ./helm/base
      sourceRef:
        kind: GitRepository
        name: <repo>
        namespace: flux-system
  targetNamespace: <app>
  valuesFrom:
    - kind: ConfigMap
      name: <app>-base-values
```

Platform HelmRelease: set `suspend: true` by default and increase `interval` to `30m` to discourage unreviewed syncs:

```yaml
  interval: 30m
  suspend: false   # set true when not actively managing infra
```

### API version

Use `helm.toolkit.fluxcd.io/v2` (GA). Do not use `v2beta1` or `v2beta2`.

## Validation — run before committing

Stack repo CI runs both:

- **kubeconform**: validates manifests against JSON schemas for the pinned Kubernetes version using the datree CRDs-catalog.
- **pluto**: detects deprecated/removed API versions.

Run locally before opening a PR:

```bash
kubeconform -strict -ignore-missing-schemas -kubernetes-version <version> gitops/
pluto detect-files -d gitops/
```

## Checklist before committing

- [ ] Base and platform deployed as separate resources
- [ ] Platform resource has no automated sync
- [ ] ArgoCD Application includes `resources-finalizer.argocd.argoproj.io`
- [ ] ArgoCD Application uses `helm.valuesObject` (not `valueFiles`)
- [ ] ArgoCD AppProject scopes source repos and destination namespaces
- [ ] FluxCD uses `helm.toolkit.fluxcd.io/v2` (not v2beta*)
- [ ] kubeconform passes with zero errors
- [ ] pluto reports no deprecated APIs
