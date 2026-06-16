import { ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { FeatureToggle } from '@platform-engineering/shared';
import { FeatureImplementation, featureEnabledPatch } from '../lib/feature-toggle';

export interface IngressConfig {
  readonly tls?: boolean;
  readonly ingressClass?: string;
}

export class IngressFeature implements FeatureImplementation {
  constructor(private readonly config: FeatureToggle<IngressConfig>) {}

  generateResources(scope: Construct, namespace: string): ApiObject[] {
    if (!this.config.enabled) {
      return [];
    }

    const tls = this.config.config?.tls ?? true;
    const ingressClass = this.config.config?.ingressClass ?? 'nginx';

    return [
      new ApiObject(scope, 'ingress', {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: 'grafana',
          namespace,
          annotations: {
            'kubernetes.io/ingress.class': ingressClass,
            'external-dns.alpha.kubernetes.io/hostname': '',
            ...(tls ? { 'cert-manager.io/cluster-issuer': 'letsencrypt' } : {}),
          },
        },
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
                        name: 'grafana-service',
                        port: { number: 3000 },
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
                    secretName: 'grafana-tls',
                  },
                ],
              }
            : {}),
        },
      }),
      new ApiObject(scope, 'certificate', {
        apiVersion: 'cert-manager.io/v1',
        kind: 'Certificate',
        metadata: {
          name: 'grafana',
          namespace,
        },
        spec: {
          secretName: 'grafana-tls',
          issuerRef: {
            name: tls ? 'letsencrypt' : 'selfsigned',
            kind: 'ClusterIssuer',
          },
          dnsNames: [''],
        },
      }),
    ];
  }

  generatePatches(): object[] {
    return [
      featureEnabledPatch('spec.features.ingress.enabled', 'spec.config.server.root_url'),
      {
        type: 'FromCompositeFieldPath',
        fromFieldPath: 'spec.domain',
        toFieldPath: 'spec.ingress.spec.rules[0].host',
      },
      {
        type: 'FromCompositeFieldPath',
        fromFieldPath: 'spec.domain',
        toFieldPath: 'spec.ingress.spec.tls[0].hosts[0]',
        policy: { fromFieldPath: 'Optional' },
      },
      {
        type: 'FromCompositeFieldPath',
        fromFieldPath: 'spec.domain',
        toFieldPath: 'spec.certificate.spec.dnsNames[0]',
      },
      {
        type: 'FromCompositeFieldPath',
        fromFieldPath: 'spec.domain',
        toFieldPath: 'spec.ingress.metadata.annotations["external-dns.alpha.kubernetes.io/hostname"]',
      },
    ];
  }
}
