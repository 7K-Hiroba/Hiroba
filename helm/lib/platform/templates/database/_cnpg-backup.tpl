{{/*
hiroba-platform.cnpg-backup — Backup storage resources for CloudNativePG.
Renders GarageBucket, GarageKey, and barman ObjectStore when
postgres.enabled AND postgres.backup.enabled are true.
*/}}
{{- define "hiroba-platform.cnpg-backup" -}}
{{- if and .Values.postgres.enabled .Values.postgres.backup.enabled -}}
---
apiVersion: garage.rajsingh.info/v1beta1
kind: GarageBucket
metadata:
  name: {{ include "hiroba-platform.name" . }}-pg-backups
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
spec:
  clusterRef:
    name: {{ .Values.postgres.backup.garage.clusterRef }}
    {{- with .Values.postgres.backup.garage.clusterRefNamespace }}
    namespace: {{ . }}
    {{- end }}
---
apiVersion: garage.rajsingh.info/v1beta1
kind: GarageKey
metadata:
  name: {{ include "hiroba-platform.name" . }}-pg-s3-key
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
spec:
  clusterRef:
    name: {{ .Values.postgres.backup.garage.clusterRef }}
    {{- with .Values.postgres.backup.garage.clusterRefNamespace }}
    namespace: {{ . }}
    {{- end }}
  name: "{{ include "hiroba-platform.name" . }} PG Backup Key"
  secretTemplate:
    name: {{ include "hiroba-platform.name" . }}-pg-s3-key
    additionalData:
      region: {{ .Values.postgres.backup.garage.region | quote }}
  bucketPermissions:
    - bucketRef:
        name: {{ include "hiroba-platform.name" . }}-pg-backups
      read: true
      write: true
---
apiVersion: barmancloud.cnpg.io/v1
kind: ObjectStore
metadata:
  name: {{ include "hiroba-platform.name" . }}-pg-barman
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
spec:
  configuration:
    destinationPath: "s3://{{ include "hiroba-platform.name" . }}-pg-backups/"
    endpointURL: {{ .Values.postgres.backup.garage.endpoint | quote }}
    s3Credentials:
      accessKeyId:
        name: {{ include "hiroba-platform.name" . }}-pg-s3-key
        key: access-key-id
      secretAccessKey:
        name: {{ include "hiroba-platform.name" . }}-pg-s3-key
        key: secret-access-key
      region:
        name: {{ include "hiroba-platform.name" . }}-pg-s3-key
        key: region
    wal:
      compression: gzip
    data:
      compression: gzip
{{- end }}
{{- end }}
