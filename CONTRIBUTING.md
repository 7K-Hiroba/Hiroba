# Contributing to Hiroba

Thank you for your interest in contributing to the 7KGroup Hiroba project! This guide will help you get started.

## How to Contribute

### Reporting Issues

- Use [GitHub Issues](https://github.com/7K-Hiroba/Hiroba/issues) to report bugs or request features
- Check existing issues before creating a new one
- Use the provided issue templates when available

### Submitting Changes

1. **Fork** the repository
2. **Create a branch** from `main` for your work (`feature/my-feature` or `fix/my-fix`)
3. **Make your changes** following the guidelines below
4. **Test** your changes locally
5. **Submit a pull request** against `main`

### What We're Looking For

- **Helm chart contributions** — New charts or improvements to existing templates
- **Manifest templates** — Kustomize overlays, base manifests for common patterns
- **Dockerfile templates** — Best-practice container image definitions
- **Documentation** — Guides, tutorials, corrections, and translations
- **CI/CD improvements** — Workflow enhancements, linting rules, automation

## Guidelines

### Helm Charts

- Follow the [Helm best practices](https://helm.sh/docs/chart_best_practices/)
- Include a `README.md` in every chart
- Provide sensible defaults in `values.yaml` with inline comments
- Include liveness and readiness probes in deployment templates
- Use `_helpers.tpl` for reusable template logic

### Dockerfiles

- Use official base images from trusted registries
- Pin image versions (no `latest` tags)
- Follow multi-stage build patterns where possible
- Run as non-root user by default
- Include `LABEL` metadata (maintainer, version, description)

### Documentation

- Write in clear, concise English
- Use Markdown for all documentation
- Place docs site content under `website/docs/`
- Place project-level docs in the `docs/` directory

### Commits

We use [Conventional Commits](https://www.conventionalcommits.org/) — this is required because [release-please](https://github.com/googleapis/release-please) reads commit messages to automate versioning and changelogs.

- **Format:** `type(scope): description`
- **Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`
- **Scope** should match the stack being changed:
  - `feat(app): add health endpoint`
  - `fix(helm-base): correct service port`
  - `feat(helm-platform): add Redis support`
  - `docs: update getting started guide`
  - `fix(crossplane): correct XRD schema`
- **Breaking changes** — append `!` after the scope: `feat(helm-platform)!: rename values structure`
- `feat` → minor version bump, `fix` → patch bump, `!` → major bump

## Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18 (for Docusaurus)
- [Helm](https://helm.sh/) >= 3.x
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Docker](https://www.docker.com/) (optional, for building images)

### Running the Docs Site

```bash
cd website
npm install
npm start
```

### Linting Helm Charts

```bash
helm lint templates/helm-charts/app-template
```

## Code of Conduct

All participants are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions?

Open a [Discussion](https://github.com/7K-Hiroba/Hiroba/discussions) or reach out to the maintainers.
