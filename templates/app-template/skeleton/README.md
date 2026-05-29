# ${{ values.name }}

${{ values.description }}

## Structure

```text
├── helm/
│   ├── base/           # Core k8s resources (Deployment, Service, HTTPRoute)
│   └── platform/       # Platform dependencies (databases, storage, secrets, observability)
├── compositions/
│   └── crossplane/     # App-specific Crossplane compositions (XRDs, Compositions)
├── gitops/
│   ├── argocd/         # ArgoCD Application manifests
│   └── fluxcd/         # FluxCD Kustomization manifests
├── docs/               # TechDocs content
├── .github/workflows/  # CI/CD (references 7K-Hiroba/workflows-library)
{% if values.hasCustomDockerfile %}├── Dockerfile          # Custom container image
{% endif %}└── catalog-info.yaml   # Backstage catalog entry
```

## Quick Start

```bash
# Deploy base application
helm install ${{ values.name }} ./helm/base

# Deploy platform dependencies (optional)
helm install ${{ values.name }}-platform ./helm/platform
```

## Documentation

Full documentation is available at [hiroba.7kgroup.org/apps/${{ values.name }}](https://hiroba.7kgroup.org/apps/${{ values.name }}), or locally under `docs/`.

## Contributing

Please read the [Contributing Guide](https://github.com/7K-Hiroba/Hiroba/blob/main/CONTRIBUTING.md) before opening pull requests.

## Part of the Hiroba ecosystem

Scaffolded with [Hiroba](https://github.com/7K-Hiroba/Hiroba) by 7KGroup.
