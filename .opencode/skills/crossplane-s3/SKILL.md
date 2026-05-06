---
name: crossplane-s3
description: Standards for Crossplane AWS/GCP object storage resources in the platform chart
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: helm-platform
---

## What I cover

Standards for all object storage resources under `helm/platform/templates/storage/`.

## Provider switch

Object storage resources use a `provider` enum with two supported values:

| `s3.provider` | Template file | Backend |
| --- | --- | --- |
| `aws` | `storage/s3-aws.yaml` | AWS S3 via Crossplane AWS provider |
| `gcp` | `storage/s3-gcp.yaml` | GCP Cloud Storage via Crossplane GCP provider |

Gate each template:

```yaml
{{- if and .Values.s3.enabled (eq .Values.s3.provider "aws") }}
```

```yaml
{{- if and .Values.s3.enabled (eq .Values.s3.provider "gcp") }}
```

## AWS (`provider: aws`)

### CRD guard

`checks.yaml` must guard `s3.enabled + provider=aws` against `s3.aws.crossplane.io/v1beta1`.

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
    locationConstraint: {{ .Values.s3.aws.region }}
    acl: {{ .Values.s3.aws.acl }}
    {{- if .Values.s3.aws.lifecycle.enabled }}
    lifecycleConfiguration:
      rules:
        - status: Enabled
          filter:
            prefix: ""
          expiration:
            days: {{ .Values.s3.aws.lifecycle.expirationDays }}
    {{- end }}
  providerConfigRef:
    name: {{ .Values.s3.aws.providerConfigRef }}
```

### Bucket naming

Bucket name is `{{ include "platform.name" . }}-{{ .Values.s3.bucketName }}`. This prevents collisions across apps sharing a cluster. Never use a bare `bucketName` without the app prefix.

### ACL

Must be sourced from `values.s3.aws.acl`. Default is `private`. Do not hardcode `public-read` — if public access is needed, it must be an explicit values override.

### `providerConfigRef`

Must reference a named `ProviderConfig` object — never use the implicit default. Source from `values.s3.aws.providerConfigRef`.

## GCP (`provider: gcp`)

### CRD guard

`checks.yaml` must guard `s3.enabled + provider=gcp` against `storage.gcp.crossplane.io/v1alpha3`.

### Bucket resource

```yaml
apiVersion: storage.gcp.crossplane.io/v1alpha3
kind: Bucket
metadata:
  name: {{ include "platform.name" . }}-{{ .Values.s3.bucketName }}
  labels:
    {{- include "platform.labels" . | nindent 4 }}
spec:
  location: {{ .Values.s3.gcp.location }}
  storageClass: {{ .Values.s3.gcp.storageClass }}
  providerConfigRef:
    name: {{ .Values.s3.gcp.providerConfigRef }}
```

### Bucket naming

Bucket name is `{{ include "platform.name" . }}-{{ .Values.s3.bucketName }}`. This prevents collisions across apps sharing a cluster. Never use a bare `bucketName` without the app prefix.

### `providerConfigRef`

Must reference a named `ProviderConfig` object — never use the implicit default. Source from `values.s3.gcp.providerConfigRef`.

## Adding a new provider

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
      "enum": ["aws", "gcp"]
    }
  }
}
```

## Checklist before committing

- [ ] Template gated by both `s3.enabled` AND `eq .Values.s3.provider "<name>"`
- [ ] Template file named `s3-<provider>.yaml`
- [ ] Bucket name includes `platform.name` prefix
- [ ] `acl` sourced from values (AWS only), not hardcoded
- [ ] `providerConfigRef` sourced from values
- [ ] `values.schema.json` has provider in `enum`
- [ ] `checks.yaml` has CRD guard for providers that use CRDs
- [ ] Unit tests cover both provider variants
