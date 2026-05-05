---
name: external-secrets
description: Standards for ExternalSecret resources in the platform chart including store refs, naming, and secret mapping
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: helm-platform
---

## What I cover

Standards for every `external-secrets.io/v1` ExternalSecret resource in the platform chart.

## API version

Always `external-secrets.io/v1`. Do not use `v1beta1`.

## Gating

The ExternalSecret is gated by `externalSecrets.enabled` (default `false`). The CRD guard in `checks.yaml` enforces the operator is installed before this can be enabled.

## Standard shape

```yaml
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: {{ include "platform.name" . }}-secrets
  labels:
    {{- include "platform.labels" . | nindent 4 }}
spec:
  refreshInterval: {{ .Values.externalSecrets.refreshInterval }}
  secretStoreRef:
    name: {{ .Values.externalSecrets.storeRef.name }}
    kind: {{ .Values.externalSecrets.storeRef.kind }}
  target:
    name: {{ include "platform.name" . }}-secrets
    creationPolicy: Owner
    {{- with .Values.externalSecrets.target.template }}
    template:
      {{- toYaml . | nindent 6 }}
    {{- end }}
  {{- with .Values.externalSecrets.data }}
  data:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.externalSecrets.dataFrom }}
  dataFrom:
    {{- toYaml . | nindent 4 }}
  {{- end }}
```

## Naming convention

The target Kubernetes Secret is named `{{ include "platform.name" . }}-secrets`. This is the name that application Deployments reference via `envFrom` or `env.valueFrom`. Do not deviate from this pattern without updating the base chart values as well.

## SecretStore reference

- Default to `ClusterSecretStore` with name `cluster-secret-store`.
- If an app needs a namespace-scoped `SecretStore`, update `storeRef.kind: SecretStore` in values.
- Never hardcode the store name in the template — always source from `values.externalSecrets.storeRef.name`.

## `refreshInterval`

- Must be non-zero. Default is `1h`.
- For secrets that change frequently (e.g., rotating credentials), consider `5m`.
- For static secrets (e.g., TLS certs managed elsewhere), `24h` is acceptable.

## `creationPolicy: Owner`

Always set `creationPolicy: Owner`. This ensures the Secret is deleted when the ExternalSecret is deleted, preventing stale secrets from lingering.

## `data` vs `dataFrom`

- Use `data[]` to map individual keys: precise, explicit, auditable.
- Use `dataFrom[]` with `extract` for bulk-importing a secret path when the shape is known and stable.
- Avoid `dataFrom` with `find` (regex key discovery) — it is non-deterministic and hard to audit.

## Secret templating

Use `target.template` when the application expects a different key name or format than what the secret backend provides:

```yaml
target:
  template:
    type: Opaque
    data:
      DATABASE_URL: "postgres://{{ `{{ .username }}` }}:{{ `{{ .password }}` }}@host/{{ `{{ .database }}` }}"
```

Note the double-braces escaping — the outer `{{ }}` is Helm, the inner `{{ `{{ }}` }}` is the ExternalSecret template engine.

## Checklist before committing

- [ ] API version is `external-secrets.io/v1`
- [ ] Resource gated by `externalSecrets.enabled`
- [ ] Target Secret named `{{ include "platform.name" . }}-secrets`
- [ ] `creationPolicy: Owner` set
- [ ] `refreshInterval` sourced from values, non-zero
- [ ] `storeRef` sourced from values, not hardcoded
- [ ] `values.schema.json` updated if new `externalSecrets.*` fields added
- [ ] Unit test covers both enabled and disabled states
