import { Testing } from 'cdk8s';
import { PlatformXr, PostgresInstance } from '../../src';

describe('PlatformXr', () => {
  test('emits a namespaced v1alpha1 XR with team label', () => {
    const app = Testing.app();
    const xr0 = new PlatformXr(app, 'redis', {
      name: 'my-redis',
      namespace: 'team-api',
      kind: 'RedisInstance',
      spec: { profile: 'production', team: 'team-api', costCenter: 'cc-123' },
    });
    const [xr] = Testing.synth(xr0) as any[];
    expect(xr.apiVersion).toBe('platform.7kgroup.org/v1alpha1');
    expect(xr.kind).toBe('RedisInstance');
    expect(xr.metadata.namespace).toBe('team-api');
    expect(xr.metadata.labels.team).toBe('team-api');
    expect(xr.spec.claimNames).toBeUndefined();
  });

  test('rejects invalid profile with a helpful error', () => {
    const app = Testing.app();
    expect(
      () =>
        new PlatformXr(app, 'x', {
          name: 'x',
          namespace: 'ns',
          kind: 'RedisInstance',
          spec: { profile: 'prod', team: 't', costCenter: 'c' },
        }),
    ).toThrow(/spec\.profile must be one of development, staging, production/);
  });

  test('rejects missing team', () => {
    const app = Testing.app();
    expect(
      () =>
        new PlatformXr(app, 'x', {
          name: 'x',
          namespace: 'ns',
          kind: 'RedisInstance',
          spec: { profile: 'production', costCenter: 'c' },
        }),
    ).toThrow(/spec\.team/);
  });
});

describe('PostgresInstance', () => {
  test('emits a typed XR with features', () => {
    const app = Testing.app();
    const pg = new PostgresInstance(app, 'db', {
      name: 'checkout-db',
      namespace: 'team-api',
      profile: 'production',
      team: 'team-api',
      costCenter: 'cc-123',
      provider: 'aws',
      storageGB: 100,
      database: 'checkout',
      features: { ha: true, backup: true },
    });
    const [xr] = Testing.synth(pg) as any[];
    expect(xr.kind).toBe('PostgresInstance');
    expect(xr.spec.provider).toBe('aws');
    expect(xr.spec.storageGB).toBe(100);
    expect(xr.spec.features.ha.enabled).toBe(true);
  });

  test('rejects invalid storageGB', () => {
    const app = Testing.app();
    expect(
      () =>
        new PostgresInstance(app, 'db', {
          name: 'db',
          namespace: 'ns',
          profile: 'development',
          team: 't',
          costCenter: 'c',
          storageGB: 0,
        }),
    ).toThrow(/storageGB/);
  });

  test('rejects invalid database name', () => {
    const app = Testing.app();
    expect(
      () =>
        new PostgresInstance(app, 'db', {
          name: 'db',
          namespace: 'ns',
          profile: 'development',
          team: 't',
          costCenter: 'c',
          database: 'Not-Valid',
        }),
    ).toThrow(/database/);
  });
});
