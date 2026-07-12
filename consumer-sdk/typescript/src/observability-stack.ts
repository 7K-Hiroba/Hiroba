import { Construct } from 'constructs';
import { PlatformXr, Profile } from './product';

export interface TeamObservabilityProps {
  readonly name?: string;
  readonly namespace: string;
  readonly profile: Profile;
  readonly team: string;
  readonly costCenter: string;
  readonly modules?: {
    readonly grafana?: {
      readonly enabled?: boolean;
      readonly domain?: string;
      readonly values?: Record<string, unknown>;
    };
    readonly loki?: {
      readonly enabled?: boolean;
      readonly values?: Record<string, unknown>;
    };
    readonly metrics?: {
      readonly enabled?: boolean;
      readonly backend?: 'prometheus' | 'mimir';
      readonly retentionDays?: number;
      readonly values?: Record<string, unknown>;
    };
    readonly alloy?: {
      readonly enabled?: boolean;
      readonly values?: Record<string, unknown>;
    };
  };
}

function moduleSpec(
  mod: Record<string, unknown> | undefined,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  if (!mod) return defaults;
  const out: Record<string, unknown> = { ...mod };
  if (out.enabled === undefined) out.enabled = defaults.enabled;
  return out;
}

/**
 * TeamObservability emits a namespaced ObservabilityStack XR: Grafana + Loki + a
 * metrics backend (Prometheus or Mimir) + Alloy, wired by the platform orchestrator.
 */
export class TeamObservability extends PlatformXr {
  constructor(scope: Construct, id: string, props: TeamObservabilityProps) {
    if (props.modules?.metrics?.retentionDays !== undefined) {
      const r = props.modules.metrics.retentionDays;
      if (!Number.isInteger(r) || r < 1 || r > 365) {
        throw new Error('platform-consumer: metrics.retentionDays must be an integer between 1 and 365');
      }
    }

    super(scope, id, {
      name: props.name ?? `${props.team}-observability`,
      namespace: props.namespace,
      kind: 'ObservabilityStack',
      spec: {
        profile: props.profile,
        team: props.team,
        costCenter: props.costCenter,
        modules: {
          grafana: moduleSpec(props.modules?.grafana, { enabled: true }),
          loki: moduleSpec(props.modules?.loki, { enabled: true }),
          metrics: moduleSpec(props.modules?.metrics, { enabled: true, backend: 'prometheus' }),
          alloy: moduleSpec(props.modules?.alloy, { enabled: true }),
        },
      },
    });
  }
}
