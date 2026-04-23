---
sidebar_position: 1
---

# Architecture Overview

Hiroba is built around a layered architecture that separates concerns cleanly. Every layer is optional beyond the base chart, so you can start simple and add complexity only when you need it.

## The Stack

```
┌─────────────────────────────────────────┐
│   GitOps Orchestration + Operators      │  App-of-Apps, ApplicationSets
│     (separate repos, coming soon)       │  Deploys apps AND operators
├─────────────────────────────────────────┤
│         GitOps Application Refs         │  Per-app ArgoCD/FluxCD manifests
│           (gitops/ in each app)         │  References base + platform charts
├─────────────────────────────────────────┤
│              TechDocs                   │  Docusaurus site + per-app docs
├──────────────────┬──────────────────────┤
│   Base Chart     │   Platform Chart     │  Helm charts per app
│ (upstream / CRs) │   (always custom)    │
├──────────────────┴──────────────────────┤
│   App-specific Crossplane Compositions  │  Apps publish XRDs for others
│   (e.g. Keycloak → realm provisioning)  │  to consume via Claims
└─────────────────────────────────────────┘
```

The **Platform Chart** is where Hiroba focuses its effort — it's always custom and always present. The base chart is often just an upstream third-party chart or operator CRs. **GitOps** connects everything: application-level refs in each repo, and orchestration repos that assemble apps into a complete platform. **TechDocs** ties it all together with documentation for every app.

## Component Responsibilities

### Platform Helm Chart

The platform chart is Hiroba's core contribution — it's **always custom** and always present. It wires third-party operator-managed infrastructure alongside your app:
- **CNPG** — PostgreSQL clusters (CloudNativePG operator)
- **S3 Buckets** — Object storage (Crossplane AWS provider or Garage)
- **Keycloak Realms** — Identity and access management (Crossplane Keycloak provider)

This is what you'd otherwise have to figure out yourself: how to connect your app to a managed database, provision storage, and set up auth — all declared in Helm values.

### Base Helm Chart

The base chart follows the **near-native** principle: if the app has an official upstream Helm chart, we use it as a dependency rather than rewriting it. The base chart may be:
- The **upstream chart as a dependency** in `Chart.yaml`
- A **thin wrapper** with minimal custom templates
- A **from-scratch chart** only when no adequate upstream chart exists

The base chart works on any cluster — even a single-node k3s or kind setup.

### GitOps

GitOps is split into two layers. The **application layer** lives in each app repo (`gitops/` directory) — it contains ArgoCD Application and FluxCD Kustomization manifests that reference the app's base and platform charts. The **orchestration layer** lives in separate repositories and assembles individual apps into a complete platform using patterns like App-of-Apps or ApplicationSets. Orchestration repos with fully built and tested examples are coming soon.

[Learn more about the GitOps architecture](gitops)

### Chart Request Flow

New charts are requested by the community via [GitHub Issues](https://github.com/7K-Hiroba/Hiroba/issues/new?template=chart_request.md). A 7K-Hiroba maintainer reviews the request, scaffolds the app repository using internal Backstage templates, and publishes it. The Backstage instance is only accessible to 7KGroup representatives — community members interact through issues and pull requests.

### Crossplane Compositions (per-app, Optional)

Each app includes a `crossplane/` directory for hosting compositions that the app **provides** to the platform. For example, a Keycloak app publishes XRDs and Compositions so other apps can provision realms via Claims in their platform charts. This is an advanced pattern — you can ignore it until you need it.

### Workflow Library

A separate repository (`7K-Hiroba/workflows-library`) containing reusable GitHub Actions workflows. Apps reference these via `uses:` rather than duplicating CI/CD logic.

## Design Principles

1. **Separation of base and platform** — The platform chart is Hiroba's focus; the base chart is often upstream. They deploy independently.
2. **Centralized workflows** — CI/CD logic lives in one place, consumed by all apps
3. **Works on small clusters** — Everything should run on a single-node k3s cluster with reasonable resource limits
4. **Operator-backed infrastructure** — Platform resources are managed by proven operators, not custom scripts
