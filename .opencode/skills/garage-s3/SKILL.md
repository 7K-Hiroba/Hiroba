---
name: garage-s3
description: Standards for self-hosted Garage S3 object storage in the platform chart using the garage-operator CRDs
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: helm-platform
---

## What I cover

The Garage-specific implementation of S3 storage in the platform chart using the [garage-operator](https://github.com/rajsinghtech/garage-operator) CRDs (`GarageBucket`, `GarageKey`). The operator manages bucket creation, S3 credential provisioning, and secret generation — replacing the previous aws-cli Job hook pattern.

For general S3 provider switching rules see the `crossplane-s3` skill. This skill covers only Garage-specific patterns.

## Where the template lives

The Garage S3 template is the `hiroba-platform.s3-garage` named template in `helm/lib/platform/templates/storage/_s3-garage.tpl` inside the Hiroba repo. Scaffolded apps only ship a one-line wrapper at `helm/platform/templates/storage/s3-garage.yaml`:

```yaml
{{- include "hiroba-platform.s3-garage" . }}
```

The same backup-storage flow is reused by `hiroba-platform.cnpg-cluster` (CNPG barman backups) — when fixing or extending the credential / bucket shape, check that both call sites still produce the right output. Library bumps use `fix(helm-platform-lib):` / `feat(helm-platform-lib):`.

## Operator installation

The garage-operator must be installed in the cluster before using `s3.provider: garage`. Install via Helm:

```bash
helm install garage-operator oci://ghcr.io/rajsinghtech/charts/garage-operator \
  --namespace garage-operator-system \
  --create-namespace
```

The operator registers the following CRDs under `garage.rajsingh.info/v1beta1`:
- `GarageCluster` — deploys and manages a Garage storage or gateway cluster
- `GarageBucket` — creates buckets with quotas, website hosting, and lifecycle rules
- `GarageKey` — provisions S3 access keys with per-bucket permissions and generates a Secret
- `GarageNode` — fine-grained node layout control
- `GarageAdminToken` — manages admin API tokens
- `GarageReferenceGrant` — grants cross-namespace access

The platform chart only creates `GarageBucket` and `GarageKey` resources — it assumes a `GarageCluster` already exists.

## CRD guard

`checks.yaml` must guard `s3.enabled + provider=garage` against `garage.rajsingh.info/v1beta1`. It must also guard `postgres.backup.enabled` against the same CRD (the CNPG backup template creates GarageBucket/GarageKey for backup storage).

```yaml
{{- if and .Values.s3.enabled (eq .Values.s3.provider "garage") (not (.Capabilities.APIVersions.Has "garage.rajsingh.info/v1beta1")) }}
  {{- fail "s3.enabled is true with provider 'garage' but the Garage Operator CRD (garage.rajsingh.info/v1beta1) is not installed..." }}
{{- end }}
```

## Resource shape

The Garage provider produces two resources gated by `{{- if and .Values.s3.enabled (eq .Values.s3.provider "garage") }}`:

### 1. GarageBucket — declarative bucket creation

```yaml
apiVersion: garage.rajsingh.info/v1beta1
kind: GarageBucket
metadata:
  name: {{ include "hiroba-platform.name" . }}-{{ .Values.s3.bucketName }}
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
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

The operator handles bucket creation, idempotency, and deletion lifecycle. No Job hook is needed.

### 2. GarageKey — S3 credentials with auto-generated Secret

```yaml
apiVersion: garage.rajsingh.info/v1beta1
kind: GarageKey
metadata:
  name: {{ include "hiroba-platform.name" . }}-s3-key
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
spec:
  clusterRef:
    name: {{ .Values.s3.garage.clusterRef }}
  name: "{{ include "hiroba-platform.name" . }} S3 Key"
  secretTemplate:
    name: {{ include "hiroba-platform.name" . }}-s3-key
    additionalData:
      S3_BUCKET: "{{ include "hiroba-platform.name" . }}-{{ .Values.s3.bucketName }}"
  bucketPermissions:
    - bucketRef:
        name: {{ include "hiroba-platform.name" . }}-{{ .Values.s3.bucketName }}
      read: true
      write: true
```

The operator generates a Secret containing:
- `access-key-id` — S3 access key
- `secret-access-key` — S3 secret key
- `endpoint` — S3 API endpoint URL (derived from the GarageCluster)
- `host` — host without scheme
- `scheme` — http or https
- `region` — region from the GarageCluster
- `S3_BUCKET` — added via `additionalData` from Helm rendering

The application references this Secret via `envFrom` in the base chart.

## clusterRef

The `clusterRef` field references an existing `GarageCluster` by name. This is the single required value for the Garage provider:

```yaml
s3:
  garage:
    clusterRef: garage
```

The `GarageCluster` is expected to exist in the same namespace. For cross-namespace access, create a `GarageReferenceGrant` in the cluster's namespace.

## Bucket naming

Bucket name is always `{{ include "hiroba-platform.name" . }}-{{ .Values.s3.bucketName }}`. This matches the Crossplane convention and prevents name collisions across apps sharing a Garage instance.

## Optional bucket features

### Quotas

```yaml
s3:
  garage:
    clusterRef: garage
    quotas:
      maxSize: 10Gi
      maxObjects: 100000
```

### Website hosting

```yaml
s3:
  garage:
    clusterRef: garage
    website:
      enabled: true
      indexDocument: index.html
      errorDocument: error.html
```

### Lifecycle rules

```yaml
s3:
  garage:
    clusterRef: garage
    lifecycle:
      rules:
        - id: expire-logs
          status: Enabled
          filter:
            prefix: "logs/"
          expirationDays: 30
```

## CNPG backup integration

When `postgres.backup.enabled` is true, the CNPG template also creates `GarageBucket` and `GarageKey` resources for the backup bucket. The GarageKey generates a Secret that the CNPG `ObjectStore` references for S3 credentials.

Values for CNPG backup:

```yaml
postgres:
  backup:
    garage:
      clusterRef: garage
      endpoint: "http://garage.garage.svc.cluster.local:3900"
```

The `endpoint` value is required because the CNPG `ObjectStore` needs `endpointURL` as a string (it cannot reference a Secret for this field). The endpoint must match the GarageCluster's S3 API service address.

The ObjectStore references the GarageKey's generated Secret using the default key names:

```yaml
s3Credentials:
  accessKeyId:
    name: <app>-pg-s3-key
    key: access-key-id
  secretAccessKey:
    name: <app>-pg-s3-key
    key: secret-access-key
```

## `values.schema.json` requirements

```json
"garage": {
  "type": "object",
  "properties": {
    "clusterRef": { "type": "string" },
    "quotas": {
      "type": "object",
      "properties": {
        "maxSize": { "type": "string" },
        "maxObjects": { "type": "integer" }
      },
      "additionalProperties": false
    },
    "website": {
      "type": "object",
      "properties": {
        "enabled": { "type": "boolean" },
        "indexDocument": { "type": "string" },
        "errorDocument": { "type": "string" }
      },
      "additionalProperties": false
    },
    "lifecycle": {
      "type": "object",
      "properties": {
        "rules": { "type": "array" }
      },
      "additionalProperties": false
    }
  },
  "required": ["clusterRef"],
  "additionalProperties": false
}
```

For CNPG backup:

```json
"garage": {
  "type": "object",
  "properties": {
    "clusterRef": { "type": "string" },
    "endpoint": { "type": "string" }
  },
  "required": ["clusterRef", "endpoint"],
  "additionalProperties": false
}
```

## Checklist before committing

- [ ] Both GarageBucket and GarageKey gated by `s3.enabled` AND `eq .Values.s3.provider "garage"`
- [ ] `checks.yaml` has CRD guard for `garage.rajsingh.info/v1beta1`
- [ ] `checks.yaml` has CRD guard for `postgres.backup.enabled` against `garage.rajsingh.info/v1beta1`
- [ ] GarageKey `secretTemplate.additionalData` includes `S3_BUCKET`
- [ ] GarageKey `bucketPermissions` grants read+write on the bucket
- [ ] GarageBucket `clusterRef` sourced from values
- [ ] No ConfigMap or Job resources (operator handles bucket creation and credential generation)
- [ ] No `endpoint`, `accessKeySecret`, `secretKeySecret`, or `replicationFactor` in values (operator-internal)
- [ ] Bucket name includes `hiroba-platform.name` prefix
- [ ] `values.schema.json` updated with `clusterRef` as required field
- [ ] Unit test covers GarageBucket and GarageKey rendering
- [ ] CNPG backup test covers GarageBucket, GarageKey, and ObjectStore credential references
