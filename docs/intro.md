---
sidebar_position: 1
slug: /intro
---

# Introduction

Welcome to **Hiroba** — the community hub for standardizing open-source solutions into production-ready Kubernetes applications.

## What is Hiroba?

Hiroba (広場, "public square") is a 7KGroup initiative to bridge the gap between great open-source software and production-grade Kubernetes deployments.

We provide **Backstage Software Templates** that scaffold complete application repositories with:

- **Base Helm charts** — Standard Kubernetes resources (Deployment, Service, Ingress, HPA)
- **Platform Helm charts** — Third-party infrastructure (CNPG Postgres, S3 via Crossplane, Keycloak realms)
- **Dockerfiles** — Security-first, multi-stage container builds
- **CI/CD workflows** — Referencing a centralized workflow-library for consistency
- **TechDocs** — Backstage-native documentation out of the box
- **Catalog integration** — Every scaffolded app registers in the Backstage catalog

## Who is this for?

- **Platform engineers** building internal developer platforms on Kubernetes
- **DevOps teams** who want standardized, battle-tested deployment patterns
- **Developers** who want to go from idea to deployed application in minutes
- **Organizations** adopting Backstage and Kubernetes together

## Core Concepts

### Base vs Platform Charts

Every application gets two Helm charts:

- **Base** — The application itself: Deployment, Service, Ingress. Works on any k8s cluster.
- **Platform** — Optional managed infrastructure: databases (CNPG), storage (S3), identity (Keycloak). Requires cluster operators but provides plug-and-play dependencies.

[Learn more about this distinction](architecture/base-vs-platform)

### Backstage Integration

Templates are designed as [Backstage Software Templates](architecture/backstage-templates). An admin configures the template in Backstage, and developers use it to scaffold new application repos with a single click.

## Getting Started

Head to the [Getting Started guide](guides/getting-started) to begin.
