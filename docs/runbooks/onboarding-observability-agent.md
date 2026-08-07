# Onboarding an ObservabilityAgent in a Client Cluster

This runbook explains how to deploy a remote-pushing Grafana Alloy agent in a
client cluster using the `ObservabilityAgent` RGD.

## Prerequisites

- KRO installed in the client cluster.
- ArgoCD installed with `application.namespaces: "*"` so Applications can be
  created in the client's namespace.
- The `ObservabilityAgent` RGD applied from the Hiroba repo:

  ```bash
  kubectl apply -f stacks/observability-agent/rg.yaml
  ```

- Reachable management-plane observability endpoints (Loki / Mimir or
  Prometheus).
- An mTLS certificate/key pair for the agent, trusted by the management plane.

## 1. Create the mTLS secret

The agent mounts a Kubernetes TLS secret at `/etc/alloy/certs`. The secret must
contain `tls.crt` and `tls.key`.

### With cert-manager

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: team-api-agent
  namespace: team-api
spec:
  secretName: team-api-agent-mtls
  issuerRef:
    name: management-plane-mtls-issuer
    kind: ClusterIssuer
  dnsNames:
    - team-api-agent.local
  usages:
    - client auth
```

### With Vault / ESO

Use External Secrets Operator to sync the cert/key from Vault into a
`kubernetes.io/tls` secret named `team-api-agent-mtls`.

### Manual (not for production)

```bash
kubectl create namespace team-api
kubectl -n team-api create secret tls team-api-agent-mtls \
  --cert=agent.crt --key=agent.key
```

## 2. Create the ObservabilityAgent CR

```yaml
apiVersion: platform.7kgroup.org/v1alpha1
kind: ObservabilityAgent
metadata:
  name: team-api-agent
  namespace: team-api
spec:
  profile: production
  team: team-api
  costCenter: cc-12345
  logsEndpoint: https://logs.mgmt.example.com/loki/api/v1/push
  metricsEndpoint: https://metrics.mgmt.example.com/api/v1/push
  tenantId: team-api
  mtls:
    certSecretName: team-api-agent-mtls
  modules:
    logs: true
    metrics: true
    kubeStateMetrics:
      enabled: true
    nodeExporter:
      enabled: true
    kubelet: true
    kubeApiServer: true
    dashboards:
      enabled: true
    rules:
      enabled: false
```

- `modules.logs` and `modules.metrics` are optional and default to `true`.
- When `modules.logs` is `true`, the chart mounts `/var/log` and
  `/var/lib/docker/containers` from the host so Alloy can collect container
  logs.
- `tenantId` is optional. If omitted, `team` is used as the `X-Scope-OrgID`
  value.
- `logsEndpoint` and `metricsEndpoint` are provided by the platform team.
- `mtls.certSecretName` must match the secret from step 1.

### Metrics sources

All metrics sources are gated by `modules.metrics` and can be toggled
individually:

| Module                     | Default | What it does                                                                                                                                                                             |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kubeStateMetrics.enabled` | `true`  | Deploys the `kube-state-metrics` Helm chart via ArgoCD and scrapes it. Pin a different chart with `kubeStateMetrics.chartVersion`.                                                       |
| `nodeExporter.enabled`     | `true`  | Deploys the `prometheus-node-exporter` DaemonSet via ArgoCD and scrapes it. Pin a different chart with `nodeExporter.chartVersion`.                                                      |
| `kubelet`                  | `true`  | Scrapes kubelet `/metrics` and `/metrics/cadvisor` on every node. The RGD creates a `<name>-node-scrape` ClusterRole/Binding for this because the Alloy chart ships no node permissions. |
| `kubeApiServer`            | `true`  | Scrapes the API server's `/metrics` endpoint.                                                                                                                                            |

The pod scrape (`prometheus.scrape "kubernetes"`) is always included when
`modules.metrics` is `true`.

### Dashboards and alert rules

- `modules.dashboards.enabled` (default `true`) creates a
  `<name>-dashboards` ConfigMap labeled `grafana_dashboard: '1'` with
  Kubernetes cluster/node/pod dashboards. Any Grafana running in the client
  cluster with the dashboards sidecar enabled picks them up
  (kube-prometheus-stack convention). Panels use the default Prometheus
  datasource.
