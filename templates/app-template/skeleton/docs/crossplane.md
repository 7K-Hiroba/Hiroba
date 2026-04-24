---
sidebar_position: 5
---

# Crossplane compositions

This directory hosts Crossplane Composite Resource Definitions (XRDs) and Compositions that **this application provides** to the platform — the inverse of the platform chart, which only *consumes* infrastructure.

Use this stack when your application exposes infrastructure capabilities that other applications can consume. For example, a Keycloak deployment might publish compositions that let other apps provision realms and clients via Claims.

Values reference: [`compositions/crossplane/`](https://github.com/7KGroup/${{ values.name }}/tree/main/compositions/crossplane)

## Structure

```
compositions/crossplane/
├── xrd-<resource>.yaml           # CompositeResourceDefinition
├── composition-<resource>.yaml   # Composition (maps XRD to managed resources)
└── examples/
    └── claim-<resource>.yaml     # Example Claim for consumers
```

Keep one XRD + one Composition per logical resource. Split into separate files rather than bundling — Crossplane applies them independently, and diffs stay readable.

## Install

After adding compositions, apply them to the cluster:

```bash
kubectl apply -f compositions/crossplane/
```

Compositions are cluster-scoped — install them once per cluster, not per namespace.

## Authoring a new composition

<!-- TODO: Document the specific XRDs this application publishes. Remove this section if the application does not expose any. -->

1. **Define the XRD** (`xrd-<resource>.yaml`) — the CRD-like schema consumers will write against. Keep the schema minimal; internal knobs belong in the Composition, not the Claim.
2. **Write the Composition** (`composition-<resource>.yaml`) — maps XRD fields to one or more managed resources (e.g. a Keycloak `Realm` + a `ClientRepresentation`).
3. **Add an example Claim** (`examples/claim-<resource>.yaml`) — a runnable demo consumers can copy.
4. **Test on a cluster** — apply the XRD and Composition, then apply the example Claim. Verify the downstream managed resources reconcile before publishing.

## Consuming compositions

Other applications consume your XRDs by creating Claims in their platform Helm charts:

```yaml
apiVersion: <your-group>/v1alpha1
kind: <YourClaimKind>
metadata:
  name: consumer-app-claim
spec:
  # fields defined by your XRD
```

## Versioning

- Breaking changes to XRD schemas require a new API version (`v1alpha2`, `v1beta1`, etc.) — don't mutate `v1alpha1` in place
- Keep the previous version served alongside the new one until consumers migrate
- Flag breaking changes in the application's CHANGELOG under a `crossplane:` prefix
