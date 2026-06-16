import * as fs from 'fs';
import * as path from 'path';

export interface ProductTemplateVars {
  productName: string;
  productNameLower: string;
  productKind: string;
  productPlural: string;
  category: string;
  description: string;
  maintainers: string;
  features: string[];
  provider: string;
}

export function toPascalCase(value: string): string {
  return value.replace(/[-_](.)/g, (_, char) => char.toUpperCase()).replace(/^(.)/, (_, char) => char.toUpperCase());
}

export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/_/g, '-');
}

export function generateProductFiles(targetDir: string, vars: ProductTemplateVars): void {
  fs.mkdirSync(targetDir, { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'src', 'features'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'src', 'imports'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'src', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'test', 'fixtures'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'test', 'unit'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'package'), { recursive: true });

  writeFile(targetDir, 'package.json', packageJsonTemplate(vars));
  writeFile(targetDir, 'tsconfig.json', tsconfigTemplate());
  writeFile(targetDir, 'jest.config.js', jestConfigTemplate());
  writeFile(targetDir, 'cdk8s.yaml', cdk8sYamlTemplate(vars));
  writeFile(targetDir, 'src/index.ts', indexTemplate(vars));
  writeFile(targetDir, 'src/xrd.ts', xrdTemplate(vars));
  writeFile(targetDir, 'src/composition.ts', compositionTemplate(vars));
  writeFile(targetDir, 'test/unit/snapshot.test.ts', snapshotTestTemplate(vars));
  writeFile(targetDir, 'test/fixtures/xr.yaml', fixtureXrTemplate(vars));
  writeFile(targetDir, 'test/fixtures/functions.yaml', fixtureFunctionsTemplate());
  writeFile(targetDir, 'package/crossplane.yaml', crossplanePackageTemplate(vars));
}

