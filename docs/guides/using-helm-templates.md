---
sidebar_position: 2
---

# Using Helm Templates

This guide covers how to work with Hiroba's Helm chart templates in detail.

## Template Structure

Every Hiroba Helm chart follows this structure:

```
app-template/
├── Chart.yaml              # Chart metadata
├── values.yaml             # Default configuration values
├── values.schema.json      # JSON Schema — validates values (required)
├── templates/
│   ├── _helpers.tpl        # Reusable template helpers
│   ├── deployment.yaml     # Application deployment
│   ├── service.yaml        # Service exposure
│   ├── httproute.yaml      # Gateway API HTTPRoute
│   └── serviceaccount.yaml
└── tests/                  # helm-unittest test suites
    ├── deployment_test.yaml
    ├── service_test.yaml
    └── ...
```

## Customizing Values

The `values.yaml` file is your primary configuration surface. Key sections:

### Image Configuration

```yaml
image:
  repository: ghcr.io/your-org/your-app
  pullPolicy: IfNotPresent
  tag: "1.2.3"  # Pinned version — never use "latest"
```

### Resource Limits

Keep these reasonable for homelab hardware. These defaults work well on a Raspberry Pi or mini PC:

```yaml
resources:
  limits:
    cpu: 500m
    memory: 256Mi
  requests:
    cpu: 50m
    memory: 64Mi
```

### Gateway API (HTTPRoute)

Hiroba uses the Gateway API instead of Ingress for external traffic routing:

```yaml
gateway:
  enabled: true
  parentRefs:
    - name: default-gateway
  hostnames:
    - app.home.lab
  rules: []  # Empty = catch-all PathPrefix /
```

## Extending the Template

To add custom resources, create new files in the `templates/` directory. Use the helpers from `_helpers.tpl` for consistent naming and labeling:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "app-template.fullname" . }}-config
  labels:
    {{- include "app-template.labels" . | nindent 4 }}
data:
  app.conf: |
    # your config here
```
## Operator Dependency Checks

The platform chart validates that required operators are installed before rendering resources. This is handled by `templates/_checks.yaml`, which uses Helm's `.Capabilities.APIVersions` to check for CRDs at install time.

If you add a new operator-backed feature to the platform chart, add a corresponding check:

```yaml
{{- if and .Values.myFeature.enabled (not (.Capabilities.APIVersions.Has "example.io/v1")) }}
  {{- fail "myFeature.enabled is true but the Example Operator CRD (example.io/v1) is not installed. Install the operator first or set myFeature.enabled=false." }}
{{- end }}
```

The rules:
1. **One check per CRD** — add it to `_checks.yaml` alongside the existing checks.
2. **Guard the resources** — wrap all templates that use the CRD with `{{- if .Values.myFeature.enabled }}`.
3. **Default to disabled** — set `myFeature.enabled: false` in `values.yaml` so the chart is safe to install without the operator.
4. **Skip native resources** — features backed by ConfigMaps, Jobs, or other built-in kinds don't need checks.

:::note CI and offline rendering
`helm template` does not connect to a cluster, so `.Capabilities.APIVersions` will be empty. Pass `--api-versions` to simulate the APIs your cluster provides:
```bash
helm template my-app ./helm/platform --api-versions postgresql.cnpg.io/v1
```
:::


## Values Schema

Every Hiroba chart **must** include a `values.schema.json` file. This is a [JSON Schema (draft-07)](https://json-schema.org/draft-07/schema#) that validates `values.yaml` at lint and template time. CI will fail if the file is missing.

The schema catches typos, wrong types, and invalid values before they reach your cluster. Helm validates against it automatically during `helm lint`, `helm template`, and `helm install`.

### Writing a schema

Key guidelines:

- Set `additionalProperties: false` on objects with a known shape to catch typos early
- Mark essential fields as `required` (e.g., `image.repository`, `service.port`, `global.appName`)
- Use `enum` for fields with a fixed set of values (e.g., `pullPolicy`, `service.type`, `provider`)
- Use `minimum`/`maximum` for numeric bounds (e.g., port ranges, replica counts)

Example for a service definition:

```json
{
  "service": {
    "type": "object",
    "required": ["port"],
    "properties": {
      "type": { "type": "string", "enum": ["ClusterIP", "NodePort", "LoadBalancer"] },
      "port": { "type": "integer", "minimum": 1, "maximum": 65535 },
      "targetPort": { "type": "integer", "minimum": 1, "maximum": 65535 }
    },
    "additionalProperties": false
  }
}
```

### Keeping the schema in sync

When you add a new value to `values.yaml`, always add the matching entry in `values.schema.json`. CI will catch mismatches — if a value is present in `values.yaml` but the schema has `additionalProperties: false` on that level, `helm lint` will fail.

## Unit Testing

Hiroba uses [helm-unittest](https://github.com/helm-unittest/helm-unittest) for chart unit tests. Tests validate that templates render correctly for different value combinations — without needing a real cluster.

### Running tests locally

```bash
# Install the plugin (one-time)
helm plugin install https://github.com/helm-unittest/helm-unittest.git

# Run tests for a chart
helm unittest ./helm/base
helm unittest ./helm/platform
```

### Writing tests

Tests live in the `tests/` directory inside each chart. One file per template, named `<template>_test.yaml`:

```yaml
suite: Deployment
templates:
  - templates/deployment.yaml
tests:
  - it: renders with default values
    asserts:
      - isKind:
          of: Deployment
      - equal:
          path: spec.replicas
          value: 1

  - it: omits replicas when autoscaling is enabled
    set:
      autoscaling.enabled: true
    asserts:
      - isNull:
          path: spec.replicas

  - it: uses the correct image
    set:
      image.repository: ghcr.io/example/app
      image.tag: "1.2.3"
    asserts:
      - equal:
          path: spec.template.spec.containers[0].image
          value: "ghcr.io/example/app:1.2.3"
```

### Testing platform chart templates

Platform chart templates depend on CRDs that won't exist during offline rendering. Set `capabilities.apiVersions` at the suite level to satisfy the checks in `_checks.yaml`:

```yaml
suite: CNPG Cluster
templates:
  - templates/database/cnpg-cluster.yaml
capabilities:
  apiVersions:
    - postgresql.cnpg.io/v1
tests:
  - it: renders when postgres is enabled
    set:
      postgres.enabled: true
    asserts:
      - isKind:
          of: Cluster
```

### What to test

| Pattern | Example |
|---|---|
| Default rendering | Template produces the right Kind with default values |
| Conditional resources | HPA only renders when `autoscaling.enabled: true` |
| Value propagation | `image.tag` appears in the container spec |
| Security defaults | Pod/container security contexts are applied |
| Disabled resources | `hasDocuments: count: 0` when feature is off |

## Linting and Testing

```bash
# Lint the chart (also validates against values.schema.json)
helm lint ./my-app

# Render templates without installing
helm template my-release ./my-app

# Run unit tests
helm unittest ./my-app

# Dry-run install
helm install my-release ./my-app --dry-run
```
