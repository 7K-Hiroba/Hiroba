---
sidebar_position: 4
---

# Security

## Pod Security

Individual app charts (from the app-template) enforce:

- `runAsNonRoot: true` — containers never run as root
- `readOnlyRootFilesystem: true` — containers cannot write to the root filesystem
- `allowPrivilegeEscalation: false` — no privilege escalation
- All capabilities dropped — no Linux capabilities granted

These are enforced by each app's `helm/base` chart and are not overridable via the stack's value files (by design).

## Network Policies

Network policies are **not included** in this stack template. Teams should implement them using whatever approach best fits their environment:

- **Vanilla Kubernetes NetworkPolicy** manifests committed to the app's platform chart
- **Cilium / Calico** CiliumNetworkPolicy or GlobalNetworkPolicy resources
- **Policy engines** (Kyverno, OPA Gatekeeper) enforcing defaults cluster-wide

This keeps the stack generic and avoids opinionated defaults that would conflict with existing cluster policies.

## TLS with cert-manager

cert-manager is included as an operator in `gitops/argocd/applications/common/cert-manager.yaml`. It provisions TLS certificates automatically. Apps can reference Certificate resources or use annotations on their Gateway/HTTPRoute.

Remove the cert-manager Application if your cluster already has it installed or you don't need TLS automation.

## Secrets Management

Secrets are managed at two levels:

1. **Operator** — External Secrets Operator is installed via `common/external-secrets.yaml`
2. **Per-app** — each app's `values-platform.yaml` override configures ExternalSecret CRs

```yaml
# In apps/my-app/values-platform.yaml
externalSecrets:
  enabled: true
  data:
    - secretKey: DATABASE_URL
      remoteKey: stack/my-app/database
      property: url
```

## Extending Security

### Network policies

Add NetworkPolicy resources to your app's platform chart, or use a cluster-wide policy engine to enforce defaults across all namespaces.

### Service mesh (mTLS)

Add the service mesh operator (Istio, Linkerd) as an Application in `common/`, then create PeerAuthentication/AuthorizationPolicy resources.

### Pod Security Standards

Apply Kubernetes Pod Security Standards at the namespace level:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  labels:
    pod-security.kubernetes.io/enforce: restricted
```
