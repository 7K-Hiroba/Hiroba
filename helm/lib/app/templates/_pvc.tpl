{{/*
hiroba-app.pvc — PersistentVolumeClaim resources.
*/}}
{{- define "hiroba-app.pvc" -}}
{{- range .Values.persistence.claims }}
{{- if and .enabled (not .existingClaim) }}
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {{ include "hiroba-app.fullname" $ }}-{{ .name }}
  labels:
    {{- include "hiroba-app.labels" $ | nindent 4 }}
spec:
  accessModes:
    - {{ .accessMode }}
  resources:
    requests:
      storage: {{ .size }}
  {{- with .storageClass }}
  storageClassName: {{ . }}
  {{- end }}
{{- end }}
{{- end }}
{{- end }}
