import { Testing } from 'cdk8s';
import { TeamObservability } from '../../src/observability-stack';

describe('TeamObservability', () => {
  test('synths an ObservabilityStackClaim', () => {
    const app = Testing.app();
    const chart = new TeamObservability(app, 'obs', {
      profile: 'production',
      domain: 'obs.team-api.yourcompany.com',
      team: 'team-api',
      costCenter: 'cc-12345',
      sso: true,
      alerting: true,
    });
    const snapshot = JSON.stringify(Testing.synth(chart));
    expect(snapshot).toContain('ObservabilityStackClaim');
    expect(snapshot).toContain('team-api');
    expect(snapshot).toContain('cc-12345');
    expect(snapshot).toContain('obs.team-api.yourcompany.com');
  });

  test('sets provider and compositionSelector when given', () => {
    const app = Testing.app();
    const chart = new TeamObservability(app, 'obs', {
      profile: 'production',
      domain: 'obs.team-api.yourcompany.com',
      team: 'team-api',
      costCenter: 'cc-12345',
      provider: 'garage',
    });
    const snapshot = JSON.stringify(Testing.synth(chart));
    expect(snapshot).toContain('"provider":"garage"');
    expect(snapshot).toContain('"compositionSelector"');
    expect(snapshot).toContain('"platform.yourcompany.io/provider":"garage"');
  });
});
