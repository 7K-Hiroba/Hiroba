#!/bin/bash
set -e

echo "=== Setting up E2E Kind cluster ==="

# Install Crossplane
helm repo add crossplane-stable https://charts.crossplane.io/stable || true
helm repo update
helm upgrade --install crossplane crossplane-stable/crossplane \
  --namespace crossplane-system \
  --create-namespace \
  --wait

# Install providers. First pass expected to partially fail: ProviderConfig CRDs
# are only registered once the provider packages below are installed, so the
# namespaced ProviderConfig in this file errors with "no matches for kind".
# It is created by the second apply after the CRD wait below.
kubectl apply -f infrastructure/crossplane-control-plane/providers.yaml || true

# Wait for providers to be Healthy (their CRDs are only registered after the
# packages are pulled and installed), then re-apply to create ProviderConfigs.
kubectl wait --for=condition=Healthy provider.pkg.crossplane.io --all --timeout=600s || true
kubectl wait --for=condition=Established crd providerconfigs.aws.m.upbound.io --timeout=300s || true
kubectl apply -f infrastructure/crossplane-control-plane/providers.yaml

# Wait for Crossplane core pods
kubectl wait --for=condition=Ready pod -l app=crossplane -n crossplane-system --timeout=120s || true

# Install ESO
helm repo add external-secrets https://charts.external-secrets.io || true
helm repo update
helm upgrade --install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace \
  --wait

# Create mock Vault SecretStore for testing
kubectl wait --for=condition=Established crd clustersecretstores.external-secrets.io --timeout=120s || true
kubectl apply -f test/fixtures/mock-secret-store.yaml

# Install the platform orchestrator function (ADR 007).
# TODO(phase-5): install function-platform from Harbor once the image is published;
# until then the function must be installed separately for e2e runs.

echo "=== E2E setup complete ==="
