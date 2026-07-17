# Hiroba KRO Stacks

This directory contains KRO `ResourceGraphDefinition`s for product stacks. The
stacks consume Hiroba primitives (`PostgresInstance`, `ObjectBucket`) and turn
them into GitOps-managed ArgoCD Applications.

## Included stacks

| Directory              | RGD kind             | What it deploys                                         |
| ---------------------- | -------------------- | ------------------------------------------------------- |
| `observability/`       | `ObservabilityStack` | In-cluster Grafana + Loki + Mimir/Prometheus + Alloy.   |
| `observability-agent/` | `ObservabilityAgent` | Remote-pushing Grafana Alloy agent for client clusters. |

## Requirements

- Kubernetes >= 1.28
- KRO >= 0.9.1 installed (see [installation](https://kro.run/docs/getting-started/01-Installation))
- ArgoCD >= 2.12 with `application.namespaces` enabled so Applications can live
  in the XR namespace
- Hiroba primitives installed:
  - `PostgresInstance` XRD + Composition
  - `ObjectBucket` XRD + Composition

## Quick start

```bash
kubectl apply -f stacks/observability/rg.yaml
kubectl apply -f stacks/observability-agent/rg.yaml

kubectl wait --for=condition=Active \
  resourcegraphdefinition.kro.run/observabilitystack.platform.7kgroup.org
kubectl wait --for=condition=Active \
  resourcegraphdefinition.kro.run/observabilityagent.platform.7kgroup.org
```

Create a stack:

```yaml
apiVersion: platform.7kgroup.org/v1alpha1
kind: ObservabilityStack
metadata:
  name: team-api-obs
  namespace: team-api
spec:
  profile: development
  team: team-api
  costCenter: cc-12345
  modules:
    grafana:
      domain: grafana.team-api.example.com
```

Create a remote agent:

```yaml
apiVersion: platform.7kgroup.org/v1alpha1
kind: ObservabilityAgent
metadata:
  name: team-api-agent
  namespace: team-api
spec:
  profile: development
  team: team-api
  costCenter: cc-12345
  logsEndpoint: https://logs.mgmt.example.com/loki/api/v1/push
  metricsEndpoint: https://metrics.mgmt.example.com/api/v1/push
  mtls:
    certSecretName: team-api-agent-mtls
```

## Fast-lane values

Every stack component references a per-client values file in the overrides repo:

```text
clients/<team>/observability/<component>.yaml
```

Examples:

- `clients/team-api/observability/loki.yaml`
- `clients/team-api/observability/alloy-agent.yaml`

Platform-critical values (S3 endpoint, bucket names, credential secret names,
remote Alloy endpoints) are injected via `valuesObject` in the RGD and always win
over the values file. Teams use the values file for chart-level tuning such as
resource limits, replica counts, retention, and ingress annotations.

If a team needs a different path, override `spec.overrides.path` or
`spec.overrides.repoURL`.

## Stack status and endpoints

These RGDs intentionally do not expose a `status.endpoint` or similar fields.
KRO status expressions cannot reference `schema.metadata`, and the actual
endpoints are deterministic from the XR name and the `fullnameOverride` values
emitted by the RGD. Documented endpoint patterns are the contract.

For example, an `ObservabilityStack` named `team-api-obs` in namespace
`team-api` exposes Grafana at:

```text
http://team-api-obs-grafana-grafana.team-api.svc:80
```

## Compatibility

| Hiroba stacks | KRO    | ArgoCD | Crossplane | Notes                              |
| ------------- | ------ | ------ | ---------- | ---------------------------------- |
| current       | 0.9.1+ | 2.12+  | 2.3+       | Requires `application.namespaces`. |

## Versioning

`stacks/` is versioned independently via release-please (`stacks-v*`). Each
release produces a `stacks-<version>.tar.gz` artifact attached to the GitHub
release for air-gapped or pinned deployments.

1. Create a new directory under `stacks/`.
2. Write an RGD with `apiVersion: kro.run/v1alpha1` and `kind: ResourceGraphDefinition`.
3. Keep primitives in the orchestrator; only compose Helm Applications in the RGD.
4. Add the RGD to `scripts/validate-stacks.sh` (it scans `stacks/**/*.yaml`).
5. Add a runbook under `docs/runbooks/` if the stack has operational procedures.
6. Update this README.
