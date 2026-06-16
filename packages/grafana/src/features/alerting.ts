import { ApiObject } from 'cdk8s';
import { Construct } from 'constructs';
import { FeatureToggle } from '@platform-engineering/shared';
import { FeatureImplementation, featureEnabledPatch } from '../lib/feature-toggle';

export class AlertingFeature implements FeatureImplementation {
  constructor(private readonly config: FeatureToggle) {}

  generateResources(scope: Construct, namespace: string): ApiObject[] {
    if (!this.config.enabled) {
      return [];
    }

    return [
      new ApiObject(scope, 'alertmanager', {
        apiVersion: 'monitoring.coreos.com/v1',
        kind: 'Alertmanager',
        metadata: {
          name: 'grafana-alertmanager',
          namespace,
        },
        spec: {
          replicas: 1,
        },
      }),
      new ApiObject(scope, 'alert-rule-group', {
        apiVersion: 'grafana.integreatly.org/v1beta1',
        kind: 'GrafanaAlertRuleGroup',
        metadata: {
          name: 'default-rules',
          namespace,
        },
        spec: {
          instanceSelector: {
            matchLabels: {
              'grafana-instance': 'grafana',
            },
          },
          interval: 60,
          rules: [],
        },
      }),
    ];
  }

  generatePatches(): object[] {
    return [
      featureEnabledPatch('spec.features.alerting.enabled', 'spec.config.unified_alerting.enabled'),
    ];
  }
}
