---
name: cnpg-cluster
description: Standards for editing CloudNativePG Cluster resources including mandatory Barman backup configuration
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: helm-platform
---

## What I cover

Standards and required patterns for every `postgresql.cnpg.io/v1` Cluster resource in the platform chart.

## Mandatory fields

Every Cluster **must** include all of the following. Missing any one is a blocking error.

### `spec.instances`

Must be at least `1`. For production environments use `3` for HA. Sourced from `values.postgres.instances`.

### `spec.imageName`

Must be a fully-qualified, pinned image — never `:latest`. Use the CloudNativePG official image:

```yaml
imageName: ghcr.io/cloudnative-pg/postgresql:16.2
```

Track updates via Renovate (`imageName:` custom manager is already configured).

### `spec.bootstrap.initdb`

Must declare the database name and owner:

```yaml
bootstrap:
  initdb:
    database: app
    owner: app
```

### `spec.storage`

Must set an explicit `size`. `storageClass` is optional but recommended for production:

```yaml
storage:
  size: 10Gi
  storageClass: ""   # leave empty to use cluster default
```

### `spec.resources`

Must set both `requests` and `limits` for CPU and memory. No unbounded resources:

```yaml
resources:
  limits:
    cpu: "1"
    memory: 1Gi
  requests:
    cpu: 250m
    memory: 256Mi
```

## Backup via barman-cloud plugin — mandatory when `postgres.backup.enabled: true`

The platform chart uses the **barman-cloud plugin** strategy (`barman-cloud.cloudnative-pg.io`) rather than the legacy inline `barmanObjectStore` block. This requires the barman-cloud plugin to be installed in the cluster alongside the CNPG operator.

When backup is enabled, **three resources** are required:

1. `spec.plugins` on the Cluster referencing the plugin and ObjectStore name
2. A `barmancloud.cnpg.io/v1` `ObjectStore` resource with the Garage S3 config
3. A `postgresql.cnpg.io/v1` `ScheduledBackup` resource for scheduled base backups

### Cluster backup shape

```yaml
plugins:
  - name: barman-cloud.cloudnative-pg.io
    parameters:
      barmanObjectName: {{ include "platform.name" . }}-pg-barman

backup:
  retentionPolicy: {{ .Values.postgres.backup.retentionPolicy }}
```

### ObjectStore resource

Emitted in the same file (`cnpg-cluster.yaml`) as a second YAML document, gated by `{{- if .Values.postgres.backup.enabled }}`:

```yaml
apiVersion: barmancloud.cnpg.io/v1
kind: ObjectStore
metadata:
  name: {{ include "platform.name" . }}-pg-barman
  labels:
    {{- include "platform.labels" . | nindent 4 }}
spec:
  configuration:
    destinationPath: "s3://{{ include "platform.name" . }}-pg-backups/"
    endpointURL: {{ .Values.postgres.backup.garage.endpoint | quote }}
    s3Credentials:
      accessKeyId:
        name: {{ .Values.postgres.backup.garage.credentialsSecret.name }}
        key: {{ .Values.postgres.backup.garage.credentialsSecret.accessKeyKey }}
      secretAccessKey:
        name: {{ .Values.postgres.backup.garage.credentialsSecret.name }}
        key: {{ .Values.postgres.backup.garage.credentialsSecret.secretKeyKey }}
    wal:
      compression: gzip
    data:
      compression: gzip
```

The `wal` block enables **continuous WAL archiving**, which allows point-in-time recovery (PITR). It must always be present when backup is enabled.

### `retentionPolicy`

- Must be present and non-empty.
- Must follow CNPG retention format: `"7d"`, `"30d"`, `"4w"`, etc.
- Default in `values.yaml` is `"7d"`. Increase for production.

### `destinationPath`

- Must be an `s3://` URI.
- Convention: `s3://<platform.name>-pg-backups/`.
- Do not use a local path or a generic bucket name that could collide across apps.

### `endpointURL`

Must be sourced from `values.postgres.backup.garage.endpoint`. Defaults to the cluster-internal Garage address:

