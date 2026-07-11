#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { generateProductFiles, toKebabCase, toPascalCase, ProductTemplateVars } from './templates';

const program = new Command();

program
  .name('create-platform-product')
  .description('Scaffold a new platform engineering product')
  .version('1.0.0')
  .requiredOption('--name <name>', 'Product name (kebab-case, e.g., postgresql)')
  .requiredOption('--category <category>', 'Product category (database, messaging, storage, compute, networking, observability)')
  .option('--description <description>', 'Product description')
  .option('--features <features>', 'Comma-separated feature names', '')
  .option('--provider <provider>', 'Base managed resource API version (e.g., rds.aws.upbound.io/v1beta1)', 'example.org/v1')
  .option('--maintainers <maintainers>', 'Maintainer email', 'platform-team@7kgroup.org')
  .option('--output <output>', 'Output directory', 'packages')
  .action((options) => {
    const productNameLower = toKebabCase(options.name);
    const productKind = toPascalCase(options.name);
    const productPlural = `${productNameLower}s`;
    const features = options.features
      .split(',')
      .map((f: string) => f.trim())
      .filter(Boolean);

    const vars: ProductTemplateVars = {
      productName: options.name,
      productNameLower,
      productKind,
      productPlural,
      category: options.category,
      description: options.description || `Self-service ${productKind} instances`,
      maintainers: options.maintainers,
      features: features.length > 0 ? features : ['backup', 'ha'],
      provider: options.provider,
    };

    const targetDir = path.resolve(options.output, productNameLower);

    if (fs.existsSync(targetDir)) {
      console.error(`Error: directory already exists: ${targetDir}`);
      process.exit(1);
    }

    generateProductFiles(targetDir, vars);

    console.log(`Created platform product: ${productNameLower}`);
    console.log(`Location: ${targetDir}`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${targetDir}`);
    console.log(`  npx cdk8s import`);
    console.log(`  npm run build`);
    console.log(`  npm run test:unit`);
    console.log(`  npm run synth`);
  });

program.parse();
