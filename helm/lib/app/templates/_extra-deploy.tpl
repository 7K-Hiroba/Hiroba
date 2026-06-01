{{/*
hiroba-app.extra-deploy — Render arbitrary extra Kubernetes resources.
Each entry in .Values.extraDeploy is passed through `tpl` so consumers can
reference helper templates, `.Release`, `.Values`, etc.
*/}}
{{- define "hiroba-app.extra-deploy" -}}
{{- range .Values.extraDeploy }}
---
{{ tpl . $ }}
{{- end }}
{{- end }}
