# Manual Resource Cleanup

If a deletion policy of `Orphan` leaves resources behind:

1. Identify orphaned resources by label:
   ```bash
   kubectl get managed -l crossplane.io/composite=<xr-name>
   ```

2. Delete orphaned resources manually:
   ```bash
   kubectl delete <kind> <name>
   ```

3. For cloud resources, use the AWS console or CLI to verify cleanup.

4. Update the XR deletion policy before re-creating if cleanup is desired:
   ```yaml
   spec:
     deletionPolicy: Delete
   ```
