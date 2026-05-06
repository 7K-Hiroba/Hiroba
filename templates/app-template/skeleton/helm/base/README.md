# ${{ values.name }}

Helm chart for ${{ values.name }}.

This chart installs the workload (Deployment, Service, HPA, PDB, HTTPRoute). For cross-cutting platform dependencies (secrets, observability, databases), install the companion [${{ values.name }}-platform](../platform/README.md) chart.

**Documentation:** <https://hiroba.7kgroup.org/docs/apps/${{ values.name }}/helm-base>

## TL;DR

```bash
helm install ${{ values.name }} \
  oci://harbor.7kgroup.org/7khiroba/charts/${{ values.name }} \
  --version 0.1.0
```

## Prerequisites

- Kubernetes 1.24+
- Gateway API CRDs installed in the cluster (the chart provisions an `HTTPRoute`)
- A running `Gateway` that your `HTTPRoute` can attach to

## What gets installed

| Resource | Purpose |
|---|---|
| `Deployment` | The application pod |
| `Service` | ClusterIP fronting the deployment |
| `HTTPRoute` | Gateway API routing |
| `ServiceAccount` | Pod identity |
| `HorizontalPodAutoscaler` | Optional — enabled via `autoscaling.enabled` |
| `PodDisruptionBudget` | Optional — enabled via `pdb.enabled` |

## Configuration

All values are documented in [`values.yaml`](values.yaml) and validated against [`values.schema.json`](values.schema.json). Artifact Hub renders the schema as an interactive form on the chart page.

## Part of the Hiroba ecosystem

Scaffolded with [Hiroba](https://github.com/7K-Hiroba/Hiroba). Source and issues: <https://github.com/7K-Hiroba/${{ values.name }}>.
