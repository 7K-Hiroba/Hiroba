import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';

export interface LifecycleRule {
  readonly name: string;
  readonly pattern?: string;
  readonly deleteOnExpiry?: boolean;
  readonly expireAfterDays?: number;
  readonly transitionToStorageClass?: string;
  readonly noncurrentVersionExpirationDays?: number;
}

export interface VersioningConfig {
  readonly enabled: boolean;
  readonly retentionDays?: number;
}

export function versioningPatch(sourceField: string, targetField: string): any {
  return {
    type: 'FromCompositeFieldPath',
    fromFieldPath: sourceField,
    toFieldPath: targetField,
    transforms: [
      {
        type: 'map',
        map: {
          enabled: 'Enabled',
          disabled: 'Disabled',
        },
      },
    ],
  };
}

export class LifecycleHelper extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);
  }
}

export function createCompositionRevisionSelector(name: string, version: string): any {
  return new ApiObject(new Chart(undefined as any, 'temp'), 'selector', {
    apiVersion: 'platform.7kgroup.org/v1',
    kind: 'CompositionRevisionSelector',
    metadata: { name },
    spec: {
      labels: {
        'platform.7kgroup.org/version': version,
      },
    },
  }).toJson();
}
