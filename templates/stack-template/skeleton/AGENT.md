# Agent Guide

This file is for AI agents and automated tools making changes to this repository. Read this before modifying any files.

## Philosophy: Composition over Duplication

This is a **stack repository** — it composes multiple Hiroba applications into a single deployable platform. It does NOT contain application code, Dockerfiles, or app-level Helm charts.

- **App charts are external.** Each app lives in its own repo with its own `helm/base` and `helm/platform` charts. This stack references them via GitOps manifests (ArgoCD multi-source or FluxCD HelmRelease).
- **Operators are individual ArgoCD Applications / FluxCD HelmReleases.** They live in `gitops/argocd/applications/common/` (or `gitops/fluxcd/common/`), each independently versionable and removable. Users add or remove operators by adding or deleting YAML files.
- **No Helm charts in this repo.** Network policies, secrets, and observability are the responsibility of individual app charts or cluster-wide tooling — not the stack.
- **Value overrides are the glue.** `apps/<name>/values-base.yaml` and `values-platform.yaml` tailor each app for this stack's specific requirements.
- **Do not duplicate app chart logic.** If an app needs a change, make it in the app's own repo. The stack only provides overrides.

## Repository Structure

```text
├── apps/
│   └── <app-name>/                # Per-app value overrides
│       ├── values-base.yaml
│       └── values-platform.yaml
├── gitops/
│   ├── argocd/
│   │   ├── root.yaml                     # Root App-of-Apps (bootstrap entry point)
│   │   └── applications/
│   │       ├── common/                    # ArgoCD Project: common
│   │       │   ├── project.yaml             # AppProject definition
│   │       │   ├── cert-manager.yaml        # Operator Application
│   │       │   ├── cloudnative-pg.yaml
│   │       │   ├── external-secrets.yaml
│   │       │   └── kube-prometheus-stack.yaml
│   │       └── apps/                      # ArgoCD Project: <stack-name>
│   │           ├── project.yaml             # AppProject definition
│   │           └── example.yaml             # Example app
│   └── fluxcd/
│       ├── git-repository.yaml
│       ├── kustomization-common.yaml      # Deploys common/ (operators)
│       ├── common/                        # Operator HelmReleases
│       │   ├── helm-repositories.yaml
│       │   ├── cert-manager.yaml
│       │   ├── cloudnative-pg.yaml
│       │   ├── external-secrets.yaml
│       │   └── kube-prometheus-stack.yaml
│       └── apps/
│           └── kustomization-example.yaml
├── docs/
└── .github/workflows/
```

## Where to Add What

### Adding a new app to the stack

1. Create `apps/<app-name>/values-base.yaml` and `values-platform.yaml`
2. Create `gitops/argocd/applications/apps/<app-name>.yaml` (copy from `example.yaml`)
3. For FluxCD: create `gitops/fluxcd/apps/kustomization-<app-name>.yaml`

### Adding a new operator

**ArgoCD:**

1. Create `gitops/argocd/applications/common/<operator>.yaml` with the ArgoCD Application
2. Add the chart's repository URL to `common/project.yaml` under `sourceRepos`
3. Add the operator's namespace to `common/project.yaml` under `destinations`

**FluxCD:**

1. Add a HelmRepository to `gitops/fluxcd/common/helm-repositories.yaml`
2. Create `gitops/fluxcd/common/<operator>.yaml` with the HelmRelease

### Removing an operator

Delete the operator's YAML file from `common/`. ArgoCD prune / FluxCD prune will clean up the resources. Optionally clean up the sourceRepos/destinations in `project.yaml`.

### Modifying an app's configuration

Edit the value override files in `apps/<app-name>/`. Do NOT modify the app's charts.

### Documentation

All docs go under `docs/`. Keep docs in Markdown.

### CI/CD workflows

Two workflow files — `ci.yml` and `release-please.yml` — each calling reusable workflows from `7K-Hiroba/workflows-library`.

| Component | CI trigger (path) | Release tag | release-please type |
| --- | --- | --- | --- |
| Docs | `docs/` | `docs/v*` | `simple` |

