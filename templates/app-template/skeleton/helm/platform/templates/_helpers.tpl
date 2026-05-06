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

{{/*
Selector labels for matching base chart workload pods.

Targets resources created by the base chart Helm release. Set
`global.baseInstance` to the base chart's release name so selectors also
match `app.kubernetes.io/instance` — required when multiple releases of
the same app coexist in one cluster.
*/}}
{{- define "platform.baseSelectorLabels" -}}
app.kubernetes.io/name: {{ include "platform.name" . }}
{{- with .Values.global.baseInstance }}
app.kubernetes.io/instance: {{ . }}
{{- end }}
{{- end }}
