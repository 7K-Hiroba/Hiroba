{{/*
hiroba-platform.s3-garage — Garage operator bucket + key (operator generates
the credentials Secret directly, no init Job needed). Gated on s3.enabled
AND s3.provider == "garage".
*/}}
{{- define "hiroba-platform.s3-garage" -}}
{{- if and .Values.s3.enabled (eq .Values.s3.provider "garage") -}}
apiVersion: garage.rajsingh.info/v1beta1
kind: GarageBucket
metadata:
  name: {{ include "hiroba-platform.name" . }}-{{ .Values.s3.bucketName }}
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
spec:
  clusterRef:
    name: {{ .Values.s3.garage.clusterRef }}
    {{- with .Values.s3.garage.clusterRefNamespace }}
    namespace: {{ . }}
    {{- end }}
  {{- with .Values.s3.garage.quotas }}
  quotas:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.s3.garage.website }}
  website:
    {{- toYaml . | nindent 4 }}
  {{- end }}
  {{- with .Values.s3.garage.lifecycle }}
  lifecycle:
    {{- toYaml . | nindent 4 }}
  {{- end }}
---
apiVersion: garage.rajsingh.info/v1beta1
kind: GarageKey
metadata:
  name: {{ include "hiroba-platform.name" . }}-s3-key
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
spec:
  clusterRef:
    name: {{ .Values.s3.garage.clusterRef }}
    {{- with .Values.s3.garage.clusterRefNamespace }}
    namespace: {{ . }}
    {{- end }}
  name: "{{ include "hiroba-platform.name" . }} S3 Key"
  secretTemplate:
    name: {{ include "hiroba-platform.name" . }}-s3-key
    additionalData:
      S3_BUCKET: "{{ include "hiroba-platform.name" . }}-{{ .Values.s3.bucketName }}"
  bucketPermissions:
    - bucketRef:
        name: {{ include "hiroba-platform.name" . }}-{{ .Values.s3.bucketName }}
      read: true
      write: true
{{- end }}
{{- end }}
