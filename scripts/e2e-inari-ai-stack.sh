#!/usr/bin/env bash
# End-to-end test for the InariAIStack KRO stack on a kind cluster.
#
# This script assumes scripts/e2e-setup.sh has already prepared a kind cluster
# with Crossplane, ESO, CNPG, provider-helm, and function-platform. If the
# cluster does not exist, it bootstraps one first.
#
# The test:
#   - installs KRO and ArgoCD (apps-in-any-namespace);
#   - installs the Hiroba primitive XRDs/Compositions and Gateway API CRDs;
#   - applies the InariAIStack RGD;
#   - creates an InariAIStack and asserts the generated ArgoCD Applications,
#     ExternalSecrets, AgentGateway static config, child XRs and HTTPRoute are
#     wired correctly, including negative assertions for disabled modules.
#
# Full sync requires Vault, Keycloak and the upstream cnoe-io charts, which are
# not installed here; this test therefore validates the RGD wiring only.
set -euo pipefail

CLUSTER_NAME="${1:-platform-e2e}"
CTX="kind-${CLUSTER_NAME}"
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
KRO_VERSION="${KRO_VERSION:-0.9.1}"
ARGOCD_VERSION="${ARGOCD_VERSION:-v2.12.3}"
GATEWAY_API_VERSION="${GATEWAY_API_VERSION:-v1.3.0}"

log() { echo "=== $* ==="; }

command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 1; }

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
# Install Gateway API CRDs (for the UI HTTPRoute).
# -----------------------------------------------------------------------------
log "Installing Gateway API CRDs ${GATEWAY_API_VERSION}"
kubectl --context "${CTX}" apply -f \
  "https://github.com/kubernetes-sigs/gateway-api/releases/download/${GATEWAY_API_VERSION}/standard-install.yaml"

# -----------------------------------------------------------------------------
# Apply the RGD.
# -----------------------------------------------------------------------------
log "Applying InariAIStack RGD"
kubectl --context "${CTX}" apply -f "${REPO}/stacks/inari-ai/rg.yaml"

kubectl --context "${CTX}" wait --for=condition=Ready \
  resourcegraphdefinition.kro.run/inariaistack.platform.7kgroup.org \
  --timeout=120s

# -----------------------------------------------------------------------------
# Test InariAIStack.
# -----------------------------------------------------------------------------
log "Testing InariAIStack"
kubectl --context "${CTX}" create namespace team-ai --dry-run=client -o yaml | kubectl --context "${CTX}" apply -f -

# spec.version is pinned to a fake tag on purpose: every component Application
# must carry it as targetRevision, which is asserted below.
kubectl --context "${CTX}" apply -n team-ai -f - <<'EOF'
apiVersion: platform.7kgroup.org/v1alpha1
kind: InariAIStack
metadata:
  name: example-ai
spec:
  profile: development
  team: team-ai
  costCenter: cc-e2e
  version: 0.0.0-e2e
  domain: ai.e2e.example.com
  identity:
    keycloakURL: http://keycloak.iam.svc:8080
    oidcIssuer: https://sso.e2e.example.com/realms/7kgroup
  secrets:
    storeName: platform-vault
EOF

log "Waiting for InariAIStack resources"
for _ in $(seq 1 90); do
  if kubectl --context "${CTX}" -n team-ai get postgresinstance.platform.7kgroup.org/example-ai-openfga-db >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get configmap/example-ai-agentgateway-static-config >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get application.argoproj.io/example-ai-ui >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get application.argoproj.io/example-ai-dynamic-agents >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get application.argoproj.io/example-ai-audit-service >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get application.argoproj.io/example-ai-skill-scanner >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get application.argoproj.io/example-ai-mcp-argocd >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get application.argoproj.io/example-ai-mcp-backstage >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get application.argoproj.io/example-ai-agentgateway >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get application.argoproj.io/example-ai-openfga >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get application.argoproj.io/example-ai-mongodb >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get externalsecret.external-secrets.io/example-ai-llm-secret >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get externalsecret.external-secrets.io/example-ai-github-pat-secret >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get externalsecret.external-secrets.io/example-ai-github-secret >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get externalsecret.external-secrets.io/example-ai-argocd-secret >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get externalsecret.external-secrets.io/example-ai-backstage-secret >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get externalsecret.external-secrets.io/example-ai-agentgateway-config-bridge-token >/dev/null 2>&1 \
     && kubectl --context "${CTX}" -n team-ai get httproute.gateway.networking.k8s.io/example-ai >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

kubectl --context "${CTX}" -n team-ai get postgresinstance.platform.7kgroup.org example-ai-openfga-db
kubectl --context "${CTX}" -n team-ai get applications
kubectl --context "${CTX}" -n team-ai get externalsecrets
kubectl --context "${CTX}" -n team-ai get httproute example-ai

log "Asserting negative gates (ragStack disabled by default)"
if kubectl --context "${CTX}" -n team-ai get application.argoproj.io/example-ai-rag-stack >/dev/null 2>&1; then
  echo "FAIL: example-ai-rag-stack Application should not exist (ragStack disabled)" >&2
  exit 1
