import { ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { PlatformProductConfig } from './platform';
import { ORCHESTRATOR_FUNCTION_NAME } from './constants';

export function createPlatformXrd(
  scope: Construct,
  id: string,
  config: PlatformProductConfig,
  schemaProperties: object,
  requiredFields: string[] = [],
): ApiObject {
  const versions: object[] = [
    {
      name: config.version,
      served: true,
      referenceable: true,
      schema: {
        openAPIV3Schema: {
          type: 'object',
          properties: {
            spec: {
              type: 'object',
              required: requiredFields,
              additionalProperties: false,
              properties: schemaProperties,
            },
            status: {
              type: 'object',
              properties: {
                phase: { type: 'string' },
                endpoint: { type: 'string' },
                connectionSecretRef: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  ];

  const spec: Record<string, any> = {
    group: config.group,
    scope: config.scope ?? 'Namespaced',
    names: {
      kind: config.kind,
      plural: config.plural,
      singular: config.singular,
    },
    versions,
  };

  if (config.shortNames) {
    spec.names.shortNames = config.shortNames;
  }

  if (config.connectionSecretKeys && config.connectionSecretKeys.length > 0) {
    spec.connectionSecretKeys = config.connectionSecretKeys;
  }

  return new ApiObject(scope, id, {
    apiVersion: 'apiextensions.crossplane.io/v2',
    kind: 'CompositeResourceDefinition',
    metadata: {
      name: `${config.plural}.${config.group}`,
    },
    spec,
  });
}

export function createBaseSchema(): object {
  return {
    profile: {
      type: 'string',
      enum: ['development', 'production', 'staging'],
    },
    provider: {
      type: 'string',
      description: 'Infrastructure provider for this resource. Defaults to the cluster default if unset.',
    },
    team: {
      type: 'string',
    },
    costCenter: {
      type: 'string',
    },
    region: {
      type: 'string',
    },
    providerConfigRef: {
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
      },
    },
    writeConnectionSecretToRef: {
      type: 'object',
      required: ['name'],
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
      },
      description: 'Where the connection secret is written. Defaults to "<xr-name>-conn" in the XR namespace.',
    },
    deletionPolicy: {
      type: 'string',
      enum: ['Delete', 'Orphan'],
    },
    features: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['enabled'],
        properties: {
          enabled: { type: 'boolean' },
          config: { type: 'object' },
          secretRef: {
            type: 'object',
            required: ['source'],
            properties: {
              source: { type: 'string', enum: ['external-secrets', 'native', 'generated'] },
              store: { type: 'string' },
              path: { type: 'string' },
              property: { type: 'string' },
              name: { type: 'string' },
              namespace: { type: 'string' },
            },
          },
        },
      },
    },
  };
}

export interface OrchestratedCompositionOpts {
  readonly config: PlatformProductConfig;
  readonly labels?: Record<string, string>;
  /** Function invoked by the single Pipeline step. Defaults to the central orchestrator. */
  readonly functionName?: string;
  /** Optional function input. The orchestrator primarily reads the observed composite. */
  readonly input?: Record<string, unknown>;
}

/**
 * Create a Crossplane v2 Composition that delegates all reconciliation to the central
 * orchestrator function (ADR 007). One Composition per product; provider branching lives
 * in the function, not in per-backend Composition files.
 */
export function createOrchestratedComposition(
  scope: Construct,
  id: string,
  opts: OrchestratedCompositionOpts,
): ApiObject {
  return new ApiObject(scope, id, {
    apiVersion: 'apiextensions.crossplane.io/v1',
    kind: 'Composition',
    metadata: {
      name: opts.config.singular,
      labels: {
        'platform.7kgroup.org/product': opts.config.singular,
        ...(opts.labels ?? {}),
      },
    },
    spec: {
      compositeTypeRef: {
        apiVersion: `${opts.config.group}/${opts.config.version}`,
        kind: opts.config.kind,
      },
      mode: 'Pipeline',
      pipeline: [
        {
          step: 'orchestrate',
          functionRef: { name: opts.functionName ?? ORCHESTRATOR_FUNCTION_NAME },
          ...(opts.input
            ? {
                input: {
                  apiVersion: 'platform.fn.crossplane.io/v1beta1',
                  kind: 'Input',
                  ...opts.input,
                },
              }
            : {}),
        },
      ],
    },
  });
}
