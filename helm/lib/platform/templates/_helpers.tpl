{{/*
hiroba-platform library — naming and label helpers.

Platform resources are named after `global.appName` (the application this
platform chart attaches to), not the chart name, so that workload and
platform releases share the same logical "app" prefix.
*/}}

{{/*
Platform resource name prefix — typically the application name.
*/}}
{{- define "hiroba-platform.name" -}}
{{- .Values.global.appName | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels applied to every platform-owned resource.
*/}}
{{- define "hiroba-platform.labels" -}}
app.kubernetes.io/name: {{ include "hiroba-platform.name" . }}
app.kubernetes.io/component: platform
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: hiroba
{{- end }}

{{/*
Selector labels for matching the base chart's workload pods.

Targets resources created by the base chart Helm release. Set
`global.baseInstance` to the base chart's release name when multiple releases
of the same application coexist in one cluster, so the selector also matches
`app.kubernetes.io/instance` — otherwise `name`-only matching is correct.
*/}}
{{- define "hiroba-platform.baseSelectorLabels" -}}
app.kubernetes.io/name: {{ include "hiroba-platform.name" . }}
{{- with .Values.global.baseInstance }}
app.kubernetes.io/instance: {{ . }}
{{- end }}
{{- end }}
