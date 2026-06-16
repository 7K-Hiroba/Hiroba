import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';

export interface PlatformCatalogEntry {
  readonly name: string;
  readonly version: string;
  readonly category: string;
  readonly description: string;
  readonly primitives: string[];
  readonly maintainers: string[];
  readonly deprecation?: {
    readonly message: string;
    readonly replacement?: string;
  };
}

export class PlatformCatalogXrd extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new ApiObject(this, 'xrd', {
      apiVersion: 'apiextensions.crossplane.io/v2',
      kind: 'CompositeResourceDefinition',
      metadata: {
        name: 'platformcatalogs.platform.yourcompany.io',
      },
      spec: {
        group: 'platform.yourcompany.io',
        names: {
          kind: 'PlatformCatalog',
          plural: 'platformcatalogs',
          singular: 'platformcatalog',
          shortNames: ['pcat'],
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
                      products: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['name', 'version', 'category', 'description', 'primitives', 'maintainers'],
                          properties: {
                            name: { type: 'string' },
                            version: { type: 'string' },
                            category: { type: 'string' },
                            description: { type: 'string' },
                            primitives: {
                              type: 'array',
                              items: { type: 'string' },
                            },
                            maintainers: {
                              type: 'array',
                              items: { type: 'string' },
                            },
                            deprecation: {
                              type: 'object',
                              properties: {
                                message: { type: 'string' },
                                replacement: { type: 'string' },
                              },
                            },
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

export function createPlatformCatalogChart(scope: Construct, id: string, products: PlatformCatalogEntry[]): Chart {
  const chart = new Chart(scope, id);

  new PlatformCatalogXrd(chart, 'xrd');

  new ApiObject(chart, 'catalog', {
    apiVersion: 'platform.yourcompany.io/v1',
    kind: 'PlatformCatalog',
    metadata: {
      name: 'platform-catalog',
    },
    spec: {
      products,
    },
  });

  return chart;
}
