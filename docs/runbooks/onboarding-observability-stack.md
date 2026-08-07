# Onboarding an ObservabilityStack

This runbook explains how to deploy a full observability platform
(Grafana + Loki + Prometheus + Alloy) in a client namespace using the
`ObservabilityStack` ResourceGraphDefinition (RGD) in Hiroba.

## What it deploys

The `ObservabilityStack` RGD composes:

- **Storage primitives**
  - `ObjectBucket` for Loki (and Mimir when enabled)
  - `PostgresInstance` for Grafana's configuration database
- **Helm Applications** (created in the client namespace)
  - `grafana`
  - `loki-distributed`
  - `prometheus` (or `mimir-distributed` if `metrics.backend: mimir`)
  - `alloy`
- **Gateway exposure**
  - `HTTPRoute` for Grafana when `modules.grafana.domain` is set
- **Datasource provisioning**
  - `ConfigMap` labeled `grafana_datasource` so Grafana auto-loads Loki and
    Prometheus/Mimir

## Prerequisites

Cluster operator side (one-time per cluster):

- KRO installed
- ArgoCD installed with `application.namespaces: "*"` so Applications can be
  created in client namespaces
- Crossplane + `function-platform` installed and healthy
- `platform-primitives` Configuration installed (ObjectBucket + PostgresInstance
  XRDs)
- Garage operator and CloudNativePG installed
- A `GarageReferenceGrant` allowing the client namespace to reference the
  GarageCluster
- Keycloak realm with a `grafana` client if you want SSO
- A Vault/ESO secret or Kubernetes Secret named `grafana-sso` with key
  `client-secret`

Install the RGD:

```bash
kubectl apply -f stacks/observability/rg.yaml
```

Verify it becomes `Active`:

```bash
kubectl get resourcegraphdefinition.kro.run observabilitystack.platform.7kgroup.org
```

## 1. Create the ObservabilityStack CR

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
      enabled: true
      domain: grafana-team-api.int.7kgroup.org
    loki:
      enabled: true
    metrics:
      enabled: true
      backend: prometheus
    alloy:
      enabled: true
```

Key fields:

- `profile` — drives primitive defaults (`development`, `staging`, `production`)
- `team` — used as `X-Scope-OrgID` for Loki/Mimir/Prometheus and for naming
- `modules.grafana.domain` — enables the `HTTPRoute`; omit it to skip external
  access
- `modules.metrics.backend` — `prometheus` (default) or `mimir`

Apply:

```bash
kubectl apply -f observabilitystack.yaml
```

## 2. Optional: configure SSO

If you set `modules.grafana.domain`, you likely want SSO too. The platform
wiring expects:

1. A Keycloak client named `grafana` in the same realm used by the cluster.
2. Valid redirect URI:
   `https://<domain>/login/generic_oauth`
3. A Kubernetes Secret `grafana-sso` in the stack namespace with the client
   secret:

   ```yaml
   apiVersion: v1
   kind: Secret
   metadata:
     name: grafana-sso
     namespace: team-api
   stringData:
     client-secret: <keycloak-client-secret>
   ```

The default values file already enables `auth.generic_oauth` and maps the
Keycloak group `platform-admin` to Grafana `Admin`. Edit
`clients/<team>/observability/grafana.yaml` in the overrides repo to change the
issuer, group mapping, or role assignment.

## 3. Verify

Wait for KRO to reconcile the CR:

```bash
kubectl -n team-api wait --for=condition=Ready \
  observabilitystack.platform.7kgroup.org/team-api-obs --timeout=300s
```

List the generated ArgoCD Applications:

```bash
kubectl -n team-api get applications
```

Expected:

```
team-api-obs-alloy        Synced   Healthy
team-api-obs-grafana      Synced   Healthy
team-api-obs-loki         Synced   Healthy
team-api-obs-prometheus   Synced   Healthy
```

Check the HTTPRoute:

```bash
kubectl -n team-api get httproute team-api-obs-grafana
```

Check datasources were auto-provisioned:

```bash
kubectl -n team-api get configmap team-api-obs-datasources -o yaml
```

Inside Grafana, navigate to **Configuration > Data sources** and confirm Loki
and Prometheus are present.

Check declarative dashboards were provisioned:

```bash
kubectl -n team-api get configmap team-api-obs-dashboards -o yaml
```

The Grafana dashboards sidecar loads every ConfigMap labeled
`grafana_dashboard: '1'` in the stack namespace. The RGD ships Kubernetes
cluster/node/pod dashboards by default; set `modules.grafana.dashboards: false`
to disable them. Team dashboards can be added by applying extra labeled
ConfigMaps in the same namespace.

## 4. Customize via the values repo

Static Helm configuration lives in the overrides repo. The default files are in
`clients/platform/observability/`; copy/adjust them for the team:

```
clients/
  team-api/
    observability/
      grafana.yaml
      loki.yaml
      prometheus.yaml
      alloy.yaml
```

Examples:

- Change the Grafana admin password: edit `grafana.yaml`
- Tune Loki retention or gateway resolver: edit `loki.yaml`
- Add Prometheus recording rules or change retention: edit `prometheus.yaml`
- Add Alloy scrape rules: edit `alloy.yaml`

Dynamic values (database password, bucket credentials, endpoints) are injected
by the RGD via `valuesObject` and cannot be overridden from these files.

## 5. Default values files

The platform ships these defaults in the values repo:

- `clients/platform/observability/grafana.yaml`
- `clients/platform/observability/loki.yaml`
- `clients/platform/observability/prometheus.yaml`
- `clients/platform/observability/alloy.yaml`

Copy them to the team's path and modify as needed.

## Troubleshooting

### ArgoCD Applications are not created

- Confirm the RGD is `Active`:

  ```bash
  kubectl get resourcegraphdefinition.kro.run observabilitystack.platform.7kgroup.org
  ```

- Confirm ArgoCD allows Applications in the namespace:

  ```bash
  kubectl get cm argocd-cm -n argocd -o jsonpath='{.data.application\.namespaces}'
  ```

- Check the `ObservabilityStack` status and events:

  ```bash
  kubectl -n team-api describe observabilitystack team-api-obs
  ```

### ObjectBucket or PostgresInstance stays unsynced

- Check that `platform-primitives` is healthy and the function has CRD read
  access.
- Verify the `GarageReferenceGrant` allows the team namespace to reference the
  GarageCluster.
- Confirm CloudNativePG is installed for PostgresInstance.

### Grafana SSO fails

- Confirm the Keycloak client redirect URI matches
  `https://<domain>/login/generic_oauth`.
- Confirm the `grafana-sso` Secret exists and has key `client-secret`.
- Check Grafana logs for OAuth errors:

  ```bash
  kubectl -n team-api logs deploy/team-api-obs-grafana
  ```

### Alloy remote write returns 400

- Alloy uses node-local pod discovery. If you see duplicate-scrape errors,
  ensure the `alloy` chart runs as a DaemonSet and `KUBE_NODE_NAME` is injected.
- Confirm Prometheus has `--web.enable-remote-write-receiver` enabled in the
  values file.

### Loki gateway fails with nginx resolver error

- Edit `clients/<team>/observability/loki.yaml` and set the cluster DNS resolver
  under `gateway.nginxConfig.resolver`.
