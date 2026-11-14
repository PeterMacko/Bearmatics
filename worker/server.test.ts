// Integration test: real Worker runtime (workerd) + real local D1 (SQLite) through Wrangler.
// Requires a built app in dist/ (npm run build) because the Worker also serves static assets.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_startWorker } from 'wrangler';

const root = join(import.meta.dirname, '..');
const persist = mkdtempSync(join(tmpdir(), 'bearmatics-d1-'));
let worker: Awaited<ReturnType<typeof unstable_startWorker>>;

function migrate(): string {
  return execFileSync(
    'npx',
    ['wrangler', 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist],
    { cwd: root, encoding: 'utf8', env: { ...process.env, CI: '1' } },
  );
}

async function get(path: string, init?: RequestInit) {
  return worker.fetch(`http://localhost${path}`, init as never);
}

beforeAll(async () => {
  if (!existsSync(join(root, 'dist/index.html'))) throw new Error('Run npm run build first');
  worker = await unstable_startWorker({
    config: join(root, 'wrangler.jsonc'),
    dev: { persist, server: { port: 0 }, inspector: false, logLevel: 'error' },
  });
  await worker.ready;
}, 60_000);

afterAll(async () => {
  await worker?.dispose();
  rmSync(persist, { recursive: true, force: true });
});

describe('server with a local database', () => {
  it('reports the missing schema before migrations', async () => {
    const response = await get('/api/health');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'error', database: 'ok', schema: 'missing' });
  });

  it('applies migrations to an empty database, and re-running is safe', async () => {
    expect(migrate()).toContain('0001_foundation.sql');
    expect(migrate()).toMatch(/No migrations to apply/i);
    const response = await get('/api/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', database: 'ok', schema: '1' });
  }, 120_000);

  it('returns a JSON 404 for unknown /api addresses', async () => {
    for (const path of ['/api', '/api/nope']) {
      const response = await get(path);
      expect(response.status).toBe(404);
      expect(response.headers.get('content-type')).toContain('application/json');
    }
  });

  it('serves the app exactly as before for every other address', async () => {
    const index = readFileSync(join(root, 'dist/index.html'), 'utf8');
    for (const path of ['/', '/some/page', '/apiary']) {
      const response = await get(path);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(index);
    }
    const favicon = await get('/favicon.svg');
    expect(favicon.status).toBe(200);
    expect(Buffer.from(await favicon.arrayBuffer())).toEqual(
      readFileSync(join(root, 'dist/favicon.svg')),
    );
  });
});
