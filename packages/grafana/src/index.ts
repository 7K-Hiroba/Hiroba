import { App } from 'cdk8s';
import { GrafanaInstanceXrd } from './xrd';
import { GrafanaInstanceComposition } from './composition';

const app = new App({ outdir: 'dist' });

new GrafanaInstanceXrd(app, 'xrd');
new GrafanaInstanceComposition(app, 'composition');

app.synth();
