# Grafana Platform Product

Self-service Grafana instances with profile-driven defaults, SSO integration, and automated TLS.

## Usage

```yaml
apiVersion: platform.yourcompany.io/v1
kind: GrafanaInstanceClaim
metadata:
  name: my-grafana
  namespace: team-api
spec:
  profile: production
  domain: grafana.team-api.yourcompany.com
  features:
    sso:
      enabled: true
      secretRef:
        source: external-secrets
        store: platform-vault
        path: platform/sso/grafana
    alerting:
      enabled: true
    ingress:
      enabled: true
```
