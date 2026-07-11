import { Profile, ProfileDefaults } from './types';

export const PROFILE_DEFAULTS: Record<Profile, ProfileDefaults> = {
  development: {
    instanceClass: 'db.t3.micro',
    storageEncrypted: false,
    multiAZ: false,
    backupRetentionDays: 1,
    deletionProtection: false,
    publiclyAccessible: false,
  },
  production: {
    instanceClass: 'db.r6g.xlarge',
    storageEncrypted: true,
    multiAZ: true,
    backupRetentionDays: 30,
    deletionProtection: true,
    publiclyAccessible: false,
  },
  staging: {
    instanceClass: 'db.t3.small',
    storageEncrypted: true,
    multiAZ: false,
    backupRetentionDays: 7,
    deletionProtection: false,
    publiclyAccessible: false,
  },
};

export const MANDATORY_LABELS = ['team', 'cost-center', 'platform.yourcompany.io/stack'];

export const DEFAULT_PROVIDER_CONFIG = 'default';

/**
 * Name of the central orchestrator Composition Function (see ADR 007).
 * Every primitive/stack Composition calls this single function in Pipeline mode.
 */
export const ORCHESTRATOR_FUNCTION_NAME = 'function-platform';

/**
 * Stable connection-secret contract for PostgresInstance.
 * Stacks reference these keys instead of inlining database infrastructure.
 */
export const POSTGRES_CONNECTION_KEYS = ['host', 'port', 'username', 'password', 'database', 'uri'];

/**
 * Stable connection-secret contract for ObjectBucket.
 * Stacks reference these keys instead of inlining object storage infrastructure.
 */
export const OBJECT_STORAGE_CONNECTION_KEYS = ['endpoint', 'bucket', 'region', 'accessKeyId', 'secretAccessKey', 'uri'];
