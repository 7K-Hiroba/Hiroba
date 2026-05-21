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

Every rule that applies when adding or modifying base-chart resources, whether:

- editing the `hiroba-app-lib` library at `helm/lib/app/` in the **Hiroba repo** (where the templates actually live), or
- editing a scaffolded app's `helm/base/` consumer chart (thin wrappers around `hiroba-app-lib`).

## Library + consumer split

Template content lives **once**, in the `hiroba-app-lib` Helm library at `helm/lib/app/` in the Hiroba repo. Scaffolded apps declare a `dependencies:` entry against this library and ship one thin wrapper per resource:

```yaml
# scaffolded-app/helm/base/templates/deployment.yaml
{{- include "hiroba-app.deployment" . }}
```

Rules for choosing where a change goes:

- **New value, new behaviour, defaults every app should adopt** → edit the library in `helm/lib/app/templates/_<resource>.tpl` and bump the library with a conventional commit (`fix(helm-app-lib):` / `feat(helm-app-lib):`). Renovate opens a bump PR in every consumer.
- **One-off override for a single app** → edit only that app's `helm/base/templates/<resource>.yaml`, replacing the `{{- include "hiroba-app.<resource>" . }}` line with bespoke YAML. The other resources keep coming from the library.

Before linting or rendering a consumer chart locally, run `helm dependency update helm/base` so the library tarball lands in `charts/`. CI does this automatically once `workflows-library` ships the supporting changes (see [`AGENT-PROPAGATE.md`](../../AGENT-PROPAGATE.md)).

## Core philosophy

The base chart is **near-native**. If an official upstream Helm chart exists for the application, use it as a dependency rather than rewriting its templates. The library covers the in-house pattern; only add custom templates (or override a library wrapper) when upstream and the library do not cover the requirement. The people who build the application know it best.

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
  name: {{ include "hiroba-app.fullname" . }}
spec:
  parentRefs:
    {{- toYaml .Values.gateway.parentRefs | nindent 4 }}
  hostnames:
    {{- toYaml .Values.gateway.hostnames | nindent 4 }}
  rules:
    - backendRefs:
        - name: {{ include "hiroba-app.fullname" . }}
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

## Labels — use library helpers

All resources must use `app.kubernetes.io/*` standard labels via the library helpers exposed by `hiroba-app-lib` (`hiroba-app.labels`, `hiroba-app.selectorLabels`, `hiroba-app.fullname`, `hiroba-app.serviceAccountName`). They produce `app.kubernetes.io/part-of: hiroba` automatically:

```yaml
labels:
  {{- include "hiroba-app.labels" . | nindent 4 }}
```

Additions to the helpers go in `helm/lib/app/templates/_helpers.tpl` in the Hiroba repo, never in a consumer chart.

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

- Unit tests live in the **consumer** chart (the scaffolded app's `helm/base/tests/`), not in the library — they exercise the rendered output, which only exists when a consumer pulls the library in.
- One test file per template: `tests/<template>_test.yaml`.
- Run `helm dependency update` for the chart under test before `helm unittest`.
- Test default rendering (correct kinds, replica counts, labels).
- Test security contexts are present and correct values.
- Test conditional resources (HPA, PDB, HTTPRoute) in both enabled and disabled states.
- Test custom values (image tags, ports, env vars, volumes).
- When a library bump changes default behaviour, add a regression test in at least one canonical consumer chart before merging.

## Checklist before committing

- [ ] Change made in the right place — library for shared behaviour, consumer chart for app-specific overrides
- [ ] Conventional-commit scope matches: `helm-app-lib` for library changes, `helm-base` for consumer changes
- [ ] Security context present: `runAsNonRoot`, `readOnlyRootFilesystem`, `capabilities.drop: ALL`
- [ ] No `allowPrivilegeEscalation: true` anywhere
- [ ] External routing uses HTTPRoute, not Ingress
- [ ] Resources `requests` and `limits` set for all containers
- [ ] Both `livenessProbe` and `readinessProbe` configured
- [ ] HPA and PDB gated by `enabled` flags
- [ ] `values.schema.json` updated for any new values (library reference schema **and** consumer schema if surface changed)
- [ ] Labels use `hiroba-app.labels` / `hiroba-app.selectorLabels` throughout
- [ ] Unit tests in a consumer chart cover new behaviour and conditional paths
