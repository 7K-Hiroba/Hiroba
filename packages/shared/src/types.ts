export type Profile = 'development' | 'production' | 'staging';

export type DeletionPolicy = 'Delete' | 'Orphan' | 'Retain';

/**
 * Cloud providers supported for managed infrastructure.
 * @deprecated use InfrastructureProvider instead
 */
export type CloudProvider = 'aws' | 'gcp' | 'azure';

/**
 * Infrastructure providers supported by the platform, including cloud providers
 * and in-cluster operators.
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

export interface ProfileDefaults {
  readonly instanceClass: string;
  readonly storageEncrypted: boolean;
  readonly multiAZ: boolean;
  readonly backupRetentionDays: number;
  readonly deletionProtection: boolean;
  readonly publiclyAccessible: boolean;
}

export interface CommonResourceProps {
  readonly profile: Profile;
  readonly team: string;
  readonly costCenter: string;
}

export interface RegionalProps {
  readonly region?: string;
  readonly providerConfigRef?: string;
}

export interface PlatformProductSpec extends CommonResourceProps, RegionalProps {
  readonly deletionPolicy?: DeletionPolicy;
  readonly features?: Record<string, FeatureToggle>;
  /**
   * @deprecated use the top-level fields instead of metadata sub-block
   */
  readonly metadata?: {
    readonly version?: string;
    readonly deprecation?: {
      readonly message: string;
      readonly replacement?: string;
    };
  };
  readonly version?: string;
  readonly deprecation?: {
    readonly message: string;
    readonly replacement?: string;
  };
  /**
   * Composition revision selection for blue/green and canary rollouts.
   * https://docs.crossplane.io/latest/concepts/composition-revisions/
   */
  readonly compositionRevisionSelector?: {
    readonly matchLabels: Record<string, string>;
  };
  /**
   * Update policy for composition revision resolution.
   */
  readonly compositionUpdatePolicy?: 'Automatic' | 'Manual';
}

export interface PlatformProductMetadata {
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

export interface CloudBackendConfig {
  readonly aws?: {
    readonly region: string;
    readonly providerConfigRef?: string;
  };
  readonly gcp?: {
    readonly project: string;
    readonly region: string;
    readonly providerConfigRef?: string;
  };
  readonly azure?: {
    readonly resourceGroup: string;
    readonly location: string;
    readonly providerConfigRef?: string;
  };
}

export interface StorageBackend {
  readonly type: StorageBackendType;
  readonly aws?: {
    readonly bucket?: string;
    readonly region?: string;
  };
  readonly gcp?: {
    readonly bucket?: string;
    readonly project?: string;
  };
  readonly azure?: {
    readonly account?: string;
    readonly container?: string;
  };
  readonly garage?: {
    readonly clusterRef?: string;
    readonly clusterNamespace?: string;
  };
}

export interface InfrastructureResourceConfig {
  readonly provider: InfrastructureProvider;
  readonly region: string;
  readonly providerConfigRef?: string;
  readonly storageBackend?: StorageBackend;
}

/**
 * @deprecated use InfrastructureResourceConfig instead
 */
export interface MultiCloudResourceConfig {
  readonly cloudProvider: CloudProvider;
  readonly region: string;
  readonly providerConfigRef?: string;
  readonly storageBackend?: StorageBackend;
}
