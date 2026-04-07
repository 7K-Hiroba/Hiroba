---
sidebar_position: 3
---

# Roadmap

## 2026 Q2 — Foundation

- [x] Repository scaffolding and governance
- [x] Base Helm chart template
- [x] Dockerfile template with best practices
- [x] Docusaurus documentation site
- [x] CI/CD pipeline (lint, validate, deploy docs)
- [ ] First community charts (candidates: Keycloak)
- [ ] Container image build pipeline (GitHub Actions + GHCR)

## 2026 Q3 — Expansion

- [ ] 5+ community-maintained Helm charts for popular self-hosted apps
- [ ] Kustomize overlay examples for multi-environment deployments
- [ ] Security scanning integration (Trivy, Grype)
- [ ] Chart testing framework (ct, kind)
- [ ] Contributor onboarding documentation

## 2026 Q4 — Maturity

- [ ] Chart repository (OCI-based via GHCR)
- [ ] Automated release pipeline for charts
- [ ] Homelab blueprints — opinionated stacks for common setups (media server, dev tools, home automation)
- [ ] Community showcase — who's running Hiroba charts on their homelab

## Future

- GitOps orchestration repositories — fully built and tested App-of-Apps / ApplicationSet examples you can fork for your own cluster
- GitOps integration guides (Flux, ArgoCD)
- ARM64 support for all charts and images (Raspberry Pi, Apple Silicon)
- Observability stack blueprints (Prometheus, Grafana, Loki)
- Single-node optimization guides
- Backup and restore patterns for self-hosted data

---

This roadmap is a living document. Priorities shift based on community feedback — [open a discussion](https://github.com/7KGroup/hiroba/discussions) to propose changes.
