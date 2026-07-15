# Developer Guide

## Quick Start

### 1. Install Dependencies

```bash
make install
```

### 2. Build and Test

```bash
make lint
make test
make synth
make validate
```

### 3. Consume the Platform

```bash
cd examples/team-api
npm install
npm run synth
kubectl apply -f dist/obs.k8s.yaml
```

## Documentation

- [Usage Guide](usage-guide.md) — detailed guide for consumers and platform engineers
- [Architecture](architecture.md)

## Adding a New Primitive Product

For a step-by-step walkthrough, see the [Usage Guide](usage-guide.md#creating-a-new-product-package). In short:

1. Use `npx create-platform-product` or create a new package under `packages/<product>/`.
2. Add `cdk8s.yaml` with required CRD imports.
3. Run `npx cdk8s import` to generate typed constructs.
4. Define the XRD in `src/xrd.ts`.
5. Define the Composition in `src/composition.ts`.
6. Add unit tests in `test/unit/`.
7. Add packaging metadata in `package/crossplane.yaml`.

## Profile Defaults

| Profile     | Grafana Replicas | Storage | Loki Storage | Loki Replication |
| ----------- | ---------------- | ------- | ------------ | ---------------- |
| development | 1                | 10Gi    | local        | 1                |
| staging     | 1                | 20Gi    | s3           | 2                |
| production  | 2                | 50Gi    | s3           | 3                |

## Feature Toggles

| Feature    | GrafanaInstance | LokiInstance | PrometheusInstance | ObservabilityStack |
| ---------- | --------------- | ------------ | ------------------ | ------------------ |
| SSO        | yes             | no           | no                 | global             |
| Alerting   | yes             | no           | yes                | global             |
| Ingress    | yes             | no           | no                 | no                 |
| Federation | no              | no           | yes                | no                 |

## Troubleshooting

### `make synth` fails with "cannot find a parent chart"

Ensure XRD and Composition classes extend `Chart` from `cdk8s`.

### `make validate` fails with string transform error

Crossplane v2 requires `string.type: Format`. Use the `transformString` helper from `@7k-hiroba/shared`.
