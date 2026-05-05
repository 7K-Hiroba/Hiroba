# GitOps Resources

This directory contains all GitOps manifests for deploying `${{ values.name }}` via ArgoCD or FluxCD.

Two separate resources are defined for each GitOps tool — one for the **base chart** (application workload) and one for the **platform chart** (operator-backed infrastructure). They are kept separate because they have different lifecycles: the base chart deploys frequently while platform resources (databases, storage) change rarely and require manual review before syncing.

## Structure

```text
gitops/
├── values-base.yaml             # Baseline Helm value overrides for helm/base
├── values-platform.yaml         # Baseline Helm value overrides for helm/platform
├── argocd/
│   ├── project.yaml             # AppProject scoping source repos and destination namespace
│   └── application.yaml        # Two Applications: <app>-base (auto-sync) and <app>-platform (manual)
└── fluxcd/
    ├── git-repository.yaml      # GitRepository source (apply once per cluster)
    ├── helmrelease-base.yaml    # HelmRelease for helm/base (reconciles every 5m)
    └── helmrelease-platform.yaml # HelmRelease for helm/platform (manual sync, suspend-ready)
```

## Value overrides

`values-base.yaml` and `values-platform.yaml` are the baseline overrides applied on top of each chart's `values.yaml`. Edit these files to configure hostnames, resource limits, feature flags, and anything else that differs from the chart defaults.

When deploying through a **stack repo**, copy these files to `apps/${{ values.name }}/values-base.yaml` and `apps/${{ values.name }}/values-platform.yaml` in the stack and point the multi-source Application at those paths instead.

## ArgoCD — standalone deployment

```bash
# Create the AppProject and both Applications
kubectl apply -f gitops/argocd/project.yaml
kubectl apply -f gitops/argocd/application.yaml

# Sync the platform chart manually after reviewing the diff
argocd app sync ${{ values.name }}-platform
```

The base Application syncs automatically (prune + selfHeal enabled). The platform Application has no automated sync — trigger it manually via the ArgoCD UI or CLI after reviewing the planned changes.

## FluxCD — standalone deployment

```bash
# Register the Git source (once per cluster)
kubectl apply -f gitops/fluxcd/git-repository.yaml

# Deploy base chart (reconciles automatically every 5m)
kubectl apply -f gitops/fluxcd/helmrelease-base.yaml

# Deploy platform chart (review first, then apply)
kubectl apply -f gitops/fluxcd/helmrelease-platform.yaml

# Manually trigger a platform sync when ready
flux reconcile helmrelease ${{ values.name }}-platform -n flux-system
```

To pause platform reconciliation while investigating an issue, set `suspend: true` in `helmrelease-platform.yaml` and re-apply.
