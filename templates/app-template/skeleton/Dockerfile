# =============================================================================
# ${{ values.name }}
# ${{ values.description }}
# =============================================================================

# -- Build stage
# TODO: Replace with your application's build image and commands
FROM node:20-alpine AS builder

WORKDIR /build
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build

# -- Runtime stage
FROM node:20-alpine

LABEL maintainer="7KGroup <https://github.com/7KGroup>"
LABEL org.opencontainers.image.source="https://github.com/7KGroup/${{ values.name }}"
LABEL org.opencontainers.image.description="${{ values.description }}"

RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -D appuser

WORKDIR /app

COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules

USER appuser

EXPOSE ${{ values.port }}

ENTRYPOINT ["node", "dist/index.js"]
