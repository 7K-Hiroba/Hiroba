# ${{ values.name }}

Helm chart for ${{ values.name }}

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square)  ![Type: application](https://img.shields.io/badge/Type-application-informational?style=flat-square)  ![AppVersion: 0.1.0](https://img.shields.io/badge/AppVersion-0.1.0-informational?style=flat-square)

This chart installs the workload (Deployment, Service, HPA, PDB, HTTPRoute). For cross-cutting platform dependencies (secrets, observability, databases), install the companion [`${{ values.name }}-platform`](../platform/README.md) chart.

**Documentation:** <https://hiroba.7kgroup.org/docs/apps/${{ values.name }}/helm-base>

## TL;DR

```bash
helm install ${{ values.name }} \
  oci://harbor.7kgroup.org/7khiroba/charts/${{ values.name }} \
  --version 0.1.0
```

## Verify the chart signature

Every release is signed keylessly with [cosign](https://docs.sigstore.dev/) via the Sigstore public-good Fulcio CA. To verify before installing:

```bash
cosign verify \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp 'github.com/7K-Hiroba/' \
  harbor.7kgroup.org/7khiroba/charts/${{ values.name }}:0.1.0
```

## Configuration examples

**Minimal install** — just override the hostname:

```yaml
gateway:
  hostnames:
    - app.example.com
```

**Production-ish** — autoscaling + disruption budget + custom Gateway:

```yaml
replicaCount: 3
autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
podDisruptionBudget:
  enabled: true
  minAvailable: 2
gateway:
  parentRefs:
    - name: public-gateway
      namespace: gateway-system
  hostnames:
    - app.example.com
```

**Behind a path prefix**:

```yaml
gateway:
  hostnames:
    - example.com
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /${{ values.name }}
```

## Prerequisites

- Kubernetes 1.24+
- Gateway API CRDs installed in the cluster (the chart provisions an `HTTPRoute`)
- A running `Gateway` that your `HTTPRoute` can attach to

## What gets installed

| Resource | Purpose |
|---|---|
| `Deployment` | The application pod |
| `Service` | ClusterIP fronting the deployment |
| `HTTPRoute` | Gateway API routing |
| `ServiceAccount` | Pod identity |
| `HorizontalPodAutoscaler` | Optional — enabled via `autoscaling.enabled` |
| `PodDisruptionBudget` | Optional — enabled via `podDisruptionBudget.enabled` |

## Requirements

Kubernetes: `>=1.24.0-0`

| Repository | Name | Version |
|------------|------|---------|
| oci://harbor.7kgroup.org/7khiroba/charts | hiroba-app-lib | ^0.1.0 |

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| affinity | object | `{}` | affinity applied to the workload pods |
| autoscaling.enabled | bool | `false` | Render a HorizontalPodAutoscaler. When true, `replicaCount` is ignored. |
| autoscaling.maxReplicas | int | `10` | Maximum replicas the HPA may scale to |
| autoscaling.minReplicas | int | `1` | Minimum replicas the HPA may scale to |
| autoscaling.targetCPUUtilizationPercentage | int | `80` | Target average CPU utilization across replicas |
| env | list | `[]` | Extra environment variables, passed directly to the container |
| extraVolumeMounts | list | `[]` | Extra volume mounts added to the workload container |
| extraVolumes | list | `[]` | Extra volumes added to the pod spec |
| fullnameOverride | string | `""` | Fully override the generated fullname used in resource names |
| gateway.annotations | object | `{}` | Annotations applied to the HTTPRoute |
| gateway.enabled | bool | `true` | Render the Gateway API `HTTPRoute` resource |
| gateway.hostnames | list | `["myapp.example.com"]` | Hostnames to match |
| gateway.parentRefs | list | `[{"name":"default-gateway"}]` | Parent Gateway references |
| gateway.rules | list | `[]` | Routing rules (omit for a simple catch-all route to the service) |
| image.pullPolicy | string | `"IfNotPresent"` | Image pull policy. One of: Always, IfNotPresent, Never |
| image.repository | string | `"ghcr.io/7k-hiroba/${{ values.name }}"` | Container image repository |
| image.tag | string | `""` | Image tag. Defaults to `.Chart.AppVersion` when unset. |
| imagePullSecrets | list | `[]` | Secrets used to pull from private registries |
| livenessProbe | object | `{"httpGet":{"path":"/healthz","port":"http"},"initialDelaySeconds":10,"periodSeconds":10}` | Liveness probe (passed straight to the container spec) |
| nameOverride | string | `""` | Override the chart name used in resource names |
| nodeSelector | object | `{}` | nodeSelector applied to the workload pods |
| podAnnotations | object | `{}` | Annotations applied to every pod |
| podDisruptionBudget | object | `{"enabled":false,"minAvailable":1}` | Pod Disruption Budget. Only meaningful when running more than one replica (replicaCount > 1 or autoscaling.enabled). |
| podDisruptionBudget.minAvailable | int | `1` | Exactly one of minAvailable or maxUnavailable should be set |
| podSecurityContext | object | `{"fsGroup":1000,"runAsNonRoot":true,"runAsUser":1000}` | Pod-level security context |
| readinessProbe | object | `{"httpGet":{"path":"/readyz","port":"http"},"initialDelaySeconds":5,"periodSeconds":5}` | Readiness probe (passed straight to the container spec) |
| replicaCount | int | `1` | Number of pod replicas. Ignored when `autoscaling.enabled` is true. |
| resources | object | `{"limits":{"cpu":"500m","memory":"256Mi"},"requests":{"cpu":"100m","memory":"128Mi"}}` | Pod resource requests and limits |
| securityContext | object | `{"allowPrivilegeEscalation":false,"capabilities":{"drop":["ALL"]},"readOnlyRootFilesystem":true}` | Container-level security context |
| service.port | int | `80` | Service port exposed inside the cluster |
| service.targetPort | int | `8080` | Container port the service targets (named `http`) |
| service.type | string | `"ClusterIP"` | Service type. One of: ClusterIP, NodePort, LoadBalancer |
| serviceAccount.annotations | object | `{}` | Annotations to add to the ServiceAccount |
| serviceAccount.create | bool | `true` | Create a dedicated ServiceAccount for the workload |
| serviceAccount.name | string | `""` | Name to use. If unset and `create: true`, a name is generated from fullname. |
| tolerations | list | `[]` | tolerations applied to the workload pods |

All values are also validated against [`values.schema.json`](values.schema.json). Artifact Hub renders the schema as an interactive form on the chart page.

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
