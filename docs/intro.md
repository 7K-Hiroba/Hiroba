---
sidebar_position: 1
---

# Introduction

Welcome to **Okura** — Kubernetes packaging for managed cloud and hybrid platforms.

## What is Okura?

Okura (広場, "public square") is a 7KGroup community project that bridges the gap between great open-source software and actually running it on your own Kubernetes cluster.

We provide ready-to-use Helm charts and templates for cloud-ready applications, each with:

- **Platform Helm charts** — Okura's core value: wiring in databases (CNPG or managed), storage (AWS/GCP object storage), auth (Keycloak), and observability alongside your app
- **Base Helm charts** — The application itself, often just an upstream third-party chart used as a dependency
- **Dockerfiles** — Lean, secure, multi-stage container builds
- **CI/CD workflows** — Referencing a centralized workflow-library for consistency

## Who is this for?

- **Platform teams** operating managed cloud or hybrid Kubernetes clusters
- **Developers** who want well-structured examples of real Kubernetes deployments
- **Operators** who need consistent packaging without reinventing infrastructure

## Core Concepts

### Base vs Platform Charts

Every application gets two Helm charts:

- **Platform** — Okura's focus. Always custom, always present. Wires in databases (CNPG or managed), storage (AWS/GCP), identity (Keycloak), and observability using cluster operators — plug-and-play infrastructure without manual setup.
- **Base** — The application itself. Often just an upstream third-party Helm chart used as a dependency — Okura doesn't rewrite what already works.

[Learn more about this distinction](architecture/base-vs-platform)

### Requesting a New Chart

Don't see the app you want? [Open a Chart Request issue](https://github.com/7K-Okura/Okura/issues/new?template=chart_request.md) on GitHub. A 7KGroup maintainer will review the request, scaffold a new app repository from the template, and publish it for the community.

## Getting Started

Head to the [Getting Started guide](guides/getting-started) to deploy your first app.
