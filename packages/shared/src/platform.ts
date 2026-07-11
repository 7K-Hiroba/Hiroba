import { Construct } from 'constructs';
import { ApiObject, Chart } from 'cdk8s';

export interface FeatureImplementation {
  generateResources(scope: Construct, namespace: string): ApiObject[];
  generatePatches(): object[];
}

export abstract class PlatformFeature implements FeatureImplementation {
  constructor(protected readonly enabled: boolean) {}

  abstract generateResources(scope: Construct, namespace: string): ApiObject[];
  abstract generatePatches(): object[];

  isEnabled(): boolean {
    return this.enabled;
  }
}

export interface PlatformProductConfig {
  readonly group: string;
  readonly version: string;
  readonly kind: string;
  readonly plural: string;
  readonly singular: string;
  readonly shortNames?: string[];
  /**
   * Crossplane v2 composite resource scope. Defaults to `Namespaced` (v2-native).
   * When `Namespaced`, legacy `claimNames` are ignored: consumers create the XR
   * directly in their namespace and no separate Claim CRD is generated.
   */
  readonly scope?: 'Namespaced' | 'Cluster';
  /**
   * @deprecated Crossplane v2 uses namespaced XRs; only honoured when `scope: 'Cluster'`.
   */
  readonly claimNames?: {
    readonly kind: string;
    readonly plural: string;
  };
  readonly connectionSecretKeys?: string[];
}

export abstract class PlatformProduct extends Chart {
  abstract readonly config: PlatformProductConfig;

  constructor(scope: Construct, id: string) {
    super(scope, id);
  }

  abstract defineXrd(): ApiObject;
  abstract defineComposition(): ApiObject;
}

export interface ProductMetadata {
  readonly name: string;
  readonly version: string;
  readonly category: 'observability' | 'database' | 'messaging' | 'storage' | 'compute' | 'networking';
  readonly description: string;
  readonly primitives: string[];
  readonly maintainers: string[];
  readonly deprecation?: {
    readonly message: string;
    readonly replacement?: string;
  };
}
