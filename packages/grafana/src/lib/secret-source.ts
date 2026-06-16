import { ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { SecretRef } from '@platform-engineering/shared';

export function externalSecretProps(
  name: string,
  namespace: string,
  secretRef: SecretRef
): object {
  return {
    apiVersion: 'external-secrets.io/v1beta1',
    kind: 'ExternalSecret',
    metadata: {
      name,
      namespace,
    },
    spec: {
      refreshInterval: '1h',
      secretStoreRef: {
        kind: 'ClusterSecretStore',
        name: secretRef.store || 'platform-vault',
      },
      target: {
        name,
        creationPolicy: 'Owner',
      },
      data: [
        {
          secretKey: 'client-id',
          remoteRef: {
            key: secretRef.path,
            property: secretRef.property || 'client-id',
          },
        },
        {
          secretKey: 'client-secret',
          remoteRef: {
            key: secretRef.path,
            property: 'client-secret',
          },
        },
      ],
    },
  };
}

export function createExternalSecret(
  scope: Construct,
  id: string,
  name: string,
  namespace: string,
  secretRef: SecretRef
): ApiObject {
  return new ApiObject(scope, id, externalSecretProps(name, namespace, secretRef) as any);
}

export function secretKeyRefEnv(name: string, secretName: string, key: string): object {
  return {
    name,
    valueFrom: {
      secretKeyRef: {
        name: secretName,
        key,
      },
    },
  };
}
