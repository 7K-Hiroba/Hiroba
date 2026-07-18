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
```

- `modules.logs` and `modules.metrics` are optional and default to `true`.
- When `modules.logs` is `true`, the chart mounts `/var/log` and
  `/var/lib/docker/containers` from the host so Alloy can collect container
  logs.
- `tenantId` is optional. If omitted, `team` is used as the `X-Scope-OrgID`
  value.
- `logsEndpoint` and `metricsEndpoint` are provided by the platform team.
- `mtls.certSecretName` must match the secret from step 1.

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

Check the ArgoCD Application:

```bash
kubectl -n team-api get application team-api-agent -o yaml
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

To tune chart values (resource limits, node selectors, tolerations), edit
`clients/team-api/observability/alloy-agent.yaml` in the overrides repo. The
platform wiring in the RGD cannot be overridden from that file.

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
