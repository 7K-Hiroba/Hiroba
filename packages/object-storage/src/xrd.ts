import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import {
  PlatformProductConfig,
  createBaseSchema,
  createPlatformXrd,
  OBJECT_STORAGE_CONNECTION_KEYS,
} from '@7k-hiroba/shared';

export const OBJECT_STORAGE_CONFIG: PlatformProductConfig = {
  group: 'platform.7kgroup.org',
  version: 'v1',
  kind: 'ObjectBucket',
  plural: 'objectbuckets',
  singular: 'objectbucket',
  shortNames: ['ob', 'bucket'],
  scope: 'Namespaced',
  connectionSecretKeys: [...OBJECT_STORAGE_CONNECTION_KEYS],
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
          enum: ['s3', 'garage', 'gcs', 'azureBlob', 'local'],
          description:
            'Backing object store. s3=AWS, gcs=Google Cloud Storage, azureBlob=Azure Blob, garage/local=in-cluster.',
        },
        bucket: {
          type: 'string',
          description: 'Bucket name override. Defaults to the XR name when unset.',
        },
        region: {
          type: 'string',
          description: 'Region/location for managed buckets. Defaults to the cluster default.',
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
          description: 'Optional toggles: versioning, encryption, website.',
        },
      },
      ['profile', 'team', 'costCenter'],
    );
  }
}
