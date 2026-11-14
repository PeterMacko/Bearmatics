// Guards the Cloudflare configuration: previews must never use the live database,
// the TOML copy must match the canonical JSONC, and only /api may reach the server script.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { unstable_readConfig } from 'wrangler';

const root = join(import.meta.dirname, '..');
const read = (file: string) => unstable_readConfig({ config: join(root, file) });

describe('Cloudflare configuration', () => {
  const live = read('wrangler.jsonc');

  it('gives previews a different database than the live app', () => {
    const [prod] = live.d1_databases;
    const [preview] = live.previews?.d1_databases ?? [];
    expect(prod.binding).toBe('DB');
    expect(preview.binding).toBe('DB');
    expect(preview.database_id).not.toBe(prod.database_id);
    expect(preview.database_name).not.toBe(prod.database_name);
  });

  it('applies preview migrations to the preview database only', () => {
    const [target] = read('wrangler.preview-migrations.jsonc').d1_databases;
    expect(target).toEqual(live.previews?.d1_databases?.[0]);
  });

  it('keeps wrangler.toml identical to wrangler.jsonc', () => {
    const toml = read('wrangler.toml');
    const pick = (c: typeof live) => ({
      main: c.main,
      date: c.compatibility_date,
      assets: c.assets,
      d1: c.d1_databases,
      previews: c.previews,
      observability: c.observability,
    });
    expect(pick(toml)).toEqual(pick(live));
  });

  it('runs the server script only for /api', () => {
    expect(live.assets?.run_worker_first).toEqual(['/api', '/api/*']);
    expect(live.assets?.not_found_handling).toBe('single-page-application');
  });
});
