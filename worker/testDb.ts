// Test helper: a fresh, fully migrated local D1 database (real SQLite through Wrangler).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';

export const root = join(import.meta.dirname, '..');

export function migrate(persist: string): string {
  return execFileSync(
    'npx',
    ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist],
    { cwd: root, encoding: 'utf8', env: { ...process.env, CI: '1' } },
  );
}

export async function freshDb() {
  const persist = mkdtempSync(join(tmpdir(), 'bearmatics-db-'));
  migrate(persist);
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: join(root, 'wrangler.jsonc'),
    persist: { path: join(persist, 'v3') },
  });
  return {
    DB: proxy.env.DB,
    async dispose() {
      await proxy.dispose();
      rmSync(persist, { recursive: true, force: true });
    },
  };
}
