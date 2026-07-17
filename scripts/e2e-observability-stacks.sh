#!/usr/bin/env bash
# End-to-end test for Hiroba observability KRO stacks on a kind cluster.
#
# This script assumes scripts/e2e-setup.sh has already prepared a kind cluster
# with Crossplane, ESO, CNPG, provider-helm, and function-platform. If the
# cluster does not exist, it bootstraps one first.
#
# The test:
#   - installs KRO and ArgoCD;
#   - installs the Hiroba primitive XRDs/Compositions;
#   - applies the observability RGDs;
#   - creates an ObservabilityAgent and asserts the generated ConfigMap + ArgoCD
#     Application are wired correctly;
#   - creates an ObservabilityStack and asserts the child ObjectBucket/Postgres
#     XRs are created.
#
# The full stack sync requires a Garage operator, which is not installed here;
# this test therefore validates the RGD wiring up to the readyWhen gate.
set -euo pipefail

CLUSTER_NAME="${1:-platform-e2e}"
CTX="kind-${CLUSTER_NAME}"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
KRO_VERSION="${KRO_VERSION:-0.9.1}"
ARGOCD_VERSION="${ARGOCD_VERSION:-v2.12.3}"

log() { echo "=== $* ==="; }

command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "openssl is required" >&2; exit 1; }

if ! kubectl --context "${CTX}" cluster-info >/dev/null 2>&1; then
  log "kind cluster not reachable; running scripts/e2e-setup.sh"
  bash "${REPO}/scripts/e2e-setup.sh" "${CLUSTER_NAME}"
fi

kubectl config use-context "${CTX}" >/dev/null

# -----------------------------------------------------------------------------
# Build primitive manifests if they are missing.
# -----------------------------------------------------------------------------
if [ ! -f "${REPO}/packages/object-storage/dist/composition.k8s.yaml" ] || \
   [ ! -f "${REPO}/packages/postgres/dist/composition.k8s.yaml" ]; then
  log "Building primitive packages"
  (cd "${REPO}" && npm run build -w @7k-hiroba/shared)
  (cd "${REPO}" && npm run synth -w @7k-hiroba/object-storage)
  (cd "${REPO}" && npm run synth -w @7k-hiroba/postgres)
fi

# -----------------------------------------------------------------------------
# Install primitives.
# -----------------------------------------------------------------------------
log "Installing primitive XRDs and Compositions"
kubectl --context "${CTX}" apply -f "${REPO}/packages/object-storage/dist/xrd.k8s.yaml"
kubectl --context "${CTX}" apply -f "${REPO}/packages/object-storage/dist/composition.k8s.yaml"
kubectl --context "${CTX}" apply -f "${REPO}/packages/postgres/dist/xrd.k8s.yaml"
kubectl --context "${CTX}" apply -f "${REPO}/packages/postgres/dist/composition.k8s.yaml"

# -----------------------------------------------------------------------------
# Install KRO.
# -----------------------------------------------------------------------------
log "Installing KRO ${KRO_VERSION}"
helm --kube-context "${CTX}" upgrade --install kro \
  oci://registry.k8s.io/kro/charts/kro \
  --namespace kro-system \
  --create-namespace \
  --version "${KRO_VERSION}" \
  --wait

# -----------------------------------------------------------------------------
# Install ArgoCD with apps-in-any-namespace enabled.
# -----------------------------------------------------------------------------
log "Installing ArgoCD ${ARGOCD_VERSION}"
kubectl --context "${CTX}" create namespace argocd --dry-run=client -o yaml | kubectl --context "${CTX}" apply -f -
kubectl --context "${CTX}" apply -n argocd \
  -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml"

kubectl --context "${CTX}" -n argocd wait --for=condition=Established crd applications.argoproj.io --timeout=120s

kubectl --context "${CTX}" -n argocd patch configmap argocd-cm --type merge \
  -p '{"data":{"application.namespaces":"*"}}'

kubectl --context "${CTX}" -n argocd rollout restart deployment argocd-server
kubectl --context "${CTX}" -n argocd rollout restart statefulset argocd-application-controller
kubectl --context "${CTX}" -n argocd rollout status deployment argocd-server --timeout=300s
kubectl --context "${CTX}" -n argocd rollout status statefulset argocd-application-controller --timeout=300s

# -----------------------------------------------------------------------------
# Apply RGDs.
# -----------------------------------------------------------------------------
log "Applying observability RGDs"
kubectl --context "${CTX}" apply -f "${REPO}/stacks/observability/rg.yaml"
kubectl --context "${CTX}" apply -f "${REPO}/stacks/observability-agent/rg.yaml"

kubectl --context "${CTX}" wait --for=condition=Ready \
  resourcegraphdefinition.kro.run/observabilitystack.platform.7kgroup.org \
  --timeout=120s
