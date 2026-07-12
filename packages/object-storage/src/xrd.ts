import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import {
  PlatformProductConfig,
  createBaseSchema,
  createPlatformXrd,
  API_GROUP,
  API_VERSION,
  OBJECT_STORAGE_PROVIDERS,
  PRODUCT_CONTRACTS,
} from '@7k-hiroba/shared';

export const OBJECT_STORAGE_CONFIG: PlatformProductConfig = {
  group: API_GROUP,
  version: API_VERSION,
  kind: PRODUCT_CONTRACTS.objectStorage.kind,
  plural: PRODUCT_CONTRACTS.objectStorage.plural,
  singular: PRODUCT_CONTRACTS.objectStorage.singular,
  shortNames: ['ob', 'bucket'],
  scope: 'Namespaced',
};

export class ObjectBucketXrd extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const base = createBaseSchema() as Record<string, unknown>;

    createPlatformXrd(
      this,
      'xrd',
      OBJECT_STORAGE_CONFIG,
      {
        ...base,
        provider: {
          type: 'string',
          enum: [...OBJECT_STORAGE_PROVIDERS],
          default: PRODUCT_CONTRACTS.objectStorage.defaultProvider,
          description: 'Backing object store. s3=AWS, garage=in-cluster (default).',
        },
        bucket: {
          type: 'string',
          pattern: '^[a-z0-9][a-z0-9.-]*$',
          description: 'Bucket name override. Defaults to the XR name when unset.',
        },
        features: {
          type: 'object',
          properties: {
            versioning: {
              type: 'object',
              required: ['enabled'],
              properties: { enabled: { type: 'boolean' } },
            },
            encryption: {
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
