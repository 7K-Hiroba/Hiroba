---
name: observability
description: Standards for ServiceMonitor, PrometheusRules, and Grafana dashboard resources in the platform chart
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: helm-platform
---

## What I cover

Standards for every resource under `helm/platform/templates/observability/`.

## Resources and their gates

| Resource | Gate | CRD guard in checks.yaml |
| --- | --- | --- |
| ServiceMonitor | `observability.serviceMonitor.enabled` | `monitoring.coreos.com/v1` |
| PrometheusRule | `observability.prometheusRules.enabled` | `monitoring.coreos.com/v1` |
| Grafana dashboard ConfigMap | `observability.grafanaDashboard.enabled` | none (plain ConfigMap) |

All three default to `false`.

## ServiceMonitor

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ include "platform.name" . }}
  labels:
    {{- include "platform.labels" . | nindent 4 }}
    {{- with .Values.observability.serviceMonitor.additionalLabels }}
    {{- toYaml . | nindent 4 }}
    {{- end }}
spec:
  selector:
    matchLabels:
      {{- if .Values.global.baseInstance }}
      app.kubernetes.io/instance: {{ .Values.global.baseInstance }}
      {{- else }}
      app.kubernetes.io/name: {{ include "platform.name" . }}
      {{- end }}
  endpoints:
    - port: {{ .Values.observability.serviceMonitor.port }}
      path: {{ .Values.observability.serviceMonitor.path }}
      interval: {{ .Values.observability.serviceMonitor.interval }}
      scrapeTimeout: {{ .Values.observability.serviceMonitor.scrapeTimeout }}
```

### Selector and `global.baseInstance`

The selector must match the Service created by the base chart. When `global.baseInstance` is set, match by `app.kubernetes.io/instance` to support multiple releases of the same app in the same namespace. When empty, fall back to `app.kubernetes.io/name`.

### `additionalLabels`

The kube-prometheus-stack Helm release typically uses a label selector to discover ServiceMonitors. Add the required label via `additionalLabels` in values (e.g., `release: kube-prometheus-stack`). Never hardcode this label in the template.

### Scrape interval and timeout

- `interval` default: `30s`. Reduce to `15s` for high-cardinality dashboards only.
- `scrapeTimeout` must be strictly less than `interval`. Default `10s` with `30s` interval is safe.

## PrometheusRule

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: {{ include "platform.name" . }}
  labels:
    {{- include "platform.labels" . | nindent 4 }}
spec:
  groups:
    {{- tpl (toYaml .Values.observability.prometheusRules.groups) . | nindent 4 }}
```

### `tpl` rendering

The `groups` value is passed through `tpl` so rule expressions can reference Helm values like `{{ .Release.Namespace }}` and `{{ include "platform.name" . }}`. This is intentional — do not remove the `tpl` call.

### Default rules

The skeleton ships two default alerts:

- `HighErrorRate` — HTTP 5xx rate > 5% over 5 minutes (warning)
- `HighLatency` — p99 latency > 1 second over 5 minutes (warning)

Keep these as the baseline. Add app-specific alerts by appending to `groups[].rules` in the app's `values-platform.yaml` override, not by modifying the skeleton defaults.

### Alert label conventions

```yaml
labels:
  severity: warning   # warning | critical
```

Use `warning` for degraded performance, `critical` for complete unavailability or data loss risk.

## Grafana Dashboard ConfigMap

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "platform.name" . }}-dashboard
  labels:
    {{- include "platform.labels" . | nindent 4 }}
    grafana_dashboard: "1"
    {{- with .Values.observability.grafanaDashboard.folderLabel }}
    grafana_folder: {{ . | quote }}
    {{- end }}
data:
  {{ include "platform.name" . }}.json: |
    {{- .Files.Get (printf "dashboards/%s.json" (include "platform.name" .)) | nindent 4 }}
```

### Discovery label

The label `grafana_dashboard: "1"` is required for Grafana's sidecar to pick up the ConfigMap. Do not change this key or value.

### Dashboard JSON

The dashboard JSON lives at `dashboards/<app-name>.json` in the chart directory. The skeleton provides a placeholder. Replace it with a real dashboard exported from Grafana. Never inline the JSON directly in the template — use `.Files.Get`.

## Checklist before committing

- [ ] ServiceMonitor selector accounts for `global.baseInstance`
- [ ] `additionalLabels` used for Prometheus discovery, not hardcoded
- [ ] `scrapeTimeout` is less than `interval`
- [ ] PrometheusRule groups rendered via `tpl`
- [ ] Alert severities use `warning` or `critical` only
- [ ] Grafana ConfigMap has `grafana_dashboard: "1"` label
- [ ] Dashboard JSON sourced via `.Files.Get`, not inlined
- [ ] All three resources default to `enabled: false`
- [ ] CRD guards present in `checks.yaml` for ServiceMonitor and PrometheusRule
- [ ] Unit tests cover enabled/disabled states and `baseInstance` selector logic
