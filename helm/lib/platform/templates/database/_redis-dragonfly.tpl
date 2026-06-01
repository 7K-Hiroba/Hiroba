{{/*
hiroba-platform.redis-dragonfly — Dragonfly (Redis-compatible) resource.
Renders a Dragonfly CR when redis.enabled AND redis.provider == "dragonfly".
*/}}
{{- define "hiroba-platform.redis-dragonfly" -}}
{{- if and .Values.redis.enabled (eq .Values.redis.provider "dragonfly") }}
apiVersion: dragonflydb.io/v1alpha1
kind: Dragonfly
metadata:
  name: {{ include "hiroba-platform.name" . }}-redis
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.redis.dragonfly.replicas }}
  image: {{ .Values.redis.dragonfly.image }}

  {{- with .Values.redis.dragonfly.labels }}
  labels:
    {{- toYaml . | nindent 4 }}
  {{- end }}

  {{- with .Values.redis.dragonfly.args }}
  args:
    {{- toYaml . | nindent 4 }}
  {{- end }}

  {{- with .Values.redis.dragonfly.env }}
  env:
    {{- toYaml . | nindent 4 }}
  {{- end }}

  {{- with .Values.redis.dragonfly.resources }}
  resources:
    {{- toYaml . | nindent 4 }}
  {{- end }}

  {{- with .Values.redis.dragonfly.snapshot }}
  snapshot:
    {{- toYaml . | nindent 4 }}
  {{- end }}

  {{- with .Values.redis.dragonfly.serviceSpec }}
  serviceSpec:
    {{- toYaml . | nindent 4 }}
  {{- end }}
{{- end }}
{{- end }}
