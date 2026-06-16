import { Testing } from 'cdk8s';
import { PrometheusInstanceXrd } from '../../src/xrd';
import { PrometheusInstanceComposition } from '../../src/composition';

describe('PrometheusInstance manifests', () => {
  test('XRD has claim names and connection secret keys', () => {
    const app = Testing.app();
    const xrd = new PrometheusInstanceXrd(app, 'xrd');
    const snapshot = JSON.stringify(Testing.synth(xrd));
    expect(snapshot).toContain('PrometheusInstanceClaim');
    expect(snapshot).toContain('prometheus-url');
    expect(snapshot).toContain('alertmanager-url');
    expect(snapshot).toContain('federation-endpoint');
  });

  test('composition contains Prometheus and Alertmanager resources', () => {
    const app = Testing.app();
    const composition = new PrometheusInstanceComposition(app, 'composition');
    const snapshot = JSON.stringify(Testing.synth(composition));
    expect(snapshot).toContain('Prometheus');
    expect(snapshot).toContain('ServiceMonitor');
    expect(snapshot).toContain('prometheus-alertmanager');
    expect(snapshot).toContain('ExternalSecret');
  });
});
