---
sidebar_position: 2
---

# Using Helm Templates

This guide covers how to work with Hiroba's Helm chart templates in detail.

## Template Structure

Every Hiroba Helm chart follows this structure:

```
app-template/
├── Chart.yaml          # Chart metadata
├── values.yaml         # Default configuration values
└── templates/
    ├── _helpers.tpl    # Reusable template helpers
    ├── deployment.yaml # Application deployment
    ├── service.yaml    # Service exposure
    ├── ingress.yaml    # Ingress (optional)
    └── serviceaccount.yaml
```

## Customizing Values

The `values.yaml` file is your primary configuration surface. Key sections:

### Image Configuration

```yaml
image:
  repository: ghcr.io/your-org/your-app
  pullPolicy: IfNotPresent
  tag: "1.2.3"  # Pinned version — never use "latest"
```

### Resource Limits

Keep these reasonable for homelab hardware. These defaults work well on a Raspberry Pi or mini PC:

```yaml
resources:
  limits:
    cpu: 500m
    memory: 256Mi
  requests:
    cpu: 50m
    memory: 64Mi
```

### Enabling Ingress

```yaml
ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: app.home.lab
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: app-tls
      hosts:
        - app.home.lab
```

## Extending the Template

To add custom resources, create new files in the `templates/` directory. Use the helpers from `_helpers.tpl` for consistent naming and labeling:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "app-template.fullname" . }}-config
  labels:
    {{- include "app-template.labels" . | nindent 4 }}
data:
  app.conf: |
    # your config here
```

## Linting and Testing

```bash
# Lint the chart
helm lint ./my-app

# Render templates without installing
helm template my-release ./my-app

# Dry-run install
helm install my-release ./my-app --dry-run
```
