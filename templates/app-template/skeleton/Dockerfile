# =============================================================================
# ${{ values.name }}
# ${{ values.description }}
# =============================================================================

# -- Build stage
# TODO: Replace with your application's build image and commands
FROM node:25-alpine AS builder

WORKDIR /build
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build

# -- Runtime stage
FROM gcr.io/distroless/nodejs20-debian12:nonroot

LABEL maintainer="7KGroup <https://github.com/7KGroup>"
LABEL org.opencontainers.image.source="https://github.com/7KGroup/${{ values.name }}"
LABEL org.opencontainers.image.description="${{ values.description }}"

WORKDIR /app

COPY --from=builder /build/dist ./dist
COPY --from=builder /build/node_modules ./node_modules

EXPOSE 8080

ENTRYPOINT ["dist/index.js"]
