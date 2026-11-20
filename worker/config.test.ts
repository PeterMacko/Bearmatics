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
      vars: c.vars,
    });
    expect(pick(toml)).toEqual(pick(live));
  });

  it('gives live and previews the same Google client ID (the secret lives in Cloudflare)', () => {
    expect(live.vars.GOOGLE_CLIENT_ID).toMatch(/\.apps\.googleusercontent\.com$/);
    expect(live.previews?.vars?.GOOGLE_CLIENT_ID).toBe(live.vars.GOOGLE_CLIENT_ID);
    expect(JSON.stringify(live)).not.toMatch(/GOOGLE_CLIENT_SECRET"?\s*[:=]/);
  });

  it('runs the server script first for every request, so http can go to https', () => {
    expect(live.assets?.run_worker_first).toBe(true);
    expect(live.assets?.not_found_handling).toBe('single-page-application');
  });

  it('samples 20% of requests for tracing and keeps the logs as they were (SCRUM-234)', () => {
    for (const file of ['wrangler.jsonc', 'wrangler.toml']) {
      const c = read(file);
      expect(c.observability?.traces).toEqual({ enabled: true, head_sampling_rate: 0.2 });
      expect(c.observability?.logs).toEqual({
        enabled: true,
        invocation_logs: true,
        persist: true,
      });
    }
  });
});
