#!/usr/bin/env bash
# Bootstrap a local kind cluster for platform e2e testing.
#
# Installs: Crossplane, AWS providers (v2 namespaced), ESO (+ mock store),
# the CNPG operator, provider-helm, and the function-platform orchestrator
# built from source and served from a local OCI registry on the kind network.
#
# Prerequisites: kind, kubectl, helm, docker, go.
# The crossplane CLI (crank) is installed automatically if missing.
# Usage: scripts/e2e-setup.sh [kind-cluster-name]
set -euo pipefail

CLUSTER_NAME="${1:-platform-e2e}"
CTX="kind-${CLUSTER_NAME}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGISTRY_NAME="kind-registry"

if ! kubectl config get-contexts "${CTX}" >/dev/null 2>&1 && kind get clusters | grep -qx "${CLUSTER_NAME}"; then
  echo "kind cluster exists but kube context ${CTX} is missing" >&2
  exit 1
fi

echo "=== Bootstrapping kind cluster '${CLUSTER_NAME}' ==="

if ! kind get clusters | grep -qx "${CLUSTER_NAME}"; then
  kind create cluster --name "${CLUSTER_NAME}"
  kubectl config use-context "${CTX}" >/dev/null
fi

# --- Homelab DNS workaround -------------------------------------------------
# Two environment quirks break in-cluster resolution here:
#  1. The internal resolver answers ANY *.homelab.lan name with the gateway IP
#     (10.0.0.56). Pods use ndots:5 search-domain resolution, so e.g.
#     xpkg.crossplane.io.homelab.lan matches the wildcard before the absolute
#     name is tried. CoreDNS is patched to NXDOMAIN multi-label *.homelab.lan
#     names so resolution falls through to the absolute name.
#  2. musl-based images (alpine nginx, e.g. loki-distributed gateway) abort the
#     search list on that NXDOMAIN instead of continuing. Dropping homelab.lan
#     from the node resolv.conf keeps it out of pod search domains.
NODE="${CLUSTER_NAME}-control-plane"
if docker exec "${NODE}" grep -q "^search homelab.lan" /etc/resolv.conf 2>/dev/null; then
  echo "=== Removing homelab.lan from node search domains ==="
  docker exec "${NODE}" sh -c 'grep -v "^search homelab.lan" /etc/resolv.conf > /tmp/r.conf && cat /tmp/r.conf > /etc/resolv.conf'
  docker exec "${NODE}" sh -c 'kill -TERM $(pidof kubelet)' || true
  sleep 10
fi

echo "=== Patching CoreDNS (multi-label *.homelab.lan -> NXDOMAIN) ==="
kubectl --context "${CTX}" -n kube-system get configmap coredns -o jsonpath='{.data.Corefile}' | grep -q "homelab.lan" || {
  kubectl --context "${CTX}" -n kube-system get configmap coredns -o yaml > /tmp/coredns.yaml
  python3 - <<'PYEOF'
s = open('/tmp/coredns.yaml').read()
s = s.replace('''        forward . /etc/resolv.conf {
           max_concurrent 1000
        }''', '''        template ANY ANY homelab.lan {
           match ".*\\\\.[^.]+\\\\.homelab\\\\.lan\\\\."
           rcode NXDOMAIN
        }
        forward . /etc/resolv.conf {
           max_concurrent 1000
        }''')
open('/tmp/coredns.yaml', 'w').write(s)
PYEOF
  kubectl --context "${CTX}" apply -f /tmp/coredns.yaml
  kubectl --context "${CTX}" -n kube-system rollout restart deployment coredns
}

echo "=== Installing Crossplane ==="
helm repo add crossplane-stable https://charts.crossplane.io/stable >/dev/null 2>&1 || true
helm repo update >/dev/null
helm upgrade --install crossplane crossplane-stable/crossplane --kube-context "${CTX}" \
  --namespace crossplane-system \
  --create-namespace \
  --wait

echo "=== Installing AWS providers (v2 namespaced) ==="
# AWS providers are only needed for the aws/s3 provider paths; the default
# cnpg/garage paths work without them. Tolerate failure (e.g. offline clusters).
if ! kubectl --context "${CTX}" apply -f "$REPO/infrastructure/crossplane-control-plane/providers.yaml"; then
  echo "WARN: provider install failed; continuing (cnpg/garage paths do not need them)"
