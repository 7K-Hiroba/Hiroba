{{/*
hiroba-platform.prometheus-rules — Prometheus Operator PrometheusRule.
`groups` is passed through `tpl` so values can reference `.Release.Namespace`,
`include "hiroba-platform.name" .`, etc. Override entirely to replace the
defaults, or append to extend them.
*/}}
{{- define "hiroba-platform.prometheus-rules" -}}
{{- if get (get (get .Values "observability" | default dict) "prometheusRules" | default dict) "enabled" | default false -}}
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: {{ include "hiroba-platform.name" . }}
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
spec:
  groups:
    {{- tpl (toYaml .Values.observability.prometheusRules.groups) . | nindent 4 }}
{{- end }}
{{- end }}
