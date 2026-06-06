{{/*
hiroba-platform.cnpg-cluster — CloudNativePG Cluster resource.
Backup configuration (plugins / retentionPolicy) is rendered when
postgres.backup.enabled is true; the actual backup storage resource
(ObjectStore) lives in the cnpg-backup template.
*/}}
{{- define "hiroba-platform.cnpg-cluster" -}}
{{- if get (get .Values "postgres" | default dict) "enabled" | default false }}
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

  {{- if get (get (get .Values "postgres" | default dict) "backup" | default dict) "enabled" | default false }}
  {{- if .Values.postgres.plugins }}
  plugins:
    {{- range .Values.postgres.plugins }}
    - name: {{ .name }}
      enabled: {{ .enabled }}
      {{- with .isWALArchiver }}
      isWALArchiver: {{ . }}
      {{- end }}
      {{- with .parameters }}
      parameters:
        {{- range $k, $v := . }}
        {{- if and (eq $k "barmanObjectName") (not $v) }}
        barmanObjectName: {{ include "hiroba-platform.name" $ }}-pg-barman
        {{- else }}
        {{ $k }}: {{ $v | quote }}
        {{- end }}
        {{- end }}
      {{- end }}
    {{- end }}
  {{- end }}
  backup:
    retentionPolicy: {{ .Values.postgres.backup.retentionPolicy }}
  {{- end }}
{{- end }}
{{- end }}