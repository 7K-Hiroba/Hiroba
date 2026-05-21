# hiroba-app-lib

Helm **library** chart for Hiroba application (workload-lifecycle) charts. It defines named templates for the resources every Hiroba app deploys — `Deployment`, `Service`, `ServiceAccount`, `HorizontalPodAutoscaler`, `PodDisruptionBudget`, and a Gateway API `HTTPRoute` — so consumer charts no longer copy the same YAML into every app repo.

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
    version: ^0.1.0
    repository: oci://harbor.7kgroup.org/7khiroba/charts
```

Pull the dependency:

```bash
helm dependency update
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

## Values surface

[`values.yaml`](values.yaml) ships the reference defaults and [`values.schema.json`](values.schema.json) documents the shape. Library values are **not** merged into the consumer — copy what you need into your own chart and validate there.

## Versioning

Semver, automated via [release-please](https://github.com/googleapis/release-please) in the [Hiroba repo](https://github.com/7K-Hiroba/Hiroba):

- `fix(helm-app-lib): ...` → patch
- `feat(helm-app-lib): ...` → minor
- `feat(helm-app-lib)!: ...` or `BREAKING CHANGE:` → major

Tagged releases publish the OCI artifact to `oci://harbor.7kgroup.org/7khiroba/charts/hiroba-app-lib`.

## Companion chart

For cross-cutting platform dependencies (ESO, CNPG, ServiceMonitor, S3 buckets) see [`hiroba-platform-lib`](../platform/README.md).

## Documentation

<https://hiroba.7kgroup.org/docs/architecture/helm-libraries>
