import { ApiObject, ApiObjectProps } from 'cdk8s';
import { Construct } from 'constructs';

export interface FeatureImplementation {
  generateResources(scope: Construct, namespace: string): ApiObject[];
  generatePatches(): object[];
}

export function featureEnabledPatch(featurePath: string, targetPath: string): object {
  return {
    type: 'FromCompositeFieldPath',
    fromFieldPath: featurePath,
    toFieldPath: targetPath,
    transforms: [
      {
        type: 'map',
        map: {
          'true': 'true',
          'false': 'false',
        },
      },
    ],
  };
}

export function conditionalResource(
  scope: Construct,
  id: string,
  props: ApiObjectProps,
  condition: boolean
): ApiObject | undefined {
  if (!condition) {
    return undefined;
  }
  return new ApiObject(scope, id, props);
}
