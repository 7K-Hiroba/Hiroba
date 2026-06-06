{{/*
hiroba-platform.s3-garage — Garage operator bucket + key collection.
Renders a GarageBucket + GarageKey for each s3.buckets entry.
Gated on s3.enabled AND s3.provider == "garage".
Bucket-level settings override top-level s3.garage defaults.
*/}}
{{- define "hiroba-platform.s3-garage" -}}
{{- if and (get (get .Values "s3" | default dict) "enabled" | default false) (eq .Values.s3.provider "garage") }}
{{- range .Values.s3.buckets }}
{{- $clusterRef := .clusterRef | default $.Values.s3.garage.clusterRef }}
{{- $clusterRefNamespace := .clusterRefNamespace | default $.Values.s3.garage.clusterRefNamespace }}
{{- $quotas := .quotas | default $.Values.s3.garage.quotas }}
{{- $website := .website | default $.Values.s3.garage.website }}
{{- $lifecycle := .lifecycle | default $.Values.s3.garage.lifecycle }}
---
apiVersion: garage.rajsingh.info/v1beta1
kind: GarageBucket
metadata:
  name: {{ include "hiroba-platform.name" $ }}-{{ .name }}
  labels:
    {{- include "hiroba-platform.labels" $ | nindent 4 }}
spec:
  clusterRef:
    name: {{ $clusterRef }}
    {{- with $clusterRefNamespace }}
    namespace: {{ . }}
    {{- end }}
  {{- with $quotas }}
  quotas:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with $website }}
  website:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with $lifecycle }}
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
    name: {{ $clusterRef }}
    {{- with $clusterRefNamespace }}
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