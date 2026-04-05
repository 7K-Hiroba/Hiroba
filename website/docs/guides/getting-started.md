---
sidebar_position: 1
---

# Getting Started

This guide walks you through creating your first application using Hiroba's Backstage templates.

## Prerequisites

- Access to a Backstage instance with Hiroba templates registered
- A running Kubernetes cluster
- [Helm](https://helm.sh/) v3.x installed
- [kubectl](https://kubernetes.io/docs/tasks/tools/) configured for your cluster

## Option A: Scaffold via Backstage (Recommended)

1. Open your Backstage portal
2. Navigate to **Create** and select **Application Template**
3. Fill in the parameters:
   - **Name**: your application name
   - **Description**: what it does
   - **Owner**: your team
   - **Port**: container port (default 8080)
   - **Platform dependencies**: toggle Postgres, S3, Keycloak as needed
   - **Repository**: select where to publish
4. Click **Create** — Backstage scaffolds and publishes your repo

Your new repo includes:
- `helm/base/` — Ready-to-deploy Helm chart
- `helm/platform/` — Platform dependencies (if enabled)
- `Dockerfile` — Multi-stage container build
- `.github/workflows/` — CI/CD referencing the workflow-library
- `docs/` + `mkdocs.yml` — TechDocs
- `catalog-info.yaml` — Backstage catalog registration

## Option B: Manual Setup

```bash
git clone https://github.com/7KGroup/hiroba.git
cp -r hiroba/templates/app-template/skeleton ./my-app
cd my-app
```

Replace all `${{ values.* }}` placeholders with your actual values, then:

```bash
# Deploy the base application
helm install my-app ./helm/base

# Optionally deploy platform dependencies
helm install my-app-platform ./helm/platform
```

## Verifying Your Deployment

```bash
kubectl get pods -l app.kubernetes.io/name=my-app
kubectl get svc my-app
```

## Next Steps

- [Understand Base vs Platform charts](../architecture/base-vs-platform)
- [Customize Helm chart values](using-helm-templates)
- [Set up Crossplane compositions](crossplane-compositions) for platform resources
- [Build container images](containerization) with the Dockerfile template
