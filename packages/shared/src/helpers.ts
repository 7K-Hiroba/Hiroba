import { ApiObject, ApiObjectProps } from 'cdk8s';
import { Construct } from 'constructs';

export function createApiObject(scope: Construct, id: string, props: ApiObjectProps): ApiObject {
  return new ApiObject(scope, id, props);
}

export function stringFormat(fmt: string, value: string): string {
  return fmt.replace('%s', value);
}

export function labelPatch(fromPath: string, toPath: string): object {
  return {
    type: 'FromCompositeFieldPath',
    fromFieldPath: fromPath,
    toFieldPath: toPath,
  };
}

export function optionalPatch(fromPath: string, toPath: string): object {
  return {
    type: 'FromCompositeFieldPath',
    fromFieldPath: fromPath,
    toFieldPath: toPath,
    policy: {
      fromFieldPath: 'Optional',
    },
  };
}

export function transformString(fmt: string): object {
  return {
    type: 'string',
    string: {
      type: 'Format',
      fmt,
    },
  };
}

export function transformMap(mapping: Record<string, string>): object {
  return {
    type: 'map',
    map: mapping,
  };
}

export function mandatoryLabelPatches(): object[] {
  return [
    optionalPatch('metadata.labels[team]', 'spec.forProvider.tags[team]'),
    optionalPatch('metadata.labels[cost-center]', 'spec.forProvider.tags[cost-center]'),
    optionalPatch('metadata.labels[platform.7kgroup.org/stack]', 'spec.forProvider.tags[platform-stack]'),
    optionalPatch('spec.profile', 'spec.forProvider.tags[environment]'),
  ];
}

export function deletionPolicyPatch(): object {
  return {
    type: 'FromCompositeFieldPath',
    fromFieldPath: 'spec.profile',
    toFieldPath: 'spec.deletionPolicy',
    transforms: [
      transformMap({
        development: 'Delete',
        staging: 'Delete',
        production: 'Orphan',
      }),
    ],
  };
}

export function regionPatch(providerFieldPath = 'spec.forProvider.region'): object {
  return {
    type: 'FromCompositeFieldPath',
    fromFieldPath: 'spec.region',
    toFieldPath: providerFieldPath,
    policy: { fromFieldPath: 'Optional' },
  };
}

export function providerConfigRefPatch(providerConfigFieldPath = 'spec.providerConfigRef.name'): object {
  return {
    type: 'FromCompositeFieldPath',
    fromFieldPath: 'spec.providerConfigRef.name',
    toFieldPath: providerConfigFieldPath,
    policy: { fromFieldPath: 'Optional' },
  };
}

export function featureEnabledPatch(featurePath: string, targetPath: string): object {
  return {
    type: 'FromCompositeFieldPath',
    fromFieldPath: featurePath,
    toFieldPath: targetPath,
    transforms: [
      transformMap({
        true: 'true',
        false: 'false',
      }),
    ],
  };
}

export function featureReplicaPatch(featurePath: string, targetPath = 'spec.replicas'): object {
  return {
    type: 'FromCompositeFieldPath',
    fromFieldPath: featurePath,
    toFieldPath: targetPath,
    transforms: [
      transformMap({
        true: '1',
        false: '0',
      }),
    ],
  };
}

export function externalSecretResource(
  scope: Construct,
  id: string,
  name: string,
  secretPath: string,
  properties: string[],
  store = 'platform-vault',
): ApiObject {
  return new ApiObject(scope, id, {
    apiVersion: 'external-secrets.io/v1',
    kind: 'ExternalSecret',
    metadata: { name },
    spec: {
      refreshInterval: '1h',
      secretStoreRef: {
        kind: 'ClusterSecretStore',
        name: store,
      },
      target: {
        name,
        creationPolicy: 'Owner',
      },
      data: properties.map((property) => ({
        secretKey: property,
        remoteRef: {
          key: secretPath,
          property,
        },
      })),
    },
  });
}

export function ingressResource(
  scope: Construct,
  id: string,
  name: string,
  serviceName: string,
  servicePort: number,
  ingressClass = 'nginx',
  tls = true,
): ApiObject {
  const annotations: Record<string, string> = {
    'kubernetes.io/ingress.class': ingressClass,
    'external-dns.alpha.kubernetes.io/hostname': '',
  };
  if (tls) {
    annotations['cert-manager.io/cluster-issuer'] = 'letsencrypt';
  }

  return new ApiObject(scope, id, {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: { name, annotations },
    spec: {
      ingressClassName: ingressClass,
      rules: [
        {
          host: '',
          http: {
            paths: [
              {
                path: '/',
                pathType: 'Prefix',
                backend: {
                  service: {
                    name: serviceName,
                    port: { number: servicePort },
                  },
                },
              },
            ],
          },
        },
      ],
      ...(tls
        ? {
            tls: [
              {
                hosts: [''],
                secretName: `${name}-tls`,
              },
            ],
          }
        : {}),
    },
  });
}

export function certificateResource(scope: Construct, id: string, name: string, issuerName = 'letsencrypt'): ApiObject {
  return new ApiObject(scope, id, {
    apiVersion: 'cert-manager.io/v1',
    kind: 'Certificate',
    metadata: { name },
    spec: {
      secretName: `${name}-tls`,
      issuerRef: {
        name: issuerName,
        kind: 'ClusterIssuer',
      },
      dnsNames: [''],
    },
  });
}

export function connectionSecretAggregator(
  scope: Construct,
  id: string,
  keys: Array<{ from: string; to: string }>,
): ApiObject {
  return new ApiObject(scope, id, {
    apiVersion: 'kubernetes.crossplane.io/v1alpha1',
    kind: 'Object',
    metadata: { name: 'connection-secret-aggregator' },
    spec: {
      forProvider: {
        manifest: {
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: {
            name: '',
          },
          stringData: Object.fromEntries(keys.map((k) => [k.to, ''])),
        },
      },
    },
  });
}
