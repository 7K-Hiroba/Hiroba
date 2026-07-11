import { Testing } from 'cdk8s';
import { PostgresInstanceXrd } from '../../src/xrd';
import { PostgresInstanceComposition } from '../../src/composition';

describe('PostgresInstance manifests', () => {
  test('XRD is namespaced and omits v1-only connection secrets', () => {
    const app = Testing.app();
    const xrd = new PostgresInstanceXrd(app, 'xrd');
    const [manifest] = Testing.synth(xrd) as any[];
    expect(manifest.kind).toBe('CompositeResourceDefinition');
    expect(manifest.apiVersion).toBe('apiextensions.crossplane.io/v2');
    expect(manifest.spec.scope).toBe('Namespaced');
    expect(manifest.spec.claimNames).toBeUndefined();
    expect(manifest.spec.connectionSecretKeys).toBeUndefined();
  });

  test('Composition delegates to the orchestrator function', () => {
    const app = Testing.app();
    const composition = new PostgresInstanceComposition(app, 'composition');
    const [manifest] = Testing.synth(composition) as any[];
    expect(manifest.kind).toBe('Composition');
    expect(manifest.spec.mode).toBe('Pipeline');
    expect(manifest.spec.pipeline).toHaveLength(1);
    expect(manifest.spec.pipeline[0].functionRef.name).toBe('function-platform');
  });
});
