import { Construct } from 'constructs';
import { PlatformXr, Profile } from './product';

export interface PostgresInstanceProps {
  readonly name: string;
  readonly namespace: string;
  readonly profile: Profile;
  readonly team: string;
  readonly costCenter: string;
  /** aws=RDS, cnpg=in-cluster operator (default). */
  readonly provider?: 'aws' | 'cnpg';
  readonly storageGB?: number;
  readonly version?: string;
  readonly database?: string;
  readonly instanceClass?: string;
  readonly region?: string;
  readonly features?: {
    readonly ha?: boolean;
    readonly backup?: boolean;
    readonly readReplicas?: boolean;
  };
}

/**
 * Typed construct for the PostgresInstance primitive.
 */
export class PostgresInstance extends PlatformXr {
  constructor(scope: Construct, id: string, props: PostgresInstanceProps) {
    if (props.storageGB !== undefined && (!Number.isInteger(props.storageGB) || props.storageGB < 1)) {
      throw new Error('platform-consumer: PostgresInstance storageGB must be a positive integer');
    }
    if (props.database !== undefined && !/^[a-z][a-z0-9_]*$/.test(props.database)) {
      throw new Error('platform-consumer: PostgresInstance database must match ^[a-z][a-z0-9_]*$');
    }

    const features: Record<string, { enabled: boolean }> = {};
    if (props.features?.ha !== undefined) features.ha = { enabled: props.features.ha };
    if (props.features?.backup !== undefined) features.backup = { enabled: props.features.backup };
    if (props.features?.readReplicas !== undefined) {
      features.readReplicas = { enabled: props.features.readReplicas };
    }

    super(scope, id, {
      name: props.name,
      namespace: props.namespace,
      kind: 'PostgresInstance',
      spec: {
        profile: props.profile,
        team: props.team,
        costCenter: props.costCenter,
        ...(props.provider && { provider: props.provider }),
        ...(props.storageGB !== undefined && { storageGB: props.storageGB }),
        ...(props.version && { version: props.version }),
        ...(props.database && { database: props.database }),
        ...(props.instanceClass && { instanceClass: props.instanceClass }),
        ...(props.region && { region: props.region }),
        ...(Object.keys(features).length > 0 && { features }),
      },
    });
  }
}
