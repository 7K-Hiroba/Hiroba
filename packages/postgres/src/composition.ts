import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { createOrchestratedComposition } from '@platform-engineering/shared';
import { POSTGRES_CONFIG } from './xrd';

/**
 * Single Pipeline Composition delegating Postgres reconciliation to the central
 * orchestrator function (ADR 007). The function reads the observed PostgresInstance XR,
 * switches on `spec.provider`, and emits RDS / Cloud SQL / Azure DB / CNPG resources.
 */
export class PostgresInstanceComposition extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.define();
  }

  define(): ApiObject {
    return createOrchestratedComposition(this, 'composition', {
      config: POSTGRES_CONFIG,
      labels: { 'platform.yourcompany.io/category': 'database' },
    });
  }
}
