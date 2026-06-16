import { Testing } from 'cdk8s';
import { Chart } from 'cdk8s';

export function synthAndFind(chart: Chart, apiVersion: string, kind: string): any[] {
  const results = Testing.synth(chart);
  return results.filter((r: any) => r.apiVersion === apiVersion && r.kind === kind);
}

export function assertResourceExists(chart: Chart, apiVersion: string, kind: string): void {
  const matches = synthAndFind(chart, apiVersion, kind);
  if (matches.length === 0) {
    throw new Error(`Expected ${apiVersion}/${kind} to exist in synthesized chart`);
  }
}

export function assertFieldValue(
  chart: Chart,
  apiVersion: string,
  kind: string,
  fieldPath: string,
  expectedValue: unknown,
): void {
  const matches = synthAndFind(chart, apiVersion, kind);
  if (matches.length === 0) {
    throw new Error(`Expected ${apiVersion}/${kind} to exist in synthesized chart`);
  }
  const actual = fieldPath
    .split('.')
    .reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined), matches[0]);
  if (actual !== expectedValue) {
    throw new Error(`Expected ${fieldPath} to be ${expectedValue}, got ${actual}`);
  }
}

export function createFixtureClaim(name: string, spec: Record<string, unknown>): any {
  return {
    apiVersion: 'platform.yourcompany.io/v1',
    kind: 'PlatformFixture',
    metadata: { name },
    spec,
  };
}
