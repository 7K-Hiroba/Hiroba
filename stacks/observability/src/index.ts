import { App } from 'cdk8s';
import { ObservabilityStackXrd } from './xrd';
import { ObservabilityStackComposition } from './composition';

const app = new App({ outdir: 'dist' });

new ObservabilityStackXrd(app, 'xrd');
new ObservabilityStackComposition(app, 'composition');

app.synth();
