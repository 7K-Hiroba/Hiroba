{{/*
hiroba-platform.cnpg-backup — Backup storage resources for CloudNativePG.
Renders the barman ObjectStore when postgres.enabled AND postgres.backup.enabled
are true.

Requires a pre-existing secret containing S3 credentials. Set
postgres.backup.credentialsSecret.name to reference it.
*/}}
{{- define "hiroba-platform.cnpg-backup" -}}
{{- if and .Values.postgres.enabled .Values.postgres.backup.enabled -}}
{{- $bucketName := default (printf "%s-pg-backups" (include "hiroba-platform.name" .)) .Values.postgres.backup.bucketName -}}
---
apiVersion: barmancloud.cnpg.io/v1
kind: ObjectStore
metadata:
  name: {{ include "hiroba-platform.name" . }}-pg-barman
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
spec:
  configuration:
    destinationPath: "s3://{{ $bucketName }}/"
    endpointURL: {{ .Values.postgres.backup.endpoint | quote }}
    s3Credentials:
      accessKeyId:
        name: {{ .Values.postgres.backup.credentialsSecret.name }}
        key: {{ .Values.postgres.backup.credentialsSecret.accessKeyKey | default "accessKeyId" }}
      secretAccessKey:
        name: {{ .Values.postgres.backup.credentialsSecret.name }}
        key: {{ .Values.postgres.backup.credentialsSecret.secretKeyKey | default "secretAccessKey" }}
      region:
        name: {{ .Values.postgres.backup.credentialsSecret.name }}
        key: {{ .Values.postgres.backup.credentialsSecret.regionKey | default "region" }}
    wal:
      compression: gzip
    data:
      compression: gzip
{{- end }}
{{- end }}
