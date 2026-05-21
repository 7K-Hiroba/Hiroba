{{/*
hiroba-platform.cnpg-scheduled-backup — CNPG ScheduledBackup, gated on
postgres.enabled AND postgres.backup.enabled.
*/}}
{{- define "hiroba-platform.cnpg-scheduled-backup" -}}
{{- if and .Values.postgres.enabled .Values.postgres.backup.enabled -}}
apiVersion: postgresql.cnpg.io/v1
kind: ScheduledBackup
metadata:
  name: {{ include "hiroba-platform.name" . }}-pg-backup
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
spec:
  schedule: {{ .Values.postgres.backup.schedule | quote }}
  backupOwnerReference: self
  cluster:
    name: {{ include "hiroba-platform.name" . }}-pg
  pluginConfiguration:
    name: barman-cloud.cloudnative-pg.io
    parameters:
      barmanObjectName: {{ include "hiroba-platform.name" . }}-pg-barman
{{- end }}
{{- end }}
