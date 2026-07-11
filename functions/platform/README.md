# function-platform

Central Crossplane composition orchestrator (see
[`docs/adr/007-orchestrator-function.md`](../../docs/adr/007-orchestrator-function.md)).

Every primitive and stack Composition runs a single Pipeline step that calls this
function. `RunFunction` dispatches on the observed composite's `kind` via the registry
wired in [`cmd/main.go`](./cmd/main.go); the matched handler emits the desired composed
resources.

- Primitive handlers emit managed resources, branching on `spec.provider`
  (`postgres.go` → RDS / CNPG; `objectbucket.go` → S3 / Garage).
- Stack handlers (to be added) emit child primitive XRs, which are reconciled by their
  own Compositions — giving hierarchical stack → primitive → managed orchestration from
  one binary.

## Layout

```
functions/platform/
├── fn.go            # Function.RunFunction (kind dispatch)
├── registry.go      # Handler registry
├── provider.go      # spec helpers + namespaced providerConfigRef resolution
├── handlers/        # per-kind handlers (provider branching lives here)
│   ├── postgres.go
│   └── objectbucket.go
└── cmd/main.go      # gRPC server (mTLS, registry wiring)
```

## Build

> Crossplane functions are Go services. This is the one Go module in an otherwise
> TypeScript/CDK8s repository.

```bash
cd functions/platform
go mod tidy
go build ./...
go test ./...
```

Run locally (insecure):

```bash
go run ./cmd --insecure --address :9443
```

## Notes / TODO

- Pin `function-sdk-go` to the version matching the control plane and re-run `go mod tidy`.
- Map managed-resource connection details onto the primitive connection contracts
  (`POSTGRES_CONNECTION_KEYS` / `OBJECT_STORAGE_CONNECTION_KEYS` in `@platform-engineering/shared`)
  via `connectionDetails` transforms so stacks can consume them uniformly.
- Add `gcp`/`azure` (postgres) and `gcs`/`azureBlob`/`local` (object storage) branches.
- Add a stack handler example (e.g. `ObservabilityStack`) that emits `PostgresInstance`
  and `ObjectBucket` child XRs to demonstrate hierarchical orchestration.
- Package as a `Function` CR + `DeploymentRuntimeConfig` and publish the image/xpkg
  (new CI lane alongside the existing TypeScript lanes).
