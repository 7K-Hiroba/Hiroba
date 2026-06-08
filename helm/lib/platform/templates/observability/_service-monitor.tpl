{{/*
hiroba-platform.service-monitor — Prometheus Operator ServiceMonitor for the
workload created by the base chart. Gated on observability.serviceMonitor.enabled.
*/}}
{{- define "hiroba-platform.service-monitor" -}}
{{- if get (get (get .Values "observability" | default dict) "serviceMonitor" | default dict) "enabled" | default false -}}
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ include "hiroba-platform.name" . }}
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
    {{- with .Values.observability.serviceMonitor.additionalLabels }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
spec:
  selector:
    matchLabels:
      {{- $selector := get (get (get .Values "observability" | default dict) "serviceMonitor" | default dict) "selector" | default dict }}
      {{- with $selector.matchLabels }}
      {{- toYaml . | nindent 6 }}
      {{- else }}
      {{- include "hiroba-platform.baseSelectorLabels" . | nindent 6 }}
      {{- end }}
  namespaceSelector:
    matchNames:
      - {{ .Release.Namespace }}
  endpoints:
    - port: {{ .Values.observability.serviceMonitor.port }}
      {{- with .Values.observability.serviceMonitor.path }}
      path: {{ . }}
      {{- end }}
      interval: {{ .Values.observability.serviceMonitor.interval }}
      {{- with .Values.observability.serviceMonitor.scrapeTimeout }}
      scrapeTimeout: {{ . }}
      {{- end }}
{{- end }}
{{- end }}
