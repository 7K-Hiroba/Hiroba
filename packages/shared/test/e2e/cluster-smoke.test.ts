import { getCondition, kubectlJson } from '../../src/e2e';

const TIMEOUT = 180_000;

describe('control plane smoke', () => {
  test(
    'crossplane core pods are Ready',
    () => {
      const pods = kubectlJson<any>(['get', 'pods', '-n', 'crossplane-system', '-l', 'app=crossplane']);
      expect(pods.items.length).toBeGreaterThan(0);
      for (const pod of pods.items) {
        const ready = getCondition(pod, 'Ready');
        expect(`${pod.metadata.name}: ${ready?.status}`).toBe(`${pod.metadata.name}: True`);
      }
    },
    TIMEOUT,
  );

  test(
    'all providers are Healthy',
    () => {
      const providers = kubectlJson<any>(['get', 'provider.pkg.crossplane.io']);
      expect(providers.items.length).toBeGreaterThan(0);
      for (const provider of providers.items) {
        const healthy = getCondition(provider, 'Healthy');
        expect(`${provider.metadata.name}: ${healthy?.status}`).toBe(`${provider.metadata.name}: True`);
      }
    },
    TIMEOUT,
  );

  test.each([
    'providerconfigs.aws.m.upbound.io',
    'compositeresourcedefinitions.apiextensions.crossplane.io',
    'clustersecretstores.external-secrets.io',
  ])(
    'CRD %s is Established',
    (crdName) => {
      const crd = kubectlJson<any>(['get', 'crd', crdName]);
      const established = getCondition(crd, 'Established');
      expect(established?.status).toBe('True');
    },
    TIMEOUT,
  );
});