- `modules.rules.enabled` (default `false`) creates a
  `<name>-kubernetes-rules` PrometheusRule CR with common Kubernetes alerts
  (node not ready, crash loops, replica mismatch, memory/filesystem pressure).
  **Requires the prometheus-operator CRDs in the client cluster** — the agent
  itself does not evaluate rules.

## 3. Verify

Wait for KRO to reconcile the CR:

```bash
kubectl -n team-api wait --for=condition=Ready \
  observabilityagent.platform.7kgroup.org/team-api-agent --timeout=120s
```

Check the generated ConfigMap:

```bash
kubectl -n team-api get configmap team-api-agent-river-config \
  -o jsonpath='{.data.config\.alloy}'
```

It should contain:

- `prometheus.remote_write "mgmt"` pointing at `metricsEndpoint`.
- `loki.write "mgmt"` pointing at `logsEndpoint`.
- `"X-Scope-OrgID" = "team-api"`.
- `cert_file` and `key_file` under `tls_config`.
- Scrape jobs for the enabled metrics sources: `kube_state_metrics`,
  `node_exporter`, `kubelet`, `cadvisor`, `apiserver`.

Check the ArgoCD Applications:

```bash
kubectl -n team-api get applications
```

Expected (depending on enabled modules):

```text
team-api-agent                      Synced   Healthy
team-api-agent-kube-state-metrics   Synced   Healthy
team-api-agent-node-exporter        Synced   Healthy
```

Confirm that:

- `spec.sources[0].helm.valuesObject.alloy.configMap.create` is `false`.
- `spec.sources[0].helm.valuesObject.alloy.configMap.name` is
  `team-api-agent-river-config`.
- `spec.sources[0].helm.valuesObject.volumes[0].secret.secretName` is
  `team-api-agent-mtls`.

In the ArgoCD UI, the Application should sync and the Alloy pods should become
healthy.

## 4. Fast-lane overrides

To tune chart values (resource limits, node selectors, tolerations), edit the
per-module files in the overrides repo:

```text
clients/team-api/observability/alloy-agent.yaml
clients/team-api/observability/kube-state-metrics.yaml
clients/team-api/observability/node-exporter.yaml
```

The platform wiring in the RGD cannot be overridden from those files.

## Troubleshooting

### ArgoCD Application is not created

- Check that KRO is installed and the RGD is `Active`:

  ```bash
  kubectl get resourcegraphdefinition.kro.run observabilityagent.platform.7kgroup.org
  ```

- Check the `ObservabilityAgent` status and events:

  ```bash
  kubectl -n team-api describe observabilityagent team-api-agent
  ```

- Ensure ArgoCD allows Applications in the `team-api` namespace.

### Alloy pods fail to start

- Verify the mTLS secret exists and has keys `tls.crt` and `tls.key`.
- Verify the endpoints are reachable from the client cluster:

  ```bash
  kubectl -n team-api run debug --rm -it --image=curlimages/curl -- \
    curl -I https://logs.mgmt.example.com
  ```

- Check Alloy logs:

  ```bash
  kubectl -n team-api logs -l app.kubernetes.io/name=alloy
  ```

### No logs or metrics arriving

- Confirm `modules.logs` and `modules.metrics` are `true`.
- Confirm the management plane accepts the `X-Scope-OrgID` header value.
- Confirm the mTLS certificate is signed by the issuer the management plane
  trusts.

### kubelet/cAdvisor or API server metrics are missing

- Confirm `modules.kubelet` / `modules.kubeApiServer` are `true`.
- Confirm the `<name>-node-scrape` ClusterRole and ClusterRoleBinding exist:

  ```bash
  kubectl get clusterrole,clusterrolebinding team-api-agent-node-scrape
  ```

- Check Alloy logs for 403 errors against the kubelet — some managed
  Kubernetes offerings restrict kubelet `/metrics` access.

### PrometheusRule is not created

- Confirm `modules.rules.enabled` is `true`.
- Confirm the prometheus-operator CRDs are installed:

  ```bash
  kubectl get crd prometheusrules.monitoring.coreos.com
  ```
