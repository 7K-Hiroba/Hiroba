#!/usr/bin/env bash
# Provision a team namespace with the per-team resources the platform expects:
# the namespace itself, a namespaced helm ProviderConfig (<team>-helm), and a
# RoleBinding granting the provider-helm SA admin in the team namespace
# (charts install arbitrary namespaced resources there).
#
# Usage: scripts/team-setup.sh <team> [kind-cluster-name]
set -euo pipefail

TEAM="${1:?usage: team-setup.sh <team> [kind-cluster-name]}"
CLUSTER_NAME="${2:-platform-e2e}"
CTX="kind-${CLUSTER_NAME}"

HELM_SA=$(kubectl --context "${CTX}" get serviceaccounts -n crossplane-system -o name | grep provider-helm | head -1 | cut -d/ -f2)
if [ -z "${HELM_SA}" ]; then
  echo "provider-helm service account not found; run scripts/e2e-setup.sh first" >&2
  exit 1
fi

kubectl --context "${CTX}" apply -f - <<MANIFEST
apiVersion: v1
kind: Namespace
metadata:
  name: ${TEAM}
  labels:
    team: ${TEAM}
---
apiVersion: helm.m.crossplane.io/v1beta1
kind: ProviderConfig
metadata:
  name: ${TEAM}-helm
  namespace: ${TEAM}
spec:
  credentials:
    source: InjectedIdentity
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: provider-helm-admin
  namespace: ${TEAM}
subjects:
  - kind: ServiceAccount
    name: ${HELM_SA}
    namespace: crossplane-system
roleRef:
  kind: ClusterRole
  name: admin
  apiGroup: rbac.authorization.k8s.io
MANIFEST
echo "team namespace '${TEAM}' ready"
