import type { Profile } from './contract.gen';

export type { Profile };

export type DeletionPolicy = 'Delete' | 'Orphan';

/**
 * Infrastructure providers supported by the platform, including cloud providers
 * and in-cluster operators. Each product's XRD constrains this to the subset
 * its handler implements (see contract/contract.json).
 */
export type InfrastructureProvider = 'aws' | 'gcp' | 'azure' | 'garage' | 'cnpg' | 'local';

export type StorageBackendType = 's3' | 'garage' | 'gcs' | 'azureBlob' | 'local';

export interface SecretRef {
  readonly source: 'external-secrets' | 'native' | 'generated';
  readonly store?: string;
  readonly path?: string;
  readonly property?: string;
  readonly name?: string;
  readonly namespace?: string;
}

export interface FeatureToggle<T = any> {
  readonly enabled: boolean;
  readonly config?: T;
  readonly secretRef?: SecretRef;
}

export interface CommonResourceProps {
  readonly profile: Profile;
  readonly team: string;
  readonly costCenter: string;
}

export interface RegionalProps {
  readonly region?: string;
  readonly providerConfigRef?: { readonly name: string };
}

export interface PlatformProductSpec extends CommonResourceProps, RegionalProps {
  readonly deletionPolicy?: DeletionPolicy;
  readonly features?: Record<string, FeatureToggle>;
}
