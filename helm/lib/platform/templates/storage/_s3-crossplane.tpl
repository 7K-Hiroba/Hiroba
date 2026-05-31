{{/*
hiroba-platform.s3-crossplane — Crossplane S3 Bucket collection.
Renders a Crossplane Bucket for each s3.buckets entry.
Gated on s3.enabled AND s3.provider == "crossplane".
Bucket-level settings override top-level s3.crossplane defaults.
*/}}
{{- define "hiroba-platform.s3-crossplane" -}}
{{- if and .Values.s3.enabled (eq .Values.s3.provider "crossplane") }}
{{- range .Values.s3.buckets }}
{{- $region := .region | default $.Values.s3.crossplane.region }}
{{- $providerConfigRef := .providerConfigRef | default $.Values.s3.crossplane.providerConfigRef }}
{{- $lifecycle := .lifecycle | default $.Values.s3.crossplane.lifecycle }}
---
apiVersion: s3.aws.crossplane.io/v1beta1
kind: Bucket
metadata:
  name: {{ include "hiroba-platform.name" $ }}-{{ .name }}
  labels:
    {{- include "hiroba-platform.labels" $ | nindent 4 }}
spec:
  forProvider:
    region: {{ $region }}
    acl: {{ .acl | default "private" }}
    {{- with $lifecycle }}
    {{- if .enabled }}
    lifecycleConfiguration:
      rules:
        - status: Enabled
          filter:
            prefix: ""
          expiration:
            days: {{ .expirationDays }}
    {{- end }}
    {{- end }}
  providerConfigRef:
    name: {{ $providerConfigRef }}
{{- end }}
{{- end }}
{{- end }}