import { Chart, Testing } from 'cdk8s';
import { PlatformProduct, createPlatformApp } from '../../src';

describe('PlatformProduct SDK', () => {
  test('creates product claim with labels', () => {
    const app = Testing.app();
    const chart = new Chart(app, 'test');
    const product = new PlatformProduct(chart, 'redis', {
      id: 'redis',
      name: 'my-redis',
      apiVersion: 'platform.yourcompany.io/v1',
      kind: 'Redis',
      plural: 'redises',
      spec: {
        profile: 'production',
        team: 'platform',
        costCenter: 'cc-123',
        features: { ha: { enabled: true } },
      },
      metadata: { team: 'platform' },
    });
    const results = Testing.synth(product);
    const claims = results.filter((r: any) => r.kind === 'Redis');
    expect(claims.length).toBe(1);
    expect(claims[0].metadata.labels.team).toBe('platform');
  });
});

describe('PlatformApp SDK', () => {
  test('creates PlatformApp with multiple products', () => {
    const app = Testing.app();
    const chart = new Chart(app, 'test');
    const appChart = createPlatformApp(chart, 'checkout-app', {
      name: 'checkout',
      team: 'payments',
      costCenter: 'cc-999',
      environment: 'production',
      products: [
        {
          product: 'Redis',
          name: 'checkout-cache',
          spec: { profile: 'production', team: 'payments', costCenter: 'cc-999' },
        },
        {
          product: 'Postgresql',
          name: 'checkout-db',
          spec: { profile: 'production', team: 'payments', costCenter: 'cc-999' },
        },
      ],
    });
    const results = Testing.synth(appChart);
    expect(results.some((r: any) => r.kind === 'PlatformApp')).toBe(true);
  });
});
