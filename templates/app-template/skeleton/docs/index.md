# ${{ values.name }}

${{ values.description }}

## Overview

This application is part of the [7KGroup](https://github.com/7KGroup)
ecosystem, scaffolded using [Hiroba](https://github.com/7K-Hiroba/Hiroba)
templates.

## Architecture

<!-- Describe the application architecture here -->

## Getting Started

### Prerequisites

- Access to the Kubernetes cluster
- Helm v3.x installed
- kubectl configured

### Deploy

```bash
# Base application
helm install ${{ values.name }} ./helm/base

# Platform dependencies (if enabled)
helm install ${{ values.name }}-platform ./helm/platform
```

## Configuration

See [helm/base/values.yaml](../helm/base/values.yaml) for base application
configuration and [helm/platform/values.yaml](../helm/platform/values.yaml)
for platform dependencies.
