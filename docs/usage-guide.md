# Platform Engineering Usage Guide

This guide explains how to use the platform engineering framework, consume existing platform products, create new applications, and build new composite stacks.

## Table of Contents

1. [Concepts](#concepts)
2. [Quick Start](#quick-start)
3. [Using Existing Platform Products](#using-existing-platform-products)
4. [Creating a New Application](#creating-a-new-application)
5. [Creating a New Stack](#creating-a-new-stack)
6. [Creating a New Primitive Product](#creating-a-new-primitive-product)
7. [Validation and Deployment](#validation-and-deployment)
8. [Testing Patterns](#testing-patterns)

## Concepts

This framework models infrastructure as **platform products** that development teams can request through Kubernetes claims.

| Term                  | Description                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Primitive Product** | A single reusable infrastructure abstraction (e.g., `GrafanaInstance`, `LokiInstance`). Lives in `packages/`. |
| **Stack**             | A composite product that orchestrates multiple primitives (e.g., `ObservabilityStack`). Lives in `stacks/`.   |
| **Claim**             | A Kubernetes custom resource a developer creates to request a product.                                        |
| **XRD**               | CompositeResourceDefinition. Defines the claim schema.                                                        |
| **Composition**       | Crossplane logic that translates a claim into managed resources.                                              |
| **Profile**           | Predefined environment tier: `development`, `staging`, or `production`.                                       |
| **Feature Toggle**    | Optional capability a user can enable (e.g., SSO, HA, alerting).                                              |

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build, Test, and Generate Manifests

```bash
make lint
make test
make synth
make validate
```

### 3. Deploy the Control Plane

```bash
make e2e-setup
```

This installs Crossplane, External Secrets Operator, the patch-and-transform function, and platform packages.

## Using Existing Platform Products

### With kubectl

Apply a claim directly:

```bash
kubectl apply -f examples/grafana-dev.yaml
```

Example claim:

```yaml
apiVersion: platform.7kgroup.org/v1
kind: GrafanaInstanceClaim
metadata:
  name: team-api-grafana
  labels:
    team: team-api
    costCenter: cc-12345
    environment: production
spec:
  profile: production
  domain: grafana.team-api.example.com
  team: team-api
  costCenter: cc-12345
  features:
    sso:
      enabled: true
    alerting:
      enabled: true
    ingress:
      enabled: true
```

### With the TypeScript Consumer SDK

Install the SDK in your application repository:

```bash
npm install @7k-hiroba/platform-consumer
```

Create a file `src/main.ts`:

```typescript
import { App } from 'cdk8s';
import { TeamObservability } from '@7k-hiroba/platform-consumer';

const app = new App({ outdir: 'dist' });

new TeamObservability(app, 'obs', {
  profile: 'production',
  domain: 'obs.team-api.example.com',
  team: 'team-api',
  costCenter: 'cc-12345',
  modules: {
    grafana: true,
    loki: true,
    prometheus: true,
  },
  sso: true,
  alerting: true,
});

app.synth();
```

Generate and apply:

```bash
npx ts-node src/main.ts
kubectl apply -f dist/
```

### Using Generic PlatformProduct and PlatformApp

For teams that need products not yet wrapped in high-level helpers:

```typescript
import { App } from 'cdk8s';
import { PlatformProduct, createPlatformApp } from '@7k-hiroba/platform-consumer';

const app = new App({ outdir: 'dist' });

const cache = new PlatformProduct(app, 'redis', {
  id: 'redis',
  name: 'checkout-cache',
  apiVersion: 'platform.7kgroup.org/v1',
  kind: 'Redis',
  plural: 'redises',
  spec: {
    profile: 'production',
    team: 'payments',
    costCenter: 'cc-999',
    features: { ha: { enabled: true, replicas: 3 } },
  },
});

const db = new PlatformProduct(app, 'postgres', {
  id: 'postgres',
  name: 'checkout-db',
  apiVersion: 'platform.7kgroup.org/v1',
  kind: 'Postgresql',
  plural: 'postgresqls',
  spec: {
    profile: 'production',
    team: 'payments',
    costCenter: 'cc-999',
    features: { backup: { enabled: true } },
  },
});

createPlatformApp(app, 'checkout-app', {
  name: 'checkout',
  team: 'payments',
  costCenter: 'cc-999',
  environment: 'production',
  products: [
    { product: 'Redis', name: 'checkout-cache', spec: cache.spec },
    { product: 'Postgresql', name: 'checkout-db', spec: db.spec },
  ],
});

app.synth();
```

## Creating a New Application

A new application is typically a repository or directory that consumes platform products through the SDK.

### 1. Create the Application Directory

```bash
mkdir examples/my-service
cd examples/my-service
```

### 2. Add a `package.json`

```json
{
  "name": "my-service",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "synth": "npx ts-node src/main.ts"
  },
  "dependencies": {
    "@7k-hiroba/platform-consumer": "*",
    "cdk8s": "^2.68.0"
  },
  "devDependencies": {
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}
```

### 3. Write `src/main.ts`

Use the SDK to declare the infrastructure your service needs:

```typescript
import { App } from 'cdk8s';
import { TeamObservability } from '@7k-hiroba/platform-consumer';

const app = new App({ outdir: 'dist' });

new TeamObservability(app, 'obs', {
  profile: 'development',
  domain: 'obs.my-service.example.com',
  team: 'my-team',
  costCenter: 'cc-00000',
  modules: { grafana: true, loki: true, prometheus: false },
});

app.synth();
```

### 4. Synthesize and Apply

```bash
npm install
npm run synth
kubectl apply -f dist/
```

## Creating a New Stack

> **Note**: This repository is the central framework repository. Individual product stacks are maintained in dedicated repositories (e.g., `/mnt/local-nas/Projects/7K-Hiroba/Observability Stack/`). Use the central repository for shared libraries, the consumer SDK, and scaffolding tools; create or update a stack repository for a specific product domain.

A stack combines multiple primitive products into a single higher-level abstraction.

### 1. Create the Stack Repository

Create a new repository for the stack. The recommended layout is:

```
my-stack/
├── packages/
│   ├── shared/          # Copy or reference the shared platform library
│   ├── product-a/       # Primitive product A
│   └── product-b/       # Primitive product B
├── my-stack/            # Composite stack package
├── scripts/
├── infrastructure/
├── package.json
├── tsconfig.json
└── README.md
```

For an example, see the [Observability Stack repository](/mnt/local-nas/Projects/7K-Hiroba/Observability%20Stack/).

### 2. Create the Stack Package

Use the scaffolding tool or create it manually:

```bash
npx create-platform-product --name observability --category observability
```

For manual creation, create `stacks/<stack-name>/` with `package.json`, `cdk8s.yaml`, `tsconfig.json`, `src/index.ts`, `src/xrd.ts`, and `src/composition.ts`.

### 2. Define the XRD

In `src/xrd.ts`, declare the composite resource schema:

```typescript
import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { createPlatformXrd, createBaseSchema } from '@7k-hiroba/shared';

export class MyStackXrd extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    createPlatformXrd(
      this,
      'xrd',
      {
        group: 'platform.7kgroup.org',
        kind: 'MyStack',
        plural: 'mystacks',
        singular: 'mystack',
        version: 'v1',
        claimNames: { kind: 'MyStackClaim', plural: 'mystackclaims' },
        connectionSecretKeys: ['endpoint'],
      },
      {
        ...createBaseSchema(),
        domain: { type: 'string' },
        modules: {
          type: 'object',
          properties: {
            grafana: { type: 'boolean' },
            loki: { type: 'boolean' },
          },
        },
      },
      ['profile', 'team', 'costCenter', 'domain'],
    );
  }
}
```

### 3. Define the Composition

In `src/composition.ts`, wire child products together:

```typescript
import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';

export class MyStackComposition extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new ApiObject(this, 'composition', {
      apiVersion: 'apiextensions.crossplane.io/v1',
      kind: 'Composition',
      metadata: {
        name: 'mystack-composition',
        labels: { 'platform.7kgroup.org/product': 'mystack' },
      },
      spec: {
        compositeTypeRef: {
          apiVersion: 'platform.7kgroup.org/v1',
          kind: 'MyStack',
        },
        mode: 'Pipeline',
        pipeline: [
          {
            step: 'patch-and-transform',
            functionRef: { name: 'function-patch-and-transform' },
            input: {
              apiVersion: 'pt.fn.crossplane.io/v1beta1',
              kind: 'Resources',
              resources: [
                {
                  name: 'grafana',
                  base: {
                    apiVersion: 'platform.7kgroup.org/v1',
                    kind: 'GrafanaInstance',
                    spec: {
                      profile: '',
                      domain: '',
                      team: '',
                      costCenter: '',
                    },
                  },
                  patches: [
                    { type: 'FromCompositeFieldPath', fromFieldPath: 'spec.profile', toFieldPath: 'spec.profile' },
                    { type: 'FromCompositeFieldPath', fromFieldPath: 'spec.domain', toFieldPath: 'spec.domain' },
                    { type: 'FromCompositeFieldPath', fromFieldPath: 'spec.team', toFieldPath: 'spec.team' },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.costCenter',
                      toFieldPath: 'spec.costCenter',
                    },
                  ],
                },
              ],
            },
          },
        ],
      },
    });
  }
}
```

### 4. Add Entry Point and Tests

`src/index.ts`:

```typescript
import { App } from 'cdk8s';
import { MyStackXrd } from './xrd';
import { MyStackComposition } from './composition';

const app = new App({ outdir: 'dist' });
new MyStackXrd(app, 'xrd');
new MyStackComposition(app, 'composition');
app.synth();
```

`test/unit/snapshot.test.ts`:

```typescript
import { Testing } from 'cdk8s';
import { MyStackXrd } from '../../src/xrd';
import { MyStackComposition } from '../../src/composition';

describe('MyStack manifests', () => {
  test('synths XRD and Composition', () => {
    const app = Testing.app();
    const xrd = new MyStackXrd(app, 'xrd');
    const composition = new MyStackComposition(app, 'composition');
    expect(Testing.synth(xrd).length).toBeGreaterThan(0);
    expect(Testing.synth(composition).length).toBeGreaterThan(0);
  });
});
```

### 5. Register the Stack in the Workspace

Add the new stack to the root `package.json` workspaces if it is not under `stacks/*` already:

```json
"workspaces": [
  "packages/*",
  "stacks/*",
  "consumer-sdk/typescript",
  "examples/*",
  "tools/*"
]
```

## Creating a New Primitive Product

For products that do not yet exist in `packages/`, use the scaffolding CLI:

```bash
npx create-platform-product \
  --name redis \
  --category database \
  --description "Self-service Redis cache" \
  --features ha,persistence \
  --provider elasticache.aws.upbound.io/v1beta1
```

This creates `packages/redis/` with:

- `src/xrd.ts`
- `src/composition.ts`
- `src/index.ts`
- `test/unit/`
- `package/crossplane.yaml`
- `cdk8s.yaml`

After scaffolding:

```bash
cd packages/redis
npx cdk8s import
npm run build
npm run test:unit
npm run synth
```

Then customize the XRD schema and Composition resources to match your provider CRDs.

## Validation and Deployment

### Local Validation

```bash
# Render a composition against a fixture XR
crossplane composition render \
  packages/grafana/test/fixtures/xr.yaml \
  packages/grafana/dist/composition.yaml \
  --functions packages/grafana/test/fixtures/functions.yaml
```

### Synthesize All Packages

```bash
make synth
```

### Deploy to Kubernetes

```bash
# Apply XRDs and Compositions
kubectl apply -f packages/grafana/dist/
kubectl apply -f packages/loki/dist/
kubectl apply -f packages/prometheus/dist/
kubectl apply -f stacks/observability/dist/

# Apply a claim
kubectl apply -f examples/grafana-dev.yaml
```

### Package and Publish

```bash
make package
make publish
```

## Testing Patterns

Each package should include unit tests that synthesize manifests and assert expected resources exist.

```typescript
import { Testing } from 'cdk8s';
import { MyProductComposition } from '../../src/composition';

describe('MyProduct composition', () => {
  test('renders expected resources', () => {
    const app = Testing.app();
    const composition = new MyProductComposition(app, 'composition');
    const resources = Testing.synth(composition);
    expect(resources.some((r: any) => r.kind === 'Composition')).toBe(true);
  });
});
```

Use the shared testing helpers for common assertions:

```typescript
import { assertResourceExists, assertFieldValue } from '@7k-hiroba/shared';
```

Run tests for a single workspace:

```bash
npm run test:unit --workspace=@7k-hiroba/grafana
```

Run all tests:

```bash
make test
```
