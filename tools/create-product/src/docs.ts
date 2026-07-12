import * as fs from 'fs';
import * as path from 'path';

export interface ProductDocEntry {
  readonly name: string;
  readonly apiVersion: string;
  readonly kind: string;
  readonly category: string;
  readonly description: string;
  readonly version: string;
  readonly features: string[];
  readonly maintainers: string[];
}

export function readCompositionManifests(dir: string): any[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  return files.flatMap((f) => {
    const content = fs.readFileSync(path.join(dir, f), 'utf-8');
    return content
      .split('---')
      .map((doc) => doc.trim())
      .filter(Boolean)
      .map((doc) => {
        try {
          return JSON.parse(doc);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  });
}

export function generateProductCatalogDocs(entries: ProductDocEntry[]): string {
  const lines = [
    '# Platform Product Catalog',
    '',
    '| Product | API Version | Category | Version | Features | Maintainers |',
    '|---------|-------------|----------|---------|----------|-------------|',
  ];

  for (const e of entries) {
    lines.push(
      `| ${e.name} | ${e.apiVersion} | ${e.category} | ${e.version} | ${e.features.join(', ')} | ${e.maintainers.join(', ')} |`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

export function generateApiReferenceDoc(manifests: any[]): string {
  const xrdEntries = manifests.filter((m) => m.kind === 'CompositeResourceDefinition');
  const lines = ['# Platform API Reference', ''];

  for (const xrd of xrdEntries) {
    lines.push(`## ${xrd.metadata.name}`);
    lines.push('');
    lines.push(`- Group: ${xrd.spec.group}`);
    lines.push(`- Kind: ${xrd.spec.names.kind}`);
    lines.push(`- Scope: ${xrd.spec.scope ?? 'Namespaced'}`);
    lines.push(`- Versions: ${xrd.spec.versions.map((v: any) => v.name).join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}

export function writeDocs(entries: ProductDocEntry[], manifestsDir: string, outputDir: string): void {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(path.join(outputDir, 'catalog.md'), generateProductCatalogDocs(entries));

  const manifests = readCompositionManifests(manifestsDir);
  fs.writeFileSync(path.join(outputDir, 'api-reference.md'), generateApiReferenceDoc(manifests));
}

export function main(args: string[]): void {
  const manifestsDir = args[0] || 'dist';
  const outputDir = args[1] || 'docs/generated';
  const entries: ProductDocEntry[] = JSON.parse(process.env.PLATFORM_DOC_ENTRIES || '[]');
  writeDocs(entries, manifestsDir, outputDir);
  console.log(`Generated docs in ${outputDir}`);
}

if (require.main === module) {
  main(process.argv.slice(2));
}
