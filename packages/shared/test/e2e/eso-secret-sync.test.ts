import { kubectl, kubectlApplyYaml, kubectlDelete, kubectlJson, pollUntil } from '../../src/e2e';

const NAMESPACE = 'team-api';
const EXTERNAL_SECRET_NAME = 'e2e-grafana-creds';
const TARGET_SECRET_NAME = 'e2e-grafana-creds';
const TIMEOUT = 180_000;

const externalSecretYaml = `
apiVersion: external-secrets.io/v1
kind: ExternalSecret
metadata:
  name: ${EXTERNAL_SECRET_NAME}
  namespace: ${NAMESPACE}
spec:
  refreshInterval: 15s
  secretStoreRef:
    kind: ClusterSecretStore
    name: platform-vault
  target:
    name: ${TARGET_SECRET_NAME}
  data:
    - secretKey: client-id
      remoteRef:
        key: platform/sso/grafana
        property: client-id
`;

function diagnostics(): string {
  const sections: string[] = [];
  const safe = (label: string, args: string[]) => {
    try {
      sections.push(`\n=== ${label} ===\n${kubectl(args)}`);
    } catch (err) {
      sections.push(`\n=== ${label} (failed) ===\n${err}`);
    }
  };
  safe('ExternalSecret', ['get', 'externalsecret', EXTERNAL_SECRET_NAME, '-n', NAMESPACE, '-o', 'yaml']);
  safe('ClusterSecretStore', ['get', 'clustersecretstore', 'platform-vault', '-o', 'yaml']);
  safe('ESO pods', ['get', 'pods', '-n', 'external-secrets', '-o', 'wide']);
  safe('ESO controller logs (tail 50)', [
    'logs',
    '-n',
    'external-secrets',
    '-l',
    'app.kubernetes.io/name=external-secrets',
    '--tail=50',
  ]);
  safe('events in team-api', ['get', 'events', '-n', NAMESPACE, '--sort-by=.lastTimestamp']);
  return sections.join('\n');
}

describe('ESO secret sync (ADR 007 credential pattern)', () => {
  afterAll(() => {
    kubectlDelete('externalsecret', EXTERNAL_SECRET_NAME, NAMESPACE);
    kubectlDelete('secret', TARGET_SECRET_NAME, NAMESPACE);
  });

  test(
    'ExternalSecret materializes a Secret from the fake Vault store',
    () => {
      kubectlApplyYaml(externalSecretYaml);

      try {
        pollUntil(() => {
          const es = kubectlJson<any>(['get', 'externalsecret', EXTERNAL_SECRET_NAME, '-n', NAMESPACE]);
          return es.status?.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'True');
        }, 120_000);
      } catch (err) {
        throw new Error(`ExternalSecret never became Ready: ${err}\n${diagnostics()}`);
      }

      const secret = kubectlJson<any>(['get', 'secret', TARGET_SECRET_NAME, '-n', NAMESPACE]);
      const decoded = Buffer.from(secret.data['client-id'], 'base64').toString('utf-8');
      expect(decoded).toBe('mock-client-id');
    },
    TIMEOUT,
  );
});
