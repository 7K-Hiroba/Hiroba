{{/*
hiroba-app library — naming and label helpers.

These helpers compute resource names and labels from the **consumer** chart's
context (`.Chart.Name`, `.Release.Name`, `.Values`). When the library is
included from a consumer chart, `$` and `.` resolve to that consumer's scope,
so labels carry the consumer chart's name/version.
*/}}

{{/*
Chart name, optionally overridden via .Values.nameOverride.
*/}}
{{- define "hiroba-app.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Fully qualified resource name. Defaults to `<release>-<chart>` truncated to
63 characters. If the release name already contains the chart name, only the
release name is used to avoid duplication (e.g. release `myapp` + chart
`myapp` → `myapp`, not `myapp-myapp`).
*/}}
{{- define "hiroba-app.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart label: `<chart>-<version>` with `+` replaced for label-validity.
*/}}
{{- define "hiroba-app.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Standard recommended labels (https://kubernetes.io/docs/concepts/overview/working-with-objects/common-labels/).
*/}}
{{- define "hiroba-app.labels" -}}
helm.sh/chart: {{ include "hiroba-app.chart" . }}
{{ include "hiroba-app.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: hiroba
{{- end }}

{{/*
Selector labels — the stable subset that must NOT change across upgrades.
*/}}
{{- define "hiroba-app.selectorLabels" -}}
app.kubernetes.io/name: {{ include "hiroba-app.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
ServiceAccount name to use. Falls back to `<release>-<chart>` when
`serviceAccount.create` is true and no explicit name is set.
*/}}
{{- define "hiroba-app.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "hiroba-app.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}
