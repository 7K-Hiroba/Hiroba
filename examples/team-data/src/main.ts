import { App } from 'cdk8s';
import { TeamObservability } from '@7k-hiroba/platform-consumer';

const app = new App({ outdir: 'dist' });

new TeamObservability(app, 'obs', {
  profile: 'development',
  domain: 'obs-dev.team-data.example.com',
  team: 'team-data',
  costCenter: 'cc-67890',
  modules: { grafana: true, loki: true, prometheus: false },
  sso: false,
});

app.synth();
