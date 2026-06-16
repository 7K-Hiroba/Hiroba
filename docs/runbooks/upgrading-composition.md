# Upgrading a Composition

1. **Make changes** in the CDK8s source.
2. **Run tests and validation**:
   ```bash
   make test
   make synth
   make validate
   ```
3. **Apply the new Composition**:
   ```bash
   kubectl apply -f packages/<product>/dist/composition.k8s.yaml
   ```
4. **Verify existing XRs reconcile**:
   ```bash
   kubectl get <xr-kind> -w
   ```
5. **Rollback if needed**:
   ```bash
   kubectl apply -f packages/<product>/dist/composition.k8s.yaml  # previous version
   ```
