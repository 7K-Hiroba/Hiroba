import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { optionalPatch, transformMap } from '@platform-engineering/shared';
import { SsoFeature } from './features/sso';
import { AlertingFeature } from './features/alerting';

export class GrafanaInstanceComposition extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const ssoPatches = new SsoFeature({ enabled: false }).generatePatches();
    const alertingPatches = new AlertingFeature({ enabled: false }).generatePatches();

    new ApiObject(this, 'composition', {
      apiVersion: 'apiextensions.crossplane.io/v1',
      kind: 'Composition',
      metadata: {
        name: 'grafanainstance-composition',
        labels: {
          'platform.yourcompany.io/product': 'grafana',
        },
      },
      spec: {
        compositeTypeRef: {
          apiVersion: 'platform.yourcompany.io/v1',
          kind: 'GrafanaInstance',
        },
        mode: 'Pipeline',
        pipeline:
        [
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
                  name: 'grafana',
                  base: {
                    apiVersion: 'grafana.integreatly.org/v1beta1',
                    kind: 'Grafana',
                    metadata: {
                      name: '',
                      labels: {
                        'grafana-instance': 'grafana',
                      },
                    },
                    spec: {
                      config: {
                        auth: {
                          disable_login_form: 'false',
                          generic_oauth: {
                            enabled: 'false',
                          },
                        },
                        unified_alerting: {
                          enabled: 'false',
                        },
                        server: {
                          root_url: '',
                        },
                      },
                      deployment: {
                        spec: {
                          template: {
                            spec: {
                              containers: [
                                {
                                  name: 'grafana',
                                  env: [],
                                },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                  patches: [
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.profile',
                      toFieldPath: 'spec.deployment.spec.replicas',
                      transforms: [
                        transformMap({ development: '1', staging: '1', production: '2' }),
                      ],
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.config.replicas',
                      toFieldPath: 'spec.deployment.spec.replicas',
                      policy: { fromFieldPath: 'Optional' },
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.profile',
                      toFieldPath: 'spec.config.persistence.enabled',
                      transforms: [
                        transformMap({ development: 'false', staging: 'true', production: 'true' }),
                      ],
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.profile',
                      toFieldPath: 'spec.config.persistence.size',
                      transforms: [
                        transformMap({ development: '10Gi', staging: '20Gi', production: '50Gi' }),
                      ],
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.config.storageGB',
                      toFieldPath: 'spec.config.persistence.size',
                      policy: { fromFieldPath: 'Optional' },
                      transforms: [
                        {
                          type: 'string',
                          string: {
                            type: 'Format',
                            fmt: '%sGi',
                          },
                        },
                      ],
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.domain',
                      toFieldPath: 'spec.config.server.root_url',
                      transforms: [
                    {
                      type: 'string',
                      string: {
                        type: 'Format',
                        fmt: 'https://%s',
                      },
                    },
                      ],
                    },
                    ...ssoPatches,
                    ...alertingPatches,
                  ],
                },
                {
                  name: 'grafana-service',
                  base: {
                    apiVersion: 'v1',
                    kind: 'Service',
                    metadata: {
                      name: 'grafana-service',
                    },
                    spec: {
                      selector: {
                        app: 'grafana',
                      },
                      ports: [
                        {
                          port: 3000,
                          targetPort: 3000,
                        },
                      ],
                    },
                  },
                  patches: [
                    optionalPatch('spec.claimRef.namespace', 'metadata.namespace'),
                  ],
                },
                {
                  name: 'sso-external-secret',
                  base: {
                    apiVersion: 'external-secrets.io/v1beta1',
                    kind: 'ExternalSecret',
                    metadata: {
                      name: 'grafana-sso-credentials',
                    },
                    spec: {
                      refreshInterval: '1h',
                      secretStoreRef: {
                        kind: 'ClusterSecretStore',
                        name: 'platform-vault',
                      },
                      target: {
                        name: 'grafana-sso-credentials',
                        creationPolicy: 'Owner',
                      },
                      data: [
                        {
                          secretKey: 'client-id',
                          remoteRef: {
                            key: '',
                            property: 'client-id',
                          },
                        },
                        {
                          secretKey: 'client-secret',
                          remoteRef: {
                            key: '',
                            property: 'client-secret',
                          },
                        },
                      ],
                    },
                  },
                  patches: [
                    optionalPatch('spec.features.sso.secretRef.path', 'spec.data[0].remoteRef.key'),
                    optionalPatch('spec.features.sso.secretRef.path', 'spec.data[1].remoteRef.key'),
                    optionalPatch('spec.features.sso.secretRef.store', 'spec.secretStoreRef.name'),
                  ],
                },
                {
                  name: 'oauth2-proxy',
                  base: {
                    apiVersion: 'apps/v1',
                    kind: 'Deployment',
                    metadata: {
                      name: 'oauth2-proxy',
                    },
                    spec: {
                      replicas: 0,
                      selector: {
                        matchLabels: { app: 'oauth2-proxy' },
                      },
                      template: {
                        metadata: { labels: { app: 'oauth2-proxy' } },
                        spec: {
                          containers: [
                            {
                              name: 'oauth2-proxy',
                              image: 'quay.io/oauth2-proxy/oauth2-proxy:v7.5.0',
                              args: [
                                '--provider=oidc',
                                '--oidc-issuer-url=https://auth.yourcompany.com',
                                '--upstream=file:///dev/null',
                                '--http-address=0.0.0.0:4180',
                              ],
                              env: [
                                {
                                  name: 'OAUTH2_PROXY_CLIENT_ID',
                                  valueFrom: {
                                    secretKeyRef: {
                                      name: 'grafana-sso-credentials',
                                      key: 'client-id',
                                    },
                                  },
                                },
                                {
                                  name: 'OAUTH2_PROXY_CLIENT_SECRET',
                                  valueFrom: {
                                    secretKeyRef: {
                                      name: 'grafana-sso-credentials',
                                      key: 'client-secret',
                                    },
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      },
                    },
                  },
                  patches: [
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.features.sso.enabled',
                      toFieldPath: 'spec.replicas',
                      transforms: [
                        transformMap({ 'true': '1', 'false': '0' }),
                      ],
                    },
                  ],
                },
                {
                  name: 'ingress',
                  base: {
                    apiVersion: 'networking.k8s.io/v1',
                    kind: 'Ingress',
                    metadata: {
                      name: 'grafana',
                      annotations: {
                        'kubernetes.io/ingress.class': 'nginx',
                        'external-dns.alpha.kubernetes.io/hostname': '',
                      },
                    },
                    spec: {
                      ingressClassName: 'nginx',
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
                                    name: 'grafana-service',
                                    port: { number: 3000 },
                                  },
                                },
                              },
                            ],
                          },
                        },
                      ],
                    },
                  },
                  patches: [
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.features.ingress.enabled',
                      toFieldPath: 'spec.replicas',
                      policy: { fromFieldPath: 'Optional' },
                      transforms: [
                        transformMap({ 'true': '1', 'false': '0' }),
                      ],
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.domain',
                      toFieldPath: 'spec.rules[0].host',
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.domain',
                      toFieldPath: 'metadata.annotations["external-dns.alpha.kubernetes.io/hostname"]',
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.features.ingress.config.tls',
                      toFieldPath: 'spec.tls',
                      policy: { fromFieldPath: 'Optional' },
                      transforms: [
                        {
                          type: 'map',
                          map: {
                            'true': JSON.stringify([{ hosts: [''], secretName: 'grafana-tls' }]),
                            'false': '[]',
                          },
                        },
                      ],
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.domain',
                      toFieldPath: 'spec.tls[0].hosts[0]',
                      policy: { fromFieldPath: 'Optional' },
                    },
                  ],
                },
                {
                  name: 'certificate',
                  base: {
                    apiVersion: 'cert-manager.io/v1',
                    kind: 'Certificate',
                    metadata: {
                      name: 'grafana',
                    },
                    spec: {
                      secretName: 'grafana-tls',
                      issuerRef: {
                        name: 'letsencrypt',
                        kind: 'ClusterIssuer',
                      },
                      dnsNames: [''],
                    },
                  },
                  patches: [
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.domain',
                      toFieldPath: 'spec.dnsNames[0]',
                    },
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.features.ingress.enabled',
                      toFieldPath: 'spec.issuerRef.name',
                      transforms: [
                        transformMap({ 'true': 'letsencrypt', 'false': 'selfsigned' }),
                      ],
                    },
                  ],
                },
                {
                  name: 'alertmanager',
                  base: {
                    apiVersion: 'monitoring.coreos.com/v1',
                    kind: 'Alertmanager',
                    metadata: {
                      name: 'grafana-alertmanager',
                    },
                    spec: {
                      replicas: 0,
                    },
                  },
                  patches: [
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.features.alerting.enabled',
                      toFieldPath: 'spec.replicas',
                      transforms: [
                        transformMap({ 'true': '1', 'false': '0' }),
                      ],
                    },
                  ],
                },
                {
                  name: 'alert-rule-group',
                  base: {
                    apiVersion: 'grafana.integreatly.org/v1beta1',
                    kind: 'GrafanaAlertRuleGroup',
                    metadata: {
                      name: 'default-rules',
                    },
                    spec: {
                      instanceSelector: {
                        matchLabels: {
                          'grafana-instance': 'grafana',
                        },
                      },
                      interval: 60,
                      rules: [],
                    },
                  },
                  patches: [
                    {
                      type: 'FromCompositeFieldPath',
                      fromFieldPath: 'spec.features.alerting.enabled',
                      toFieldPath: 'spec.interval',
                      transforms: [
                        transformMap({ 'true': '60', 'false': '0' }),
                      ],
                    },
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
