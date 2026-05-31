# hiroba-app-lib

Helm library chart for Hiroba application (workload-lifecycle) charts.
Defines reusable named templates for Deployment, Service, ServiceAccount,
HPA, PDB, and Gateway API HTTPRoute. Consumer charts add this as a
dependency and include the resources they need.

![Version: 0.2.5](https://img.shields.io/badge/Version-0.2.5-informational?style=flat-square)  ![Type: library](https://img.shields.io/badge/Type-library-informational?style=flat-square)  ![AppVersion: 0.1.0](https://img.shields.io/badge/AppVersion-0.1.0-informational?style=flat-square)

> Library charts are not installable on their own. Add this as a `dependency` from your application chart and include the resources you need.

## Quick start

`Chart.yaml`:

```yaml
apiVersion: v2
name: myapp
type: application
version: 0.1.0
appVersion: "0.1.0"
dependencies:
  - name: hiroba-app-lib
    version: ^0.2.5
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
  harbor.7kgroup.org/7khiroba/charts/hiroba-app-lib:0.2.5
```

`templates/deployment.yaml` (one thin wrapper per resource, following the Hiroba skeleton convention):

```yaml
{{- include "hiroba-app.deployment" . }}
```

Repeat for `service.yaml`, `httproute.yaml`, `hpa.yaml`, `pdb.yaml`, `serviceaccount.yaml`. Override individual resources by replacing the wrapper with your own YAML — the library renders nothing on its own.

## Named templates

| Template | Renders | Gated on |
| --- | --- | --- |
| `hiroba-app.deployment` | `apps/v1` Deployment | always |
| `hiroba-app.service` | `v1` Service | always |
| `hiroba-app.serviceaccount` | `v1` ServiceAccount | `serviceAccount.create` |
| `hiroba-app.hpa` | `autoscaling/v2` HorizontalPodAutoscaler | `autoscaling.enabled` |
| `hiroba-app.pdb` | `policy/v1` PodDisruptionBudget | `podDisruptionBudget.enabled` |
| `hiroba-app.httproute` | `gateway.networking.k8s.io/v1` HTTPRoute | `gateway.enabled` |

Helper templates used internally and safe to re-use from consumer templates: `hiroba-app.name`, `hiroba-app.fullname`, `hiroba-app.chart`, `hiroba-app.labels`, `hiroba-app.selectorLabels`, `hiroba-app.serviceAccountName`.

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md). Releases are automated via [release-please](https://github.com/googleapis/release-please) from the [Hiroba](https://github.com/7K-Hiroba/Hiroba) monorepo:

- `fix(helm-app-lib): ...` → patch
- `feat(helm-app-lib): ...` → minor
- `feat(helm-app-lib)!: ...` or `BREAKING CHANGE:` → major

Tagged releases publish the OCI artifact to `oci://harbor.7kgroup.org/7khiroba/charts/hiroba-app-lib`.

## Requirements

Kubernetes: `>=1.24.0-0`

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| affinity | object | `{}` | affinity applied to the workload pods |
| args | list | `[]` | Container args override. When empty, the container uses the image's default CMD. |
| autoscaling.enabled | bool | `false` | Render a HorizontalPodAutoscaler. When true, `replicaCount` is ignored. |
| autoscaling.maxReplicas | int | `10` | Maximum replicas the HPA may scale to |
| autoscaling.minReplicas | int | `1` | Minimum replicas the HPA may scale to |
| autoscaling.scaleTargetKind | string | `"Deployment"` | Workload kind to scale. One of: Deployment, StatefulSet |
| autoscaling.targetCPUUtilizationPercentage | int | `80` | Target average CPU utilization across replicas |
| config.configs | list | `[{"configMapName":"","mountPath":"/app/app-config.yaml","readOnly":true,"subPath":"app-config.yaml"}]` | List of ConfigMaps to mount as files |
| config.configs[0] | object | `{"configMapName":"","mountPath":"/app/app-config.yaml","readOnly":true,"subPath":"app-config.yaml"}` | Name of the ConfigMap to mount. Defaults to fullname + "-app-config" when empty |
| config.configs[0].mountPath | string | `"/app/app-config.yaml"` | File path where the config is mounted inside the container |
| config.configs[0].readOnly | bool | `true` | Whether the mounted config file is read-only |
| config.configs[0].subPath | string | `"app-config.yaml"` | The key inside the ConfigMap to mount as a file (required for readOnlyRootFilesystem) |
| config.enabled | bool | `false` | Mount ConfigMap(s) into the container as files |
| env | list | `[]` | Extra environment variables, passed directly to the container |
| envFrom | list | `[]` | envFrom sources (ConfigMapRef / SecretRef) injected into the container |
| extraVolumeMounts | list | `[]` | Extra volume mounts added to the workload container |
| extraVolumes | list | `[]` | Extra volumes added to the pod spec |
| fullnameOverride | string | `""` | Fully override the generated fullname used in resource names |
| gateway.annotations | object | `{}` | Annotations applied to the HTTPRoute |
| gateway.defaultFilters | list | `[{"responseHeaderModifier":{"set":[{"name":"Strict-Transport-Security","value":"max-age=63072000; includeSubDomains"},{"name":"X-Content-Type-Options","value":"nosniff"},{"name":"X-Frame-Options","value":"DENY"},{"name":"Referrer-Policy","value":"strict-origin-when-cross-origin"}]},"type":"ResponseHeaderModifier"}]` | Filters prepended to every rule (e.g. response security headers). Set to [] to opt out. CSP in particular needs per-deployment tuning. |
| gateway.enabled | bool | `true` | Render the Gateway API `HTTPRoute` resource |
| gateway.hostnames | list | `["myapp.example.com"]` | Hostnames the route matches |
| gateway.parentRefs | list | `[{"name":"default-gateway"}]` | Parent Gateway references the HTTPRoute attaches to |
| gateway.rules | list | `[]` | Routing rules. Leave empty for a catch-all forward to the service. |
| image.pullPolicy | string | `"IfNotPresent"` | Image pull policy. One of: Always, IfNotPresent, Never |
| image.repository | string | `"ghcr.io/example/app"` | Container image repository |
| image.tag | string | `""` | Image tag. Defaults to `.Chart.AppVersion` when unset. |
| imagePullSecrets | list | `[]` | Secrets used to pull from private registries |
| livenessProbe | object | `{"httpGet":{"path":"/healthz","port":"http"},"initialDelaySeconds":10,"periodSeconds":10}` | Liveness probe (passed straight to the container spec) |
| nameOverride | string | `""` | Override the chart name used in resource names |
| nodeSelector | object | `{}` | nodeSelector applied to the workload pods |
| podAnnotations | object | `{}` | Annotations applied to every pod |
| podDisruptionBudget | object | `{"enabled":false,"minAvailable":1}` | Pod Disruption Budget. Only meaningful with replicaCount > 1 or HPA on. |
| podDisruptionBudget.enabled | bool | `false` | Render a PodDisruptionBudget |
| podDisruptionBudget.minAvailable | int | `1` | Minimum available replicas. Mutually exclusive with `maxUnavailable`. |
| podSecurityContext | object | `{"fsGroup":1000,"runAsNonRoot":true,"runAsUser":1000}` | Pod-level security context |
| readinessProbe | object | `{"httpGet":{"path":"/readyz","port":"http"},"initialDelaySeconds":5,"periodSeconds":5}` | Readiness probe (passed straight to the container spec) |
| replicaCount | int | `1` | Number of pod replicas. Ignored when `autoscaling.enabled` is true. |
| resources | object | `{"limits":{"cpu":"500m","memory":"256Mi"},"requests":{"cpu":"100m","memory":"128Mi"}}` | Pod resource requests and limits |
| securityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":true}` | Container-level security context |
| service.port | int | `80` | Service port exposed inside the cluster |
| service.targetPort | int | `8080` | Container port the service targets (named `http`) |
| service.type | string | `"ClusterIP"` | Service type. One of: ClusterIP, NodePort, LoadBalancer |
| serviceAccount.annotations | object | `{}` | Annotations to add to the ServiceAccount (e.g. IRSA / Workload Identity) |
| serviceAccount.create | bool | `true` | Create a dedicated ServiceAccount for the workload |
| serviceAccount.name | string | `""` | Name to use. If unset and `create: true`, a name is generated from fullname. |
| startupProbe | object | `{}` | Startup probe (passed straight to the container spec). When set, disables liveness and readiness checks until the container starts. |
| statefulset.podManagementPolicy | string | `"OrderedReady"` | Pod management policy. One of: OrderedReady, Parallel |
| statefulset.serviceName | string | `""` | Service name governing the StatefulSet. Defaults to the chart fullname. |
| statefulset.updateStrategy | object | `{"type":"RollingUpdate"}` | StatefulSet update strategy |
| statefulset.volumeClaimTemplates | list | `[]` | Volume claim templates for the StatefulSet |
| tolerations | list | `[]` | tolerations applied to the workload pods |

> Library values are **not** merged into the consumer chart. They are shipped as a reference — copy what you need into your own `values.yaml` and validate via the bundled [`values.schema.json`](values.schema.json).

## Companion chart

For cross-cutting platform dependencies (ESO, CNPG, ServiceMonitor, S3 buckets) see [`hiroba-platform-lib`](../platform/README.md).

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
