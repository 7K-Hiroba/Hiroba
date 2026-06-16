import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';

export type Profile = 'development' | 'production' | 'staging';

export interface TeamObservabilityProps {
  readonly profile: Profile;
  readonly domain: string;
  readonly team: string;
  readonly costCenter: string;
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
      spec: {
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
          sso: { enabled: props.sso ?? (props.profile === 'production') },
          alerting: { enabled: props.alerting ?? false },
        },
      },
    });
  }
}
