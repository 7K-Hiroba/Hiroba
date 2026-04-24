---
sidebar_position: 2
---

# Container image

The application ships as an OCI image built from the root [`Dockerfile`](https://github.com/7KGroup/${{ values.name }}/blob/main/Dockerfile). The scaffolded template uses a two-stage build (builder + distroless runtime); adjust the build stage to match your language and toolchain.

## Build stages

The template's Dockerfile has two stages:

- **Builder** — pulls dependencies and compiles the application. Replace the base image (`node:20-alpine` by default) and commands with whatever your stack needs.
- **Runtime** — copies only the compiled artefacts into a distroless image (`gcr.io/distroless/nodejs20-debian12:nonroot`). The runtime has no shell, no package manager, and runs as a non-root user.

## Build locally

```bash
docker build -t ghcr.io/7kgroup/${{ values.name }}:dev .
docker run --rm -p 8080:8080 ghcr.io/7kgroup/${{ values.name }}:dev
```

## Image labels

Labels are populated from the template at scaffold time:

| Label                                           | Value                                                    |
| ----------------------------------------------- | -------------------------------------------------------- |
| `maintainer`                                    | `7KGroup <https://github.com/7KGroup>`                   |
| `org.opencontainers.image.source`               | `https://github.com/7KGroup/${{ values.name }}`          |
| `org.opencontainers.image.description`          | `${{ values.description }}`                              |

<!-- TODO: Add more OCI labels (version, revision, created) once your CI wiring is in place. -->

## Publishing

Images are built and published by the CI workflows under `.github/workflows/`, which reference the centralized [workflow-library](https://github.com/7K-Hiroba/workflows-library). The default target is `ghcr.io/7kgroup/${{ values.name }}`.

## Runtime expectations

The Helm base chart assumes:

- Container listens on port `8080` (override `service.targetPort` if yours differs)
- Process runs as UID `1000` (distroless `nonroot` matches this)
- Root filesystem is read-only — write to `/tmp` or a mounted volume only
- Health endpoints at `/healthz` (liveness) and `/readyz` (readiness)

<!-- TODO: Document any other runtime expectations your app imposes (env vars, mount points, signals). -->
