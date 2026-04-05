# Crossplane Compositions

This directory hosts Crossplane Composite Resource Definitions (XRDs) and Compositions that this application **provides** to the platform.

Use this when your application exposes infrastructure capabilities that other applications can consume. For example, a Keycloak deployment might publish compositions that let other apps provision realms and clients via Claims.

## Structure

```
crossplane/
├── xrd-<resource>.yaml           # CompositeResourceDefinition
├── composition-<resource>.yaml   # Composition (maps XRD to managed resources)
└── examples/
    └── claim-<resource>.yaml     # Example Claim for consumers
```

## Usage

After adding compositions, install them on the cluster:

```bash
kubectl apply -f crossplane/
```

Other applications can then create Claims against your XRDs in their platform Helm charts.
