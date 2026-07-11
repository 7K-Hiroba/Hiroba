import { execFileSync } from 'child_process';

export function kubectl(args: string[], input?: string): string {
  try {
    return execFileSync('kubectl', args, {
      input,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err: any) {
    const stderr = err.stderr ? String(err.stderr) : '';
    const stdout = err.stdout ? String(err.stdout) : '';
    throw new Error(`kubectl ${args.join(' ')} failed:\n${stderr || stdout}`);
  }
}

export function kubectlJson<T = any>(args: string[]): T {
  return JSON.parse(kubectl([...args, '-o', 'json'])) as T;
}

export function kubectlApplyYaml(yaml: string): string {
  return kubectl(['apply', '-f', '-'], yaml);
}

export function kubectlDelete(kind: string, name: string, namespace?: string): void {
  const args = ['delete', kind, name, '--ignore-not-found', '--wait=false'];
  if (namespace) {
    args.push('-n', namespace);
  }
  kubectl(args);
}

export function waitFor(resource: string, condition: string, timeoutSeconds: number, namespace?: string): void {
  const args = ['wait', `--for=condition=${condition}`, resource, `--timeout=${timeoutSeconds}s`];
  if (namespace) {
    args.push('-n', namespace);
  }
  kubectl(args);
}

export function getCondition(resource: any, type: string): any | undefined {
  const conditions: any[] = resource?.status?.conditions ?? [];
  return conditions.find((c) => c.type === type);
}

export function pollUntil(fn: () => boolean, timeoutMs: number, intervalMs = 2000): void {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      if (fn()) {
        return;
      }
    } catch (err) {
      lastError = err;
    }
    execFileSync('sleep', [String(intervalMs / 1000)]);
  }
  throw new Error(`pollUntil timed out after ${timeoutMs}ms${lastError ? `: ${lastError}` : ''}`);
}
