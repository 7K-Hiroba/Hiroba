import { Testing } from 'cdk8s';
import { ObservabilityStackXrd } from '../../src/xrd';
import { ObservabilityStackComposition } from '../../src/composition';

describe('ObservabilityStack manifests', () => {
  test('XRD has claim names and connection secret keys', () => {
    const app = Testing.app();
    const xrd = new ObservabilityStackXrd(app, 'xrd');
    const snapshot = JSON.stringify(Testing.synth(xrd));
    expect(snapshot).toContain('ObservabilityStackClaim');
    expect(snapshot).toContain('grafana-url');
    expect(snapshot).toContain('loki-endpoint');
    expect(snapshot).toContain('prometheus-url');
  });

  test('composition creates child modules and datasources', () => {
    const app = Testing.app();
    const composition = new ObservabilityStackComposition(app, 'composition');
    const snapshot = JSON.stringify(Testing.synth(composition));
    expect(snapshot).toContain('GrafanaInstance');
    expect(snapshot).toContain('LokiInstance');
    expect(snapshot).toContain('PrometheusInstance');
    expect(snapshot).toContain('GrafanaDatasource');
    expect(snapshot).toContain('grafana-module');
  });
});
