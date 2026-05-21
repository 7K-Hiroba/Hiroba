{{/*
hiroba-app.serviceaccount — ServiceAccount, gated on serviceAccount.create.
*/}}
{{- define "hiroba-app.serviceaccount" -}}
{{- if .Values.serviceAccount.create -}}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "hiroba-app.serviceAccountName" . }}
  labels:
    {{- include "hiroba-app.labels" . | nindent 4 }}
  {{- with .Values.serviceAccount.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
automountServiceAccountToken: false
{{- end }}
{{- end }}
