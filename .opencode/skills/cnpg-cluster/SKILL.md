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

## Backup via Barman — mandatory when `postgres.backup.enabled: true`

When backup is enabled (`{{- if .Values.postgres.backup.enabled }}`), the cluster **must** include a `spec.backup.barmanObjectStore` block. Backup without a barman store is invalid.

### Required backup shape

```yaml
backup:
  barmanObjectStore:
    destinationPath: "s3://{{ include "platform.name" . }}-pg-backups/"
    s3Credentials:
      accessKeyId:
        name: {{ include "platform.name" . }}-pg-backup-creds
        key: ACCESS_KEY_ID
      secretAccessKey:
        name: {{ include "platform.name" . }}-pg-backup-creds
        key: ACCESS_SECRET_KEY
  retentionPolicy: {{ .Values.postgres.backup.retentionPolicy }}
```

### `retentionPolicy`

- Must be present and non-empty.
- Must follow CNPG retention format: `"7d"`, `"30d"`, `"4w"`, etc.
- Default in `values.yaml` is `"7d"`. Increase for production.

### `destinationPath`

- Must be an `s3://` URI.
- The convention is `s3://<platform.name>-pg-backups/`.
- Do not use a local path or a generic bucket name that could collide across apps.

### Secret reference convention

The credential Secret is named `{{ include "platform.name" . }}-pg-backup-creds` and must contain:

| Key | Value |
| --- | --- |
| `ACCESS_KEY_ID` | S3 access key |
| `ACCESS_SECRET_KEY` | S3 secret key |

This Secret is **not** created by the platform chart. It must be provisioned externally (e.g., via an ExternalSecret) and exist in the same namespace before the Cluster is created.

## ScheduledBackup resource

When backup is enabled, a `postgresql.cnpg.io/v1` `ScheduledBackup` resource should accompany the Cluster:

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
```

Gate it with the same `{{- if .Values.postgres.backup.enabled }}` condition.

## Labels

All resources must use `platform.labels` from `_helpers.tpl`:

```yaml
labels:
  {{- include "platform.labels" . | nindent 4 }}
```

## CRD capability check

`templates/checks.yaml` already guards `postgres.enabled` against the `postgresql.cnpg.io/v1` API group. Do not add a duplicate check — verify the existing one covers any new CNPG resource kinds you introduce.

## Checklist before committing

- [ ] `instances`, `imageName`, `bootstrap.initdb`, `storage.size`, `resources` all present
- [ ] Image tag is pinned (not `:latest`)
- [ ] If `backup.enabled`, `barmanObjectStore` block is present with `destinationPath` and `s3Credentials`
- [ ] If `backup.enabled`, a `ScheduledBackup` resource exists with `schedule` from values
- [ ] `retentionPolicy` is non-empty
- [ ] Credential secret name follows `<platform.name>-pg-backup-creds` convention
- [ ] `values.schema.json` updated if any new `postgres.*` values added
- [ ] helm-unittest test covers backup-enabled and backup-disabled cases