else
  kubectl --context "${CTX}" wait --for=condition=Installed provider.pkg.crossplane.io --all --timeout=300s || \
    echo "WARN: providers not fully installed; AWS-backed XRs will not reconcile"
fi
# Apply namespaced ProviderConfigs only when their CRD exists.
if kubectl --context "${CTX}" get crd providerconfigs.aws.m.upbound.io >/dev/null 2>&1; then
  kubectl --context "${CTX}" apply -f "$REPO/infrastructure/crossplane-control-plane/providers.yaml"
else
  echo "WARN: providerconfigs.aws.m.upbound.io CRD missing; skipping ProviderConfig creation"
fi

echo "=== Installing ESO ==="
helm repo add external-secrets https://charts.external-secrets.io >/dev/null 2>&1 || true
helm repo update >/dev/null
helm upgrade --install external-secrets external-secrets/external-secrets --kube-context "${CTX}" \
  --namespace external-secrets \
  --create-namespace \
  --wait
kubectl --context "${CTX}" wait --for=condition=Established crd clustersecretstores.external-secrets.io --timeout=120s
kubectl --context "${CTX}" apply -f "$REPO/test/fixtures/mock-secret-store.yaml"

echo "=== Installing the CNPG operator ==="
helm repo add cnpg https://cloudnative-pg.github.io/charts >/dev/null 2>&1 || true
helm repo update >/dev/null
helm upgrade --install cnpg cnpg/cloudnative-pg --kube-context "${CTX}" \
  --namespace cnpg-system \
  --create-namespace \
  --wait
kubectl --context "${CTX}" wait --for=condition=Established crd clusters.postgresql.cnpg.io --timeout=120s

echo "=== Granting Crossplane RBAC for CNPG composed resources ==="
kubectl --context "${CTX}" apply -f - <<'EOF'
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: crossplane:composed:cnpg
  labels:
    rbac.crossplane.io/aggregate-to-crossplane: "true"
rules:
  - apiGroups: ["postgresql.cnpg.io"]
    resources: ["*"]
    verbs: ["*"]
EOF

echo "=== Installing provider-helm ==="
kubectl --context "${CTX}" apply -f - <<'EOF'
apiVersion: pkg.crossplane.io/v1
kind: Provider
metadata:
  name: provider-helm
spec:
  package: xpkg.upbound.io/crossplane-contrib/provider-helm:v1.0.2
EOF
kubectl --context "${CTX}" wait --for=condition=Healthy provider.pkg.crossplane.io/provider-helm --timeout=600s

echo "=== Granting provider-helm RBAC (charts create namespaces/cluster resources) ==="
HELM_SA=$(kubectl --context "${CTX}" get serviceaccounts -n crossplane-system -o name | grep provider-helm | head -1 | cut -d/ -f2)
kubectl --context "${CTX}" apply -f - <<EOF
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: provider-helm-cluster-admin
subjects:
  - kind: ServiceAccount
    name: ${HELM_SA}
    namespace: crossplane-system
roleRef:
  kind: ClusterRole
  name: cluster-admin
  apiGroup: rbac.authorization.k8s.io
EOF
# NOTE: cluster-admin is acceptable for the local e2e cluster only. Production
# must scope the provider-helm SA to the exact verbs the charts require.

echo "=== Starting local OCI registry on the kind network ==="
if ! docker ps --format '{{.Names}}' | grep -qx "${REGISTRY_NAME}"; then
  docker rm -f "${REGISTRY_NAME}" >/dev/null 2>&1 || true
  docker run -d --restart=unless-stopped --network kind -p 127.0.0.1:5000:5000 --name "${REGISTRY_NAME}" registry:2 >/dev/null
fi
REG_IP=$(docker inspect -f "{{.NetworkSettings.Networks.kind.IPAddress}}" "${REGISTRY_NAME}")
echo "registry: ${REG_IP}:5000 (also reachable as localhost:5000 on the host)"

