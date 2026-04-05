# ${{ values.name }}

${{ values.description }}

## Structure

```
├── helm/
│   ├── base/           # Core k8s resources (Deployment, Service, Ingress)
│   └── platform/       # Platform dependencies with provider switching
├── crossplane/         # App-specific Crossplane compositions (XRDs, Compositions)
├── gitops/
│   ├── argocd/         # ArgoCD Application manifests
│   └── fluxcd/         # FluxCD Kustomization manifests
├── docs/               # TechDocs content
├── .github/workflows/  # CI/CD (references 7K-Hiroba/workflows-library)
├── Dockerfile
├── catalog-info.yaml   # Backstage catalog entry
└── mkdocs.yml          # TechDocs configuration
```

## Quick Start

```bash
# Build the container image
docker build -t ${{ values.name }}:dev .

# Deploy base application
helm install ${{ values.name }} ./helm/base

# Deploy platform dependencies (optional)
helm install ${{ values.name }}-platform ./helm/platform
```

## Documentation

Full documentation is available in Backstage via TechDocs, or locally under `docs/`.

## Part of the Hiroba ecosystem

Scaffolded with [Hiroba](https://github.com/7KGroup/hiroba) by 7KGroup.
