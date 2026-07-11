import { App } from 'cdk8s';
import { PostgresInstanceXrd } from './xrd';
import { PostgresInstanceComposition } from './composition';

const app = new App({ outdir: 'dist' });
new PostgresInstanceXrd(app, 'xrd');
new PostgresInstanceComposition(app, 'composition');
app.synth();
