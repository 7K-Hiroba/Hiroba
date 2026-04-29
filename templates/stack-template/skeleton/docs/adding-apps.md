---
sidebar_position: 3
---

# Adding Apps

Step-by-step guide for adding a new application to this stack.

## Prerequisites

The app must be a Hiroba application (scaffolded from the app-template) with:
- `helm/base/` chart
- `helm/platform/` chart
- Published to a Git repository under `7K-Hiroba`

## Steps

### 1. Create value override files

```bash
mkdir apps/<app-name>
cp apps/example/values-base.yaml apps/<app-name>/values-base.yaml
cp apps/example/values-platform.yaml apps/<app-name>/values-platform.yaml
```

### 2. Configure base chart overrides

Edit `apps/<app-name>/values-base.yaml`:

```yaml
# Pin the image version for this stack
image:
  tag: "1.2.3"

# Configure routing for this stack's domain
gateway:
  enabled: true
  hostnames:
    - app-name.your-domain.com
  parentRefs:
    - name: main-gateway
      namespace: gateway-system

# Set inter-app communication URLs
env:
  - name: UPSTREAM_API
    value: "http://other-app:8080"
```

### 3. Configure platform chart overrides

Edit `apps/<app-name>/values-platform.yaml`:

```yaml
global:
  appName: <app-name>

postgres:
  enabled: true
  database: app_name_db

externalSecrets:
  enabled: true
  data:
    - secretKey: DATABASE_URL
      remoteKey: stack/<app-name>/database
      property: url

observability:
  serviceMonitor:
    enabled: true
```

### 4. Create the GitOps manifest

#### ArgoCD

```bash
cp gitops/argocd/applications/apps/example.yaml \
   gitops/argocd/applications/apps/<app-name>.yaml
```

Edit the new file:
- Update `metadata.name` to `$STACK_NAME-<app-name>`
- Replace `CHANGE_ME` in `repoURL` with the actual app repo
- Update `valueFiles` paths to point to `apps/<app-name>/`

#### FluxCD

```bash
cp gitops/fluxcd/apps/kustomization-example.yaml \
   gitops/fluxcd/apps/kustomization-<app-name>.yaml
```

Edit the new file:
- Update `metadata.name` to `$STACK_NAME-<app-name>`
- Update `path` to `./apps/<app-name>`

### 5. Ensure required operators are in common/

Check that the operators your app needs are present in `gitops/argocd/applications/common/` (or `gitops/fluxcd/common/`). For example, if your app uses PostgreSQL, make sure `cloudnative-pg.yaml` exists.

### 6. Update documentation

Update the apps table in `docs/index.md`.

### 7. Commit and push

```bash
git add apps/<app-name> gitops/ docs/
git commit -m "feat: add <app-name> to stack"
git push
```

ArgoCD or FluxCD will automatically detect the new Application and deploy it.

## Adding an Operator

To add a new operator that apps depend on:

### ArgoCD

1. Create `gitops/argocd/applications/common/<operator>.yaml`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: <operator>
  namespace: argocd
  annotations:
    argocd.argoproj.io/sync-wave: "-5"
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: common
  source:
    repoURL: <chart-repo-url>
    chart: <chart-name>
    targetRevision: <version>
  destination:
    server: https://kubernetes.default.svc
    namespace: <operator-namespace>
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
```

2. Add the repo URL and namespace to `common/project.yaml`

### FluxCD

1. Add a HelmRepository to `gitops/fluxcd/common/helm-repositories.yaml`
2. Create `gitops/fluxcd/common/<operator>.yaml` with a HelmRelease

## Removing an App

1. Delete the ArgoCD Application manifest (or FluxCD Kustomization)
2. Delete `apps/<app-name>/`
3. Commit and push — prune will clean up resources

## Removing an Operator

1. Delete the operator's YAML from `common/`
2. Optionally clean up `project.yaml` sourceRepos/destinations
3. Commit and push — prune will clean up resources
