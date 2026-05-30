{{/*
hiroba-platform.s3-crossplane — Crossplane S3 Bucket collection.
Iterates over s3.buckets and renders a Crossplane Bucket for every
entry with provider == "crossplane". Gated on s3.enabled.
*/}}
{{- define "hiroba-platform.s3-crossplane" -}}
{{- if .Values.s3.enabled }}
{{- range .Values.s3.buckets }}
{{- if eq .provider "crossplane" }}
---
apiVersion: s3.aws.crossplane.io/v1beta1
kind: Bucket
metadata:
  name: {{ include "hiroba-platform.name" $ }}-{{ .name }}
  labels:
    {{- include "hiroba-platform.labels" $ | nindent 4 }}
spec:
  forProvider:
    region: {{ .crossplane.region }}
    acl: {{ .acl }}
    {{- with .crossplane.lifecycle }}
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
    name: {{ .crossplane.providerConfigRef }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
