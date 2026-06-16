import { ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { FeatureToggle } from '@platform-engineering/shared';
import { FeatureImplementation, featureEnabledPatch } from '../lib/feature-toggle';
import { createExternalSecret, secretKeyRefEnv } from '../lib/secret-source';

export interface SsoConfig {
  readonly provider?: 'generic_oauth' | 'azure_ad' | 'okta';
  readonly clientId?: string;
}

export class SsoFeature implements FeatureImplementation {
  constructor(private readonly config: FeatureToggle<SsoConfig>) {}

  generateResources(scope: Construct, namespace: string): ApiObject[] {
    if (!this.config.enabled) {
      return [];
    }

    const resources: ApiObject[] = [];

    if (this.config.secretRef?.source === 'external-secrets') {
      resources.push(createExternalSecret(scope, 'sso-external-secret', 'grafana-sso-credentials', namespace, this.config.secretRef));
    }

    resources.push(
      new ApiObject(scope, 'oauth2-proxy', {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: {
          name: 'oauth2-proxy',
          namespace,
        },
        spec: {
          replicas: 1,
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
                    secretKeyRefEnv('OAUTH2_PROXY_CLIENT_ID', 'grafana-sso-credentials', 'client-id'),
                    secretKeyRefEnv('OAUTH2_PROXY_CLIENT_SECRET', 'grafana-sso-credentials', 'client-secret'),
                  ],
                },
              ],
            },
          },
        },
      })
    );

    return resources;
  }

  generatePatches(): object[] {
    return [
      featureEnabledPatch('spec.features.sso.enabled', 'spec.config.auth.generic_oauth.enabled'),
      featureEnabledPatch('spec.features.sso.enabled', 'spec.config.auth.disable_login_form'),
      {
        type: 'FromCompositeFieldPath',
        fromFieldPath: 'spec.features.sso.enabled',
        toFieldPath: 'spec.deployment.spec.template.spec.containers[0].env',
        policy: { fromFieldPath: 'Optional' },
        transforms: [
          {
            type: 'map',
            map: {
              'true': JSON.stringify([
                { name: 'GF_AUTH_GENERIC_OAUTH_ENABLED', value: 'true' },
                {
                  name: 'GF_AUTH_GENERIC_OAUTH_CLIENT_ID',
                  valueFrom: { secretKeyRef: { name: 'grafana-sso-credentials', key: 'client-id' } },
                },
                {
                  name: 'GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET',
                  valueFrom: { secretKeyRef: { name: 'grafana-sso-credentials', key: 'client-secret' } },
                },
              ]),
              'false': '[]',
            },
          },
        ],
      },
    ];
  }
}
