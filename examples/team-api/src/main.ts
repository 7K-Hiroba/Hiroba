import { App } from 'cdk8s';
import { TeamObservability } from '@yourcompany/platform-consumer';

const app = new App({ outdir: 'dist' });

new TeamObservability(app, 'obs', {
  profile: 'production',
  domain: 'obs.team-api.yourcompany.com',
  team: 'team-api',
  costCenter: 'cc-12345',
  sso: true,
  alerting: true,
});

app.synth();
