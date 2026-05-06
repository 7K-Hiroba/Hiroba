---
name: helm-base
description: Standards for editing the Hiroba base Helm chart covering security contexts, Gateway API, schema, and tests
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: helm-base
---

## What I cover

Every rule that applies when adding or modifying resources in `helm/base/`.

## Core philosophy

The base chart is **near-native**. If an official upstream Helm chart exists for the application, use it as a dependency rather than rewriting its templates. Only add custom templates when upstream does not cover the requirement. The people who build the application know it best.

## Security context — non-negotiable defaults

Every Pod and container **must** carry these security settings. They must not be removed or loosened without explicit justification:

```yaml
podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000

securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
      - ALL
```

If the workload genuinely needs a writable filesystem, mount an `emptyDir` volume at the required path instead of disabling `readOnlyRootFilesystem`.

## External traffic — Gateway API only

Use `gateway.networking.k8s.io/v1` HTTPRoute. **Do not use Ingress.**

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ include "base.fullname" . }}
spec:
  parentRefs:
    {{- toYaml .Values.gateway.parentRefs | nindent 4 }}
  hostnames:
    {{- toYaml .Values.gateway.hostnames | nindent 4 }}
  rules:
    - backendRefs:
        - name: {{ include "base.fullname" . }}
          port: {{ .Values.service.port }}
```

Gate the HTTPRoute with `{{- if .Values.gateway.enabled }}`.

## Resource limits — required

Every workload must specify both `requests` and `limits`. No unbounded resources:

```yaml
resources:
  limits:
    cpu: 500m
    memory: 256Mi
  requests:
    cpu: 100m
    memory: 128Mi
```

## Probes — required

Both `livenessProbe` and `readinessProbe` must be configured. Defaults use HTTP GET:

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: http
  initialDelaySeconds: 10
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /readyz
    port: http
  initialDelaySeconds: 5
  periodSeconds: 5
```

## HPA and PDB

- HPA is gated by `autoscaling.enabled` (default `false`). When enabled, `minReplicas`, `maxReplicas`, and `targetCPUUtilizationPercentage` must be set.
- PDB is gated by `podDisruptionBudget.enabled` (default `false`). Set either `minAvailable` or `maxUnavailable`, not both.
- PDB is only meaningful when `replicaCount > 1` or `autoscaling.enabled`. Add a comment to `values.yaml` noting this.

## Labels — use helpers

All resources must use `app.kubernetes.io/*` standard labels via `_helpers.tpl`. Include `app.kubernetes.io/part-of: hiroba`:

```yaml
labels:
  {{- include "base.labels" . | nindent 4 }}
```

## Service account

- Create a dedicated ServiceAccount per app (`serviceAccount.create: true` by default).
- Annotations are supported for workload identity (e.g., IRSA, Workload Identity).

## `values.schema.json` — keep in sync

Every new value in `values.yaml` must have a matching entry in `values.schema.json`:

- Use `additionalProperties: false` on every object.
- Mark `image`, `service`, `resources` as `required`.
- Use `enum` for `pullPolicy` (`Always`, `IfNotPresent`, `Never`) and `service.type`.
- Use integer ranges for ports (`minimum: 1`, `maximum: 65535`).
- Use `minimum: 1` for `replicaCount`.

## API version

Always `apiVersion: v2` in `Chart.yaml`.

## Unit tests

- One test file per template in `tests/`: `<template>_test.yaml`.
- Test default rendering (correct kinds, replica counts, labels).
- Test security contexts are present and correct values.
- Test conditional resources (HPA, PDB, HTTPRoute) in both enabled and disabled states.
- Test custom values (image tags, ports, env vars, volumes).

## Checklist before committing

- [ ] Security context present: `runAsNonRoot`, `readOnlyRootFilesystem`, `capabilities.drop: ALL`
- [ ] No `allowPrivilegeEscalation: true` anywhere
- [ ] External routing uses HTTPRoute, not Ingress
- [ ] Resources `requests` and `limits` set for all containers
- [ ] Both `livenessProbe` and `readinessProbe` configured
- [ ] HPA and PDB gated by `enabled` flags
- [ ] `values.schema.json` updated for any new values
- [ ] Labels use `_helpers.tpl` helpers throughout
- [ ] Unit tests cover new templates and conditional paths
