# Adding Apps to the Stack

Each app in the stack is a **reference** to an existing Hiroba application chart,
not a copy. The stack provides value overrides that tailor the app for this
particular composition.

## Directory Structure

```
apps/
  <app-name>/
    values-base.yaml       # Overrides for the app's helm/base chart
    values-platform.yaml   # Overrides for the app's helm/platform chart
```

## Step-by-Step

### 1. Create the app directory

```bash
cp -r apps/example apps/<app-name>
```

### 2. Configure base chart overrides

Edit `apps/<app-name>/values-base.yaml` with values specific to this stack.
Common overrides include:

- **Gateway/routing**: hostname, path prefixes
- **Resources**: CPU/memory limits tuned for this stack's workload
- **Environment variables**: inter-app URLs, shared config

### 3. Configure platform chart overrides

Edit `apps/<app-name>/values-platform.yaml` for infrastructure overrides:

- **Database**: connection details, database name
- **External Secrets**: secret paths specific to this stack
- **Observability**: scrape targets, alert thresholds

### 4. Create the GitOps manifest

#### ArgoCD

Copy `gitops/argocd/applications/example.yaml` to
`gitops/argocd/applications/<app-name>.yaml` and update:

- `metadata.name`: `$STACK_NAME-<app-name>`
- `spec.sources[*].repoURL`: the app's GitHub repo
- `spec.sources[*].helm.valueFiles`: paths to your new value files

#### FluxCD

Copy `gitops/fluxcd/apps/kustomization-example.yaml` to
`gitops/fluxcd/apps/kustomization-<app-name>.yaml` and update accordingly.

### 5. Commit and push

ArgoCD (via App-of-Apps) or FluxCD will automatically detect the new
Application manifest and deploy the app.

## Example

See `apps/example/` for a working reference with commented values files.
