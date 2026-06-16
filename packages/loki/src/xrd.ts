import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { Profile } from '@platform-engineering/shared';

export interface LokiInstanceSpec {
  readonly profile: Profile;
  readonly storage?: 's3' | 'local';
  readonly retentionDays?: number;
  readonly replication?: number;
}

export class LokiInstanceXrd extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new ApiObject(this, 'xrd', {
      apiVersion: 'apiextensions.crossplane.io/v2',
      kind: 'CompositeResourceDefinition',
      metadata: {
        name: 'lokiinstances.platform.yourcompany.io',
      },
      spec: {
        group: 'platform.yourcompany.io',
        names: {
          kind: 'LokiInstance',
          plural: 'lokiinstances',
          singular: 'lokiinstance',
          shortNames: ['li'],
        },
        claimNames: {
          kind: 'LokiInstanceClaim',
          plural: 'lokiinstanceclaims',
        },
        connectionSecretKeys: ['endpoint', 'read-url', 'write-url', 'tenant-id'],
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
                      storage: {
                        type: 'string',
                        enum: ['s3', 'local'],
                      },
                      retentionDays: {
                        type: 'integer',
                        minimum: 1,
                      },
                      replication: {
                        type: 'integer',
                        minimum: 1,
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
