import { App } from 'cdk8s';
import { PostgresInstance, TeamObservability } from '@7k-hiroba/platform-consumer';

const app = new App({ outdir: 'dist' });

new TeamObservability(app, 'obs', {
  namespace: 'team-data',
  profile: 'development',
  team: 'team-data',
  costCenter: 'cc-67890',
  modules: {
    grafana: { domain: 'obs-dev.team-data.example.com' },
    metrics: { enabled: false },
  },
});

new PostgresInstance(app, 'analytics-db', {
  name: 'analytics-db',
  namespace: 'team-data',
  profile: 'development',
  team: 'team-data',
  costCenter: 'cc-67890',
  storageGB: 50,
  database: 'analytics',
});

app.synth();
