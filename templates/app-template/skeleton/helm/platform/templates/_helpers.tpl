{{/*
Platform resource name prefix
*/}}
{{- define "platform.name" -}}
{{- .Values.global.appName | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels for platform resources
*/}}
{{- define "platform.labels" -}}
app.kubernetes.io/name: {{ include "platform.name" . }}
app.kubernetes.io/component: platform
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: hiroba
{{- end }}
