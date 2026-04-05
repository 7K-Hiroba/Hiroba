---
sidebar_position: 3
---

# Containerization Guide

Best practices for building container images using Hiroba's Dockerfile template.

## Template Overview

The Hiroba Dockerfile template uses a multi-stage build pattern:

1. **Build stage** — Compiles or packages the application
2. **Runtime stage** — Minimal image containing only the built artifact

## Key Principles

### Use Minimal Base Images

Prefer Alpine or distroless images for the runtime stage:

```dockerfile
# Good — small attack surface
FROM gcr.io/distroless/static-debian12

# Also good
FROM alpine:3.19
```

### Pin Versions

Never use `latest`. Always pin to a specific version:

```dockerfile
FROM node:20.11-alpine3.19 AS builder
```

### Run as Non-Root

```dockerfile
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -D appuser

USER appuser
```

### Use Multi-Stage Builds

Keep build tools out of the final image:

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /build
COPY . .
RUN go build -o app .

FROM alpine:3.19
COPY --from=builder /build/app /usr/local/bin/app
USER 1000
ENTRYPOINT ["app"]
```

### Add Metadata Labels

```dockerfile
LABEL org.opencontainers.image.source="https://github.com/7KGroup/hiroba"
LABEL org.opencontainers.image.description="My application"
LABEL org.opencontainers.image.version="1.0.0"
```

## Using the Template

1. Copy `templates/dockerfiles/Dockerfile.template` to your project
2. Replace all `REPLACE_*` placeholders
3. Build and test locally:

```bash
docker build -t my-app:dev .
docker run --rm -p 8080:8080 my-app:dev
```

## Security Scanning

Always scan images before pushing:

```bash
# Using Trivy
trivy image my-app:dev

# Using Grype
grype my-app:dev
```
