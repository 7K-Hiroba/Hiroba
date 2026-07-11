import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import {
  PlatformProductConfig,
  createBaseSchema,
  createPlatformXrd,
  POSTGRES_CONNECTION_KEYS,
} from '@7k-hiroba/shared';

export const POSTGRES_CONFIG: PlatformProductConfig = {
  group: 'platform.7kgroup.org',
  version: 'v1',
  kind: 'PostgresInstance',
  plural: 'postgresinstances',
  singular: 'postgresinstance',
  shortNames: ['pg', 'pgi'],
  scope: 'Namespaced',
  connectionSecretKeys: [...POSTGRES_CONNECTION_KEYS],
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
          enum: ['aws', 'gcp', 'azure', 'cnpg'],
          description:
            'Backing provider. aws=RDS, gcp=Cloud SQL, azure=Database for PostgreSQL, cnpg=in-cluster operator.',
        },
        engine: {
          type: 'string',
          enum: ['postgres'],
          default: 'postgres',
        },
        version: {
          type: 'string',
          default: '15',
          description: 'PostgreSQL major version.',
        },
        storageGB: {
          type: 'integer',
          minimum: 1,
          default: 20,
        },
        instanceClass: {
          type: 'string',
          description: 'Override the profile-derived instance/size class.',
        },
        database: {
          type: 'string',
          description: 'Initial database name to create.',
        },
        features: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            required: ['enabled'],
            properties: {
              enabled: { type: 'boolean' },
              config: { type: 'object' },
            },
          },
          description: 'Optional toggles: ha, backup, readReplicas.',
        },
      },
      ['profile', 'team', 'costCenter'],
    );
  }
}
