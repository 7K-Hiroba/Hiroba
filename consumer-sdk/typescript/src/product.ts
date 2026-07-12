import { Chart, ApiObject } from 'cdk8s';
import { Construct } from 'constructs';

export const PLATFORM_API_VERSION = 'platform.7kgroup.org/v1alpha1';

export type Profile = 'development' | 'staging' | 'production';

const VALID_PROFILES: Profile[] = ['development', 'staging', 'production'];

export interface PlatformXrProps {
  /** XR name. */
  readonly name: string;
  /** Namespace the XR is created in (v2 namespaced XRs). */
  readonly namespace: string;
  /** Composite kind, e.g. PostgresInstance. */
  readonly kind: string;
  /** XR spec. Must satisfy the product's XRD schema. */
  readonly spec: Record<string, unknown>;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`platform-consumer: ${message}`);
  }
}

function requireString(value: unknown, field: string): string {
  assert(typeof value === 'string' && value.length > 0, `${field} must be a non-empty string`);
  return value;
}

function validateCommonSpec(kind: string, spec: Record<string, unknown>): void {
  assert(
    VALID_PROFILES.includes(spec.profile as Profile),
    `${kind}: spec.profile must be one of ${VALID_PROFILES.join(', ')} (got ${JSON.stringify(spec.profile)})`,
  );
  requireString(spec.team, `${kind}: spec.team`);
  requireString(spec.costCenter, `${kind}: spec.costCenter`);
}

/**
 * PlatformXr is the generic construct for any platform product: it emits a
 * namespaced Crossplane v2 XR at platform.7kgroup.org/v1alpha1. Prefer the typed
 * constructs (PostgresInstance, TeamObservability, ...) when available; use this
 * for products without a typed construct yet.
 */
export class PlatformXr extends Chart {
  constructor(scope: Construct, id: string, props: PlatformXrProps) {
    super(scope, id);

    requireString(props.name, 'name');
    requireString(props.namespace, 'namespace');
    requireString(props.kind, 'kind');
    assert(props.spec && typeof props.spec === 'object', 'spec must be an object');
    validateCommonSpec(props.kind, props.spec);

    new ApiObject(this, 'xr', {
      apiVersion: PLATFORM_API_VERSION,
      kind: props.kind,
      metadata: {
        name: props.name,
        namespace: props.namespace,
        labels: {
          'platform.7kgroup.org/managed-by': 'platform-consumer-sdk',
          team: props.spec.team as string,
        },
      },
      spec: props.spec,
    });
  }
}
