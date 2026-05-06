---
name: helm-platform
description: Standards for editing the Hiroba platform Helm chart covering providers, schema, checks, and tests
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: helm-platform
---

## What I cover

Every rule that applies when adding or modifying resources in `helm/platform/`.

## Core philosophy

The platform chart is always **custom**. It wires in databases, storage, secrets, and observability using cluster operators. Never copy logic that an upstream operator already handles — configure the operator's CRD instead.

## Directory layout

```
helm/platform/
├── Chart.yaml
├── values.yaml
├── values.schema.json        # required — CI fails without it
├── templates/
│   ├── _helpers.tpl
│   ├── checks.yaml           # operator CRD guards
│   ├── database/             # CNPG clusters, etc.
│   ├── storage/              # S3 via Crossplane, Garage, etc.
│   ├── secrets/              # ExternalSecret
│   └── observability/        # ServiceMonitor, GrafanaDashboard, PrometheusRules
└── tests/                    # helm-unittest suites
```

## Resource gating — non-negotiable

Every resource **must** be gated by an `enabled` flag defaulting to `false`:

```yaml
{{- if .Values.<resource>.enabled }}
...
{{- end }}
```

Never render a resource unconditionally. A misconfigured but disabled resource must produce zero output.

## Provider switch pattern

When a resource has multiple backend implementations, use a `provider` enum:

```yaml
{{- if and .Values.s3.enabled (eq .Values.s3.provider "crossplane") }}
```

- Template files are named `<resource>-<provider>.yaml` inside the category subfolder.
- The `provider` field must be listed in `enum` in `values.schema.json`.
- Add provider-specific values under `<resource>.<provider>:` in `values.yaml`.

## Helpers — always use them

Use helpers from `_helpers.tpl` for every resource:

```yaml
name: {{ include "platform.name" . }}-<suffix>
labels:
  {{- include "platform.labels" . | nindent 4 }}
```

Never hard-code the app name or labels inline.

## Operator CRD checks (`checks.yaml`)

When adding a new resource kind backed by a CRD, add a guard in `templates/checks.yaml`:

```yaml
{{- if .Values.<resource>.enabled }}
{{- if not (.Capabilities.APIVersions.Has "<group>/<version>") }}
{{- fail "<resource>.enabled requires the <operator> CRD (<group>/<version>). Install the operator first." }}
{{- end }}
{{- end }}
```

Existing guards (do not duplicate):

| Feature | CRD |
| --- | --- |
| `postgres.enabled` | `postgresql.cnpg.io/v1` |
| `s3.enabled` + `provider=crossplane` | `s3.aws.crossplane.io/v1beta1` |
| `externalSecrets.enabled` | `external-secrets.io/v1` |
| `observability.serviceMonitor.enabled` | `monitoring.coreos.com/v1` |
| `observability.prometheusRules.enabled` | `monitoring.coreos.com/v1` |

## `values.schema.json` — keep in sync

Every time a value is added or changed in `values.yaml`:

1. Add the corresponding entry in `values.schema.json`.
2. Use `additionalProperties: false` on every object.
3. Mark required fields with `required: [...]`.
4. Use `enum` for all fixed-choice fields (`provider`, `pullPolicy`, etc.).
5. Use pattern constraints for size strings: `"^[0-9]+(Mi|Gi|Ti)$"`.

CI runs `helm lint` which validates values against the schema — a missing schema entry will fail the build.

## `global.appName` — required

`global.appName` is required in the schema and must be set by the consumer. All resources derive their name from it via `platform.name`. Never hardcode an app name.

## Unit tests

- One test file per template: `tests/<template>_test.yaml`.
- Always set `capabilities.apiVersions` to satisfy CRD checks:

```yaml
capabilities:
  apiVersions:
    - postgresql.cnpg.io/v1
```

- Test the enabled and disabled states of every gated resource.
- Test provider switching (e.g., crossplane vs. garage).
- Test that `checks.yaml` fails when the CRD is absent (omit the capability).

## Checklist before committing

- [ ] New resource gated behind `<resource>.enabled: false`
- [ ] Provider switch uses `eq .Values.<resource>.provider "<name>"` pattern
- [ ] Template file named `<resource>-<provider>.yaml` in correct subfolder
- [ ] `values.yaml` has `enabled`, `provider`, and all resource-specific keys
- [ ] `values.schema.json` updated with `additionalProperties: false` and `required`
- [ ] `checks.yaml` has a CRD guard for any new CRD-backed resource
- [ ] `_helpers.tpl` name and label helpers used throughout
- [ ] `tests/` has a test file covering enabled, disabled, and provider variants
