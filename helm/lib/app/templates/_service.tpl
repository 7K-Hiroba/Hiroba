{{/*
hiroba-app.service — ClusterIP Service fronting the workload pods.
*/}}
{{- define "hiroba-app.service" -}}
apiVersion: v1
kind: Service
metadata:
  name: {{ include "hiroba-app.fullname" . }}
  labels:
    {{- include "hiroba-app.labels" . | nindent 4 }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: http
      protocol: TCP
      name: http
  selector:
    {{- include "hiroba-app.selectorLabels" . | nindent 4 }}
{{- end }}
