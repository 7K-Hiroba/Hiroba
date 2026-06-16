import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';

export interface QuotaSpec {
  readonly scope: string;
  readonly scopeKind: string;
  readonly limits: QuotaLimit[];
}

export interface QuotaLimit {
  readonly resource: string;
  readonly max?: number;
  readonly min?: number;
  readonly default?: number;
}

export class PlatformQuotaXrd extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new ApiObject(this, 'xrd', {
      apiVersion: 'apiextensions.crossplane.io/v2',
      kind: 'CompositeResourceDefinition',
      metadata: {
        name: 'platformquotas.platform.yourcompany.io',
      },
      spec: {
        group: 'platform.yourcompany.io',
        names: {
          kind: 'PlatformQuota',
          plural: 'platformquotas',
          singular: 'platformquota',
          shortNames: ['pquota'],
        },
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
                    properties: {
                      scope: { type: 'string' },
                      scopeKind: { type: 'string' },
                      limits: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['resource'],
                          properties: {
                            resource: { type: 'string' },
                            max: { type: 'integer' },
                            min: { type: 'integer' },
                            default: { type: 'integer' },
                          },
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

export function createPlatformQuota(scope: Construct, id: string, spec: QuotaSpec): Chart {
  const chart = new Chart(scope, id);

  new ApiObject(chart, 'quota', {
    apiVersion: 'platform.yourcompany.io/v1',
    kind: 'PlatformQuota',
    metadata: { name: `${spec.scope}-quota` },
    spec,
  });

  return chart;
}
