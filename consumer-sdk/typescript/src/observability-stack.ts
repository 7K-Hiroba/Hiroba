import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';

export type Profile = 'development' | 'production' | 'staging';

export type InfrastructureProvider = 'aws' | 'garage' | 'cnpg' | 'local';

export interface TeamObservabilityProps {
  readonly profile: Profile;
  readonly domain: string;
  readonly team: string;
  readonly costCenter: string;
  readonly provider?: InfrastructureProvider;
  readonly providerConfigRef?: {
    readonly name?: string;
  };
  readonly region?: string;
  readonly modules?: {
    readonly grafana?: boolean;
    readonly loki?: boolean;
    readonly prometheus?: boolean;
  };
  readonly sso?: boolean;
  readonly alerting?: boolean;
}

export class TeamObservability extends Chart {
  constructor(scope: Construct, id: string, props: TeamObservabilityProps) {
    super(scope, id);

    const spec: Record<string, unknown> = {
      profile: props.profile,
      domain: props.domain,
      team: props.team,
      costCenter: props.costCenter,
      modules: {
        grafana: { enabled: props.modules?.grafana ?? true },
        loki: { enabled: props.modules?.loki ?? true },
        prometheus: { enabled: props.modules?.prometheus ?? true },
      },
      globalFeatures: {
        sso: { enabled: props.sso ?? props.profile === 'production' },
        alerting: { enabled: props.alerting ?? false },
      },
    };

    if (props.provider) {
      spec.provider = props.provider;
      spec.compositionSelector = {
        matchLabels: {
          'platform.yourcompany.io/provider': props.provider,
        },
      };
    }

    if (props.providerConfigRef) {
      spec.providerConfigRef = props.providerConfigRef;
    }

    if (props.region) {
      spec.region = props.region;
    }

    new ApiObject(this, 'stack', {
      apiVersion: 'platform.yourcompany.io/v1',
      kind: 'ObservabilityStackClaim',
      metadata: {
        name: `${props.team}-observability`,
        labels: {
          team: props.team,
          'cost-center': props.costCenter,
          'platform.yourcompany.io/stack': 'observability',
        },
      },
      spec,
    });
  }
}
