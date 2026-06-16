import { App } from 'cdk8s';
import { TeamObservability } from '@yourcompany/platform-consumer';

const app = new App({ outdir: 'dist' });

new TeamObservability(app, 'obs', {
  profile: 'development',
  domain: 'obs-dev.team-data.yourcompany.com',
  team: 'team-data',
  costCenter: 'cc-67890',
  modules: { grafana: true, loki: true, prometheus: false },
  sso: false,
});

app.synth();
