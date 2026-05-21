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

Every rule that applies when adding or modifying platform-chart resources, whether:

- editing the `hiroba-platform-lib` library at `helm/lib/platform/` in the **Hiroba repo** (where templates live), or
- editing a scaffolded app's `helm/platform/` consumer chart (thin wrappers around `hiroba-platform-lib`).

## Library + consumer split

Template content lives **once**, in the `hiroba-platform-lib` Helm library at `helm/lib/platform/` in the Hiroba repo. Scaffolded apps declare a `dependencies:` entry against the library and ship one thin wrapper per resource:

```yaml
# scaffolded-app/helm/platform/templates/database/cnpg-cluster.yaml
{{- include "hiroba-platform.cnpg-cluster" . }}
```

Rules for choosing where a change goes:

- **New resource kind, new provider, new operator check, defaults every app should adopt** → edit the library in `helm/lib/platform/templates/_<resource>.tpl` (or `_helpers.tpl` / `_checks.tpl`) and bump with `fix(helm-platform-lib):` / `feat(helm-platform-lib):`. Renovate opens a bump PR in every consumer.
- **App-specific override of a single resource** → edit only that app's `helm/platform/templates/<category>/<resource>.yaml`, replacing the include with bespoke YAML.
- **A brand-new resource only one app needs** → keep it in the consumer chart. Promote to the library only after a second app needs the same thing.

Before linting or rendering a consumer chart locally, run `helm dependency update helm/platform`.

## Core philosophy

The platform chart is always **custom**. It wires in databases, storage, secrets, and observability using cluster operators. Never copy logic that an upstream operator already handles — configure the operator's CRD instead.

## Directory layout

The **library** (`helm/lib/platform/` in the Hiroba repo) groups templates into the same category subfolders as the consumer for navigability — named-template names are global, so the include paths don't depend on the folder:

```
helm/lib/platform/
├── Chart.yaml                # type: library
├── values.yaml               # reference defaults (NOT merged into consumers)
├── values.schema.json        # reference schema; consumers copy and own their own
└── templates/
    ├── _helpers.tpl          # hiroba-platform.{name, labels, baseSelectorLabels}
    ├── _checks.tpl           # hiroba-platform.checks — operator CRD guards
    ├── database/
    │   ├── _cnpg-cluster.tpl
    │   └── _cnpg-scheduled-backup.tpl
    ├── storage/
    │   ├── _s3-crossplane.tpl
    │   └── _s3-garage.tpl
    ├── secrets/
    │   └── _external-secret.tpl
    └── observability/
        ├── _service-monitor.tpl
        ├── _grafana-dashboard.tpl
        └── _prometheus-rules.tpl
```

The **consumer** (`helm/platform/` in a scaffolded app) mirrors the same subfolders for wrapper files:

```
helm/platform/
├── Chart.yaml                # dependencies: hiroba-platform-lib
├── values.yaml
├── values.schema.json        # required — CI fails without it
├── templates/
│   ├── checks.yaml           # {{ include "hiroba-platform.checks" . }}
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

Use helpers from the library's `_helpers.tpl` for every resource:

```yaml
name: {{ include "hiroba-platform.name" . }}-<suffix>
labels:
  {{- include "hiroba-platform.labels" . | nindent 4 }}
```

Never hard-code the app name or labels inline. Helper changes go in `helm/lib/platform/templates/_helpers.tpl` in the Hiroba repo, not in a consumer chart.

## Operator CRD checks (`hiroba-platform.checks`)

When adding a new resource kind backed by a CRD, add a guard in **the library** at `helm/lib/platform/templates/_checks.tpl` inside the `hiroba-platform.checks` `define`. Every consumer's `checks.yaml` calls that single named template, so a new guard reaches every app on the next library bump:

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

Two schemas exist and must be updated together when adding a new value:

1. The **library reference schema** at `helm/lib/platform/values.schema.json` (Hiroba repo) documents the surface the named templates expect. It's a copy-paste starting point for consumers — Helm does not enforce it on consumer renders.
2. The **consumer schema** at `helm/platform/values.schema.json` (scaffolded app) is what Helm validates against. It must have a top-level `hiroba-platform-lib` property so the subchart values slot doesn't trip `additionalProperties: false`.

For both:

- Use `additionalProperties: false` on every object.
- Mark required fields with `required: [...]`.
- Use `enum` for all fixed-choice fields (`provider`, `pullPolicy`, etc.).
- Use pattern constraints for size strings: `"^[0-9]+(Mi|Gi|Ti)$"`.

CI runs `helm lint` (consumer side) and `ct lint` (library side) — a missing schema entry will fail the build.

## `global.appName` — required

`global.appName` is required in the schema and must be set by the consumer. All resources derive their name from it via `hiroba-platform.name`. Never hardcode an app name.

## Unit tests

- Unit tests live in the **consumer** chart (scaffolded app's `helm/platform/tests/`) — the library has nothing renderable on its own.
- Run `helm dependency update helm/platform` before `helm unittest`.
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
- When a library bump changes behaviour, add a regression test in at least one canonical consumer chart.

## Checklist before committing

- [ ] Change made in the right place — library for shared behaviour, consumer chart for app-specific overrides
- [ ] Conventional-commit scope matches: `helm-platform-lib` for library, `helm-platform` for consumer
- [ ] New resource gated behind `<resource>.enabled: false`
- [ ] Provider switch uses `eq .Values.<resource>.provider "<name>"` pattern
- [ ] Library named template called `hiroba-platform.<resource>-<provider>` and lives in `_<resource>-<provider>.tpl`
- [ ] Consumer wrapper file named `<resource>-<provider>.yaml` inside the correct category subfolder
- [ ] `values.yaml` has `enabled`, `provider`, and all resource-specific keys
- [ ] Both library reference schema and consumer schema updated with `additionalProperties: false` and `required`
- [ ] `hiroba-platform.checks` in `_checks.tpl` extended for any new CRD-backed resource
- [ ] `hiroba-platform.name` / `hiroba-platform.labels` helpers used throughout
- [ ] Tests in a consumer chart cover enabled, disabled, and provider variants
