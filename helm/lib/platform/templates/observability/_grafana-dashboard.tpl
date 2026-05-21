{{/*
hiroba-platform.grafana-dashboard — ConfigMap shipping the contents of every
JSON file in the consumer chart's `dashboards/` directory, picked up by the
Grafana sidecar via the `grafana_dashboard: "1"` label.

`.Files.Glob` resolves against the CONSUMER chart's files when the named
template is included from a consumer wrapper, so the consumer ships its own
dashboards/*.json.
*/}}
{{- define "hiroba-platform.grafana-dashboard" -}}
{{- if .Values.observability.grafanaDashboard.enabled -}}
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "hiroba-platform.name" . }}-dashboard
  labels:
    {{- include "hiroba-platform.labels" . | nindent 4 }}
    grafana_dashboard: "1"
    {{- with .Values.observability.grafanaDashboard.folderLabel }}
    grafana_folder: {{ . | quote }}
    {{- end }}
  annotations:
    grafana_dashboard_uid: {{ include "hiroba-platform.name" . }}
data:
  {{- range $path, $_ := .Files.Glob "dashboards/*.json" }}
  {{ base $path }}: |-
    {{- tpl ($.Files.Get $path) $ | nindent 4 }}
  {{- end }}
{{- end }}
{{- end }}
