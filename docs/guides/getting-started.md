---
sidebar_position: 1
---

# Getting Started

This guide walks you through deploying your first application using Okura's Helm chart templates.

## Prerequisites

- A running Kubernetes cluster (EKS, GKE, AKS, or a managed distribution)
- [Helm](https://helm.sh/) v3.x installed
- [kubectl](https://kubernetes.io/docs/tasks/tools/) configured for your cluster

:::tip New to Kubernetes?
For managed cloud setups, use a supported Kubernetes service (EKS, GKE, or AKS) with a Gateway API implementation and Crossplane providers installed.
:::

## Deploy from the Template

1. Clone the repo and copy the app skeleton:

```bash
git clone https://github.com/7K-Okura/Okura.git
cp -r okura/templates/app-template/skeleton ./my-app
cd my-app
```

2. Replace all `${{ values.* }}` placeholders with your actual values (app name, image, port, etc.)

3. Deploy the base application:

```bash
helm install my-app ./helm/base
```

4. Optionally deploy platform dependencies (requires the relevant operators on your cluster):

```bash
helm install my-app-platform ./helm/platform
```

## Verifying Your Deployment

```bash
kubectl get pods -l app.kubernetes.io/name=my-app
kubectl get svc my-app
```

## Requesting a New Chart

Want Okura to package an app we don't cover yet? [Open a Chart Request issue](https://github.com/7K-Okura/Okura/issues/new?template=chart_request.md) on GitHub. A 7KGroup maintainer will review the request and scaffold a new app repository for the community.

## Next Steps

- [Understand Base vs Platform charts](../architecture/base-vs-platform)
- [Customize Helm chart values](using-helm-templates)
- [Set up Crossplane compositions](crossplane-compositions) for platform resources
- [Build container images](containerization) with the Dockerfile template
