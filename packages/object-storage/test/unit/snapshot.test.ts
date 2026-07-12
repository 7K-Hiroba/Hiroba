import { Testing } from 'cdk8s';
import { ObjectBucketXrd } from '../../src/xrd';
import { ObjectBucketComposition } from '../../src/composition';

describe('ObjectBucket manifests', () => {
  test('XRD is namespaced v1alpha1 and publishes the connection contract', () => {
    const app = Testing.app();
    const xrd = new ObjectBucketXrd(app, 'xrd');
    const [manifest] = Testing.synth(xrd) as any[];
    expect(manifest.kind).toBe('CompositeResourceDefinition');
    expect(manifest.apiVersion).toBe('apiextensions.crossplane.io/v2');
    expect(manifest.spec.scope).toBe('Namespaced');
    expect(manifest.spec.claimNames).toBeUndefined();
    expect(manifest.spec.versions[0].name).toBe('v1alpha1');
    // Crossplane v2 drops XR-level connection secrets; status is the contract.
    expect(manifest.spec.connectionSecretKeys).toBeUndefined();
    expect(manifest.spec.versions[0].schema.openAPIV3Schema.properties.status).toBeDefined();
  });

  test('Composition delegates to the orchestrator function', () => {
    const app = Testing.app();
    const composition = new ObjectBucketComposition(app, 'composition');
    const [manifest] = Testing.synth(composition) as any[];
    expect(manifest.kind).toBe('Composition');
    expect(manifest.spec.mode).toBe('Pipeline');
    expect(manifest.spec.pipeline).toHaveLength(1);
    expect(manifest.spec.pipeline[0].functionRef.name).toBe('function-platform');
  });
});
