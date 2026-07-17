# Migrating a Stack from the Orchestrator to KRO

Use this runbook when moving a product stack out of `function-platform` and into
a KRO `ResourceGraphDefinition`.

## When to migrate

Migrate when the stack is primarily concerned with stitching together Helm
releases and consuming Hiroba primitives. Keep the stack in the orchestrator if
it needs deep provider branching, provider config resolution, or dependency
gating that KRO cannot express.

## Migration steps

### 1. Remove the orchestrator handler

- Delete `functions/platform/handlers/<stack>.go` and its unit tests.
- Remove the handler registration from `functions/platform/cmd/main.go`.
- Remove the stack kind from `contract/contract.json` if it was listed there.
- Regenerate the contract: `npm run gen:contract`.

### 2. Remove or shrink TypeScript packages

If the consumer repo shipped cdk8s packages for the stack's child XRDs
(`GrafanaInstance`, `LokiInstance`, ...):

- Delete the packages or reduce them to documentation-only.
- Keep the consumer SDK focused on primitives if that is the new boundary.

### 3. Create the RGD

Create `stacks/<stack>/rg.yaml`:

- Define the XR schema (`spec.profile`, `spec.team`, `spec.costCenter`, modules).
- Emit Hiroba primitives as child resources with deterministic names.
- Emit one ArgoCD Application per Helm chart.
- Use multi-source Applications with a per-team values file and a `valuesObject`
  for platform wiring.
- Add `includeWhen` for optional modules and `readyWhen` for primitive
  dependencies.

### 4. Preserve naming contracts

Helm charts must use `fullnameOverride` so that service names are deterministic.
The RGD and any downstream wiring rely on those names.

Example:

```yaml
valuesObject:
  fullnameOverride: ${schema.metadata.name}-loki
```

### 5. Move wiring config out of inline values

If a component's config is large (e.g. Alloy River config), emit it as a
`ConfigMap` managed by the RGD and reference the ConfigMap from the Helm chart:

```yaml
alloy:
  configMap:
    create: false
    name: ${riverConfig.metadata.name}
```

This keeps the RGD readable and allows the config to be unit-tested separately.

### 6. Validate

```bash
bash scripts/validate-stacks.sh
```

### 7. Test locally on kind

```bash
scripts/e2e-setup.sh platform-e2e
bash scripts/e2e-observability-stacks.sh platform-e2e
```

### 8. Update documentation

- Add or update the stack entry in `stacks/README.md`.
- Add an ADR if the migration changes a prior decision.
- Add runbooks for operational tasks.

## Rollback

If the migrated stack fails in production:

1. Re-apply the previous Crossplane Composition / XRD versions.
2. Restore the orchestrator handler and `cmd/main.go` registration.
3. Delete the RGD (`kubectl delete -f stacks/<stack>/rg.yaml`). ArgoCD will
   remove the Applications it managed unless deletion policy is Orphan.
