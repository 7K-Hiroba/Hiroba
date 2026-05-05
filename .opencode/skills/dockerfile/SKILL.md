---
name: dockerfile
description: Standards for Dockerfiles in Hiroba app repos including multi-stage builds, non-root user, pinned images, and OCI labels
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: app
---

## What I cover

Every rule that applies when creating or modifying a `Dockerfile` in an app repo.

## When a custom Dockerfile is justified

Only maintain a custom Dockerfile if **at least one** of:

- No official upstream Docker image exists for the application.
- The official image is poorly maintained, has unacceptable CVEs, or is missing required features.
- The application is custom-built code (not a third-party tool).

If an official image exists, use it directly in `values.yaml` (`image.repository`) and skip the Dockerfile entirely. The near-native philosophy applies here too.

## Multi-stage build — required

Every Dockerfile must use multi-stage builds. Never ship build tools in the runtime image:

```dockerfile
# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

# Stage 2: runtime
FROM gcr.io/distroless/nodejs20-debian12 AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
```

## Non-root user — required

The runtime stage must not run as root. Use UID 1000:

```dockerfile
USER 1000
```

If the base image provides a named non-root user (e.g., `node` in the Node.js image, `nonroot` in distroless), use that:

```dockerfile
USER nonroot
```

Do not create a new user if a suitable non-root user already exists in the base image.

## Pinned base image versions — required

Never use `:latest` or a floating tag like `:20` or `:lts`. Pin to a specific digest or at minimum a patch version:

```dockerfile
# Acceptable — pinned to patch version (Renovate will update)
FROM node:20.18.1-alpine3.20 AS builder

# Better — pinned to digest
FROM node:20.18.1-alpine3.20@sha256:<digest> AS builder

# Not acceptable
FROM node:latest
FROM node:20
FROM node:lts-alpine
```

Renovate is configured to track Dockerfile `FROM` image versions and open PRs automatically.

## OCI labels — required

The runtime stage must include OCI image labels:

```dockerfile
LABEL org.opencontainers.image.source="https://github.com/<org>/<repo>"
LABEL org.opencontainers.image.description="<one-line description>"
LABEL org.opencontainers.image.licenses="MIT"
```

These are used by GitHub Packages and security scanners.

## Read-only filesystem compatibility

The base chart defaults to `readOnlyRootFilesystem: true`. The application must not write to the container filesystem at runtime. If the app needs writable paths:

1. Identify the exact paths (e.g., `/tmp`, `/var/cache/app`).
2. Add `emptyDir` volume mounts in the base chart values for those paths.
3. Document the required mounts in the repo's `README.md`.

Do not disable `readOnlyRootFilesystem` in the Helm chart to work around a Dockerfile issue — fix the Dockerfile or add the appropriate volume mounts.

## Port exposure

Use `EXPOSE` to document the port the application listens on. This must match `service.targetPort` in `helm/base/values.yaml`:

```dockerfile
EXPOSE 8080
```

## `.dockerignore`

Every repo with a Dockerfile must have a `.dockerignore` that excludes:

- `.git/`
- `node_modules/` (if applicable — re-installed in build stage)
- `helm/`
- `gitops/`
- `docs/`
- `*.md`
- `.github/`

## CI scanning

The `app` CI job builds the image and runs a vulnerability scan via Trivy. High/critical CVEs in the final image will fail the build. Fix them by:

1. Updating the base image to a patched version.
2. Removing packages that introduce the CVE.
3. Using a minimal base image (distroless preferred over alpine, alpine preferred over debian/ubuntu).

## Checklist before committing

- [ ] Multi-stage build — build tools not present in runtime stage
- [ ] Runtime stage runs as non-root (UID 1000 or named non-root user)
- [ ] All `FROM` base images pinned to a specific version (not `:latest`)
- [ ] OCI image labels present in runtime stage
- [ ] `EXPOSE` matches `service.targetPort` in `helm/base/values.yaml`
- [ ] `.dockerignore` excludes non-source files
- [ ] Application does not write to container filesystem at runtime (or `emptyDir` mounts added to chart)
- [ ] Trivy scan passes in CI (no high/critical CVEs in final image)
