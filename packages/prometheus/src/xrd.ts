import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { Profile, FeatureToggle } from '@platform-engineering/shared';

export interface PrometheusInstanceSpec {
  readonly profile: Profile;
  readonly retentionDays?: number;
  readonly alerting?: FeatureToggle;
  readonly federation?: FeatureToggle;
}

export class PrometheusInstanceXrd extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new ApiObject(this, 'xrd', {
      apiVersion: 'apiextensions.crossplane.io/v2',
      kind: 'CompositeResourceDefinition',
      metadata: {
        name: 'prometheusinstances.platform.yourcompany.io',
      },
      spec: {
        group: 'platform.yourcompany.io',
        names: {
          kind: 'PrometheusInstance',
          plural: 'prometheusinstances',
          singular: 'prometheusinstance',
          shortNames: ['pi'],
        },
        claimNames: {
          kind: 'PrometheusInstanceClaim',
          plural: 'prometheusinstanceclaims',
        },
        connectionSecretKeys: ['prometheus-url', 'alertmanager-url', 'federation-endpoint'],
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
                    required: ['profile'],
                    properties: {
                      profile: {
                        type: 'string',
                        enum: ['development', 'production', 'staging'],
                      },
                      retentionDays: {
                        type: 'integer',
                        minimum: 1,
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
                            },
                          },
                        },
                      },
                      federation: {
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
            },
          },
        ],
      },
    });
  }
}
