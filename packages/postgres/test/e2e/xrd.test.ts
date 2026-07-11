import { Testing } from 'cdk8s';
import { kubectlApplyYaml, kubectlDelete, waitFor } from '@7k-hiroba/shared';
import { PostgresInstanceXrd } from '../../src/xrd';

const XRD_NAME = 'postgresinstances.platform.7kgroup.org';

function synthXrdYaml(): string {
  const app = Testing.app();
  const chart = new PostgresInstanceXrd(app, 'xrd');
  const [manifest] = Testing.synth(chart);
  return JSON.stringify(manifest);
}

function invalidClaimYaml(name: string, spec: Record<string, unknown>): string {
  return JSON.stringify({
    apiVersion: 'platform.7kgroup.org/v1',
    kind: 'PostgresInstance',
    metadata: { name, namespace: 'default' },
    spec,
  });
}

describe('PostgresInstance XRD (cluster)', () => {
  afterAll(() => {
    kubectlDelete('compositeresourcedefinition', XRD_NAME);
  });

  test('synthesized XRD installs and reaches Established', () => {
    kubectlApplyYaml(synthXrdYaml());
    waitFor(`xrd/${XRD_NAME}`, 'Established', 300);
  }, 360_000);

  test('claim missing required fields is rejected by the API server', () => {
    const yaml = invalidClaimYaml('e2e-invalid-missing-fields', {
      profile: 'development',
      team: 'platform',
      provider: 'cnpg',
    });
    expect(() => kubectlApplyYaml(yaml)).toThrow(/costCenter|Required value/i);
  }, 60_000);

  test('claim with provider outside the enum is rejected by the API server', () => {
    const yaml = invalidClaimYaml('e2e-invalid-bad-provider', {
      profile: 'development',
      team: 'platform',
      costCenter: 'cc-1234',
      provider: 'mysql',
    });
    expect(() => kubectlApplyYaml(yaml)).toThrow(/Unsupported value|Invalid value/i);
  }, 60_000);
});
