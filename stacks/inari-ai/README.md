# InariAIStack

This directory contains the KRO `ResourceGraphDefinition` (RGD) for the
`InariAIStack` product — a cloud-agnostic packaging of CAIPE
([cnoe-io/ai-platform-engineering](https://github.com/cnoe-io/ai-platform-engineering))
deployed as per-component ArgoCD Applications (no umbrella chart).

The RGD composes:

- `PostgresInstance` primitive for the OpenFGA datastore (cnpg in-cluster or AWS RDS)
- `ObjectBucket` primitive for Milvus vector storage (in-cluster Garage or AWS S3)
- Helm Applications for caipe-ui, dynamic-agents, audit-service, skill-scanner,
  mcp-argocd, mcp-backstage (HTTP MCP servers), agentgateway, openfga, mongodb,
  and rag-stack — all sourced from the upstream git repo at one pinned tag
  (`spec.version`)
- `ExternalSecret`s for LLM/agent/bridge credentials (the mcp-server subchart
  hardcodes `external-secrets.io/v1beta1`, so secrets stay RGD-managed)
- A static AgentGateway routing `ConfigMap` (replicates the upstream umbrella
  template: one `/mcp/<id>` route per enabled module)
- `HTTPRoute` for the UI

For user-facing instructions on how to request and customize a stack, see:

- [Onboarding an InariAIStack](../../docs/runbooks/onboarding-inari-ai-stack.md)

## Files

- `rg.yaml` — the `ResourceGraphDefinition` that orchestrates the stack.

## Modules

| Module          | Default | Notes                                                    |
| --------------- | ------- | -------------------------------------------------------- |
| `ui`            | on      | Chat UI + BFF.                                           |
| `dynamicAgents` | on      | Agent runtime.                                           |
| `auditService`  | on      | Local-disk audit log API.                                |
| `skillScanner`  | on      | Unauthenticated ClusterIP scanner.                       |
| `agentGateway`  | on      | Static routing + config-bridge sidecar.                  |
| `openfga`       | on      | RBAC backend; Postgres via `PostgresInstance`.           |
| `mcpArgocd`     | on      | HTTP MCP server.                                         |
| `mcpBackstage`  | on      | HTTP MCP server.                                         |
| `mcpGithub`     | on      | stdio only: AgentGateway route + secrets, no Deployment. |
| `ragStack`      | off     | rag-server/webui/agent-rag + Milvus on `ObjectBucket`.   |

## Cloud-agnostic wiring

| Concern          | Mechanism                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenFGA database | `spec.database.postgres.provider`: `cnpg` (in-cluster) or `aws` (RDS).                                                                                                          |
| Milvus storage   | `spec.storage.provider`: `garage` (in-cluster) or `s3` (AWS).                                                                                                                   |
| MongoDB          | `spec.database.provider`: `local`, `atlas`, or `documentdb`. Managed options skip the in-cluster chart and read `MONGODB_URI` from the secret store at `<vaultPrefix>/mongodb`. |
| Secrets          | `spec.secrets.storeName/storeKind` select the ESO store; `vaultPrefix` selects the remote key prefix.                                                                           |
| Identity         | `spec.identity.*` carries Keycloak/OIDC endpoints and client IDs.                                                                                                               |

## Fast-lane values

Per-module values files live in the overrides repo at
`clients/<team>/inari-ai/<module>.yaml` (e.g. `ui.yaml`, `rag-stack.yaml`).
Platform wiring in `valuesObject` always wins. Use the fast lane for
`appConfig` (models, oauthConnectors), resources, storage classes, and other
chart-level tuning.

## Naming contract

All components use `fullnameOverride` so service names are deterministic:
`<xr-name>-caipe-ui`, `<xr-name>-dynamic-agents`, `<xr-name>-openfga`,
`<xr-name>-agentgateway`, `<xr-name>-mcp-argocd-mcp`, `<xr-name>-mongodb`,
`<xr-name>-rag-server`, `<xr-name>-audit-service`, `<xr-name>-skill-scanner`.

One exception: the agentgateway Helm release name is the XR name itself,
because the subchart derives the static-config ConfigMap name
(`<release>-agentgateway-static-config`) from `.Release.Name`.
