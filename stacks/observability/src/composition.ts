import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { transformMap } from '@platform-engineering/shared';
import { grafanaDatasource } from './wiring';

export class ObservabilityStackComposition extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const resources: object[] = [];

    resources.push({
      name: 'grafana-module',
      base: {
        apiVersion: 'platform.yourcompany.io/v1',
        kind: 'GrafanaInstance',
        metadata: {
          name: '',
          labels: {
            'grafana-instance': 'grafana-module',
          },
        },
        spec: {
          profile: '',
          domain: '',
          features: {
            sso: { enabled: false },
            alerting: { enabled: false },
            ingress: { enabled: true },
          },
        },
      },
      patches: [
        { type: 'FromCompositeFieldPath', fromFieldPath: 'spec.profile', toFieldPath: 'spec.profile' },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.domain',
          toFieldPath: 'spec.domain',
          transforms: [{ type: 'string', string: { type: 'Format', fmt: 'grafana.%s' } }],
        },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.modules.grafana.domain',
          toFieldPath: 'spec.domain',
          policy: { fromFieldPath: 'Optional' },
        },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.modules.grafana.features.sso.enabled',
          toFieldPath: 'spec.features.sso.enabled',
          policy: { fromFieldPath: 'Optional' },
        },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.globalFeatures.sso.enabled',
          toFieldPath: 'spec.features.sso.enabled',
          policy: { fromFieldPath: 'Optional' },
        },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.modules.grafana.features.alerting.enabled',
          toFieldPath: 'spec.features.alerting.enabled',
          policy: { fromFieldPath: 'Optional' },
        },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.globalFeatures.alerting.enabled',
          toFieldPath: 'spec.features.alerting.enabled',
          policy: { fromFieldPath: 'Optional' },
        },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.modules.grafana.enabled',
          toFieldPath: 'spec.features.ingress.enabled',
          transforms: [transformMap({ 'true': 'true', 'false': 'false' })],
        },
      ],
    });

    resources.push({
      name: 'loki-module',
      base: {
        apiVersion: 'platform.yourcompany.io/v1',
        kind: 'LokiInstance',
        metadata: { name: '' },
        spec: {
          profile: '',
          storage: '',
          retentionDays: 7,
        },
      },
      patches: [
        { type: 'FromCompositeFieldPath', fromFieldPath: 'spec.profile', toFieldPath: 'spec.profile' },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.modules.loki.storage',
          toFieldPath: 'spec.storage',
          policy: { fromFieldPath: 'Optional' },
        },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.profile',
          toFieldPath: 'spec.storage',
          transforms: [transformMap({ development: 'local', staging: 's3', production: 's3' })],
          policy: { fromFieldPath: 'Optional' },
        },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.modules.loki.retentionDays',
          toFieldPath: 'spec.retentionDays',
          policy: { fromFieldPath: 'Optional' },
        },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.retentionDays',
          toFieldPath: 'spec.retentionDays',
          policy: { fromFieldPath: 'Optional' },
        },
      ],
    });

    resources.push({
      name: 'prometheus-module',
      base: {
        apiVersion: 'platform.yourcompany.io/v1',
        kind: 'PrometheusInstance',
        metadata: { name: '' },
        spec: {
          profile: '',
          retentionDays: 7,
          alerting: { enabled: false },
          federation: { enabled: false },
        },
      },
      patches: [
        { type: 'FromCompositeFieldPath', fromFieldPath: 'spec.profile', toFieldPath: 'spec.profile' },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.modules.prometheus.retentionDays',
          toFieldPath: 'spec.retentionDays',
          policy: { fromFieldPath: 'Optional' },
        },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.retentionDays',
          toFieldPath: 'spec.retentionDays',
          policy: { fromFieldPath: 'Optional' },
        },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.modules.prometheus.alerting.enabled',
          toFieldPath: 'spec.alerting.enabled',
          policy: { fromFieldPath: 'Optional' },
        },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.globalFeatures.alerting.enabled',
          toFieldPath: 'spec.alerting.enabled',
          policy: { fromFieldPath: 'Optional' },
        },
        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.modules.prometheus.enabled',
          toFieldPath: 'spec.federation.enabled',
          transforms: [transformMap({ 'true': 'false', 'false': 'false' })],
          policy: { fromFieldPath: 'Optional' },
        },
      ],
    });

    resources.push(grafanaDatasource('loki-datasource', 'Loki', 'loki', 'loki-module'));
    resources.push(grafanaDatasource('prometheus-datasource', 'Prometheus', 'prometheus', 'prometheus-module'));

    new ApiObject(this, 'composition', {
      apiVersion: 'apiextensions.crossplane.io/v1',
      kind: 'Composition',
      metadata: {
        name: 'observabilitystack-composition',
        labels: {
          'platform.yourcompany.io/product': 'observability',
        },
      },
      spec: {
        compositeTypeRef: {
          apiVersion: 'platform.yourcompany.io/v1',
          kind: 'ObservabilityStack',
        },
        mode: 'Pipeline',
        pipeline: [
          {
            step: 'patch-and-transform',
            functionRef: {
              name: 'function-patch-and-transform',
            },
            input: {
              apiVersion: 'pt.fn.crossplane.io/v1beta1',
              kind: 'Resources',
              resources,
            },
          },
        ],
      },
    });
  }
}