fi
if kubectl --context "${CTX}" -n team-ai get objectbucket.platform.7kgroup.org/example-ai-milvus-bucket >/dev/null 2>&1; then
  echo "FAIL: example-ai-milvus-bucket ObjectBucket should not exist (ragStack disabled)" >&2
  exit 1
fi

log "Asserting AgentGateway static config"
STATIC_CONFIG="$(mktemp)"
kubectl --context "${CTX}" -n team-ai get configmap example-ai-agentgateway-static-config \
  -o jsonpath='{.data.config\.yaml}' > "${STATIC_CONFIG}"
grep -q 'pathPrefix: "/mcp/argocd"' "${STATIC_CONFIG}"
grep -q 'pathPrefix: "/mcp/backstage"' "${STATIC_CONFIG}"
grep -q 'pathPrefix: "/mcp/github"' "${STATIC_CONFIG}"
grep -q 'example-ai-mcp-argocd-mcp.team-ai.svc.cluster.local:8000/mcp' "${STATIC_CONFIG}"
if grep -q 'pathPrefix: "/mcp/knowledge-base"' "${STATIC_CONFIG}"; then
  echo "FAIL: knowledge-base route should not exist (ragStack disabled)" >&2
  exit 1
fi
rm -f "${STATIC_CONFIG}"

log "Asserting ArgoCD Application wiring"
UI_APP_JSON="$(kubectl --context "${CTX}" -n team-ai get application.argoproj.io example-ai-ui -o json)"
echo "${UI_APP_JSON}" | jq -e '.spec.sources[0].targetRevision == "0.0.0-e2e"' >/dev/null
echo "${UI_APP_JSON}" | jq -e '.spec.sources[0].helm.releaseName == "example-ai-ui"' >/dev/null
echo "${UI_APP_JSON}" | jq -e '.spec.sources[0].helm.valuesObject.config.KEYCLOAK_URL == "http://keycloak.iam.svc:8080"' >/dev/null
echo "${UI_APP_JSON}" | jq -e '.spec.sources[0].helm.valuesObject.config.OIDC_ISSUER == "https://sso.e2e.example.com/realms/7kgroup"' >/dev/null
echo "${UI_APP_JSON}" | jq -e '.spec.sources[0].helm.valuesObject.externalSecrets.secretStoreRef.name == "platform-vault"' >/dev/null

for app in example-ai-dynamic-agents example-ai-audit-service example-ai-skill-scanner \
           example-ai-mcp-argocd example-ai-mcp-backstage example-ai-agentgateway \
           example-ai-openfga example-ai-mongodb; do
  kubectl --context "${CTX}" -n team-ai get application.argoproj.io "${app}" \
    -o jsonpath='{.spec.sources[0].targetRevision}' | grep -q '0.0.0-e2e'
done

AGW_APP_JSON="$(kubectl --context "${CTX}" -n team-ai get application.argoproj.io example-ai-agentgateway -o json)"
echo "${AGW_APP_JSON}" | jq -e '.spec.sources[0].helm.releaseName == "example-ai"' >/dev/null
echo "${AGW_APP_JSON}" | jq -e '.spec.sources[0].helm.valuesObject.global.agentgateway.routingMode == "static"' >/dev/null

OPENFGA_APP_JSON="$(kubectl --context "${CTX}" -n team-ai get application.argoproj.io example-ai-openfga -o json)"
echo "${OPENFGA_APP_JSON}" | jq -e '.spec.sources[0].helm.valuesObject.datastore.engine == "postgres"' >/dev/null

MONGO_APP_JSON="$(kubectl --context "${CTX}" -n team-ai get application.argoproj.io example-ai-mongodb -o json)"
echo "${MONGO_APP_JSON}" | jq -e '.spec.sources[0].helm.valuesObject.persistence.size == "5Gi"' >/dev/null

log "Asserting HTTPRoute"
ROUTE_JSON="$(kubectl --context "${CTX}" -n team-ai get httproute example-ai -o json)"
echo "${ROUTE_JSON}" | jq -e '.spec.hostnames[0] == "ai.e2e.example.com"' >/dev/null
echo "${ROUTE_JSON}" | jq -e '.spec.rules[0].backendRefs[0].name == "example-ai-caipe-ui"' >/dev/null
echo "${ROUTE_JSON}" | jq -e '.spec.rules[0].backendRefs[0].port == 3000' >/dev/null

log "Asserting ExternalSecrets point at the mock store"
LLM_SECRET_JSON="$(kubectl --context "${CTX}" -n team-ai get externalsecret example-ai-llm-secret -o json)"
echo "${LLM_SECRET_JSON}" | jq -e '.spec.secretStoreRef.name == "platform-vault"' >/dev/null
echo "${LLM_SECRET_JSON}" | jq -e '[.spec.data[].remoteRef.key] | contains(["caipe/llm"])' >/dev/null

log "InariAIStack e2e passed"
