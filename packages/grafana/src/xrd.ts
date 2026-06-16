import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { Profile, FeatureToggle } from '@platform-engineering/shared';

export interface SsoConfig {
  readonly provider?: 'generic_oauth' | 'azure_ad' | 'okta';
  readonly clientId?: string;
}

export interface IngressConfig {
  readonly tls?: boolean;
  readonly ingressClass?: string;
}

export interface GrafanaInstanceSpec {
  readonly profile: Profile;
  readonly domain: string;
  readonly features?: {
    readonly sso?: FeatureToggle<SsoConfig>;
    readonly alerting?: FeatureToggle;
    readonly ingress?: FeatureToggle<IngressConfig>;
  };
  readonly config?: {
    readonly replicas?: number;
    readonly storageGB?: number;
    readonly adminEmail?: string;
  };
  readonly overrides?: {
    readonly instanceClass?: string;
    readonly storageClass?: string;
  };
}

export interface GrafanaInstanceProps {
  readonly spec: GrafanaInstanceSpec;
}

export class GrafanaInstanceXrd extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new ApiObject(this, 'xrd', {
      apiVersion: 'apiextensions.crossplane.io/v2',
      kind: 'CompositeResourceDefinition',
      metadata: {
        name: 'grafanainstances.platform.yourcompany.io',
      },
      spec: {
        group: 'platform.yourcompany.io',
        names: {
          kind: 'GrafanaInstance',
          plural: 'grafanainstances',
          singular: 'grafanainstance',
          shortNames: ['gi'],
        },
        claimNames: {
          kind: 'GrafanaInstanceClaim',
          plural: 'grafanainstanceclaims',
        },
        connectionSecretKeys: ['admin-url', 'admin-password', 'service-endpoint'],
        versions: [
          {
            name: 'v1',
            served: true,
            referenceable: true,
            schema: {
              openAPIV3Schema: {
                type: 'object',
                properties: {
                  spec: {
                    type: 'object',
                    required: ['profile', 'domain'],
                    properties: {
                      profile: {
                        type: 'string',
                        enum: ['development', 'production', 'staging'],
                      },
                      domain: {
                        type: 'string',
                      },
                      features: {
                        type: 'object',
                        properties: {
                          sso: {
                            type: 'object',
                            required: ['enabled'],
                            properties: {
                              enabled: { type: 'boolean' },
                              config: {
                                type: 'object',
                                properties: {
                                  provider: {
                                    type: 'string',
                                    enum: ['generic_oauth', 'azure_ad', 'okta'],
                                  },
                                  clientId: { type: 'string' },
                                },
                              },
                              secretRef: {
                                type: 'object',
                                required: ['source'],
                                properties: {
                                  source: { type: 'string' },
                                  store: { type: 'string' },
                                  path: { type: 'string' },
                                  property: { type: 'string' },
                                  name: { type: 'string' },
                                  namespace: { type: 'string' },
                                },
                              },
                            },
                          },
                          alerting: {
                            type: 'object',
                            required: ['enabled'],
                            properties: {
                              enabled: { type: 'boolean' },
                              secretRef: {
                                type: 'object',
                                required: ['source'],
                                properties: {
                                  source: { type: 'string' },
                                  store: { type: 'string' },
                                  path: { type: 'string' },
                                  property: { type: 'string' },
                                  name: { type: 'string' },
                                  namespace: { type: 'string' },
                                },
                              },
                            },
                          },
                          ingress: {
                            type: 'object',
                            required: ['enabled'],
                            properties: {
                              enabled: { type: 'boolean' },
                              config: {
                                type: 'object',
                                properties: {
                                  tls: { type: 'boolean' },
                                  ingressClass: { type: 'string' },
                                },
                              },
                            },
                          },
                        },
                      },
                      config: {
                        type: 'object',
                        properties: {
                          replicas: { type: 'integer', minimum: 1 },
                          storageGB: { type: 'integer', minimum: 1 },
                          adminEmail: { type: 'string' },
                        },
                      },
                      overrides: {
                        type: 'object',
                        properties: {
                          instanceClass: { type: 'string' },
                          storageClass: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    });
  }
}
