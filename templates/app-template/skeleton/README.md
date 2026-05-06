# ${{ values.name }}

${{ values.description }}

## Structure

```
├── helm/
│   ├── base/           # Core k8s resources (Deployment, Service, HTTPRoute)
│   └── platform/       # Platform dependencies with provider switching
├── compositions/
│   └── crossplane/     # App-specific Crossplane compositions (XRDs, Compositions)
├── gitops/
│   ├── argocd/         # ArgoCD Application manifests
│   └── fluxcd/         # FluxCD Kustomization manifests
├── docs/               # TechDocs content
├── .github/workflows/  # CI/CD (references 7K-Okura/workflows-library)
├── Dockerfile
└── catalog-info.yaml   # Backstage catalog entry
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

Full documentation is available at [okura.7kgroup.org/apps/${{ values.name }}](https://okura.7kgroup.org/apps/${{ values.name }}), or locally under `docs/`.

## Part of the Okura ecosystem

Scaffolded with [Okura](https://github.com/7K-Okura/Okura) by 7KGroup.
