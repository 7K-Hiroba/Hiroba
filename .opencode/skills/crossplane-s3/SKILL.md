---
name: crossplane-s3
description: Standards for Crossplane and Garage S3 bucket resources in the platform chart
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: helm-platform
---

## What I cover

Standards for all S3 object storage resources under `helm/platform/templates/storage/`.

## Provider switch

S3 resources use a `provider` enum with two supported values:

| `s3.provider` | Template file | Backend |
| --- | --- | --- |
| `crossplane` | `storage/s3-crossplane.yaml` | AWS S3 via Crossplane AWS provider |
| `garage` | `storage/s3-garage.yaml` | Self-hosted Garage via native API |

Gate each template:

```yaml
{{- if and .Values.s3.enabled (eq .Values.s3.provider "crossplane") }}
```

```yaml
{{- if and .Values.s3.enabled (eq .Values.s3.provider "garage") }}
```

## Crossplane (`provider: crossplane`)

### CRD guard

`checks.yaml` must guard `s3.enabled + provider=crossplane` against `s3.aws.crossplane.io/v1beta1`.

### Bucket resource

```yaml
apiVersion: s3.aws.crossplane.io/v1beta1
kind: Bucket
metadata:
  name: {{ include "platform.name" . }}-{{ .Values.s3.bucketName }}
  labels:
    {{- include "platform.labels" . | nindent 4 }}
spec:
  forProvider:
    region: {{ .Values.s3.crossplane.region }}
    acl: {{ .Values.s3.acl }}
    {{- if .Values.s3.crossplane.lifecycle.enabled }}
    lifecycleConfiguration:
      rules:
        - status: Enabled
          expiration:
            days: {{ .Values.s3.crossplane.lifecycle.expirationDays }}
    {{- end }}
  providerConfigRef:
    name: {{ .Values.s3.crossplane.providerConfigRef }}
```

### Bucket naming

Bucket name is `{{ include "platform.name" . }}-{{ .Values.s3.bucketName }}`. This prevents collisions across apps sharing a cluster. Never use a bare `bucketName` without the app prefix.

### ACL

Must be sourced from `values.s3.acl`. Default is `private`. Do not hardcode `public-read` — if public access is needed, it must be an explicit values override.

### `providerConfigRef`

Must reference a named `ProviderConfig` object — never use the implicit default. Source from `values.s3.crossplane.providerConfigRef`.

## Garage (`provider: garage`)

Garage is a self-hosted S3-compatible object store. Resources are created via Garage's native Kubernetes operator CRDs (not Crossplane).

### Bucket resource

```yaml
apiVersion: garage.deuxfleurs.fr/v1
kind: GarageBucket
metadata:
  name: {{ include "platform.name" . }}-{{ .Values.s3.bucketName }}
  labels:
    {{- include "platform.labels" . | nindent 4 }}
spec:
  endpoint: {{ .Values.s3.garage.endpoint }}
  replicationFactor: {{ .Values.s3.garage.replicationFactor }}
  accessKeySecret:
    name: {{ .Values.s3.garage.accessKeySecret.name }}
    key: {{ .Values.s3.garage.accessKeySecret.key }}
  secretKeySecret:
    name: {{ .Values.s3.garage.secretKeySecret.name }}
    key: {{ .Values.s3.garage.secretKeySecret.key }}
```

### `replicationFactor`

Must be `1`, `2`, or `3`. Production clusters should use `3` for data durability. The schema should enforce `minimum: 1`, `maximum: 3`.

### Credential secrets

The access key and secret key are referenced from existing Kubernetes Secrets. These Secrets must be provisioned externally (e.g., via ExternalSecret) before the GarageBucket resource is applied. The platform chart does not create credential secrets.

### Endpoint format

Must be a full URL including scheme and port: `http://garage.garage.svc.cluster.local:3900`. Source from values — never hardcode.

## Adding a new S3 provider

1. Create `helm/platform/templates/storage/s3-<provider>.yaml`.
2. Gate with `{{- if and .Values.s3.enabled (eq .Values.s3.provider "<provider>") }}`.
3. Add provider-specific values under `s3.<provider>:` in `values.yaml`.
4. Add the new provider name to the `s3.provider` `enum` in `values.schema.json`.
5. Add a CRD guard in `checks.yaml` if the provider uses a CRD-backed API.
6. Add unit tests covering the new provider.

## `values.schema.json` requirements

```json
"s3": {
  "type": "object",
  "properties": {
    "provider": {
      "type": "string",
      "enum": ["crossplane", "garage"]
    },
    "acl": {
      "type": "string",
      "enum": ["private", "public-read", "public-read-write", "authenticated-read"]
    }
  }
}
```

## Checklist before committing

- [ ] Template gated by both `s3.enabled` AND `eq .Values.s3.provider "<name>"`
- [ ] Template file named `s3-<provider>.yaml`
- [ ] Bucket name includes `platform.name` prefix
- [ ] `acl` sourced from values, not hardcoded
- [ ] Crossplane: `providerConfigRef` sourced from values
- [ ] Garage: credential secrets referenced from values, not created by chart
- [ ] `values.schema.json` has provider in `enum`
- [ ] `checks.yaml` has CRD guard for providers that use CRDs
- [ ] Unit tests cover both provider variants
