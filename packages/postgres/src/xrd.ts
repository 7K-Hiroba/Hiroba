import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import {
  PlatformProductConfig,
  createBaseSchema,
  createPlatformXrd,
  API_GROUP,
  API_VERSION,
  POSTGRES_PROVIDERS,
  PRODUCT_CONTRACTS,
} from '@7k-hiroba/shared';

export const POSTGRES_CONFIG: PlatformProductConfig = {
  group: API_GROUP,
  version: API_VERSION,
  kind: PRODUCT_CONTRACTS.postgres.kind,
  plural: PRODUCT_CONTRACTS.postgres.plural,
  singular: PRODUCT_CONTRACTS.postgres.singular,
  shortNames: ['pg', 'pgi'],
  scope: 'Namespaced',
};

export class PostgresInstanceXrd extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const base = createBaseSchema() as Record<string, unknown>;

    createPlatformXrd(
      this,
      'xrd',
      POSTGRES_CONFIG,
      {
        ...base,
        provider: {
          type: 'string',
          enum: [...POSTGRES_PROVIDERS],
          default: PRODUCT_CONTRACTS.postgres.defaultProvider,
          description: 'Backing provider. aws=RDS, cnpg=in-cluster operator (default).',
        },
        version: {
          type: 'string',
          default: '15',
          description: 'PostgreSQL major version.',
        },
        storageGB: {
          type: 'integer',
          minimum: 1,
          maximum: 65536,
          default: 20,
        },
        instanceClass: {
          type: 'string',
          description: 'Override the profile-derived instance/size class.',
        },
        database: {
          type: 'string',
          pattern: '^[a-z][a-z0-9_]*$',
          description: 'Initial database name to create. Defaults to "app".',
        },
        features: {
          type: 'object',
          properties: {
            ha: {
              type: 'object',
              required: ['enabled'],
              properties: { enabled: { type: 'boolean' } },
              description: 'High availability (Multi-AZ on AWS, multiple instances on CNPG).',
            },
            backup: {
              type: 'object',
              required: ['enabled'],
              properties: { enabled: { type: 'boolean' } },
            },
            readReplicas: {
              type: 'object',
              required: ['enabled'],
              properties: { enabled: { type: 'boolean' } },
            },
          },
        },
      },
      ['profile', 'team', 'costCenter'],
    );
  }
}
