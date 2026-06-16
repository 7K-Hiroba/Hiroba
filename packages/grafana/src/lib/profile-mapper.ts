import { Profile } from '@platform-engineering/shared';

export interface GrafanaProfileDefaults {
  readonly replicas: number;
  readonly storageGB: number;
  readonly tls: 'self-signed' | 'letsencrypt';
  readonly persistence: boolean;
  readonly ingressClass: string;
  readonly oauth2ProxyReplicas: number;
}

export const GRAFANA_PROFILE_DEFAULTS: Record<Profile, GrafanaProfileDefaults> = {
  development: {
    replicas: 1,
    storageGB: 10,
    tls: 'self-signed',
    persistence: false,
    ingressClass: 'nginx',
    oauth2ProxyReplicas: 0,
  },
  staging: {
    replicas: 1,
    storageGB: 20,
    tls: 'letsencrypt',
    persistence: true,
    ingressClass: 'nginx',
    oauth2ProxyReplicas: 1,
  },
  production: {
    replicas: 2,
    storageGB: 50,
    tls: 'letsencrypt',
    persistence: true,
    ingressClass: 'nginx',
    oauth2ProxyReplicas: 2,
  },
};

export function getGrafanaProfileDefaults(profile: Profile): GrafanaProfileDefaults {
  return GRAFANA_PROFILE_DEFAULTS[profile];
}
