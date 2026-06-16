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
