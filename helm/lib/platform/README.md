# hiroba-platform-lib

Helm library chart for Hiroba application platform (cross-cutting
dependencies) charts. Defines reusable named templates for CloudNativePG
Clusters, S3 buckets (Crossplane / Garage), ExternalSecrets, ServiceMonitor,
Grafana dashboards, PrometheusRules, and operator presence checks.

![Version: 0.2.9](https://img.shields.io/badge/Version-0.2.9-informational?style=flat-square)  ![Type: library](https://img.shields.io/badge/Type-library-informational?style=flat-square)  ![AppVersion: 0.1.0](https://img.shields.io/badge/AppVersion-0.1.0-informational?style=flat-square)

> Library charts are not installable on their own. Add this as a `dependency` from your application *platform* chart and include the resources you need.

## Quick start

`Chart.yaml`:

```yaml
apiVersion: v2
name: myapp-platform
type: application
version: 0.1.0
appVersion: "0.1.0"
dependencies:
  - name: hiroba-platform-lib
    version: ^0.2.9
    repository: oci://harbor.7kgroup.org/7khiroba/charts
```

Pull the dependency:

```bash
helm dependency update
```

Every release is signed keylessly with [cosign](https://docs.sigstore.dev/) via the Sigstore public-good Fulcio CA. To verify the dependency before pulling:

```bash
cosign verify \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp 'github.com/7K-Hiroba/' \
  harbor.7kgroup.org/7khiroba/charts/hiroba-platform-lib:0.2.9
```

Wrappers (one per resource, following the Hiroba skeleton convention):

```yaml
# templates/checks.yaml
{{- include "hiroba-platform.checks" . }}
```

```yaml
# templates/database/cnpg-cluster.yaml
{{- include "hiroba-platform.cnpg-cluster" . }}
```

…and so on. Delete or replace any wrapper whose resource you don't want.

## Named templates

| Template | Renders | Gated on |
| --- | --- | --- |
| `hiroba-platform.checks` | Render-time `fail` calls when an enabled feature's Operator CRD is missing | always (no-op if all features disabled) |
| `hiroba-platform.cnpg-cluster` | CNPG `Cluster` + optional Garage backup bucket / key / barman ObjectStore | `postgres.enabled` (+ `postgres.backup.enabled`) |
| `hiroba-platform.cnpg-scheduled-backup` | CNPG `ScheduledBackup` | `postgres.enabled` AND `postgres.backup.enabled` |
| `hiroba-platform.s3-crossplane` | Crossplane S3 `Bucket` | `s3.enabled` AND `s3.provider==crossplane` |
| `hiroba-platform.s3-garage` | Garage `GarageBucket` + `GarageKey` | `s3.enabled` AND `s3.provider==garage` |
| `hiroba-platform.external-secret` | external-secrets.io `ExternalSecret` | `externalSecrets.enabled` |
| `hiroba-platform.service-monitor` | Prometheus `ServiceMonitor` targeting the base chart's pods | `observability.serviceMonitor.enabled` |
| `hiroba-platform.grafana-dashboard` | `ConfigMap` shipping consumer's `dashboards/*.json` | `observability.grafanaDashboard.enabled` |
| `hiroba-platform.prometheus-rules` | Prometheus `PrometheusRule` (`groups` are `tpl`-rendered) | `observability.prometheusRules.enabled` |

Helper templates safe to reuse from consumer templates: `hiroba-platform.name`, `hiroba-platform.labels`, `hiroba-platform.baseSelectorLabels`.

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md). Releases are automated via [release-please](https://github.com/googleapis/release-please) from the [Hiroba](https://github.com/7K-Hiroba/Hiroba) monorepo:

- `fix(helm-platform-lib): ...` → patch
- `feat(helm-platform-lib): ...` → minor
- `feat(helm-platform-lib)!: ...` or `BREAKING CHANGE:` → major

Tagged releases publish the OCI artifact to `oci://harbor.7kgroup.org/7khiroba/charts/hiroba-platform-lib`.

## Requirements

Kubernetes: `>=1.24.0-0`

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| externalSecrets | object | `{"data":[],"dataFrom":[],"enabled":false,"refreshInterval":"1h","storeRef":{"kind":"ClusterSecretStore","name":"cluster-secret-store"},"target":{"template":{}}}` | ExternalSecret (external-secrets.io) resources |
| externalSecrets.data | list | `[]` | Individual secret mappings (`secretKey` / `remoteKey` pairs) |
| externalSecrets.dataFrom | list | `[]` | Pull all keys from a remote path |
| externalSecrets.enabled | bool | `false` | Render an ExternalSecret |
| externalSecrets.refreshInterval | string | `"1h"` | How often to sync secrets |
| externalSecrets.storeRef | object | `{"kind":"ClusterSecretStore","name":"cluster-secret-store"}` | SecretStore or ClusterSecretStore reference |
| externalSecrets.target | object | `{"template":{}}` | Optional target Secret template for value transformation |
| global.appName | string | `"example"` | Application name, used as prefix for all platform resources |
| global.baseInstance | string | `""` | Release name of the base chart deployment. When set, the ServiceMonitor selector matches `app.kubernetes.io/instance: <baseInstance>` so multiple releases of the same app coexist safely. Leave empty to match by name only. |
| observability | object | `{"grafanaDashboard":{"enabled":false,"folderLabel":""},"prometheusRules":{"enabled":false,"groups":[]},"serviceMonitor":{"additionalLabels":{},"enabled":false,"interval":"30s","path":"/metrics","port":"http","scrapeTimeout":"10s"}}` | Observability resources |
| observability.grafanaDashboard.enabled | bool | `false` | Ship `dashboards/*.json` as a ConfigMap picked up by Grafana's sidecar |
| observability.grafanaDashboard.folderLabel | string | `""` | Grafana folder label |
| observability.prometheusRules.enabled | bool | `false` | Render a PrometheusRule. `groups` is `tpl`-rendered so it can reference `.Release.Namespace`, helper templates, etc. |
| observability.prometheusRules.groups | list | `[]` | Rule groups passed straight to the PrometheusRule spec |
| observability.serviceMonitor.additionalLabels | object | `{}` | Additional labels for ServiceMonitor discovery (e.g., release: kube-prometheus-stack) |
| observability.serviceMonitor.enabled | bool | `false` | Render a Prometheus ServiceMonitor |
| observability.serviceMonitor.interval | string | `"30s"` | Scrape interval |
| observability.serviceMonitor.path | string | `"/metrics"` | Metrics endpoint path |
| observability.serviceMonitor.port | string | `"http"` | Service port name to scrape |
| observability.serviceMonitor.scrapeTimeout | string | `"10s"` | Scrape timeout |
| postgres | object | `{"backup":{"bucketName":"","credentialsSecret":{"accessKeyKey":"accessKeyId","name":"","regionKey":"region","secretKeyKey":"secretAccessKey"},"enabled":false,"endpoint":"","retentionPolicy":"7d","schedule":"0 2 * * *"},"database":"app","enabled":false,"imageName":"ghcr.io/cloudnative-pg/postgresql:16.2","instances":1,"owner":"app","plugins":[{"enabled":true,"isWALArchiver":false,"name":"barman-cloud.cloudnative-pg.io","parameters":{"barmanObjectName":""}}],"provider":"cnpg","resources":{"limits":{"cpu":"1","memory":"1Gi"},"requests":{"cpu":"250m","memory":"256Mi"}},"storage":{"size":"10Gi","storageClass":""}}` | PostgreSQL database resources |
| postgres.backup.bucketName | string | `""` | S3 bucket name for backups (defaults to <app>-pg-backups) |
| postgres.backup.credentialsSecret | object | `{"accessKeyKey":"accessKeyId","name":"","regionKey":"region","secretKeyKey":"secretAccessKey"}` | Pre-existing secret containing S3 credentials. |
| postgres.backup.credentialsSecret.accessKeyKey | string | `"accessKeyId"` | Key in the secret for the access key ID |
| postgres.backup.credentialsSecret.name | string | `""` | Name of the secret |
| postgres.backup.credentialsSecret.regionKey | string | `"region"` | Key in the secret for the S3 region |
| postgres.backup.credentialsSecret.secretKeyKey | string | `"secretAccessKey"` | Key in the secret for the secret access key |
| postgres.backup.enabled | bool | `false` | Render backup storage resources (ObjectStore) |
| postgres.backup.endpoint | string | `""` | S3 API endpoint for backups |
| postgres.backup.retentionPolicy | string | `"7d"` | Retention policy passed to barman |
| postgres.backup.schedule | string | `"0 2 * * *"` | Cron schedule for ScheduledBackup |
| postgres.database | string | `"app"` | Database name to create |
| postgres.enabled | bool | `false` | Render the database resources |
| postgres.imageName | string | `"ghcr.io/cloudnative-pg/postgresql:16.2"` | Container image (operator-compatible) used for PostgreSQL |
| postgres.instances | int | `1` | Number of PostgreSQL instances in the cluster |
| postgres.owner | string | `"app"` | Database owner role |
| postgres.plugins | list | `[{"enabled":true,"isWALArchiver":false,"name":"barman-cloud.cloudnative-pg.io","parameters":{"barmanObjectName":""}}]` | CNPG plugins applied to the cluster. The barman-cloud plugin is automatically configured when backup is enabled; add others here. |
| postgres.plugins[0].parameters.barmanObjectName | string | `""` | ObjectStore resource name. Defaults to <app>-pg-barman when empty. |
| postgres.provider | string | `"cnpg"` | Provider: "cnpg" (CloudNativePG operator) |
| postgres.resources | object | `{"limits":{"cpu":"1","memory":"1Gi"},"requests":{"cpu":"250m","memory":"256Mi"}}` | Resource requests and limits for each PostgreSQL pod |
| postgres.storage.size | string | `"10Gi"` | Persistent volume size per instance |
| postgres.storage.storageClass | string | `""` | StorageClass for the persistent volumes. Empty uses the cluster default. |
| redis | object | `{"dragonfly":{"args":[],"env":[],"image":"docker.io/dragonflydb/dragonfly:latest","labels":{},"persistentVolumeClaimSpec":{"accessModes":["ReadWriteOnce"],"resources":{"requests":{"storage":"10Gi"}},"storageClassName":""},"replicas":1,"resources":{"limits":{"cpu":"500m","memory":"1Gi"},"requests":{"cpu":"100m","memory":"256Mi"}},"serviceSpec":{"type":"ClusterIP"},"snapshot":{"cron":"0 */6 * * *","dir":"/snapshots","enableOnMasterOnly":false,"existingPersistentVolumeClaimName":"","persistentVolumeClaimSpec":{"resources":{"requests":{"storage":"5Gi"}},"storageClassName":""}}},"enabled":false,"provider":"dragonfly"}` | Redis-compatible cache / queue resources |
| redis.dragonfly | object | `{"args":[],"env":[],"image":"docker.io/dragonflydb/dragonfly:latest","labels":{},"persistentVolumeClaimSpec":{"accessModes":["ReadWriteOnce"],"resources":{"requests":{"storage":"10Gi"}},"storageClassName":""},"replicas":1,"resources":{"limits":{"cpu":"500m","memory":"1Gi"},"requests":{"cpu":"100m","memory":"256Mi"}},"serviceSpec":{"type":"ClusterIP"},"snapshot":{"cron":"0 */6 * * *","dir":"/snapshots","enableOnMasterOnly":false,"existingPersistentVolumeClaimName":"","persistentVolumeClaimSpec":{"resources":{"requests":{"storage":"5Gi"}},"storageClassName":""}}}` | Dragonfly operator settings |
| redis.dragonfly.args | list | `[]` | Container args override |
| redis.dragonfly.env | list | `[]` | Extra environment variables |
| redis.dragonfly.image | string | `"docker.io/dragonflydb/dragonfly:latest"` | Container image for Dragonfly |
| redis.dragonfly.labels | object | `{}` | Extra labels applied to Dragonfly pods |
| redis.dragonfly.persistentVolumeClaimSpec | object | `{"accessModes":["ReadWriteOnce"],"resources":{"requests":{"storage":"10Gi"}},"storageClassName":""}` | PersistentVolumeClaim configuration for Dragonfly data storage |
| redis.dragonfly.persistentVolumeClaimSpec.accessModes | list | `["ReadWriteOnce"]` | Access mode for the PVC. Required by the Dragonfly operator. |
| redis.dragonfly.persistentVolumeClaimSpec.resources.requests.storage | string | `"10Gi"` | Size of the persistent volume |
| redis.dragonfly.persistentVolumeClaimSpec.storageClassName | string | `""` | StorageClass for the PVC. Empty uses cluster default. |
| redis.dragonfly.replicas | int | `1` | Number of Dragonfly replicas (including master) |
| redis.dragonfly.resources | object | `{"limits":{"cpu":"500m","memory":"1Gi"},"requests":{"cpu":"100m","memory":"256Mi"}}` | Resource requests and limits for each Dragonfly pod |
| redis.dragonfly.serviceSpec | object | `{"type":"ClusterIP"}` | Service configuration |
| redis.dragonfly.serviceSpec.type | string | `"ClusterIP"` | Service type. One of: ClusterIP, NodePort, LoadBalancer |
| redis.dragonfly.snapshot | object | `{"cron":"0 */6 * * *","dir":"/snapshots","enableOnMasterOnly":false,"existingPersistentVolumeClaimName":"","persistentVolumeClaimSpec":{"resources":{"requests":{"storage":"5Gi"}},"storageClassName":""}}` | Snapshot configuration (persistence) |
| redis.dragonfly.snapshot.cron | string | `"0 */6 * * *"` | Cron schedule for snapshots |
| redis.dragonfly.snapshot.dir | string | `"/snapshots"` | Snapshot directory path |
| redis.dragonfly.snapshot.enableOnMasterOnly | bool | `false` | Only run snapshots on the master node |
| redis.dragonfly.snapshot.existingPersistentVolumeClaimName | string | `""` | Pre-existing PVC name for snapshots (leave empty to create one) |
| redis.dragonfly.snapshot.persistentVolumeClaimSpec | object | `{"resources":{"requests":{"storage":"5Gi"}},"storageClassName":""}` | PVC spec for snapshot storage |
| redis.dragonfly.snapshot.persistentVolumeClaimSpec.resources.requests.storage | string | `"5Gi"` | Size of the snapshot volume |
| redis.dragonfly.snapshot.persistentVolumeClaimSpec.storageClassName | string | `""` | StorageClass for the PVC. Empty uses cluster default. |
| redis.enabled | bool | `false` | Render Redis resources |
| redis.provider | string | `"dragonfly"` | Provider: "dragonfly" (Dragonfly operator) |
| s3 | object | `{"buckets":[{"acl":"private","name":"assets"}],"crossplane":{"lifecycle":{"enabled":false,"expirationDays":90},"providerConfigRef":"aws-provider","region":"us-east-1"},"enabled":false,"garage":{"clusterRef":"garage","clusterRefNamespace":"","lifecycle":{},"quotas":{},"website":{}},"provider":"crossplane"}` | S3-compatible object storage buckets |
| s3.buckets | list | `[{"acl":"private","name":"assets"}]` | List of S3 buckets to provision. All use the same provider. |
| s3.buckets[0] | object | `{"acl":"private","name":"assets"}` | Bucket name (will be prefixed with app name) |
| s3.buckets[0].acl | string | `"private"` | Bucket ACL |
| s3.crossplane | object | `{"lifecycle":{"enabled":false,"expirationDays":90},"providerConfigRef":"aws-provider","region":"us-east-1"}` | Crossplane default settings (all buckets inherit, per-bucket overrides allowed) |
| s3.crossplane.providerConfigRef | string | `"aws-provider"` | ProviderConfig reference for the crossplane AWS provider |
| s3.crossplane.region | string | `"us-east-1"` | AWS region for the bucket |
| s3.enabled | bool | `false` | Render the bucket resources |
| s3.garage | object | `{"clusterRef":"garage","clusterRefNamespace":"","lifecycle":{},"quotas":{},"website":{}}` | Garage default settings (all buckets inherit, per-bucket overrides allowed) |
| s3.garage.clusterRef | string | `"garage"` | GarageCluster resource name to reference |
| s3.garage.clusterRefNamespace | string | `""` | Namespace of the GarageCluster (defaults to the same namespace). Cross-namespace requires a GarageReferenceGrant |
| s3.garage.lifecycle | object | `{}` | Optional bucket lifecycle rules |
| s3.garage.quotas | object | `{}` | Optional bucket quotas (maxSize, maxObjects) |
| s3.garage.website | object | `{}` | Optional website hosting configuration |
| s3.provider | string | `"crossplane"` | Provider: "crossplane" | "garage" |

> Library values are **not** merged into the consumer chart. They are shipped as a reference — copy what you need into your own `values.yaml` and validate via the bundled [`values.schema.json`](values.schema.json).

## Companion chart

For the workload itself (Deployment, Service, HPA, PDB, HTTPRoute) see [`hiroba-app-lib`](../app/README.md).

## Maintainers

| Name | Email | Url |
| ---- | ------ | --- |
| 7k-hiroba |  | <https://github.com/7K-Hiroba> |

## Source Code

* <https://github.com/7K-Hiroba/Hiroba>

## Documentation

<https://hiroba.7kgroup.org/docs/architecture/helm-libraries>

----------------------------------------------
Autogenerated from chart metadata using [helm-docs v1.14.2](https://github.com/norwoodj/helm-docs/releases/v1.14.2)
