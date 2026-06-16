export function grafanaDatasource(id: string, name: string, type: string, moduleName: string): object {
  return {
    name: id,
    base: {
      apiVersion: 'grafana.integreatly.org/v1beta1',
      kind: 'GrafanaDatasource',
      metadata: {
        name: id,
      },
      spec: {
        datasource: {
          name,
          type,
          url: '',
          access: 'proxy',
        },
        instanceSelector: {
          matchLabels: {
            'grafana-instance': 'grafana-module',
          },
        },
      },
    },
    patches: [
      {
        type: 'FromCompositeFieldPath',
        fromFieldPath: `status.${moduleName}.connectionDetails.endpoint`,
        toFieldPath: 'spec.datasource.url',
        policy: { fromFieldPath: 'Optional' },
      },
    ],
  };
}
