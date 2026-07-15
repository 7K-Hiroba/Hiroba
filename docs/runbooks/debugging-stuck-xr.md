# Debugging a Stuck XR

## Symptoms

- `kubectl get <xr>` shows `SYNCED: False` or `READY: False`
- The claim is waiting for the composite resource to become ready

## Steps

1. **Describe the claim**:

   ```bash
   kubectl describe <claim-kind> <name> -n <namespace>
   ```

2. **Describe the XR**:

   ```bash
   kubectl describe <xr-kind> <name>
   ```

3. **Check events**:

   ```bash
   kubectl get events --field-selector involvedObject.name=<xr-name>
   ```

4. **Common causes**:
   - Missing Composition Function (`function-patch-and-transform` not healthy)
   - Missing provider CRDs
   - Invalid patch paths in Composition
   - Missing secrets referenced by ExternalSecret

5. **Render locally**:

   ```bash
   cd packages/<product>
   npm run validate
   ```
