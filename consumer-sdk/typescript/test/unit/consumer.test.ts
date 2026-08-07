import { Testing } from 'cdk8s';
import { TeamObservability } from '../../src';

describe('TeamObservability', () => {
  test('synths a namespaced ObservabilityStack XR (no Claims)', () => {
    const app = Testing.app();
    const chart = new TeamObservability(app, 'obs', {
      namespace: 'team-api',
      profile: 'production',
      team: 'team-api',
      costCenter: 'cc-12345',
      modules: {
        grafana: { domain: 'obs.team-api.example.com' },
        metrics: { backend: 'prometheus' },
      },
    });
    const [xr] = Testing.synth(chart) as any[];
    expect(xr.apiVersion).toBe('platform.7kgroup.org/v1alpha1');
    expect(xr.kind).toBe('ObservabilityStack');
    expect(xr.metadata.namespace).toBe('team-api');
    expect(xr.metadata.name).toBe('team-api-observability');
    expect(xr.spec.modules.grafana.domain).toBe('obs.team-api.example.com');
    expect(xr.spec.modules.metrics.backend).toBe('prometheus');
    expect(JSON.stringify(xr)).not.toContain('Claim');
    expect(xr.spec.compositionSelector).toBeUndefined();
  });

  test('defaults all modules enabled', () => {
    const app = Testing.app();
    const chart = new TeamObservability(app, 'obs', {
      namespace: 'ns',
      profile: 'development',
      team: 't',
      costCenter: 'c',
    });
    const [xr] = Testing.synth(chart) as any[];
    for (const mod of ['grafana', 'loki', 'metrics', 'alloy']) {
      expect(xr.spec.modules[mod].enabled).toBe(true);
    }
  });

  test('rejects invalid retentionDays at synth time', () => {
    const app = Testing.app();
    expect(
      () =>
        new TeamObservability(app, 'obs', {
          namespace: 'ns',
          profile: 'development',
          team: 't',
          costCenter: 'c',
          modules: { metrics: { retentionDays: 0 } },
        }),
    ).toThrow(/retentionDays/);
  });

  test('defaults storage to garage/us-east-1', () => {
    const app = Testing.app();
    const chart = new TeamObservability(app, 'obs', {
      namespace: 'ns',
      profile: 'development',
      team: 't',
      costCenter: 'c',
    });
    const [xr] = Testing.synth(chart) as any[];
    expect(xr.spec.storage.provider).toBe('garage');
    expect(xr.spec.storage.region).toBe('us-east-1');
  });

  test('forwards storage overrides', () => {
    const app = Testing.app();
    const chart = new TeamObservability(app, 'obs', {
      namespace: 'ns',
      profile: 'production',
      team: 't',
      costCenter: 'c',
      storage: { provider: 's3', region: 'eu-west-1' },
    });
    const [xr] = Testing.synth(chart) as any[];
    expect(xr.spec.storage.provider).toBe('s3');
    expect(xr.spec.storage.region).toBe('eu-west-1');
  });
});
