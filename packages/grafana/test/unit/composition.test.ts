import { Testing } from 'cdk8s';
import { GrafanaInstanceComposition } from '../../src/composition';

describe('Grafana composition', () => {
  test('renders Composition with pipeline', () => {
    const app = Testing.app();
    const composition = new GrafanaInstanceComposition(app, 'composition');
    const results = Testing.synth(composition);
    const compositions = results.filter((r: any) => r.kind === 'Composition');
    expect(compositions.length).toBeGreaterThanOrEqual(1);
  });

  test('includes function-patch-and-transform pipeline', () => {
    const app = Testing.app();
    const composition = new GrafanaInstanceComposition(app, 'composition');
    const compositions = Testing.synth(composition).filter((r: any) => r.kind === 'Composition');
    expect(compositions.length).toBeGreaterThanOrEqual(1);
    expect(compositions[0].spec.mode).toBe('Pipeline');
    expect(compositions[0].spec.pipeline[0].step).toBe('patch-and-transform');
  });
});
