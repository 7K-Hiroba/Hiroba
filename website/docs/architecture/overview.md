---
sidebar_position: 1
---

# Architecture Overview

Hiroba is built around a layered architecture that separates concerns cleanly.

## The Stack

```
┌─────────────────────────────────────────┐
│           Backstage Portal              │  Developer self-service
├─────────────────────────────────────────┤
│        Software Templates               │  Scaffold new apps
├──────────────────┬──────────────────────┤
│   Base Chart     │   Platform Chart     │  Helm charts per app
│  (k8s native)    │  (operators + CRDs)  │
├──────────────────┴──────────────────────┤
│   App-specific Crossplane Compositions  │  Apps publish XRDs for others
│   (e.g. Keycloak → realm provisioning)  │  to consume via Claims
├─────────────────────────────────────────┤
│     Kubernetes + Operators              │  CNPG, Crossplane, etc.
│     (CNPG, Crossplane, Keycloak)        │
└─────────────────────────────────────────┘
```

## Component Responsibilities

### Backstage Software Templates

Define the scaffolding experience. Parameters collected from the developer (app name, port, which platform dependencies to enable) drive what gets generated.

### Base Helm Chart

Standard Kubernetes resources that any cluster can run:
- Deployment, Service, Ingress
- ServiceAccount, HPA
- Security contexts, resource limits, probes

### Platform Helm Chart

Third-party resources that require cluster operators:
- **CNPG** — PostgreSQL clusters (CloudNativePG operator)
- **S3 Buckets** — Object storage (Crossplane AWS provider)
- **Keycloak Realms** — Identity and access management (Crossplane Keycloak provider)

### Crossplane Compositions (per-app)

Each scaffolded app includes a `crossplane/` directory for hosting compositions that the app **provides** to the platform. For example, a Keycloak app publishes XRDs and Compositions so other apps can provision realms via Claims in their platform charts.

### Workflow Library

A separate repository (`7KGroup/workflow-library`) containing reusable GitHub Actions workflows. Scaffolded apps reference these via `uses:` rather than duplicating CI/CD logic.

## Design Principles

1. **Separation of base and platform** — An app should deploy without platform deps; platform is opt-in
2. **Centralized workflows** — CI/CD logic lives in one place, consumed by all apps
3. **Backstage-native** — Every app is a catalog entity with TechDocs from day one
4. **Operator-backed infrastructure** — Platform resources are managed by proven operators, not custom scripts
