import { Chart } from 'cdk8s';
import { Construct } from 'constructs';

export interface CostAttributionProps {
  readonly team: string;
  readonly costCenter: string;
  readonly environment: string;
}

export function mandatoryCostLabelPatches(): any[] {
  return [
    {
      type: 'FromCompositeFieldPath',
      fromFieldPath: 'spec.team',
      toFieldPath: 'metadata.labels[team]',
    },
    {
      type: 'FromCompositeFieldPath',
      fromFieldPath: 'spec.costCenter',
      toFieldPath: 'metadata.labels[costCenter]',
    },
    {
      type: 'FromCompositeFieldPath',
      fromFieldPath: 'spec.environment',
      toFieldPath: 'metadata.labels[environment]',
    },
    {
      type: 'FromCompositeFieldPath',
      fromFieldPath: 'metadata.name',
      toFieldPath: 'metadata.labels[platform.7kgroup.org/claim]',
    },
  ];
}

export function defaultCostLabels(props: CostAttributionProps): Record<string, string> {
  return {
    team: props.team,
    costCenter: props.costCenter,
    environment: props.environment,
  };
}

export class CostAttributionHelper extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
  }
}
