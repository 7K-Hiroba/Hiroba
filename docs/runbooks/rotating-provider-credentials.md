# Rotating Provider Credentials

1. Update the `ProviderConfig` secret in the target cluster.
2. Verify provider pods restart and reconnect:
   ```bash
   kubectl rollout restart deployment -n crossplane-system
   ```
3. Check provider health:
   ```bash
   kubectl get providers.pkg.crossplane.io
   ```
4. Trigger reconciliation of affected XRs:
   ```bash
   kubectl annotate <xr-kind> <xr-name> crossplane.io/paused=false --overwrite
   ```
