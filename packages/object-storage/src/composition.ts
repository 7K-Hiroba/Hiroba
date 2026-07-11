import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { createOrchestratedComposition } from '@platform-engineering/shared';
import { OBJECT_STORAGE_CONFIG } from './xrd';

/**
 * Single Pipeline Composition delegating object-storage reconciliation to the central
 * orchestrator function (ADR 007). The function reads the observed ObjectBucket XR,
 * switches on `spec.provider`, and emits S3 / GCS / Azure Blob / Garage resources.
 */
export class ObjectBucketComposition extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.define();
  }

  define(): ApiObject {
    return createOrchestratedComposition(this, 'composition', {
      config: OBJECT_STORAGE_CONFIG,
      labels: { 'platform.yourcompany.io/category': 'storage' },
    });
  }
}