CI also runs [kubeconform](https://github.com/yannh/kubeconform) and [pluto](https://github.com/FairwindsOps/pluto) on every pull request to validate Kubernetes manifests under `gitops/argocd/` and `gitops/fluxcd/`:

- **kubeconform** validates manifests against JSON schemas for a pinned Kubernetes version (set via the `KUBERNETES_VERSION` env var in `ci.yml`). CRD schemas for ArgoCD and FluxCD resources are resolved from the [datree CRDs-catalog](https://github.com/datree/CRDs-catalog). Any schema validation error fails the build.
- **pluto** detects deprecated or removed Kubernetes API versions targeting the same `KUBERNETES_VERSION`. If any manifest uses an API that is removed in the target version, the build fails.

When upgrading your cluster, update the `KUBERNETES_VERSION` env var in `.github/workflows/ci.yml` to match the new target version. This ensures manifests are validated against the correct schemas and deprecation rules.

**After creating or editing any GitOps manifest, validate locally before committing:**

```bash
# Schema validation
kubeconform -strict -ignore-missing-schemas \
  -kubernetes-version 1.36.0 \
  -schema-location default \
  -schema-location 'https://raw.githubusercontent.com/datree/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json' \
  -summary gitops/

# Deprecated API detection
pluto detect-files -d gitops/ --target-versions k8s=v1.31.0 -o wide
```

## Technical Specifics

### ArgoCD structure

- **Root Application** uses `directory.recurse: true` to scan all subdirectories
- **Sync-waves** control ordering: projects (-10) → operators (-5) → apps (0)
- **AppProjects** scope RBAC: `common` project for operators, stack-named project for apps
- **Multi-source** on app Applications pulls charts from app repos and values from this repo via `ref: stack`

### FluxCD structure

- **Kustomization chain**: `common` → apps (dependsOn common)
- **HelmReleases** in `common/` reference HelmRepositories for each operator chart
- **GitRepository** source shared across all Kustomizations

### Commit messages drive versioning

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `fix(docs): correct deployment instructions` → patch bump
- `feat(docs): add observability guide` → minor bump
- `feat(docs)!: restructure documentation` → major bump (breaking `!`)

## Dependency Management

[Renovate](https://docs.renovatebot.com/) is configured via `renovate.json5` to automatically open PRs when dependencies have new versions. It tracks:

- **ArgoCD operator chart versions** (`targetRevision` in `gitops/argocd/applications/common/`)
- **FluxCD operator chart versions** (`version` in `gitops/fluxcd/common/`)
- **GitHub Actions** versions in `.github/workflows/`
- **kubeconform** binary version in CI

Package rules group related updates into single PRs:

| Group | Includes | Commit prefix |
| --- | --- | --- |
| `operators` | ArgoCD + FluxCD operator chart bumps | `fix(operators):` |
| `github-actions` | Actions + kubeconform | `ci:` |

When Renovate opens a PR, review the changelog and ensure CI passes before merging. Operator version bumps should be tested on a cluster before merging to `main`.

## OpenCode Skills

Agent skills for this repository are maintained centrally in the [Hiroba](https://github.com/7K-Hiroba/Hiroba) repo under `.opencode/skills/`. Skills enforce standards when editing GitOps manifests and documentation.

To install them locally so they are available when working in this repo:

```bash
git clone https://github.com/7K-Hiroba/Hiroba /tmp/hiroba
mkdir -p .opencode/skills
for skill in gitops helm-chart-release documentation; do
  ln -sf "/tmp/hiroba/.opencode/skills/$skill" .opencode/skills/
done
```

Available skills and when they apply:

| Skill | Use when… |
| --- | --- |
| `gitops` | Editing ArgoCD or FluxCD manifests under `gitops/` |
| `helm-chart-release` | Preparing a release, writing commit messages, versioning |
| `documentation` | Creating or editing Markdown files under `docs/` |

If this stack needs additional skills (e.g., `cnpg-cluster` if managing CNPG directly), add them to the install loop above or symlink them individually from the Hiroba baseline.

If this repo requires standards not covered by the Hiroba baseline, add a skill directly in `.opencode/skills/<name>/SKILL.md` and open a PR to Hiroba to include it upstream.

## Markdown Linting

CI runs [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) on every pull request. Any violation fails the build.

**After creating or editing any `.md` file, you must run the linter before committing:**

```bash
npx markdownlint-cli2 "**/*.md"
```

- Rules are configured in `.markdownlint.yaml` at the repository root.
- Fix every reported error. Do not disable rules inline or in config to silence warnings — fix the underlying markup instead.
- Common issues: fenced code blocks without a language tag (MD040), table separator rows missing spaces around pipes (MD060), missing blank lines before/after lists and headings (MD032, MD022), and duplicate heading text across sections (MD024).
- If you add a new Markdown file, ensure it starts with a top-level `# Heading` (MD041).
- Run the linter again after making fixes to confirm zero errors before committing.
