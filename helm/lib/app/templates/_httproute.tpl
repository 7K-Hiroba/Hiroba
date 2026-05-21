{{/*
hiroba-app.httproute — Gateway API HTTPRoute. Pin sectionName to your TLS
listener on the parent Gateway to avoid silently serving plaintext.
*/}}
{{- define "hiroba-app.httproute" -}}
{{- if .Values.gateway.enabled -}}
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: {{ include "hiroba-app.fullname" . }}
  labels:
    {{- include "hiroba-app.labels" . | nindent 4 }}
  {{- with .Values.gateway.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  parentRefs:
    {{- range .Values.gateway.parentRefs }}
    - name: {{ .name }}
      {{- if .namespace }}
      namespace: {{ .namespace }}
      {{- end }}
      {{- if .sectionName }}
      sectionName: {{ .sectionName }}
      {{- end }}
    {{- end }}
  {{- if .Values.gateway.hostnames }}
  hostnames:
    {{- range .Values.gateway.hostnames }}
    - {{ . | quote }}
    {{- end }}
  {{- end }}
  rules:
    {{- if .Values.gateway.rules }}
    {{- range .Values.gateway.rules }}
    - matches:
        {{- range .matches }}
        - path:
            type: {{ .path.type | default "PathPrefix" }}
            value: {{ .path.value | default "/" }}
          {{- if .method }}
          method: {{ .method }}
          {{- end }}
          {{- if .headers }}
          headers:
            {{- toYaml .headers | nindent 12 }}
          {{- end }}
        {{- end }}
      backendRefs:
        - name: {{ include "hiroba-app.fullname" $ }}
          port: {{ $.Values.service.port }}
      {{- if .filters }}
      filters:
        {{- toYaml .filters | nindent 8 }}
      {{- end }}
    {{- end }}
    {{- else }}
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: {{ include "hiroba-app.fullname" . }}
          port: {{ .Values.service.port }}
    {{- end }}
{{- end }}
{{- end }}
