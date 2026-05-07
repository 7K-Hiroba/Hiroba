---
name: garage-s3
description: Standards for self-hosted Garage S3 object storage in the platform chart using the aws-cli Job hook pattern
license: MIT
compatibility: opencode
metadata:
  audience: contributors
  workflow: helm-platform
---

## What I cover

The Garage-specific implementation of S3 storage in the platform chart. Garage is a self-hosted, lightweight S3-compatible object store. Unlike Crossplane, Garage has no Kubernetes operator — bucket creation is handled via a Helm post-install `Job` using the AWS CLI pointed at the Garage API endpoint.

For general S3 provider switching rules see the `crossplane-s3` skill. This skill covers only Garage-specific patterns.

## How Garage bucket creation works

Garage does not have CRDs. The platform chart creates buckets by running a one-shot `batch/v1` Job as a Helm post-install hook. The Job uses the `amazon/aws-cli` image to call `aws s3 mb` against the Garage endpoint.

This means:

- There is **no CRD guard** needed in `checks.yaml` for Garage (no operator required).
- Bucket creation is **idempotent** — the `|| true` in the command means re-running the Job on upgrade is safe.
- The Job is **self-deleting** on success (`hook-delete-policy: hook-succeeded`).
- Bucket deletion on `helm uninstall` is **not automatic** — buckets are retained to prevent accidental data loss.

## Resource shape

The Garage provider produces two resources gated by `{{- if and .Values.s3.enabled (eq .Values.s3.provider "garage") }}`:

### 1. ConfigMap — connection info for the application

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ include "platform.name" . }}-s3-config
  labels:
    {{- include "platform.labels" . | nindent 4 }}
data:
  S3_ENDPOINT: {{ .Values.s3.garage.endpoint | quote }}
  S3_BUCKET: {{ include "platform.name" . }}-{{ .Values.s3.bucketName }}
  S3_REGION: "garage"
```

The region value is always the string `"garage"` — this is the conventional pseudo-region used with Garage's S3-compatible API. Do not make it configurable.

### 2. Job — bucket provisioner

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "platform.name" . }}-s3-init
  labels:
    {{- include "platform.labels" . | nindent 4 }}
  annotations:
    helm.sh/hook: post-install
    helm.sh/hook-weight: "0"
    helm.sh/hook-delete-policy: hook-succeeded
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: create-bucket
          image: amazon/aws-cli:2.15.0
          env:
            - name: AWS_ENDPOINT_URL
              value: {{ .Values.s3.garage.endpoint | quote }}
            - name: AWS_DEFAULT_REGION
              value: "garage"
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.s3.garage.accessKeySecret.name }}
                  key: {{ .Values.s3.garage.accessKeySecret.key }}
            - name: AWS_SECRET_ACCESS_KEY
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.s3.garage.secretKeySecret.name }}
                  key: {{ .Values.s3.garage.secretKeySecret.key }}
          command:
            - sh
            - -c
            - |
              aws s3 mb "s3://{{ include "platform.name" . }}-{{ .Values.s3.bucketName }}" \
                --endpoint-url "$AWS_ENDPOINT_URL" || true
```

## AWS CLI image version

The Job uses `amazon/aws-cli:2.15.0`. This is tracked by Renovate — do not pin to a digest manually, let Renovate open the update PR. Never use `:latest`.

## Hook annotations — all three are required

| Annotation | Value | Purpose |
| --- | --- | --- |
| `helm.sh/hook` | `post-install` | Runs after all chart resources are created |
| `helm.sh/hook-weight` | `"0"` | Execution order within the hook phase |
| `helm.sh/hook-delete-policy` | `hook-succeeded` | Deletes the Job pod after successful completion |

Do not use `hook-failed` in the delete policy — a failed Job must remain visible for debugging.

## Credential secrets

The Job reads AWS credentials from two Kubernetes Secrets referenced by name and key in values:

```yaml
s3:
  garage:
    accessKeySecret:
      name: ""      # Secret name — must be pre-provisioned
      key: accessKey
    secretKeySecret:
      name: ""      # Secret name — must be pre-provisioned
      key: secretKey
```

These Secrets must exist in the same namespace before `helm install` is run. They are typically provisioned via an ExternalSecret. The platform chart does not create them.

If the Secret names are empty, the Job will fail. Consider adding a `required` check in the template when both `s3.enabled` and `provider=garage`:

```yaml
{{- if and .Values.s3.enabled (eq .Values.s3.provider "garage") }}
{{- if not .Values.s3.garage.accessKeySecret.name }}
{{- fail "s3.garage.accessKeySecret.name is required when s3.provider is garage" }}
{{- end }}
{{- end }}
```

## Endpoint format

Must be a full URL with scheme and port. The cluster-internal address for a standard Garage install:

```
http://garage.garage.svc.cluster.local:3900
```

Source always from `values.s3.garage.endpoint`. The endpoint is also exposed to the application via the ConfigMap's `S3_ENDPOINT` key.

## Bucket naming

Bucket name is always `{{ include "platform.name" . }}-{{ .Values.s3.bucketName }}`. This matches the Crossplane convention and prevents name collisions across apps sharing a Garage instance.

## `replicationFactor`

Garage replication is configured at the cluster level, not per-bucket. The `replicationFactor` value in `values.yaml` is informational/documentation only for the current implementation — it is not passed to the `aws s3 mb` command (the AWS CLI does not support Garage-native replication settings). If the Garage admin API is used in future to set per-bucket replication, this value becomes the source of truth.

## `values.schema.json` requirements

```json
"garage": {
  "type": "object",
  "properties": {
    "endpoint": { "type": "string" },
    "replicationFactor": {
      "type": "integer",
      "minimum": 1,
      "maximum": 3
    },
    "accessKeySecret": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "key": { "type": "string" }
      },
      "required": ["name", "key"]
    },
    "secretKeySecret": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "key": { "type": "string" }
      },
      "required": ["name", "key"]
    }
  },
  "required": ["endpoint", "accessKeySecret", "secretKeySecret"]
}
```

## Checklist before committing

- [ ] Both ConfigMap and Job gated by `s3.enabled` AND `eq .Values.s3.provider "garage"`
- [ ] Job has all three hook annotations (`post-install`, weight, `hook-succeeded` delete policy)
- [ ] AWS CLI image is pinned to a version (not `:latest`)
- [ ] `restartPolicy: Never` on the Job pod template
- [ ] `|| true` present in the `aws s3 mb` command (idempotent)
- [ ] Credential Secrets referenced from values, not hardcoded
- [ ] Validation fail added for empty `accessKeySecret.name` when provider is garage
- [ ] ConfigMap `S3_REGION` is hardcoded `"garage"` (not from values)
- [ ] Bucket name includes `platform.name` prefix
- [ ] `values.schema.json` updated with Garage-specific fields
- [ ] Unit test covers Garage provider rendering and Crossplane provider is absent
