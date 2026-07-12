# Platform Engineering Usage Guide

This guide explains how to consume platform products, create new applications, and
build new products on the orchestrator architecture (ADR 007).

## Table of Contents

1. [Concepts](#concepts)
2. [Quick Start](#quick-start)
3. [Using Existing Platform Products](#using-existing-platform-products)
4. [Creating a New Application](#creating-a-new-application)
5. [Creating a New Product Package](#creating-a-new-product-package)
6. [Validation and Deployment](#validation-and-deployment)
7. [Testing Patterns](#testing-patterns)

## Concepts

Infrastructure is modeled as **platform products** that teams request as namespaced
Kubernetes resources (Crossplane v2 XRs — there is no separate Claim model).

| Term                  | Description                                                                            |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Primitive Product** | A single reusable infrastructure abstraction (`PostgresInstance`, `ObjectBucket`).     |
| **Stack**             | A composite product orchestrating multiple children (`ObservabilityStack`).            |
| **XR**                | The namespaced composite resource a developer creates to request a product.            |
| **XRD**               | CompositeResourceDefinition (`apiextensions.crossplane.io/v2`). Defines the XR schema. |
| **Composition**       | Thin Pipeline composition delegating to the orchestrator function.                     |
| **Orchestrator**      | `function-platform`: the Go composition function that reconciles every kind.           |
| **Profile**           | Environment tier: `development`, `staging`, or `production`. Drives contract defaults. |
| **Feature Toggle**    | Optional capability under `spec.features.<name>.enabled` (e.g. HA, backups).           |

## Quick Start

### 1. Bootstrap a local cluster

```bash
scripts/e2e-setup.sh platform-e2e        # Crossplane, providers, ESO, CNPG, provider-helm, function-platform
scripts/team-setup.sh team-api           # per-team namespace + helm ProviderConfig + RoleBinding
```

### 2. Install product APIs

```bash
kubectl --context kind-platform-e2e apply \
  -f packages/postgres/dist/xrd.k8s.yaml \
  -f packages/postgres/dist/composition.k8s.yaml
```

### 3. Develop

```bash
bash scripts/pre-push-checks.sh   # contract check, lint, build, tests, synth, validate, go vet/test -race
npm run gen:contract              # regenerate TS + Go after editing contract/contract.json
```

## Using Existing Platform Products

### With kubectl

```yaml
apiVersion: platform.7kgroup.org/v1alpha1
kind: PostgresInstance
metadata:
  name: team-api-db
  namespace: team-api
spec:
  team: team-api
  profile: development
  costCenter: cc-12345
  features:
    ha:
      enabled: true
```

Status is the contract (Crossplane v2 has no XR connection secrets):

```bash
kubectl -n team-api get postgresinstance team-api-db \
  -o jsonpath='{.status.endpoint}{"\n"}{.status.phase}{"\n"}{.status.connectionSecretRef.name}{"\n"}'
# team-api-db-pg-rw.team-api.svc:5432
# Ready
# team-api-db-pg-app          <- CNPG operator secret (keys: username, password, dbname, host, port, uri)
```

### With the TypeScript Consumer SDK

```typescript
import { App } from 'cdk8s';
import { TeamObservability, PostgresInstance } from '@7k-hiroba/platform-consumer';

const app = new App({ outdir: 'dist' });

new PostgresInstance(app, 'db', {
  name: 'team-api-db',
  namespace: 'team-api',
  team: 'team-api',
  profile: 'development',
  costCenter: 'cc-12345',
});

new TeamObservability(app, 'obs', {
  name: 'team-api-obs',
  namespace: 'team-api',
  team: 'team-api',
  profile: 'development',
  modules: {
    grafana: { enabled: true, domain: 'grafana.team-api.example.com' },
    loki: { enabled: false },
    metrics: { enabled: true, backend: 'prometheus' },
    alloy: { enabled: true },
  },
});

app.synth();
```

```bash
npx ts-node src/main.ts && kubectl apply -f dist/
```

For products without a dedicated construct, use the generic `PlatformXr` construct
from the SDK.

## Creating a New Application

An application repository consumes products through the SDK:

```bash
mkdir examples/my-service && cd examples/my-service
npm init -y
npm install cdk8s @7k-hiroba/platform-consumer ts-node typescript
```

Write `src/main.ts` (see the SDK example above), then:

```bash
npx ts-node src/main.ts
kubectl apply -f dist/
```

## Creating a New Product Package

Products ship an XRD + thin Composition from a cdk8s package, plus a Go handler in
the orchestrator.

### 1. Scaffold the package

```bash
npx create-platform-product --name redis --category database
```

### 2. Define the XRD

```typescript
import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { createPlatformXrd, createBaseSchema, API_GROUP, API_VERSION } from '@7k-hiroba/shared';

export class RedisInstanceXrd extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    createPlatformXrd(
      this,
      'xrd',
      {
        group: API_GROUP,
        version: API_VERSION, // v1alpha1
        kind: 'RedisInstance',
        plural: 'redisinstances',
        singular: 'redisinstance',
        scope: 'Namespaced',
      },
      {
        ...createBaseSchema(),
        provider: { type: 'string', enum: ['aws', 'incluster'] },
      },
      ['profile', 'team', 'costCenter'],
    );
  }
}
```

Schema rules imposed by the v2 XRD -> CRD converter:

- no `connectionSecretKeys` (XR connection secrets do not exist in v2);
- no `additionalProperties` combined with `properties` on nested object fields —
  keep nested objects either structural (`properties` only) or free-form.

### 3. Emit the thin Composition

```typescript
import { createOrchestratedComposition } from '@7k-hiroba/shared';
// one Pipeline step invoking function-platform; no composition logic in TS
```

### 4. Implement the Go handler

Add `functions/platform/handlers/redis.go`:

- read the observed XR (`hc.OXR`), resolve provider
  (`spec.provider` > `PLATFORM_DEFAULT_*` env > contract default);
- emit desired composed resources with deterministic names;
- set explicit readiness: `platform.MarkReady(res, hc, name)`;
- publish `status.phase` / `status.endpoint` / `status.connectionSecretRef`;
- for Helm workloads use the namespaced `helm.m.crossplane.io/v1beta1` Release API
  and `platform.ResolveProviderConfig(oxr, "helm")` (`<team>-helm`);
- wire children from **observed child `status`** — never from connection details
  (v2 drops XR-level connection secrets).

Register the handler in `cmd/main.go` and add tests in `handlers/handlers_test.go`.

### 5. Update the contract

Add the product to `contract/contract.json` (kind, plural, providers, profiles,
connection keys) and run `npm run gen:contract`. The `--check` gate in
`scripts/pre-push-checks.sh` enforces freshness.

## Validation and Deployment

### Local render validation

```bash
HIROBA_ROOT=$PWD bash scripts/render-validate.sh packages/postgres
```

### Deploy to Kubernetes

```bash
kubectl apply -f packages/postgres/dist/xrd.k8s.yaml
kubectl apply -f packages/postgres/dist/composition.k8s.yaml
```

For Helm-backed products, each team namespace needs (created by
`scripts/team-setup.sh`): a namespaced `ProviderConfig` `<team>-helm`
(`helm.m.crossplane.io/v1beta1`) and a RoleBinding granting the provider-helm
service account `admin` in the namespace.

### Live e2e on kind

```bash
scripts/e2e-setup.sh platform-e2e
scripts/team-setup.sh team-api
# apply XRDs/Compositions, create an XR, assert Ready + status.endpoint
```

## Testing Patterns

- **TS packages**: synthesize the chart and assert the XRD/Composition shape
  (`Testing.synth`). See `packages/postgres/test/unit/snapshot.test.ts`.
- **Go handlers**: table tests building a `HandlerContext` with observed composed
  resources; assert desired resources, readiness, and status. See
  `functions/platform/handlers/handlers_test.go`.
- **Render**: `scripts/render-validate.sh` runs `crossplane composition render`
  against fixtures.

```bash
npm run test:unit --workspace=@7k-hiroba/postgres
(cd functions/platform && go test -race ./...)
```
