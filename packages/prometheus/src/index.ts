import { App } from 'cdk8s';
import { PrometheusInstanceXrd } from './xrd';
import { PrometheusInstanceComposition } from './composition';

const app = new App({ outdir: 'dist' });

new PrometheusInstanceXrd(app, 'xrd');
new PrometheusInstanceComposition(app, 'composition');

app.synth();
