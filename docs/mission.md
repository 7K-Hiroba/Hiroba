---
sidebar_position: 2
---

# Mission

## Vision

A world where deploying open-source software on Kubernetes is straightforward and accessible — whether you're running a single-node homelab or a small self-hosted cluster.

## Mission Statement

Hiroba exists to **standardize, containerize, and platform** open-source applications for Kubernetes. We build and maintain Helm charts, container images, and deployment manifests so that self-hosters can focus on using their applications, not wrestling with infrastructure.

## Principles

### Open by Default
Everything we build is open-source under the Apache 2.0 license. Our governance, roadmaps, and decision-making are transparent.

### Security First
Container images run as non-root. Charts include security contexts by default. We follow best practices even on homelab-grade deployments — your self-hosted infra deserves the same care.

### Convention over Configuration
Our templates ship with sensible defaults that work out of the box on a single-node cluster, while remaining fully customizable for more complex setups.

### Community Driven
We welcome contributions from anyone. Ideas, bug reports, documentation improvements, and new chart contributions all help the project move forward.

### Kubernetes Native
We build for Kubernetes. Our solutions leverage native primitives (Deployments, Services, Gateway API, CRDs) rather than fighting the platform.

### Near-Native
We don't reinvent the wheel. If an application has an official Helm chart or Docker image, we use it. The upstream maintainers know their application best. Hiroba's value is the **platform layer** — wiring in databases, storage, secrets, and observability on top of what already exists. Custom charts and images are only maintained when the upstream solution is absent, inadequate, or poorly maintained, at the discretion of 7KGroup admins.

## Goals

1. Provide a platform layer for common self-hosted applications, building on their official charts and images wherever possible
2. Maintain the platform chart as the always-custom, always-present integration layer
3. Publish clear, practical documentation and guides for every solution
4. Build a community of self-hosters and homelab enthusiasts who contribute and maintain charts
5. Establish patterns that anyone can adopt for their own self-hosted Kubernetes setup
