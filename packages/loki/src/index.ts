import { App } from 'cdk8s';
import { LokiInstanceXrd } from './xrd';
import { LokiInstanceComposition } from './composition';

const app = new App({ outdir: 'dist' });

new LokiInstanceXrd(app, 'xrd');
new LokiInstanceComposition(app, 'composition');

app.synth();
