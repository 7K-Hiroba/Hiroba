{{/*
hiroba-platform.cnpg-cluster — CloudNativePG Cluster resource.
Backup configuration (plugins / retentionPolicy) is rendered when
postgres.backup.enabled is true; the actual backup storage resource
(ObjectStore) lives in the cnpg-backup template.
*/}}
{{- define "hiroba-platform.cnpg-cluster" -}}
{{- if .Values.postgres.enabled }}
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: {{ include "hiroba-platform.name" . }}-pg
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
spec:
  instances: {{ .Values.postgres.instances }}
  imageName: {{ .Values.postgres.imageName }}

  bootstrap:
    initdb:
      database: {{ .Values.postgres.database }}
      owner: {{ .Values.postgres.owner }}

  storage:
    size: {{ .Values.postgres.storage.size }}
    {{- if .Values.postgres.storage.storageClass }}
    storageClass: {{ .Values.postgres.storage.storageClass }}
    {{- end }}

  resources:
    {{- toYaml .Values.postgres.resources | nindent 4 }}

  {{- if .Values.postgres.backup.enabled }}
  plugins:
    - name: barman-cloud.cloudnative-pg.io
      parameters:
        barmanObjectName: {{ include "hiroba-platform.name" . }}-pg-barman

  backup:
    retentionPolicy: {{ .Values.postgres.backup.retentionPolicy }}
  {{- end }}
{{- end }}
{{- end }}