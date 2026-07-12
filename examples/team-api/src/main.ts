import { App } from 'cdk8s';
import { TeamObservability } from '@7k-hiroba/platform-consumer';

const app = new App({ outdir: 'dist' });

new TeamObservability(app, 'obs', {
  namespace: 'team-api',
  profile: 'production',
  team: 'team-api',
  costCenter: 'cc-12345',
  modules: {
    grafana: { domain: 'obs.team-api.example.com' },
    metrics: { backend: 'prometheus', retentionDays: 30 },
  },
});

app.synth();
