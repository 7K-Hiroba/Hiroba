# Adding a New Provider to a Hiroba Product

This runbook describes how to add a new infrastructure backend (provider) to an existing Hiroba platform product.

## Overview

Hiroba uses a **provider-per-composition** pattern:

- One XRD defines the cloud-agnostic consumer API.
- One Composition implements the product for each supported provider.
- Compositions are selected via `spec.provider` + `compositionSelector`.

## Steps

### 1. Add the provider to shared types

Edit `packages/shared/src/types.ts`:

```ts
export type InfrastructureProvider = 'aws' | 'gcp' | 'azure' | 'garage' | 'cnpg' | 'myprovider';
```

Also update `StorageBackendType` if the provider introduces a new storage type.

### 2. Update the product XRD

Edit `packages/<product>/src/xrd.ts`:

- Add the new provider value to `spec.provider` enum.
- Add per-module provider overrides if applicable.

### 3. Create the provider-specific composition

Create `packages/<product>/src/compositions/<myprovider>.ts`:

- Import provider-specific CRDs (e.g., managed resources or operator CRDs).
  - Add the CRD URL to `cdk8s.yaml` and run `npm run import` to generate typed constructs.
  - Use `SomeResourceV1Beta1.manifest({ ... })` as the `base` of Crossplane patch-and-transform resources.
- Emit the concrete resources needed for the backend.
- Normalize connection secrets so downstream consumers see a stable shape.
- Use `createProviderCompositionName()` and `createProviderCompositionLabels()` from `@platform-engineering/shared`.
- Patch `spec.providerConfigRef.name` and `spec.region` (for cloud providers) from the composite into managed resources.
- For Garage, map `spec.providerConfigRef.name` to `spec.clusterRef.name`.

### 4. Register the composition

Edit `packages/<product>/src/composition.ts` to export the new composition.

Edit `packages/<product>/src/index.ts` to instantiate it during synthesis.

### 5. Add tests

Add snapshot tests in `packages/<product>/test/unit/snapshot.test.ts` that assert the new composition emits the expected resources and labels.

### 6. Update the consumer SDK

If the product is exposed through the TypeScript SDK, update the relevant props to accept the new provider and set `compositionSelector` accordingly.

### 7. Update examples and docs

Add or update example claims in `examples/` and update `docs/architecture.md`.

## Verification

```bash
npm run build
npm run test
npm run synth
```

For products with the Crossplane CLI installed:

```bash
npm run validate
```

## See also

- [ADR 006: Multi-Provider Compositions](../adr/006-multi-provider-compositions.md)
- [Architecture Overview](../architecture.md)
