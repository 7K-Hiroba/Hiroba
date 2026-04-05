# GitOps Resources

This directory hosts centralized orchestration resources for deploying this application through a GitOps workflow.

Add ArgoCD Applications, FluxCD Kustomizations, or other orchestration manifests here. These are typically consumed by a centralized GitOps repository or applied directly to the management cluster.

## Structure

```
gitops/
├── argocd/
│   └── application.yaml       # ArgoCD Application manifest
├── fluxcd/
│   └── kustomization.yaml     # FluxCD Kustomization manifest
└── examples/
    └── ...                    # Environment-specific overrides
```

## Usage

### ArgoCD

Copy or reference the ArgoCD Application manifest from your central app-of-apps repository:

```bash
kubectl apply -f gitops/argocd/application.yaml
```

### FluxCD

Reference the FluxCD Kustomization from your fleet management repository:

```bash
kubectl apply -f gitops/fluxcd/kustomization.yaml
```
