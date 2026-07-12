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
  fs.mkdirSync(path.join(targetDir, 'test', 'fixtures'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'test', 'unit'), { recursive: true });
  fs.mkdirSync(path.join(targetDir, 'package'), { recursive: true });

  writeFile(targetDir, 'package.json', packageJsonTemplate(vars));
  writeFile(targetDir, 'tsconfig.json', tsconfigTemplate());
  writeFile(targetDir, 'jest.config.js', jestConfigTemplate());
  writeFile(targetDir, 'cdk8s.yaml', cdk8sYamlTemplate());
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
      name: `@7k-hiroba/${vars.productNameLower}`,
      version: '0.0.0',
      private: true,
      description: vars.description,
      main: 'dist/index.js',
      types: 'dist/index.d.ts',
      scripts: {
        build: 'tsc',
        synth: 'cdk8s synth',
        test: 'jest',
        'test:unit': 'jest --testPathPattern=test/unit',
        validate: `crossplane composition render test/fixtures/xr.yaml dist/composition.k8s.yaml test/fixtures/functions.yaml --xrd=dist/xrd.k8s.yaml`,
        package: 'cp dist/*.yaml package/ && crossplane build configuration package/',
      },
      dependencies: {
        '@7k-hiroba/shared': '^2.0.0',
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

function cdk8sYamlTemplate(): string {
  return `language: typescript
app: npx ts-node src/index.ts
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
  return `import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { PlatformProductConfig, createBaseSchema, createPlatformXrd } from '@7k-hiroba/shared';

export const ${vars.productNameLower.toUpperCase().replace(/-/g, '_')}_CONFIG: PlatformProductConfig = {
  group: 'platform.7kgroup.org',
  version: 'v1alpha1',
  kind: '${vars.productKind}',
  plural: '${vars.productPlural}',
  singular: '${vars.productNameLower}',
  shortNames: ['${vars.productNameLower.slice(0, 2)}'],
  scope: 'Namespaced',
  connectionSecretKeys: ['endpoint'],
};

export class ${vars.productKind}Xrd extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const base = createBaseSchema() as Record<string, unknown>;

    createPlatformXrd(
      this,
      'xrd',
      ${vars.productNameLower.toUpperCase().replace(/-/g, '_')}_CONFIG,
      {
        ...base,
        // TODO: add product-specific spec fields here
      },
      ['profile', 'team', 'costCenter'],
    );
  }
}
`;
}

function compositionTemplate(vars: ProductTemplateVars): string {
  return `import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import { createOrchestratedComposition } from '@7k-hiroba/shared';
import { ${vars.productNameLower.toUpperCase().replace(/-/g, '_')}_CONFIG } from './xrd';

export class ${vars.productKind}Composition extends Chart {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    createOrchestratedComposition(this, 'composition', {
      config: ${vars.productNameLower.toUpperCase().replace(/-/g, '_')}_CONFIG,
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
  test('XRD is v2 namespaced with connection secret keys', () => {
    const app = Testing.app();
    const xrd = new ${vars.productKind}Xrd(app, 'xrd');
    const [manifest] = Testing.synth(xrd);
    expect(manifest.apiVersion).toBe('apiextensions.crossplane.io/v2');
    expect(manifest.spec.scope).toBe('Namespaced');
    expect(manifest.spec.claimNames).toBeUndefined();
    expect(manifest.spec.connectionSecretKeys).toContain('endpoint');
  });

  test('composition delegates to the orchestrator function', () => {
    const app = Testing.app();
    const composition = new ${vars.productKind}Composition(app, 'composition');
    const [manifest] = Testing.synth(composition);
    expect(manifest.spec.mode).toBe('Pipeline');
    expect(manifest.spec.pipeline).toHaveLength(1);
    expect(manifest.spec.pipeline[0].functionRef.name).toBe('function-platform');
  });
});
`;
}

function fixtureXrTemplate(vars: ProductTemplateVars): string {
  return `apiVersion: platform.7kgroup.org/v1alpha1
kind: ${vars.productKind}
metadata:
  name: test-${vars.productNameLower}
  namespace: team-${vars.productNameLower}
spec:
  profile: production
  team: team-${vars.productNameLower}
  costCenter: cc-12345
  region: us-east-1
`;
}

function fixtureFunctionsTemplate(): string {
  return `apiVersion: pkg.crossplane.io/v1beta1
kind: Function
metadata:
  name: function-platform
spec:
  package: harbor.7kgroup.org/7khiroba/function-platform:1.0.0
`;
}

function crossplanePackageTemplate(vars: ProductTemplateVars): string {
  return `apiVersion: meta.pkg.crossplane.io/v1
kind: Configuration
metadata:
  name: ${vars.productNameLower}-platform
  annotations:
    meta.crossplane.io/maintainer: ${vars.maintainers}
    meta.crossplane.io/source: github.com/7K-Hiroba/Hiroba
    meta.crossplane.io/license: Apache-2.0
    meta.crossplane.io/description: |
      ${vars.description}
spec:
  crossplane:
    version: ">=v2.0.0"
  dependsOn:
    - function: harbor.7kgroup.org/7khiroba/function-platform
      version: ">=v1.0.0"
`;
}
