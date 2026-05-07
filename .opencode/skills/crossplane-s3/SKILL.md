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
| `garage` | `storage/s3-garage.yaml` | Self-hosted Garage via garage-operator CRDs |

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

Garage is a self-hosted S3-compatible object store managed by the [garage-operator](https://github.com/rajsinghtech/garage-operator). Resources are created via the operator's CRDs (`GarageBucket`, `GarageKey`) — not Crossplane.

### CRD guard

`checks.yaml` must guard `s3.enabled + provider=garage` against `garage.rajsingh.info/v1beta1`.

### Bucket resource (GarageBucket)

```yaml
apiVersion: garage.rajsingh.info/v1beta1
kind: GarageBucket
metadata:
  name: {{ include "platform.name" . }}-{{ .Values.s3.bucketName }}
  labels:
    {{- include "platform.labels" . | nindent 4 }}
spec:
  clusterRef:
    name: {{ .Values.s3.garage.clusterRef }}
  {{- with .Values.s3.garage.quotas }}
  quotas:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.s3.garage.website }}
  website:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.s3.garage.lifecycle }}
  lifecycle:
    {{- toYaml . | nindent 4 }}
  {{- end }}
```

### Key resource (GarageKey)

The GarageKey creates S3 credentials and auto-generates a Secret containing `access-key-id`, `secret-access-key`, `endpoint`, `host`, `scheme`, `region`, and custom `additionalData` (e.g. `S3_BUCKET`). The application references this Secret via `envFrom`.

```yaml
apiVersion: garage.rajsingh.info/v1beta1
kind: GarageKey
metadata:
  name: {{ include "platform.name" . }}-s3-key
  labels:
    {{- include "platform.labels" . | nindent 4 }}
spec:
  clusterRef:
    name: {{ .Values.s3.garage.clusterRef }}
  name: "{{ include "platform.name" . }} S3 Key"
  secretTemplate:
    name: {{ include "platform.name" . }}-s3-key
    additionalData:
      S3_BUCKET: "{{ include "platform.name" . }}-{{ .Values.s3.bucketName }}"
  bucketPermissions:
    - bucketRef:
        name: {{ include "platform.name" . }}-{{ .Values.s3.bucketName }}
      read: true
      write: true
```

### `clusterRef`

Required. References an existing `GarageCluster` by name in the same namespace. The `GarageCluster` manages the actual Garage deployment (storage, networking, replication). The platform chart does not create `GarageCluster` resources.

### Credential secrets

The operator auto-generates a Secret from the `GarageKey` spec. No pre-provisioned credential secrets are needed — unlike the previous aws-cli Job pattern. The generated Secret is named via `secretTemplate.name` and contains all S3 connection info.

### Optional features

- **Quotas** (`s3.garage.quotas`) — `maxSize` and `maxObjects`
- **Website hosting** (`s3.garage.website`) — `enabled`, `indexDocument`, `errorDocument`
- **Lifecycle rules** (`s3.garage.lifecycle`) — object expiration, multipart upload cleanup

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
- [ ] Garage: `clusterRef` sourced from values, required in schema
- [ ] Garage: GarageKey includes `secretTemplate.additionalData.S3_BUCKET`
- [ ] `values.schema.json` has provider in `enum`
- [ ] `checks.yaml` has CRD guard for providers that use CRDs
- [ ] Unit tests cover both provider variants