kubectl --context "${CTX}" wait --for=condition=Ready \
  resourcegraphdefinition.kro.run/observabilityagent.platform.7kgroup.org \
  --timeout=120s

# -----------------------------------------------------------------------------
# Test ObservabilityAgent.
# -----------------------------------------------------------------------------
log "Testing ObservabilityAgent"
kubectl --context "${CTX}" create namespace team-obs --dry-run=client -o yaml | kubectl --context "${CTX}" apply -f -

CERT_DIR="$(mktemp -d)"
openssl req -x509 -newkey rsa:2048 \
  -keyout "${CERT_DIR}/tls.key" \
  -out "${CERT_DIR}/tls.crt" \
  -days 1 -nodes -subj "/CN=team-obs-agent" >/dev/null 2>&1
kubectl --context "${CTX}" -n team-obs create secret tls example-agent-mtls \
  --cert="${CERT_DIR}/tls.crt" --key="${CERT_DIR}/tls.key" \
  --dry-run=client -o yaml | kubectl --context "${CTX}" apply -f -
rm -rf "${CERT_DIR}"

kubectl --context "${CTX}" apply -n team-obs -f - <<'EOF'
apiVersion: platform.7kgroup.org/v1alpha1
kind: ObservabilityAgent
metadata:
  name: example-agent
spec:
  profile: development
  team: team-obs
  costCenter: cc-e2e
  logsEndpoint: https://logs.example.com/loki/api/v1/push
  metricsEndpoint: https://metrics.example.com/api/v1/push
  tenantId: e2e-tenant
  mtls:
    certSecretName: example-agent-mtls
EOF

log "Waiting for agent resources"
for _ in $(seq 1 60); do
  if kubectl --context "${CTX}" -n team-obs get configmap/example-agent-river-config >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-obs get application.argoproj.io/example-agent >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

kubectl --context "${CTX}" -n team-obs get configmap example-agent-river-config
kubectl --context "${CTX}" -n team-obs get application.argoproj.io example-agent

RIVER_CONFIG="$(mktemp)"
kubectl --context "${CTX}" -n team-obs get configmap example-agent-river-config \
  -o jsonpath='{.data.config\.alloy}' > "${RIVER_CONFIG}"

log "Asserting River config content"
grep -q 'url = "https://metrics.example.com/api/v1/push"' "${RIVER_CONFIG}"
grep -q 'url = "https://logs.example.com/loki/api/v1/push"' "${RIVER_CONFIG}"
grep -q '"X-Scope-OrgID" = "e2e-tenant"' "${RIVER_CONFIG}"
grep -q 'cert_file = "/etc/alloy/certs/tls.crt"' "${RIVER_CONFIG}"
grep -q 'key_file = "/etc/alloy/certs/tls.key"' "${RIVER_CONFIG}"
rm -f "${RIVER_CONFIG}"

APP_JSON="$(kubectl --context "${CTX}" -n team-obs get application.argoproj.io example-agent -o json)"
log "Asserting ArgoCD Application wiring"
echo "${APP_JSON}" | jq -e '.spec.sources[0].helm.valuesObject.alloy.configMap.create == false' >/dev/null
echo "${APP_JSON}" | jq -e '.spec.sources[0].helm.valuesObject.alloy.configMap.name == "example-agent-river-config"' >/dev/null
echo "${APP_JSON}" | jq -e '.spec.sources[0].helm.valuesObject.volumes[0].secret.secretName == "example-agent-mtls"' >/dev/null

# -----------------------------------------------------------------------------
# Test ObservabilityStack wiring (partial: child XRs are created).
# -----------------------------------------------------------------------------
log "Testing ObservabilityStack child XRs"
kubectl --context "${CTX}" apply -n team-obs -f - <<'EOF'
apiVersion: platform.7kgroup.org/v1alpha1
kind: ObservabilityStack
metadata:
  name: example-stack
spec:
  profile: development
  team: team-obs
  costCenter: cc-e2e
  modules:
    grafana:
      enabled: true
    loki:
      enabled: true
    metrics:
      enabled: true
      backend: mimir
    alloy:
      enabled: false
EOF

log "Waiting for child ObjectBuckets and PostgresInstance"
for res in objectbucket.platform.7kgroup.org/example-stack-loki-bucket \
           objectbucket.platform.7kgroup.org/example-stack-mimir-bucket \
           postgresinstance.platform.7kgroup.org/example-stack-grafana-db; do
  for _ in $(seq 1 60); do
    if kubectl --context "${CTX}" -n team-obs get "${res}" >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done
  kubectl --context "${CTX}" -n team-obs get "${res}"
done

log "Observability stacks e2e passed"
