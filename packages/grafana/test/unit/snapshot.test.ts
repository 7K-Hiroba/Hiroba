import { Testing } from 'cdk8s';
import { GrafanaInstanceXrd } from '../../src/xrd';
import { GrafanaInstanceComposition } from '../../src/composition';

describe('GrafanaInstance manifests', () => {
  test('synths XRD and Composition', () => {
    const app = Testing.app();
    const xrd = new GrafanaInstanceXrd(app, 'xrd');
    const composition = new GrafanaInstanceComposition(app, 'composition');
    const xrdJson = Testing.synth(xrd);
    const compositionJson = Testing.synth(composition);
    expect(xrdJson).toBeDefined();
    expect(compositionJson).toBeDefined();
    expect(xrdJson.length).toBeGreaterThan(0);
    expect(compositionJson.length).toBeGreaterThan(0);
  });

  test('composition contains conditional resources', () => {
    const app = Testing.app();
    const composition = new GrafanaInstanceComposition(app, 'composition');
    const snapshot = JSON.stringify(Testing.synth(composition));
    expect(snapshot).toContain('oauth2-proxy');
    expect(snapshot).toContain('ExternalSecret');
    expect(snapshot).toContain('grafana-sso-credentials');
    expect(snapshot).toContain('grafana-alertmanager');
    expect(snapshot).toContain('GrafanaAlertRuleGroup');
    expect(snapshot).toContain('Ingress');
    expect(snapshot).toContain('Certificate');
  });

  test('XRD has claim names and connection secret keys', () => {
    const app = Testing.app();
    const xrd = new GrafanaInstanceXrd(app, 'xrd');
    const snapshot = JSON.stringify(Testing.synth(xrd));
    expect(snapshot).toContain('GrafanaInstanceClaim');
    expect(snapshot).toContain('admin-url');
    expect(snapshot).toContain('admin-password');
    expect(snapshot).toContain('service-endpoint');
  });
});