function writeFile(baseDir: string, relativePath: string, content: string): void {
  const fullPath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function packageJsonTemplate(vars: ProductTemplateVars): string {
  return JSON.stringify(
    {
      name: `@platform-engineering/${vars.productNameLower}`,
      version: '1.0.0',
      private: true,
      description: vars.description,
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      scripts: {
        import: 'cdk8s import -o src/imports',
        build: 'tsc',
        synth: 'cdk8s synth',
        test: 'jest',
        'test:unit': 'jest --testPathPattern=test/unit',
        validate: `crossplane composition render test/fixtures/xr.yaml dist/composition.k8s.yaml test/fixtures/functions.yaml --xrd=dist/xrd.k8s.yaml`,
        package: 'cp dist/*.yaml package/ && crossplane build configuration package/',
      },
      dependencies: {
        '@platform-engineering/shared': '1.0.0',
        cdk8s: '^2.68.0',
        constructs: '^10.3.0',
      },
      devDependencies: {
        '@types/jest': '^29.5.12',
        '@types/node': '^20.11.0',
        'cdk8s-cli': '^2.198.0',
        jest: '^29.7.0',
        'ts-jest': '^29.1.2',
        'ts-node': '^10.9.2',
        typescript: '^5.3.3',
      },
    },
    null,
    2,
  );
}

function tsconfigTemplate(): string {
  return JSON.stringify(
    {
      extends: '../../tsconfig.json',
      compilerOptions: {
        outDir: 'dist',
        rootDir: 'src',
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'test'],
    },
    null,
    2,
  );
}

function jestConfigTemplate(): string {
  return `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
};
`;
}

function cdk8sYamlTemplate(_vars: ProductTemplateVars): string {
  return `language: typescript
app: npx ts-node src/index.ts
imports:
  - k8s@1.28.0
`;
}

function indexTemplate(vars: ProductTemplateVars): string {
  return `import { App } from 'cdk8s';
import { ${vars.productKind}Xrd } from './xrd';
import { ${vars.productKind}Composition } from './composition';

const app = new App({ outdir: 'dist' });

new ${vars.productKind}Xrd(app, 'xrd');
new ${vars.productKind}Composition(app, 'composition');

app.synth();
`;
}

function xrdTemplate(vars: ProductTemplateVars): string {
  const featureProperties = vars.features
    .map((feature) => {
      const key = feature.toLowerCase();
      return `      ${key}: {
        type: 'object',
        required: ['enabled'],
        properties: {
          enabled: { type: 'boolean' },
          config: { type: 'object' },
          secretRef: {
            type: 'object',
            required: ['source'],
            properties: {
              source: { type: 'string' },
              store: { type: 'string' },
              path: { type: 'string' },
              property: { type: 'string' },
              name: { type: 'string' },
              namespace: { type: 'string' },
            },
          },
        },
      },`;
    })
    .join('\n');

  return `import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { createPlatformXrd } from '@platform-engineering/shared';

export interface ${vars.productKind}Spec {
  readonly profile: 'development' | 'production' | 'staging';
  readonly team: string;
  readonly costCenter: string;
  readonly region?: string;
  readonly providerConfigRef?: string;
  readonly deletionPolicy?: 'Delete' | 'Orphan' | 'Retain';
  readonly features?: {
${vars.features.map((f) => `    readonly ${f.toLowerCase()}?: { enabled: boolean };`).join('\n')}
  };
}

export class ${vars.productKind}Xrd extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    createPlatformXrd(this, 'xrd', {
      group: 'platform.yourcompany.io',
      version: 'v1',
      kind: '${vars.productKind}',
      plural: '${vars.productPlural}',
      singular: '${vars.productNameLower}',
      shortNames: ['${vars.productNameLower.slice(0, 2)}'],
      claimNames: {
        kind: '${vars.productKind}Claim',
        plural: '${vars.productPlural}claims',
      },
      connectionSecretKeys: ['endpoint', 'url'],
    }, {
      profile: { type: 'string', enum: ['development', 'production', 'staging'] },
      team: { type: 'string' },
      costCenter: { type: 'string' },
      region: { type: 'string' },
      providerConfigRef: { type: 'string' },
      deletionPolicy: { type: 'string', enum: ['Delete', 'Orphan', 'Retain'] },
      features: {
        type: 'object',
        properties: {
${featureProperties}
        },
      },
    }, ['profile', 'team', 'costCenter']);
  }
}
`;
}

function compositionTemplate(vars: ProductTemplateVars): string {
  const featurePatches = vars.features
    .map((feature) => {
      const key = feature.toLowerCase();
      return `        {
          type: 'FromCompositeFieldPath',
          fromFieldPath: 'spec.features.${key}.enabled',
          toFieldPath: 'spec.replicas',
          transforms: [transformMap({ 'true': '1', 'false': '0' })],
        },`;
    })
    .join('\n');

  return `import { ApiObject, Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { deletionPolicyPatch, mandatoryLabelPatches, optionalPatch, regionPatch, transformMap } from '@platform-engineering/shared';

export class ${vars.productKind}Composition extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new ApiObject(this, 'composition', {
      apiVersion: 'apiextensions.crossplane.io/v1',
      kind: 'Composition',
      metadata: {
        name: '${vars.productNameLower}-composition',
        labels: {
          'platform.yourcompany.io/product': '${vars.productNameLower}',
        },
      },
      spec: {
        compositeTypeRef: {
          apiVersion: 'platform.yourcompany.io/v1',
          kind: '${vars.productKind}',
        },
        mode: 'Pipeline',
        pipeline: [
          {
            step: 'patch-and-transform',
            functionRef: { name: 'function-patch-and-transform' },
            input: {
              apiVersion: 'pt.fn.crossplane.io/v1beta1',
              kind: 'Resources',
              resources: [
                {
                  name: '${vars.productNameLower}',
                  base: {
                    apiVersion: '${vars.provider}',
                    kind: '${vars.productKind}',
                    metadata: { name: '' },
                    spec: {
                      deletionPolicy: 'Delete',
                    },
                  },
                  patches: [
                    deletionPolicyPatch(),
                    regionPatch(),
                    optionalPatch('spec.providerConfigRef', 'spec.providerConfigRef.name'),
                    ...mandatoryLabelPatches(),
${featurePatches}
                  ],
                },
              ],
            },
          },
        ],
      },
    });
  }
}
`;
}

function snapshotTestTemplate(vars: ProductTemplateVars): string {
  return `import { Testing } from 'cdk8s';
import { ${vars.productKind}Xrd } from '../../src/xrd';
import { ${vars.productKind}Composition } from '../../src/composition';

describe('${vars.productKind} manifests', () => {
  test('XRD has claim names and connection secret keys', () => {
    const app = Testing.app();
    const xrd = new ${vars.productKind}Xrd(app, 'xrd');
    const snapshot = JSON.stringify(Testing.synth(xrd));
    expect(snapshot).toContain('${vars.productKind}Claim');
    expect(snapshot).toContain('endpoint');
    expect(snapshot).toContain('url');
  });

  test('composition contains base resource and patches', () => {
    const app = Testing.app();
    const composition = new ${vars.productKind}Composition(app, 'composition');
    const snapshot = JSON.stringify(Testing.synth(composition));
    expect(snapshot).toContain('${vars.productKind}');
    expect(snapshot).toContain('${vars.productNameLower}-composition');
  });
});
`;
}

function fixtureXrTemplate(vars: ProductTemplateVars): string {
  const featureLines = vars.features.map((feature) => `    ${feature.toLowerCase()}:\n      enabled: true`).join('\n');

  return `apiVersion: platform.yourcompany.io/v1
kind: ${vars.productKind}
metadata:
  name: test-${vars.productNameLower}
spec:
  profile: production
  team: team-${vars.productNameLower}
  costCenter: cc-12345
  region: us-east-1
  deletionPolicy: Orphan
  features:
${featureLines}
`;
}

function fixtureFunctionsTemplate(): string {
  return `apiVersion: pkg.crossplane.io/v1beta1
kind: Function
metadata:
  name: function-patch-and-transform
spec:
  package: xpkg.upbound.io/crossplane-contrib/function-patch-and-transform:v0.2.0
`;
}

function crossplanePackageTemplate(vars: ProductTemplateVars): string {
  return `apiVersion: meta.pkg.crossplane.io/v1
kind: Configuration
metadata:
  name: ${vars.productNameLower}-platform
  annotations:
    meta.crossplane.io/maintainer: ${vars.maintainers}
    meta.crossplane.io/source: github.com/yourcompany/platform-engineering
    meta.crossplane.io/license: Apache-2.0
    meta.crossplane.io/description: |
      ${vars.description}
spec:
  crossplane:
    version: ">=v2.0.0"
  dependsOn:
    - function: xpkg.upbound.io/crossplane-contrib/function-patch-and-transform
      version: ">=v0.2.0"
`;
}
