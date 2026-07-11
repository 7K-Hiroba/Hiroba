# API Reference

## Composite Resources

### GrafanaInstance

```yaml
apiVersion: platform.7kgroup.org/v1
kind: GrafanaInstanceClaim
metadata:
  name: my-grafana
  namespace: team-api
spec:
  profile: production
  provider: aws
  providerConfigRef:
    name: aws-provider
  region: us-east-1
  domain: grafana.team-api.example.com
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
apiVersion: platform.7kgroup.org/v1
kind: LokiInstanceClaim
metadata:
  name: my-loki
  namespace: team-api
spec:
  profile: production
  provider: aws
  providerConfigRef:
    name: aws-provider
  region: us-east-1
  retentionDays: 90
  replication: 3
```

### PrometheusInstance

```yaml
apiVersion: platform.7kgroup.org/v1
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
apiVersion: platform.7kgroup.org/v1
kind: ObservabilityStackClaim
metadata:
  name: team-api-observability
  namespace: team-api
spec:
  profile: production
  provider: aws
  providerConfigRef:
    name: aws-provider
  region: us-east-1
  domain: obs.team-api.example.com
  team: team-api
  costCenter: cc-12345
  modules:
    grafana: { enabled: true }
    loki: { enabled: true, retentionDays: 90 }
    prometheus: { enabled: true, retentionDays: 90 }
```
