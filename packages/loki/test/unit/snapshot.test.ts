import { Testing } from 'cdk8s';
import { LokiInstanceXrd } from '../../src/xrd';
import { LokiInstanceComposition } from '../../src/composition';

describe('LokiInstance manifests', () => {
  test('XRD has claim names and connection secret keys', () => {
    const app = Testing.app();
    const xrd = new LokiInstanceXrd(app, 'xrd');
    const snapshot = JSON.stringify(Testing.synth(xrd));
    expect(snapshot).toContain('LokiInstanceClaim');
    expect(snapshot).toContain('endpoint');
    expect(snapshot).toContain('read-url');
    expect(snapshot).toContain('write-url');
    expect(snapshot).toContain('tenant-id');
  });

  test('composition contains LokiStack and S3 resources', () => {
    const app = Testing.app();
    const composition = new LokiInstanceComposition(app, 'composition');
    const snapshot = JSON.stringify(Testing.synth(composition));
    expect(snapshot).toContain('LokiStack');
    expect(snapshot).toContain('s3-bucket');
    expect(snapshot).toContain('ExternalSecret');
    expect(snapshot).toContain('loki-storage');
  });
});
