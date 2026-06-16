# Grafana SSO Composition Function

Prototype Go-based Composition Function for true conditional resource creation based on the `spec.features.sso.enabled` toggle.

## Build

```bash
cd functions/grafana-sso
docker build -t ghcr.io/yourcompany/functions/grafana-sso:v1.0.0 .
```

## Usage

Reference the function image in a Composition pipeline:

```yaml
spec:
  mode: Pipeline
  pipeline:
    - step: grafana-sso
      functionRef:
        name: function-grafana-sso
```
