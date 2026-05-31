{{/*
hiroba-platform.cnpg-backup — Backup storage resources for CloudNativePG.
Renders the barman ObjectStore when postgres.enabled AND postgres.backup.enabled
are true. Assumes the S3 bucket and credentials secret are created externally.
*/}}
{{- define "hiroba-platform.cnpg-backup" -}}
{{- if and .Values.postgres.enabled .Values.postgres.backup.enabled -}}
---
apiVersion: barmancloud.cnpg.io/v1
kind: ObjectStore
metadata:
  name: {{ include "hiroba-platform.name" . }}-pg-barman
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
spec:
  configuration:
    destinationPath: "s3://{{ .Values.postgres.backup.bucketName | default (printf "%s-pg-backups" (include "hiroba-platform.name" .)) }}/"
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