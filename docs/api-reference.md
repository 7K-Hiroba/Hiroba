# API Reference

## Composite Resources

### GrafanaInstance

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

### LokiInstance

```yaml
apiVersion: platform.yourcompany.io/v1
kind: LokiInstanceClaim
metadata:
  name: my-loki
  namespace: team-api
spec:
  profile: production
  storage: s3
  retentionDays: 90
  replication: 3
```

### PrometheusInstance

```yaml
apiVersion: platform.yourcompany.io/v1
kind: PrometheusInstanceClaim
metadata:
  name: my-prometheus
  namespace: team-api
spec:
  profile: production
  retentionDays: 90
  alerting:
    enabled: true
  federation:
    enabled: true
```

### ObservabilityStack

```yaml
apiVersion: platform.yourcompany.io/v1
kind: ObservabilityStackClaim
metadata:
  name: team-api-observability
  namespace: team-api
spec:
  profile: production
  domain: obs.team-api.yourcompany.com
  team: team-api
  costCenter: cc-12345
  modules:
    grafana: { enabled: true }
    loki: { enabled: true, storage: s3, retentionDays: 90 }
    prometheus: { enabled: true, retentionDays: 90 }
```
