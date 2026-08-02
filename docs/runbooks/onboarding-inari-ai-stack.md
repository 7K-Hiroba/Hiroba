# Onboarding an InariAIStack

This runbook explains how to deploy the Inari AI platform (CAIPE:
cnoe-io ai-platform-engineering) using the `InariAIStack`
ResourceGraphDefinition (RGD) in Hiroba.

## What it deploys

The `InariAIStack` RGD composes:

- **Storage primitives**
  - `PostgresInstance` for the OpenFGA datastore (`spec.database.postgres.provider`: `cnpg` or `aws`)
  - `ObjectBucket` for Milvus vector storage when `modules.ragStack` is enabled (`spec.storage.provider`: `garage` or `s3`)
- **ExternalSecrets** (RGD-managed because the mcp-server subchart hardcodes
  `external-secrets.io/v1beta1`)
  - `<name>-llm-secret`, `<name>-argocd-secret`, `<name>-backstage-secret`,
    `<name>-github-secret`, `<name>-github-pat-secret`,
    `<name>-agentgateway-config-bridge-token`
- **Helm Applications** (created in the XR namespace, sourced from the upstream
  git repo at `spec.version`)
  - `caipe-ui`, `dynamic-agents`, `audit-service`, `skill-scanner`,
    `mcp-argocd`, `mcp-backstage`, `agentgateway`, `openfga`, `mongodb`
    (when `database.provider: local`), `rag-stack` (when enabled)
- **AgentGateway routing**
  - Static-config `ConfigMap` with one `/mcp/<id>` route per enabled MCP module
- **Gateway exposure**
  - `HTTPRoute` for the UI when `spec.domain` is set

## Prerequisites

Cluster operator side (one-time per cluster):

- KRO installed
- ArgoCD installed with `application.namespaces` so Applications can be
  created in the XR namespace
- Crossplane + `function-platform` installed and healthy
- `platform-primitives` Configuration installed (ObjectBucket + PostgresInstance XRDs)
- Garage operator and CloudNativePG installed (for the in-cluster providers)
- External Secrets Operator v1+ and a ClusterSecretStore (default `vault-internal`)
- Keycloak realm + clients (`<oidcClientID>`, `<platformClientID>`) for SSO

Secret store keys expected under `spec.secrets.vaultPrefix` (e.g. `caipe`):

| Key                            | Properties                                                           |
| ------------------------------ | -------------------------------------------------------------------- |
| `<prefix>/llm`                 | `openai-api-key`, `openai-endpoint`, `openai-model-name`, `provider` |
| `<prefix>/mongodb`             | `username`, `password`, `database`, `uri`                            |
| `<prefix>/keycloak`            | `client-secret`, `platform-client-secret`                            |
| `<prefix>/ui`                  | `nextauth-secret`                                                    |
| `<prefix>/github-oauth`        | `client-id`, `client-secret`                                         |
| `<prefix>/github`              | `token`                                                              |
| `<prefix>/argocd`              | `token`, `url`, `verify-ssl`                                         |
| `<prefix>/backstage`           | `token`, `url`                                                       |
| `<prefix>/agentgateway-bridge` | `token`                                                              |

Install the RGD:

```bash
kubectl apply -f stacks/inari-ai/rg.yaml
kubectl wait --for=condition=Ready \
  resourcegraphdefinition.kro.run/inariaistack.platform.7kgroup.org
```

## 1. Create the InariAIStack CR

```yaml
apiVersion: platform.7kgroup.org/v1alpha1
kind: InariAIStack
metadata:
  name: inari
  namespace: inari
spec:
  profile: development
  team: platform
  costCenter: cc-12345
  domain: inari.example.com
  identity:
    keycloakURL: http://keycloak-service.keycloak.svc.cluster.local:8080
    oidcIssuer: https://auth.example.com/realms/example
```

Watch it come up:

```bash
kubectl -n inari get inariaistack inari
kubectl -n inari get applications.argoproj.io
```

## 2. Fast-lane customization

Per-module values files live in the overrides repo at
`clients/<team>/inari-ai/<module>.yaml` and are merged underneath the
RGD-managed `valuesObject` (platform wiring always wins):

| File                | Typical contents                                 |
| ------------------- | ------------------------------------------------ |
| `ui.yaml`           | `appConfig.models`, `oauthConnectors`, resources |
| `mongodb.yaml`      | resources                                        |
| `rag-stack.yaml`    | Milvus/Redis/etcd storage classes and resources  |
| `agentgateway.yaml` | resources, replicaCount                          |

Override `spec.overrides.path` (or `repoURL`/`revision`) to change the lookup.

## 3. Managed MongoDB (atlas/documentdb)

Set `spec.database.provider: atlas` (or `documentdb`). The in-cluster MongoDB
chart is skipped and every component reads `MONGODB_URI` from the secret store
at `<vaultPrefix>/mongodb` — point that key at the managed connection string.

## 4. Enabling the RAG stack

```yaml
spec:
  modules:
    ragStack:
      enabled: true
```

This creates an `ObjectBucket` named `<name>-milvus` and wires Milvus
`externalS3` to it (Garage in-cluster or AWS S3 depending on
`spec.storage.provider`). Vector data is not migrated between buckets; plan
for re-ingestion. Milvus runs with `rocksmq` (not Woodpecker) because not all
S3 backends support conditional writes.

## Migrating from the legacy caipe ArgoCD Application

The previous deployment used a single ArgoCD Application wrapping the upstream
umbrella chart plus `extras/platform/caipe-extras`. To migrate:

1. Merge the RGD (`stacks/inari-ai`) and confirm it is `Ready`.
2. Delete the legacy `caipe` Application **with cascade**. The new
   per-component Applications cannot adopt the orphaned Helm-owned resources,
   so a clean recreate is required (short UI downtime).
3. Merge the `InariAIStack` CR (replaces `apps/platform/caipe.yaml`) and let
   KRO create the stack.

Consequences to plan for:

- MongoDB and Milvus PVCs are recreated (new Helm releases); the UI credential
  store starts empty.
- OpenFGA moves from the hand-rolled cnpg Cluster to `PostgresInstance`; the
  authorization model is re-seeded by the chart init job. Keep
  `spec.ui.bootstrapAdminEmails` set until OpenFGA grants are reconfigured.
- Vault keys under `caipe/*` are unchanged.

## Rollback

1. Delete the `InariAIStack` CR. ArgoCD removes the per-component Applications
   (they carry the resources-finalizer) unless `deletionPolicy: Orphan`.
2. Re-apply the legacy `caipe` Application manifest and `caipe-extras`.
3. `kubectl delete -f stacks/inari-ai/rg.yaml` once no instances remain.
