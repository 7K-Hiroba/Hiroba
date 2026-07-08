import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { InfrastructureProvider } from './types';
import { PlatformProductConfig, ProductMetadata } from './platform';

export function createProviderCompositionName(productName: string, provider: InfrastructureProvider): string {
  return `${productName}-${provider}-composition`;
}

export function createProviderCompositionLabels(
  productName: string,
  provider: InfrastructureProvider,
): Record<string, string> {
  return {
    'platform.yourcompany.io/product': productName,
    'platform.yourcompany.io/provider': provider,
  };
}

export function createPlatformXrd(
  scope: Construct,
  id: string,
  config: PlatformProductConfig,
  schemaProperties: object,
  requiredFields: string[] = [],
): ApiObject {
  const versions: object[] = [
    {
      name: config.version,
      served: true,
      referenceable: true,
      schema: {
        openAPIV3Schema: {
          type: 'object',
          properties: {
            spec: {
              type: 'object',
              required: requiredFields,
              properties: schemaProperties,
            },
          },
        },
      },
    },
  ];

  const spec: Record<string, any> = {
    group: config.group,
    names: {
      kind: config.kind,
      plural: config.plural,
      singular: config.singular,
    },
    versions,
  };

  if (config.shortNames) {
    spec.names.shortNames = config.shortNames;
  }

  if (config.claimNames) {
    spec.claimNames = config.claimNames;
  }

  if (config.connectionSecretKeys) {
    spec.connectionSecretKeys = config.connectionSecretKeys;
  }

  return new ApiObject(scope, id, {
    apiVersion: 'apiextensions.crossplane.io/v2',
    kind: 'CompositeResourceDefinition',
    metadata: {
      name: `${config.plural}.${config.group}`,
    },
    spec,
  });
}

export function createBaseSchema(): object {
  return {
    profile: {
      type: 'string',
      enum: ['development', 'production', 'staging'],
    },
    provider: {
      type: 'string',
      enum: ['aws', 'gcp', 'azure', 'garage', 'cnpg', 'local'],
      description: 'Infrastructure provider for this resource. Defaults to the cluster default if unset.',
    },
    team: {
      type: 'string',
    },
    costCenter: {
      type: 'string',
    },
    region: {
      type: 'string',
    },
    providerConfigRef: {
      type: 'string',
    },
    deletionPolicy: {
      type: 'string',
      enum: ['Delete', 'Orphan', 'Retain'],
    },
    features: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['enabled'],
        properties: {
          enabled: { type: 'boolean' },
          config: { type: 'object' },
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
    },
  };
}

export abstract class BasePlatformProduct extends Chart {
  abstract readonly config: PlatformProductConfig;
  abstract readonly metadata: ProductMetadata;

  constructor(scope: Construct, id: string) {
    super(scope, id);
  }

  defineXrd(): ApiObject {
    return createPlatformXrd(this, 'xrd', this.config, this.getSchemaProperties(), this.getRequiredFields());
  }

  abstract getSchemaProperties(): object;
  abstract getRequiredFields(): string[];
  abstract defineComposition(): ApiObject;
}
