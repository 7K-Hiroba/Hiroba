{{/*
hiroba-platform.cnpg-cluster — CloudNativePG Cluster (+ companion Garage
bucket / key / barman ObjectStore when backups are enabled).
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
{{- if .Values.postgres.backup.enabled }}
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
