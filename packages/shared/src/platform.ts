export interface PlatformProductConfig {
  readonly group: string;
  readonly version: string;
  readonly kind: string;
  readonly plural: string;
  readonly singular: string;
  readonly shortNames?: string[];
  /**
   * Crossplane v2 composite resource scope. Defaults to `Namespaced` (v2-native).
   * Consumers create the XR directly in their namespace; no Claim CRD is generated.
   */
  readonly scope?: 'Namespaced' | 'Cluster';
  /**
   * Connection-secret keys this product publishes. Emitted into the XRD so
   * Crossplane aggregates composed connection details under these keys.
   */
  readonly connectionSecretKeys?: string[];
}
