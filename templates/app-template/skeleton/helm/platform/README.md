# ${{ values.name }}-platform

Platform dependencies for ${{ values.name }} — provisions databases, storage, and identity resources

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square)  ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square)  ![AppVersion: 0.1.0](https://img.shields.io/badge/AppVersion-0.1.0-informational?style=flat-square)

Install this **alongside** the base chart, typically in the same namespace.**Documentation:** <https://hiroba.7kgroup.org/docs/apps/${{ values.name }}/helm-platform>

## TL;DR

```bash
helm install ${{ values.name }}-platform \
  oci://harbor.7kgroup.org/7khiroba/charts/${{ values.name }}-platform \
  --version 0.1.0
```

## Verify the chart signature

Every release is signed keylessly with [cosign](https://docs.sigstore.dev/) via the Sigstore public-good Fulcio CA. To verify before installing:

```bash
cosign verify \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp 'github.com/7K-Hiroba/' \
  harbor.7kgroup.org/7khiroba/charts/${{ values.name }}-platform:0.1.0
```

## Configuration examples

**Bare ServiceMonitor only**:

```yaml
observability:
  serviceMonitor:
    enabled: true
    additionalLabels:
      release: kube-prometheus-stack
```

**PostgreSQL with daily Garage-backed backups**:

```yaml
postgres:
  enabled: true
  instances: 2
  storage:
    size: 20Gi
  backup:
    enabled: true
    schedule: "0 2 * * *"
    retentionPolicy: "14d"
```

**App secrets sourced from an external store**:

```yaml
externalSecrets:
  enabled: true
  storeRef:
    name: vault-backend
    kind: ClusterSecretStore
  data:
    - secretKey: DATABASE_URL
      remoteKey: ${{ values.name }}/db
      property: url
    - secretKey: API_KEY
      remoteKey: ${{ values.name }}/api
      property: key
```

## Prerequisites

- Kubernetes 1.24+
- [External Secrets Operator](https://external-secrets.io/) — for the `ExternalSecret` resource
- [Prometheus Operator](https://prometheus-operator.dev/) — for the `ServiceMonitor` resource
- Grafana with dashboard sidecar enabled (optional, for shipped dashboards)
- [CloudNativePG](https://cloudnative-pg.io/) — if enabling the PostgreSQL example
- [Crossplane](https://www.crossplane.io/) — if enabling the S3 example

## What gets installed

| Resource | Purpose |
|---|---|
| `ExternalSecret` | Sources app secrets from your secret backend |
| `ServiceMonitor` | Scrape config for the workload's metrics endpoint |
| Grafana dashboards | Shipped as `ConfigMap`s in `dashboards/`, picked up by the Grafana sidecar |
| `Cluster` (CNPG) | Optional — PostgreSQL database, enabled via values |
| Crossplane `Bucket` | Optional — S3-compatible object storage, enabled via values |

The chart is split so that **workload-lifecycle** resources (Deployment, HPA, PDB, HTTPRoute) live in the [base chart](../base/README.md), while **cross-cutting dependencies** (ESO, ServiceMonitor, dashboards, DB, storage) live here. This keeps each chart focused and lets operators opt out of platform wiring without losing the app.

## Requirements

Kubernetes: `>=1.24.0-0`

| Repository | Name | Version |
|------------|------|---------|
| oci://harbor.7kgroup.org/7khiroba/charts | hiroba-platform-lib | ^0.1.0 |

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| externalSecrets | object | `{"data":[],"dataFrom":[],"enabled":false,"refreshInterval":"1h","storeRef":{"kind":"ClusterSecretStore","name":"cluster-secret-store"},"target":{"template":{}}}` | External Secrets (external-secrets.io) |
| externalSecrets.data | list | `[]` | Individual secret mappings |
| externalSecrets.dataFrom | list | `[]` | Pull all keys from a remote path |
| externalSecrets.refreshInterval | string | `"1h"` | How often to sync secrets |
| externalSecrets.storeRef | object | `{"kind":"ClusterSecretStore","name":"cluster-secret-store"}` | SecretStore or ClusterSecretStore reference |
| externalSecrets.target | object | `{"template":{}}` | Optional target Secret template for value transformation. See https://external-secrets.io/latest/guides/templating/ |
| global.appName | string | `"${{ values.name }}"` | Application name, used as prefix for all platform resources |
| global.baseInstance | string | `""` | Release name of the base chart deployment. When set, the ServiceMonitor selector matches `app.kubernetes.io/instance: <baseInstance>` so multiple releases of the same app coexist safely. Leave empty to match by name only. |
| observability | object | `{"grafanaDashboard":{"enabled":false,"folderLabel":""},"prometheusRules":{"enabled":false,"groups":[{"name":"{{ include \"hiroba-platform.name\" . }}.rules","rules":[{"alert":"HighErrorRate","annotations":{"description":"Error rate is above 5% for the last 5 minutes.","summary":"High error rate for {{ include \"hiroba-platform.name\" . }}"},"expr":"sum(rate(http_requests_total{namespace=\"{{ .Release.Namespace }}\", service=\"{{ include \"hiroba-platform.name\" . }}\", status=~\"5..\"}[5m]))\n/\nsum(rate(http_requests_total{namespace=\"{{ .Release.Namespace }}\", service=\"{{ include \"hiroba-platform.name\" . }}\"}[5m]))\n> 0.05\n","for":"5m","labels":{"severity":"warning"}},{"alert":"HighLatency","annotations":{"description":"p99 latency is above 1 second for the last 5 minutes.","summary":"High p99 latency for {{ include \"hiroba-platform.name\" . }}"},"expr":"histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{namespace=\"{{ .Release.Namespace }}\", service=\"{{ include \"hiroba-platform.name\" . }}\"}[5m]))\n> 1\n","for":"5m","labels":{"severity":"warning"}}]}]},"serviceMonitor":{"additionalLabels":{},"enabled":false,"interval":"30s","path":"/metrics","port":"http","scrapeTimeout":"10s"}}` | Observability resources |
| observability.grafanaDashboard | object | `{"enabled":false,"folderLabel":""}` | Grafana dashboard (deployed as ConfigMap with sidecar label) |
| observability.grafanaDashboard.folderLabel | string | `""` | Grafana folder label |
| observability.prometheusRules | object | `{"enabled":false,"groups":[{"name":"{{ include \"hiroba-platform.name\" . }}.rules","rules":[{"alert":"HighErrorRate","annotations":{"description":"Error rate is above 5% for the last 5 minutes.","summary":"High error rate for {{ include \"hiroba-platform.name\" . }}"},"expr":"sum(rate(http_requests_total{namespace=\"{{ .Release.Namespace }}\", service=\"{{ include \"hiroba-platform.name\" . }}\", status=~\"5..\"}[5m]))\n/\nsum(rate(http_requests_total{namespace=\"{{ .Release.Namespace }}\", service=\"{{ include \"hiroba-platform.name\" . }}\"}[5m]))\n> 0.05\n","for":"5m","labels":{"severity":"warning"}},{"alert":"HighLatency","annotations":{"description":"p99 latency is above 1 second for the last 5 minutes.","summary":"High p99 latency for {{ include \"hiroba-platform.name\" . }}"},"expr":"histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{namespace=\"{{ .Release.Namespace }}\", service=\"{{ include \"hiroba-platform.name\" . }}\"}[5m]))\n> 1\n","for":"5m","labels":{"severity":"warning"}}]}]}` | PrometheusRule alerts. `groups` is passed through `tpl` so values can reference `.Release.Namespace`, `include "hiroba-platform.name" .`, etc. Override entirely to replace the defaults, or append to extend them. |
| observability.serviceMonitor | object | `{"additionalLabels":{},"enabled":false,"interval":"30s","path":"/metrics","port":"http","scrapeTimeout":"10s"}` | Prometheus ServiceMonitor |
| observability.serviceMonitor.additionalLabels | object | `{}` | Additional labels for ServiceMonitor discovery (e.g., release: kube-prometheus-stack) |
| observability.serviceMonitor.interval | string | `"30s"` | Scrape interval |
| observability.serviceMonitor.path | string | `"/metrics"` | Metrics endpoint path |
| observability.serviceMonitor.port | string | `"http"` | Service port name to scrape |
| observability.serviceMonitor.scrapeTimeout | string | `"10s"` | Scrape timeout |
| postgres | object | `{"backup":{"enabled":false,"garage":{"clusterRef":"garage","endpoint":"http://garage.garage.svc.cluster.local:3900","region":"garage"},"retentionPolicy":"7d","schedule":"0 2 * * *"},"database":"app","enabled":"${{ values.enablePostgres }}","imageName":"ghcr.io/cloudnative-pg/postgresql:16.2","instances":1,"owner":"app","provider":"cnpg","resources":{"limits":{"cpu":"1","memory":"1Gi"},"requests":{"cpu":"250m","memory":"256Mi"}},"storage":{"size":"10Gi","storageClass":""}}` | PostgreSQL database |
| postgres.backup | object | `{"enabled":false,"garage":{"clusterRef":"garage","endpoint":"http://garage.garage.svc.cluster.local:3900","region":"garage"},"retentionPolicy":"7d","schedule":"0 2 * * *"}` | Backup configuration (optional) |
| postgres.backup.garage | object | `{"clusterRef":"garage","endpoint":"http://garage.garage.svc.cluster.local:3900","region":"garage"}` | Garage S3 settings for WAL archiving and base backups (barman-cloud plugin) |
| postgres.backup.garage.clusterRef | string | `"garage"` | GarageCluster resource name to reference |
| postgres.backup.garage.endpoint | string | `"http://garage.garage.svc.cluster.local:3900"` | Garage S3 API endpoint (must match the GarageCluster's service) |
| postgres.backup.garage.region | string | `"garage"` | S3 region (must match the GarageCluster's configured region) |
| postgres.database | string | `"app"` | Database name to create |
| postgres.imageName | string | `"ghcr.io/cloudnative-pg/postgresql:16.2"` | PostgreSQL version |
| postgres.owner | string | `"app"` | Database owner |
| postgres.provider | string | `"cnpg"` | Provider: "cnpg" (CloudNativePG operator) |
| s3 | object | `{"acl":"private","bucketName":"assets","crossplane":{"lifecycle":{"enabled":false,"expirationDays":90},"providerConfigRef":"aws-provider","region":"us-east-1"},"enabled":"${{ values.enableS3 }}","garage":{"clusterRef":"garage","lifecycle":{},"quotas":{},"website":{}},"provider":"crossplane"}` | S3-compatible object storage |
| s3.acl | string | `"private"` | Access control |
| s3.bucketName | string | `"assets"` | Bucket name (will be prefixed with app name) |
| s3.crossplane | object | `{"lifecycle":{"enabled":false,"expirationDays":90},"providerConfigRef":"aws-provider","region":"us-east-1"}` | Crossplane-specific settings (provider: crossplane) |
| s3.garage | object | `{"clusterRef":"garage","lifecycle":{},"quotas":{},"website":{}}` | Garage-specific settings (provider: garage) Provisions a bucket + key via the garage-operator (https://github.com/rajsinghtech/garage-operator). The operator generates the credentials Secret directly, so no init Job is needed. |
| s3.garage.clusterRef | string | `"garage"` | GarageCluster resource name to reference |
| s3.garage.lifecycle | object | `{}` | Optional bucket lifecycle rules |
| s3.garage.quotas | object | `{}` | Optional bucket quotas |
| s3.garage.website | object | `{}` | Optional website hosting configuration |
| s3.provider | string | `"crossplane"` | Provider: "crossplane" | "garage" |

Full schema in [`values.schema.json`](values.schema.json). Artifact Hub renders the schema as an interactive form.

## Uninstall caveats

`helm uninstall` does **not** clean up everything this chart provisions. Operators intentionally keep stateful resources around so they're not wiped by accident — you must remove them by hand:

| Resource | What stays | How to remove |
|---|---|---|
| CNPG `Cluster` PVCs | PostgreSQL data volumes | `kubectl delete pvc -l cnpg.io/cluster=${{ values.name }}` |
| Garage backup bucket | WAL archives / base backups | Delete the `GarageBucket` resource, then the bucket contents |
| Crossplane `Bucket` | S3 bucket and its contents | Set `deletionPolicy: Delete` *before* uninstall, or remove the bucket manually after |
| `ExternalSecret` target | The synced `Secret` in-cluster | `kubectl delete secret <target-name>` |
| Grafana dashboard ConfigMap | The dashboard JSON (no impact, but lingers) | `kubectl delete cm -l grafana_dashboard=1 -l app.kubernetes.io/instance=<release>` |

Tip: do a dry run with `helm uninstall --dry-run` first to see what *will* be removed.

## Maintainers

| Name | Email | Url |
| ---- | ------ | --- |
| 7k-hiroba |  |  |

## Source Code

* <https://github.com/7K-Hiroba/${{ values.name }}>

## Part of the Hiroba ecosystem

Scaffolded with [Hiroba](https://github.com/7K-Hiroba/Hiroba).

----------------------------------------------
Autogenerated from chart metadata using [helm-docs v1.14.2](https://github.com/norwoodj/helm-docs/releases/v1.14.2)