```
http://garage.garage.svc.cluster.local:3900
```

### Credential secret convention

Credentials are sourced from a single pre-existing Kubernetes Secret — typically the Secret produced by a GarageKey resource — referenced via:

```yaml
postgres:
  backup:
    garage:
      credentialsSecret:
        name: <app>-pg-garage-key   # Set to the actual Secret name
        accessKeyKey: accessKey
        secretKeyKey: secretKey
```

The platform chart does **not** create this Secret. It must be provisioned externally (e.g., via a GarageKey + ExternalSecret) and exist in the namespace before the Cluster is created.

## ScheduledBackup resource

When backup is enabled, a `postgresql.cnpg.io/v1` `ScheduledBackup` resource must exist in `templates/database/cnpg-scheduled-backup.yaml`:

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: {{ include "platform.name" . }}-pg-backup
  labels:
    {{- include "platform.labels" . | nindent 4 }}
spec:
  schedule: {{ .Values.postgres.backup.schedule | quote }}
  backupOwnerReference: self
  cluster:
    name: {{ include "platform.name" . }}-pg
  pluginConfiguration:
    name: barman-cloud.cloudnative-pg.io
    parameters:
      barmanObjectName: {{ include "platform.name" . }}-pg-barman
```

Gate with `{{- if and .Values.postgres.enabled .Values.postgres.backup.enabled }}`.

The `pluginConfiguration` block is mandatory — without it the ScheduledBackup does not know which ObjectStore to target.

## Labels

All resources must use `platform.labels` from `_helpers.tpl`:

```yaml
labels:
  {{- include "platform.labels" . | nindent 4 }}
```

## CRD capability check

`templates/checks.yaml` already guards `postgres.enabled` against the `postgresql.cnpg.io/v1` API group. Do not add a duplicate check — verify the existing one covers any new CNPG resource kinds you introduce. The `barmancloud.cnpg.io/v1` ObjectStore does not require a separate CRD guard; it ships with the barman-cloud plugin.

## `values.yaml` shape

```yaml
postgres:
  backup:
    enabled: false
    schedule: "0 2 * * *"
    retentionPolicy: "7d"
    garage:
      endpoint: "http://garage.garage.svc.cluster.local:3900"
      credentialsSecret:
        name: ""
        accessKeyKey: accessKey
        secretKeyKey: secretKey
```

## `values.schema.json` shape

```json
"backup": {
  "type": "object",
  "properties": {
    "enabled": { "type": "boolean" },
    "schedule": { "type": "string" },
    "retentionPolicy": { "type": "string" },
    "garage": {
      "type": "object",
      "properties": {
        "endpoint": { "type": "string" },
        "credentialsSecret": {
          "type": "object",
          "properties": {
            "name": { "type": "string" },
            "accessKeyKey": { "type": "string" },
            "secretKeyKey": { "type": "string" }
          },
          "required": ["name", "accessKeyKey", "secretKeyKey"],
          "additionalProperties": false
        }
      },
      "required": ["endpoint", "credentialsSecret"],
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

## Checklist before committing

- [ ] `instances`, `imageName`, `bootstrap.initdb`, `storage.size`, `resources` all present
- [ ] Image tag is pinned (not `:latest`)
- [ ] If `backup.enabled`: `spec.plugins` references `barman-cloud.cloudnative-pg.io` on the Cluster
- [ ] If `backup.enabled`: `ObjectStore` resource present in `cnpg-cluster.yaml` with `endpointURL`, `s3Credentials`, `wal.compression`, `data.compression`
- [ ] If `backup.enabled`: `ScheduledBackup` resource present in `cnpg-scheduled-backup.yaml` with `pluginConfiguration`
- [ ] `retentionPolicy` is non-empty
- [ ] `credentialsSecret.name` points to a pre-provisioned Secret (not created by the chart)
- [ ] `values.schema.json` updated if any new `postgres.*` values added
- [ ] helm-unittest tests cover: backup-disabled (1 doc), backup-enabled (2 docs), plugin ref, ObjectStore endpoint/credentials/compression, ScheduledBackup schedule and pluginConfiguration
