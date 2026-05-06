---
sidebar_position: 1
---

# ${{ values.name }}

${{ values.description }}

## Overview

This application is part of the [7KGroup](https://github.com/7KGroup) ecosystem, scaffolded using [Hiroba](https://github.com/7K-Hiroba/Hiroba) templates.

## Architecture

<!-- TODO: Describe the application architecture here. Include a diagram if useful. -->

## Prerequisites

- Access to the Kubernetes cluster
- Helm v3.x installed
- kubectl configured
- A parent `Gateway` (HTTP + HTTPS listeners, TLS configured) — typically from a gateway chart such as `hiroba-gateway`

## Quick start

```bash
# Core application
helm install ${{ values.name }} ./helm/base

# Platform dependencies (databases, secrets, observability) — optional
helm install ${{ values.name }}-platform ./helm/platform
```

See the per-stack pages for full configuration:

- **[Container image](./container.md)** — Dockerfile, build stages, image publishing
- **[Helm base chart](./helm-base.md)** — Deployment, Service, HTTPRoute, env vars, ingress
- **[Helm platform chart](./helm-platform.md)** — PostgreSQL, S3, ExternalSecrets, observability
- **[Crossplane compositions](./crossplane.md)** — Infrastructure capabilities this app exposes to the platform
