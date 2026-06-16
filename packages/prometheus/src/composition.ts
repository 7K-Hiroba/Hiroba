import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { optionalPatch, transformMap } from '@platform-engineering/shared';

export class PrometheusInstanceComposition extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new ApiObject(this, 'composition', {
      apiVersion: 'apiextensions.crossplane.io/v1',
      kind: 'Composition',
      metadata: {
        name: 'prometheusinstance-composition',
        labels: {
          'platform.yourcompany.io/product': 'prometheus',
        },
      },
      spec: {
        compositeTypeRef: {
          apiVersion: 'platform.yourcompany.io/v1',
          kind: 'PrometheusInstance',
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
                  name: 'prometheus',
                  base: {
                    apiVersion: 'monitoring.coreos.com/v1',
                    kind: 'Prometheus',
                    metadata: {
                      name: '',
                    },
                    spec: {
                      replicas: 1,
                      retention: '7d',
                      serviceAccountName: 'prometheus',
                      serviceMonitorSelector: {},
                    },
                  },
                  patches: [
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.profile',
                      toFieldPath: 'spec.replicas',
                      transforms: [
                        transformMap({ development: '1', staging: '1', production: '2' }),
                      ],
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.retentionDays',
                      toFieldPath: 'spec.retention',
                      policy: { fromFieldPath: 'Optional' },
                      transforms: [
                        {
                          type: 'string',
                          string: {
                            type: 'Format',
                            fmt: '%sd',
                          },
                        },
                      ],
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.profile',
                      toFieldPath: 'spec.retention',
                      transforms: [
                        transformMap({ development: '7d', staging: '30d', production: '90d' }),
                      ],
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.federation.enabled',
                      toFieldPath: 'spec.enableAdminAPI',
                      transforms: [
                        transformMap({ 'true': 'true', 'false': 'false' }),
                      ],
                    },
                  ],
                },
                {
                  name: 'service-monitor',
                  base: {
                    apiVersion: 'monitoring.coreos.com/v1',
                    kind: 'ServiceMonitor',
                    metadata: {
                      name: 'prometheus-self',
                    },
                    spec: {
                      selector: {
                        matchLabels: {
                          app: 'prometheus',
                        },
                      },
                      endpoints: [
                        {
                          port: 'web',
                        },
                      ],
                    },
                  },
                  patches: [
                    optionalPatch('spec.claimRef.namespace', 'metadata.namespace'),
                  ],
                },
                {
                  name: 'alertmanager',
                  base: {
                    apiVersion: 'monitoring.coreos.com/v1',
                    kind: 'Alertmanager',
                    metadata: {
                      name: 'prometheus-alertmanager',
                    },
                    spec: {
                      replicas: 0,
                    },
                  },
                  patches: [
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.alerting.enabled',
                      toFieldPath: 'spec.replicas',
                      transforms: [
                        transformMap({ 'true': '1', 'false': '0' }),
                      ],
                    },
                  ],
                },
                {
                  name: 'alertmanager-credentials',
                  base: {
                    apiVersion: 'external-secrets.io/v1beta1',
                    kind: 'ExternalSecret',
                    metadata: {
                      name: 'prometheus-alertmanager-credentials',
                    },
                    spec: {
                      refreshInterval: '1h',
                      secretStoreRef: {
                        kind: 'ClusterSecretStore',
                        name: 'platform-vault',
                      },
                      target: {
                        name: 'prometheus-alertmanager-credentials',
                        creationPolicy: 'Owner',
                      },
                      data: [
                        {
                          secretKey: 'pagerduty-key',
                          remoteRef: {
                            key: 'platform/prometheus/pagerduty',
                            property: 'key',
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
