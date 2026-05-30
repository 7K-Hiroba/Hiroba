{{/*
hiroba-platform.s3-garage — Garage operator bucket + key collection.
Iterates over s3.buckets and renders a GarageBucket + GarageKey for every
entry with provider == "garage". Gated on s3.enabled.
*/}}
{{- define "hiroba-platform.s3-garage" -}}
{{- if .Values.s3.enabled }}
{{- range .Values.s3.buckets }}
{{- if eq .provider "garage" }}
---
apiVersion: garage.rajsingh.info/v1beta1
kind: GarageBucket
metadata:
  name: {{ include "hiroba-platform.name" $ }}-{{ .name }}
  labels:
    {{- include "hiroba-platform.labels" $ | nindent 4 }}
spec:
  clusterRef:
    name: {{ .garage.clusterRef }}
    {{- with .garage.clusterRefNamespace }}
    namespace: {{ . }}
    {{- end }}
  {{- with .garage.quotas }}
  quotas:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .garage.website }}
  website:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .garage.lifecycle }}
  lifecycle:
    {{- toYaml . | nindent 4 }}
  {{- end }}
---
apiVersion: garage.rajsingh.info/v1beta1
kind: GarageKey
metadata:
  name: {{ include "hiroba-platform.name" $ }}-{{ .name }}-s3-key
  labels:
    {{- include "hiroba-platform.labels" $ | nindent 4 }}
spec:
  clusterRef:
    name: {{ .garage.clusterRef }}
    {{- with .garage.clusterRefNamespace }}
    namespace: {{ . }}
    {{- end }}
  name: "{{ include "hiroba-platform.name" $ }} {{ .name | title }} S3 Key"
  secretTemplate:
    name: {{ include "hiroba-platform.name" $ }}-{{ .name }}-s3-key
    additionalData:
      S3_BUCKET: "{{ include "hiroba-platform.name" $ }}-{{ .name }}"
  bucketPermissions:
    - bucketRef:
        name: {{ include "hiroba-platform.name" $ }}-{{ .name }}
      read: true
      write: true
{{- end }}
{{- end }}
{{- end }}
{{- end }}
