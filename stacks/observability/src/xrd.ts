import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { Profile, FeatureToggle } from '@platform-engineering/shared';

export interface GrafanaModuleConfig {
  readonly enabled: boolean;
  readonly domain?: string;
  readonly features?: {
    readonly sso?: FeatureToggle;
    readonly alerting?: FeatureToggle;
  };
}

export interface LokiModuleConfig {
  readonly enabled: boolean;
  readonly storage?: 's3' | 'local';
  readonly retentionDays?: number;
}

export interface PrometheusModuleConfig {
  readonly enabled: boolean;
  readonly retentionDays?: number;
  readonly alerting?: FeatureToggle;
}

export interface ObservabilityStackSpec {
  readonly profile: Profile;
  readonly domain: string;
  readonly retentionDays?: number;
  readonly modules: {
    readonly grafana?: GrafanaModuleConfig;
    readonly loki?: LokiModuleConfig;
    readonly prometheus?: PrometheusModuleConfig;
  };
  readonly globalFeatures?: {
    readonly sso?: FeatureToggle;
    readonly alerting?: FeatureToggle;
  };
  readonly costCenter: string;
  readonly team: string;
}

export class ObservabilityStackXrd extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new ApiObject(this, 'xrd', {
      apiVersion: 'apiextensions.crossplane.io/v2',
      kind: 'CompositeResourceDefinition',
      metadata: {
        name: 'observabilitystacks.platform.yourcompany.io',
      },
      spec: {
        group: 'platform.yourcompany.io',
        names: {
          kind: 'ObservabilityStack',
          plural: 'observabilitystacks',
          singular: 'observabilitystack',
          shortNames: ['obs'],
        },
        claimNames: {
          kind: 'ObservabilityStackClaim',
          plural: 'observabilitystackclaims',
        },
        connectionSecretKeys: [
          'grafana-url',
          'grafana-admin-password',
          'loki-endpoint',
          'loki-read-url',
          'loki-write-url',
          'prometheus-url',
          'alertmanager-url',
        ],
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
                    required: ['profile', 'domain', 'modules', 'costCenter', 'team'],
                    properties: {
                      profile: {
                        type: 'string',
                        enum: ['development', 'production', 'staging'],
                      },
                      domain: { type: 'string' },
                      retentionDays: { type: 'integer', minimum: 1 },
                      modules: {
                        type: 'object',
                        properties: {
                          grafana: {
                            type: 'object',
                            required: ['enabled'],
                            properties: {
                              enabled: { type: 'boolean' },
                              domain: { type: 'string' },
                              features: {
                                type: 'object',
                                properties: {
                                  sso: {
                                    type: 'object',
                                    required: ['enabled'],
                                    properties: {
                                      enabled: { type: 'boolean' },
                                    },
                                  },
                                  alerting: {
                                    type: 'object',
                                    required: ['enabled'],
                                    properties: {
                                      enabled: { type: 'boolean' },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          loki: {
                            type: 'object',
                            required: ['enabled'],
                            properties: {
                              enabled: { type: 'boolean' },
                              storage: { type: 'string', enum: ['s3', 'local'] },
                              retentionDays: { type: 'integer', minimum: 1 },
                            },
                          },
                          prometheus: {
                            type: 'object',
                            required: ['enabled'],
                            properties: {
                              enabled: { type: 'boolean' },
                              retentionDays: { type: 'integer', minimum: 1 },
                              alerting: {
                                type: 'object',
                                required: ['enabled'],
                                properties: {
                                  enabled: { type: 'boolean' },
                                },
                              },
                            },
                          },
                        },
                      },
                      globalFeatures: {
                        type: 'object',
                        properties: {
                          sso: {
                            type: 'object',
                            required: ['enabled'],
                            properties: {
                              enabled: { type: 'boolean' },
                            },
                          },
                          alerting: {
                            type: 'object',
                            required: ['enabled'],
                            properties: {
                              enabled: { type: 'boolean' },
                            },
                          },
                        },
                      },
                      costCenter: { type: 'string' },
                      team: { type: 'string' },
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
