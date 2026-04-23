---
sidebar_position: 1
---

# Introduction

Welcome to **Hiroba** — Kubernetes packaging for self-hosters and homelab enthusiasts.

## What is Hiroba?

Hiroba (広場, "public square") is a 7KGroup community project that bridges the gap between great open-source software and actually running it on your own Kubernetes cluster.

We provide ready-to-use Helm charts and templates for self-hosted applications, each with:

- **Platform Helm charts** — Hiroba's core value: wiring in databases (CNPG Postgres), storage (S3), auth (Keycloak), and observability alongside your app
- **Base Helm charts** — The application itself, often just an upstream third-party chart used as a dependency
- **Dockerfiles** — Lean, secure, multi-stage container builds
- **CI/CD workflows** — Referencing a centralized workflow-library for consistency

## Who is this for?

- **Homelab enthusiasts** running Kubernetes on a Raspberry Pi, mini PC, or spare hardware
- **Self-hosters** who want to deploy open-source apps on their own infrastructure without the guesswork
- **Tinkerers and learners** who want well-structured examples of real Kubernetes deployments
- **Small teams** who need reliable packaging without enterprise overhead

## Core Concepts

### Base vs Platform Charts

Every application gets two Helm charts:

- **Platform** — Hiroba's focus. Always custom, always present. Wires in databases (CNPG), storage (S3), identity (Keycloak), and observability using cluster operators — plug-and-play infrastructure without manual setup.
- **Base** — The application itself. Often just an upstream third-party Helm chart used as a dependency — Hiroba doesn't rewrite what already works.

[Learn more about this distinction](architecture/base-vs-platform)

### Requesting a New Chart

Don't see the app you want? [Open a Chart Request issue](https://github.com/7K-Hiroba/Hiroba/issues/new?template=chart_request.md) on GitHub. A 7KGroup maintainer will review the request, scaffold a new app repository from the template, and publish it for the community.

## Getting Started

Head to the [Getting Started guide](guides/getting-started) to deploy your first app.
