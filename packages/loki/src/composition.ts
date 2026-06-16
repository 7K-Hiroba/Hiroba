import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { optionalPatch, transformMap } from '@platform-engineering/shared';

export class LokiInstanceComposition extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new ApiObject(this, 'composition', {
      apiVersion: 'apiextensions.crossplane.io/v1',
      kind: 'Composition',
      metadata: {
        name: 'lokiinstance-composition',
        labels: {
          'platform.yourcompany.io/product': 'loki',
        },
      },
      spec: {
        compositeTypeRef: {
          apiVersion: 'platform.yourcompany.io/v1',
          kind: 'LokiInstance',
        },
        mode: 'Pipeline',
        pipeline: [
          {
            step: 'patch-and-transform',
            functionRef: {
              name: 'function-patch-and-transform',
            },
            input: {
              apiVersion: 'pt.fn.crossplane.io/v1beta1',
              kind: 'Resources',
              resources: [
                {
                  name: 'lokistack',
                  base: {
                    apiVersion: 'loki.grafana.com/v1',
                    kind: 'LokiStack',
                    metadata: {
                      name: '',
                    },
                    spec: {
                      size: '1x.extra-small',
                      storage: {
                        schemas: [
                          {
                            effectiveDate: '2024-01-01',
                            version: 'v13',
                          },
                        ],
                        secret: {
                          name: 'loki-storage',
                          type: 's3',
                        },
                      },
                      storageClassName: 'standard',
                      tenants: {
                        mode: 'openshift-logging',
                      },
                    },
                  },
                  patches: [
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.profile',
                      toFieldPath: 'spec.size',
                      transforms: [
                        transformMap({
                          development: '1x.extra-small',
                          staging: '1x.small',
                          production: '1x.medium',
                        }),
                      ],
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.profile',
                      toFieldPath: 'spec.storage.secret.type',
                      transforms: [
                        transformMap({
                          development: 'local',
                          staging: 's3',
                          production: 's3',
                        }),
                      ],
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.storage',
                      toFieldPath: 'spec.storage.secret.type',
                      policy: { fromFieldPath: 'Optional' },
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.retentionDays',
                      toFieldPath: 'spec.limits.global.retention.days',
                      policy: { fromFieldPath: 'Optional' },
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.profile',
                      toFieldPath: 'spec.replication.factor',
                      transforms: [
                        transformMap({
                          development: '1',
                          staging: '2',
                          production: '3',
                        }),
                      ],
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.replication',
                      toFieldPath: 'spec.replication.factor',
                      policy: { fromFieldPath: 'Optional' },
                    },
                  ],
                },
                {
                  name: 's3-bucket',
                  base: {
                    apiVersion: 's3.aws.upbound.io/v1beta1',
                    kind: 'Bucket',
                    metadata: {
                      name: '',
                    },
                    spec: {
                      deletionPolicy: 'Delete',
                      forProvider: {
                        region: 'us-east-1',
                      },
                    },
                  },
                  patches: [
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.storage',
                      toFieldPath: 'spec.replicas',
                      transforms: [
                        transformMap({
                          s3: '1',
                          local: '0',
                        }),
                      ],
                    },
                    {
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
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'metadata.labels[team]',
                      toFieldPath: 'spec.forProvider.tags[team]',
                      policy: { fromFieldPath: 'Optional' },
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'metadata.labels[cost-center]',
                      toFieldPath: 'spec.forProvider.tags[cost-center]',
                      policy: { fromFieldPath: 'Optional' },
                    },
                  ],
                },
                {
                  name: 's3-credentials',
                  base: {
                    apiVersion: 'external-secrets.io/v1beta1',
                    kind: 'ExternalSecret',
                    metadata: {
                      name: 'loki-storage',
                    },
                    spec: {
                      refreshInterval: '1h',
                      secretStoreRef: {
                        kind: 'ClusterSecretStore',
                        name: 'platform-vault',
                      },
                      target: {
                        name: 'loki-storage',
                        creationPolicy: 'Owner',
                      },
                      data: [
                        {
                          secretKey: 'endpoint',
                          remoteRef: {
                            key: 'platform/loki/s3',
                            property: 'endpoint',
                          },
                        },
                        {
                          secretKey: 'bucketnames',
                          remoteRef: {
                            key: 'platform/loki/s3',
                            property: 'bucket',
                          },
                        },
                        {
                          secretKey: 'access_key_id',
                          remoteRef: {
                            key: 'platform/loki/s3',
                            property: 'access_key_id',
                          },
                        },
                        {
                          secretKey: 'access_key_secret',
                          remoteRef: {
                            key: 'platform/loki/s3',
                            property: 'secret_access_key',
                          },
                        },
                      ],
                    },
                  },
                  patches: [
                    optionalPatch('spec.claimRef.namespace', 'metadata.namespace'),
                  ],
                },
              ],
            },
          },
        ],
      },
    });
  }
}
