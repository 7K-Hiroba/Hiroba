import { App } from 'cdk8s';
import { ObjectBucketXrd } from './xrd';
import { ObjectBucketComposition } from './composition';

const app = new App({ outdir: 'dist' });
new ObjectBucketXrd(app, 'xrd');
new ObjectBucketComposition(app, 'composition');
app.synth();
