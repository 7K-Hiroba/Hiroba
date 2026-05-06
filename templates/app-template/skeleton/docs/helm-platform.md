---
sidebar_position: 4
---

# Helm platform chart

The platform chart provisions resources that **surround** the application: databases, object storage, secrets, and observability. It is optional — install the [base chart](./helm-base.md) alone for a minimal deployment.

Every section ships disabled by default so the chart is safe to install into clusters that don't have the relevant operators present. Enabling a feature without its required CRDs causes `helm install` to fail early with a clear error, rather than silently creating Custom Resources nothing is reconciling.

## Matching the base chart

The ServiceMonitor below needs to select the base chart's pods. Set `global.baseInstance` to the base chart's release name so the selector matches both `app.kubernetes.io/name` and `app.kubernetes.io/instance`:

```yaml
global:
  baseInstance: ${{ values.name }}   # release name used for `helm install <name> ./helm/base`
```

Leave it empty to match by name only — acceptable when only one release of the app runs in the cluster.

> PodDisruptionBudget lives in the [base chart](./helm-base.md#poddisruptionbudget), not here — it's tightly coupled to the Deployment's lifecycle.

Values reference: [`helm/platform/values.yaml`](https://github.com/7KGroup/${{ values.name }}/blob/main/helm/platform/values.yaml)

## Install

```bash
helm install ${{ values.name }}-platform ./helm/platform \
  --set postgres.enabled=true \
  --set externalSecrets.enabled=true
```

## PostgreSQL

Provisions a PostgreSQL cluster via [CloudNativePG](https://cloudnative-pg.io/).

### Prerequisites

- CloudNativePG operator installed in the cluster
- A `StorageClass` available for the data volume

### Configuration

```yaml
postgres:
  enabled: true
  provider: cnpg
  instances: 1            # use 3 for HA
  storage:
    size: 10Gi
    storageClass: ""      # omit to use the cluster default
  database: app
  owner: app
  backup:
    enabled: true
    schedule: "0 2 * * *"
    retentionPolicy: "7d"
```

Connection credentials are published to a `Secret` named `${{ values.name }}-app` that the base chart can pull via `envFrom`.

## S3 / Object storage

Provisions an S3-compatible bucket. Two providers are supported:

- **`crossplane`** — provisions a real bucket on AWS (or an S3-compatible cloud) via Crossplane's S3 provider
- **`garage`** — creates a bucket in an in-cluster [Garage](https://garagehq.deuxfleurs.fr/) deployment

### Configuration

```yaml
s3:
  enabled: true
  provider: crossplane   # or "garage"
  bucketName: assets
  acl: private
  crossplane:
    region: us-east-1
    providerConfigRef: aws-provider
    lifecycle:
      enabled: true
      expirationDays: 90
```

Swap the provider by changing `s3.provider` — the provider-specific blocks (`crossplane`, `garage`) configure the chosen backend.

## ExternalSecrets

Populates a Kubernetes `Secret` from an upstream store (Vault, AWS Secrets Manager, 1Password, etc.) via an `ExternalSecret` resource. The base chart's `envFrom` then pulls credentials from this `Secret`.

### Prerequisites

- [external-secrets operator](https://external-secrets.io/) installed in the cluster
- A `ClusterSecretStore` (or `SecretStore`) configured and reachable

### Configuration

```yaml
externalSecrets:
  enabled: true
  refreshInterval: 1h
  storeRef:
    name: cluster-secret-store
    kind: ClusterSecretStore
  data:
    - secretKey: DATABASE_URL
      remoteKey: ${{ values.name }}/database
      property: url
    - secretKey: API_KEY
      remoteKey: ${{ values.name }}/api
      property: key
```

To pull every key under a remote path instead of mapping them individually, use `dataFrom`:

```yaml
externalSecrets:
  dataFrom:
    - extract:
        key: ${{ values.name }}/config
```

### Value transformation

Use `target.template` to synthesize new secret values from the retrieved ones (e.g. compose a URL from parts). See the [ESO templating guide](https://external-secrets.io/latest/guides/templating/):

```yaml
externalSecrets:
  target:
    template:
      type: Opaque
      data:
        DATABASE_URL: "postgres://{{ `{{ .username }}` }}:{{ `{{ .password }}` }}@host/{{ `{{ .database }}` }}"
```

The double-brace escape (`{{ ` ... ` }}`) is needed because Helm processes the values file first; the inner braces reach ESO untouched.

### Wiring back into the base chart

The generated `Secret` is named after the application (`${{ values.name }}`). Reference it from the base chart's `envFrom`:

```yaml
# helm/base values override
envFrom:
  - secretRef:
      name: ${{ values.name }}
```

See the [base chart injecting-secrets section](./helm-base.md#injecting-secrets) for which variables to map.

## Observability

### ServiceMonitor

Scrapes the container's `/metrics` endpoint via the Prometheus Operator.

```yaml
observability:
  serviceMonitor:
    enabled: true
    additionalLabels:
      release: kube-prometheus-stack  # match your Prometheus instance selector
    port: http
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s
```

Requires the Prometheus Operator CRDs (`monitoring.coreos.com/v1`).

### Grafana dashboard

Deploys dashboards as a `ConfigMap` with the Grafana sidecar label. The sidecar picks them up and imports them into Grafana automatically.

```yaml
observability:
  grafanaDashboard:
    enabled: true
    folderLabel: "Applications"
```

Dashboards are loaded from `helm/platform/dashboards/*.json`. Each JSON file becomes a key in the ConfigMap and is run through Helm's `tpl` function, so you can reference chart helpers inside the JSON — use backtick-quoted args for `include` (e.g. ``{{ include `platform.name` . }}``) since JSON escapes break inside Go template actions. Drop additional dashboards into the directory and they ship alongside the default.

<!-- TODO: Replace the default dashboard JSON with panels that match the metrics your app actually emits. -->

### PrometheusRules

Ships alert rules for error rate and latency. The group definitions live under `observability.prometheusRules.groups` and are passed through `tpl`, so you can reference chart helpers and release context inside expressions:

```yaml
observability:
  prometheusRules:
    enabled: true
    groups:
      - name: '{{ include "platform.name" . }}.rules'
        rules:
          - alert: HighErrorRate
            expr: |
              sum(rate(http_requests_total{service="{{ include "platform.name" . }}", status=~"5.."}[5m])) > 0.05
            for: 5m
            labels:
              severity: warning
            annotations:
              summary: "High error rate"
```

Override the whole list to replace the built-in alerts, or append to extend them. Requires the Prometheus Operator CRDs.

<!-- TODO: The default alerts assume `http_requests_total` / `http_request_duration_seconds_bucket` metric names. Replace them with alerts based on metrics your app actually exposes, or switch to kube-state-metrics based checks (`kube_pod_container_status_restarts_total`, `up == 0`) for a generic baseline. -->

## What this chart does NOT install

- The parent `Gateway` resource — provided by a gateway chart
- TLS certificates — expected to be attached to the Gateway's HTTPS listener
- Cluster-wide operators (CNPG, Crossplane, external-secrets, Prometheus) — these are platform prerequisites
