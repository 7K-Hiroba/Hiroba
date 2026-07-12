import { Testing } from 'cdk8s';
import { kubectlApplyYaml, kubectlDelete, waitFor } from '@7k-hiroba/shared';
import { ObjectBucketXrd } from '../../src/xrd';

const XRD_NAME = 'objectbuckets.platform.7kgroup.org';

function synthXrdYaml(): string {
  const app = Testing.app();
  const chart = new ObjectBucketXrd(app, 'xrd');
  const [manifest] = Testing.synth(chart);
  return JSON.stringify(manifest);
}

function invalidXrYaml(name: string, spec: Record<string, unknown>): string {
  return JSON.stringify({
    apiVersion: 'platform.7kgroup.org/v1alpha1',
    kind: 'ObjectBucket',
    metadata: { name, namespace: 'default' },
    spec,
  });
}

describe('ObjectBucket XRD (cluster)', () => {
  afterAll(() => {
    kubectlDelete('compositeresourcedefinition', XRD_NAME);
  });

  test('synthesized XRD installs and reaches Established', () => {
    kubectlApplyYaml(synthXrdYaml());
    waitFor(`xrd/${XRD_NAME}`, 'Established', 300);
  }, 360_000);

  test('XR missing required fields is rejected by the API server', () => {
    const yaml = invalidXrYaml('e2e-invalid-missing-fields', {
      profile: 'development',
      team: 'platform',
      provider: 'garage',
    });
    expect(() => kubectlApplyYaml(yaml)).toThrow(/costCenter|Required value/i);
  }, 60_000);

  test('XR with provider outside the enum is rejected by the API server', () => {
    const yaml = invalidXrYaml('e2e-invalid-bad-provider', {
      profile: 'development',
      team: 'platform',
      costCenter: 'cc-1234',
      provider: 'mysql',
    });
    expect(() => kubectlApplyYaml(yaml)).toThrow(/Unsupported value|Invalid value/i);
  }, 60_000);
});
