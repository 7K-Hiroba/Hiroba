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

## Standard wiring — base + platform

GitOps manifests must reflect a **complete, working baseline** — not the chart defaults. Before writing manifests:

1. Read `helm/platform/values.yaml` to identify which platform resources the app has (postgres, s3, externalSecrets, observability, etc.).
2. Enable every resource the app actually uses. Do not leave `enabled: false` for resources the app depends on.
3. Wire the base chart to consume those resources (DB host, credentials Secret, persistence, env vars).

Each resource type has a standard wiring pattern — follow the relevant one below.

### postgres (CNPG)

Enable in the platform chart and point the base chart at the CNPG read-write service:

**Platform:**
```yaml
postgres:
  enabled: true
  provider: cnpg
  instances: 1
  storage:
    size: 10Gi
  database: <app>
  owner: <app>
  backup:
    enabled: false
```

**Base:**
```yaml
env:
  - name: <APP>_DATABASE_TYPE
    value: postgres
  - name: <APP>_DATABASE_HOST
    value: <app>-pg-rw   # CNPG read-write service name
  - name: <APP>_DATABASE_USER
    value: <app>
  - name: <APP>_DATABASE_DATABASE
    value: <app>
  - name: <APP>_DATABASE_SSLMODE
    value: require
```

### s3 (Crossplane or Garage)

Enable in the platform chart. The base chart typically needs the bucket name and endpoint as env vars — check the app's documentation.

**Platform (Crossplane):**
```yaml
s3:
  enabled: true
  provider: crossplane
  bucketName: files
  acl: private
  crossplane:
    region: us-east-1
    providerConfigRef: aws-provider   # replace with actual ProviderConfig name
```

**Platform (Garage):**
```yaml
s3:
  enabled: true
  provider: garage
  bucketName: files
  garage:
    endpoint: "http://garage.garage.svc.cluster.local:3900"
    accessKeySecret:
      name: <app>-garage-creds
      key: accessKey
    secretKeySecret:
      name: <app>-garage-creds
      key: secretKey
```

### externalSecrets

Enable whenever the app needs credentials injected as env vars (DB password, JWT secret, API keys, etc.). The resulting Secret is referenced via `envFrom` in the base chart.

**Platform:**
```yaml
externalSecrets:
  enabled: true
  refreshInterval: 1h
  storeRef:
    name: cluster-secret-store
    kind: ClusterSecretStore
  data:
    - secretKey: <ENV_VAR_NAME>
      remoteKey: <app>/<path>
      property: <field>
```

**Base:**
```yaml
envFrom:
  - secretRef:
      name: <app>   # Secret created by the platform ExternalSecret
```

### observability

Enable when the app exposes Prometheus metrics and the cluster runs kube-prometheus-stack.

**Platform:**
```yaml
observability:
  serviceMonitor:
    enabled: true
    additionalLabels:
      release: kube-prometheus-stack   # match your Prometheus instance label
  prometheusRules:
    enabled: true
```

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
        gateway:
          enabled: true
          parentRefs:
            - name: default-gateway
          hostnames:
            - <app>.example.com
        # Wire platform resources here — see "Standard wiring" section above
        # e.g. env, envFrom, persistence depending on what the platform chart enables
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
        # Enable the platform resources this app uses — see "Standard wiring" section above.
        # Read helm/platform/values.yaml to identify available resources.
        # Example (adjust to what the app actually has):
        # postgres:
        #   enabled: true
        #   ...
        # s3:
        #   enabled: true
        #   ...
        # externalSecrets:
        #   enabled: true
        #   ...
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
  install:
    createNamespace: true
  values:
    gateway:
      enabled: true
      parentRefs:
        - name: default-gateway
      hostnames:
        - <app>.example.com
    # Wire platform resources here — see "Standard wiring" section above
    # e.g. env, envFrom, persistence depending on what the platform chart enables
```

Platform HelmRelease: set `suspend: true` by default, increase `interval` to `30m`, and include the full standard platform values:

```yaml
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: <app>-platform
  namespace: flux-system
spec:
  interval: 30m
  suspend: true # set false only when actively managing infrastructure
  chart:
    spec:
      chart: ./helm/platform
      sourceRef:
        kind: GitRepository
        name: <repo>
        namespace: flux-system
  targetNamespace: <app>
  install:
    createNamespace: true
  values:
    global:
      appName: <app>
    # Enable the platform resources this app uses — see "Standard wiring" section above.
    # Read helm/platform/values.yaml to identify available resources.
    # Example (adjust to what the app actually has):
    # postgres:
    #   enabled: true
    #   ...
    # s3:
    #   enabled: true
    #   ...
    # externalSecrets:
    #   enabled: true
    #   ...
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
- [ ] Platform values enable all resources the app actually uses (read `helm/platform/values.yaml`)
- [ ] Base values wire to those resources (env vars, envFrom, persistence) per the "Standard wiring" patterns
- [ ] kubeconform passes with zero errors
- [ ] pluto reports no deprecated APIs