# containerd on the kind node must treat the registry as plain HTTP.
docker exec "${NODE}" sh -c "mkdir -p /etc/containerd/certs.d/${REG_IP}:5000 && cat > /etc/containerd/certs.d/${REG_IP}:5000/hosts.toml <<EOF
server = \"http://${REG_IP}:5000\"
[host.\"http://${REG_IP}:5000\"]
  capabilities = [\"pull\", \"resolve\", \"push\"]
  skip_verify = true
EOF"

if ! command -v crossplane >/dev/null 2>&1; then
  echo "=== Installing crossplane CLI (crank) ==="
  CROSSPLANE_CLI_VERSION="v2.3.3"
  curl -sL "https://releases.crossplane.io/stable/${CROSSPLANE_CLI_VERSION}/bin/linux_amd64/crank" -o /tmp/crossplane
  chmod +x /tmp/crossplane
  sudo mv /tmp/crossplane /usr/local/bin/crossplane 2>/dev/null || mv /tmp/crossplane "${HOME}/.local/bin/crossplane"
  command -v crossplane >/dev/null 2>&1 || export PATH="${HOME}/.local/bin:${PATH}"
fi

echo "=== Building and publishing function-platform (xpkg) ==="
# Crossplane's package cache cannot use kind-loaded images, so the function is
# packaged as an xpkg and pushed to the local registry.
docker build -q -t xpkg.crossplane.io/local/function-platform:dev "$REPO/functions/platform" >/dev/null
docker save xpkg.crossplane.io/local/function-platform:dev -o /tmp/function-platform.tar >/dev/null
# -e points at a nonexistent dir: the CLI would otherwise default --examples-root
# to ./examples and fail parsing the cdk8s.yaml configs there.
crossplane xpkg build -f "$REPO/functions/platform/package" \
  -e "$REPO/.xpkg-no-examples" \
  --embed-runtime-image-tarball=/tmp/function-platform.tar \
  -o /tmp/function-platform.xpkg >/dev/null
XPKG_ID=$(docker load -i /tmp/function-platform.xpkg | grep -o 'sha256:[a-f0-9]*' | head -1)
docker tag "${XPKG_ID}" localhost:5000/function-platform:dev
# Resolve the registry manifest digest from the push output. With the classic
# docker image store the image ID is the *config* digest, which the registry
# cannot serve as a manifest (the function pod then ImagePullBackOffs).
XPKG_DIGEST=$(docker push localhost:5000/function-platform:dev | grep -oE 'sha256:[a-f0-9]{64}' | tail -1)
rm -f /tmp/function-platform.tar /tmp/function-platform.xpkg

kubectl --context "${CTX}" apply -f - <<EOF
apiVersion: pkg.crossplane.io/v1beta1
kind: Function
metadata:
  name: function-platform
spec:
  package: ${REG_IP}:5000/function-platform@${XPKG_DIGEST}
EOF
if ! kubectl --context "${CTX}" wait --for=condition=Healthy function.pkg.crossplane.io/function-platform --timeout=300s; then
  echo "!!! function-platform did not become Healthy; diagnostics:" >&2
  kubectl --context "${CTX}" describe function.pkg.crossplane.io/function-platform >&2 || true
  kubectl --context "${CTX}" get pods -n crossplane-system >&2 || true
  kubectl --context "${CTX}" describe pods -n crossplane-system -l pkg.crossplane.io/function=function-platform >&2 || true
  exit 1
fi


echo "=== Granting function-platform CRD read access (dependency gate) ==="
kubectl --context "${CTX}" apply -f "$REPO/infrastructure/crossplane-control-plane/function-rbac.yaml"
# The function's SA is named after the active FunctionRevision.
FN_REV=$(kubectl --context "${CTX}" get functionrevision.pkg.crossplane.io -o jsonpath='{.items[?(@.spec.desiredState=="Active")].metadata.name}' | tr ' ' '\n' | head -1)
FN_SA="${FN_REV}"
kubectl --context "${CTX}" apply -f - <<RBAC
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: function-platform:crd-reader
subjects:
  - kind: ServiceAccount
    name: ${FN_SA}
    namespace: crossplane-system
roleRef:
  kind: ClusterRole
  name: function-platform:crd-reader
  apiGroup: rbac.authorization.k8s.io
RBAC

echo "=== Bootstrap complete ==="
echo "Next: install the primitives and products, then per-team setup:"
echo "  kubectl --context ${CTX} apply -f packages/postgres/dist/{xrd,composition}.k8s.yaml"
echo "  # per team namespace: namespaced helm ProviderConfig '<team>-helm' and"
echo "  # RoleBinding granting the provider-helm SA admin in the team namespace."
