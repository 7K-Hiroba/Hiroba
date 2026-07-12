import { Testing } from 'cdk8s';
import { PostgresInstanceXrd } from '../../src/xrd';
import { PostgresInstanceComposition } from '../../src/composition';

describe('PostgresInstance manifests', () => {
  test('XRD is namespaced v1alpha1 and publishes the connection contract', () => {
    const app = Testing.app();
    const xrd = new PostgresInstanceXrd(app, 'xrd');
    const [manifest] = Testing.synth(xrd) as any[];
    expect(manifest.kind).toBe('CompositeResourceDefinition');
    expect(manifest.apiVersion).toBe('apiextensions.crossplane.io/v2');
    expect(manifest.spec.scope).toBe('Namespaced');
    expect(manifest.spec.claimNames).toBeUndefined();
    expect(manifest.spec.versions[0].name).toBe('v1alpha1');
    expect(manifest.spec.connectionSecretKeys).toEqual(
      expect.arrayContaining(['host', 'port', 'username', 'password', 'database', 'uri']),
    );
    expect(manifest.spec.versions[0].schema.openAPIV3Schema.properties.status).toBeDefined();
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
