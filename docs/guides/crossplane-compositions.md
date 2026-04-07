---
sidebar_position: 4
---

# Crossplane Compositions

Every Hiroba application includes a `crossplane/` directory for hosting **app-specific** Crossplane Composite Resource Definitions (XRDs) and Compositions.

## What Goes Here?

This directory is for compositions that your application **provides to the platform**. Not every app will need this — it's for applications that expose infrastructure capabilities to other apps.

### Example: Keycloak

Say you have a Keycloak application created from the Hiroba template. The `crossplane/` directory starts empty. You then add:

- `xrd-realm.yaml` — Defines a `KeycloakRealmClaim` API
- `composition-realm.yaml` — Maps the claim to Keycloak API resources

Now other applications can provision Keycloak realms by creating Claims against your XRD in their platform Helm charts.

```
keycloak/
└── crossplane/
    ├── xrd-realm.yaml
    ├── composition-realm.yaml
    └── examples/
        └── claim-realm.yaml
```

## The Flow

```
App A (Keycloak)                    App B (Web App)
┌─────────────────────┐             ┌──────────────────────┐
│ crossplane/         │             │ helm/platform/       │
│   xrd-realm.yaml    │◄────────── │   keycloak-realm.yaml│
│   composition.yaml  │  Claims    │   (KeycloakRealmClaim)│
└─────────────────────┘             └──────────────────────┘
```

1. **App A** (e.g., Keycloak) publishes XRDs and Compositions in its `crossplane/` directory
2. Platform admins install them on the cluster: `kubectl apply -f crossplane/`
3. **App B** creates Claims in its platform Helm chart to provision resources from App A

## Writing a Composition

### 1. Define the XRD

```yaml
apiVersion: apiextensions.crossplane.io/v1
kind: CompositeResourceDefinition
metadata:
  name: xkeycloakrealms.identity.example.com
spec:
  group: identity.example.com
  names:
    kind: XKeycloakRealm
    plural: xkeycloakrealms
  claimNames:
    kind: KeycloakRealmClaim
    plural: keycloakrealmclaims
  versions:
    - name: v1alpha1
      served: true
      referenceable: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                realmName:
                  type: string
              required: [realmName]
```

### 2. Create the Composition

```yaml
apiVersion: apiextensions.crossplane.io/v1
kind: Composition
metadata:
  name: keycloak-realm
spec:
  compositeTypeRef:
    apiVersion: identity.example.com/v1alpha1
    kind: XKeycloakRealm
  resources:
    - name: realm
      base:
        apiVersion: keycloak.crossplane.io/v1alpha1
        kind: Realm
        spec:
          forProvider:
            enabled: true
          providerConfigRef:
            name: keycloak-provider
      patches:
        - fromFieldPath: spec.realmName
          toFieldPath: spec.forProvider.realm
```

### 3. Add an example Claim

```yaml
apiVersion: identity.example.com/v1alpha1
kind: KeycloakRealmClaim
metadata:
  name: my-realm
spec:
  realmName: my-app
```

## Installing on the Cluster

```bash
kubectl apply -f crossplane/
```

This makes the XRDs and Compositions available cluster-wide for other apps to consume.
