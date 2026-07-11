import { App, Chart, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';

export interface PlatformProductSpec {
  readonly profile?: string;
  readonly region?: string;
  readonly features?: Record<string, { readonly enabled: boolean; readonly replicas?: number }>;
  [key: string]: unknown;
}

export interface ProductMetadata {
  readonly owner?: string;
  readonly team?: string;
  readonly costCenter?: string;
  readonly environment?: string;
}

export interface PlatformProductProps {
  readonly id: string;
  readonly name: string;
  readonly apiVersion: string;
  readonly kind: string;
  readonly plural: string;
  readonly group?: string;
  readonly spec: PlatformProductSpec;
  readonly metadata?: ProductMetadata;
}

export class PlatformProduct extends Chart {
  public readonly spec: PlatformProductSpec;

  constructor(scope: Construct, id: string, props: PlatformProductProps) {
    super(scope, id);

    this.spec = props.spec;

    new ApiObject(this, 'claim', {
      apiVersion: props.apiVersion,
      kind: props.kind,
      metadata: {
        name: props.name,
        labels: {
          'platform.7kgroup.org/managed-by': 'platform-consumer-sdk',
          ...(props.metadata?.team && { team: props.metadata.team }),
        },
      },
      spec: props.spec,
    });
  }

  featureEnabled(name: string): boolean {
    const feature = this.spec.features?.[name];
    return feature?.enabled ?? false;
  }

  getFeature(name: string): { readonly enabled: boolean; readonly replicas?: number } | undefined {
    return this.spec.features?.[name];
  }
}

export function createProductClaim(
  scope: Construct,
  id: string,
  apiVersion: string,
  kind: string,
  name: string,
  spec: PlatformProductSpec,
): PlatformProduct {
  return new PlatformProduct(scope, id, {
    id,
    name,
    apiVersion,
    kind,
    plural: `${kind.toLowerCase()}s`,
    spec,
  });
}

export class PlatformApp extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
  }
}

export function synthesizePlatformApp(...products: PlatformProduct[]): string {
  const app = new App();
  const platformApp = new PlatformApp(app, 'platform-app');

  for (const product of products) {
    (product.node as any).scope = platformApp;
  }

  return app.synthYaml();
}
