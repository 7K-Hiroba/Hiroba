{{/*
hiroba-app.configmap — ConfigMap resources.

Renders one ConfigMap per entry in `.Values.config.configs` that contains
`data`, `tplData`, or `binaryData`.  The ConfigMap is automatically mounted
into the workload by the `hiroba-app.deployment` template.

Example values:

  config:
    enabled: true
    configs:
      - configMapName: app-config
        mountPath: /app/config.yaml
        subPath: config.yaml
        readOnly: true
        data:
          config.yaml: |
            server:
              port: 8080
      - configMapName: ""
        mountPath: /app/settings.php
        subPath: settings.php
        readOnly: true
        tplData:
          settings.php: |
            <?php
            $host = '{{ include "hiroba-app.name" . }}';
*/}}
{{- define "hiroba-app.configmap" -}}
{{- if .Values.config.enabled }}
{{- range $i, $cfg := .Values.config.configs }}
{{- if and (not $cfg.configMapName) (or $cfg.data $cfg.tplData $cfg.binaryData) }}
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ printf "%s-app-config" (include "hiroba-app.fullname" $) }}
  labels:
    {{- include "hiroba-app.labels" $ | nindent 4 }}
data:
{{- range $k, $v := $cfg.data }}
  {{ $k }}: |
{{ $v | indent 4 }}
{{- end }}
{{- range $k, $v := $cfg.tplData }}
  {{ $k }}: |
{{ tpl $v $ | indent 4 }}
{{- end }}
{{- with $cfg.binaryData }}
binaryData:
{{- toYaml . | nindent 2 }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
{{- end }}
