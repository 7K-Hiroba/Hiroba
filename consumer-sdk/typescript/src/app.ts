import { App, Chart, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { PlatformProduct, PlatformProductSpec } from './product';

export interface PlatformAppSpec {
  readonly name: string;
  readonly description?: string;
  readonly owner?: string;
  readonly team?: string;
  readonly costCenter?: string;
  readonly environment?: string;
  readonly products: PlatformAppProductRef[];
}

export interface PlatformAppProductRef {
  readonly product: string;
  readonly name: string;
  readonly spec: PlatformProductSpec;
}

export class PlatformAppComposition extends Chart {
  constructor(
    scope: Construct,
    id: string,
    public readonly spec: PlatformAppSpec,
  ) {
    super(scope, id);

    new ApiObject(this, 'app', {
      apiVersion: 'platform.yourcompany.io/v1',
      kind: 'PlatformApp',
      metadata: {
        name: spec.name,
        labels: {
          'platform.yourcompany.io/managed-by': 'platform-consumer-sdk',
          team: spec.team ?? 'unknown',
          costCenter: spec.costCenter ?? 'unknown',
          environment: spec.environment ?? 'unknown',
        },
      },
      spec: {
        description: spec.description,
        owner: spec.owner,
        team: spec.team,
        costCenter: spec.costCenter,
        environment: spec.environment,
        products: spec.products.map((p) => ({
          product: p.product,
          name: p.name,
          spec: p.spec,
        })),
      },
    });

    for (const p of spec.products) {
      new PlatformProduct(this, `${p.name}-product`, {
        id: `${p.name}-product`,
        name: p.name,
        apiVersion: `platform.yourcompany.io/v1`,
        kind: p.product,
        plural: `${p.product.toLowerCase()}s`,
        spec: p.spec,
        metadata: {
          team: spec.team,
          costCenter: spec.costCenter,
          environment: spec.environment,
        },
      });
    }
  }
}

export function createPlatformApp(scope: Construct, id: string, spec: PlatformAppSpec): PlatformAppComposition {
  return new PlatformAppComposition(scope, id, spec);
}

export function synthesizeApps(...apps: PlatformAppComposition[]): string {
  const app = new App();
  const root = new Chart(app, 'root');

  for (const a of apps) {
    (a.node as any).scope = root;
  }

  return app.synthYaml();
}
