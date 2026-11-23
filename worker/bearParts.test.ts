// SCRUM-249: the bear is stored as five parts. Real local D1 (SQLite) for the migration and API.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OLD_BEARS, PART_COUNTS, type BearLook } from '../shared/bearLook';
import { SESSION_COOKIE } from './accounts';
import type { Env } from './api';
import { apiCaller, read } from './testApi';
import { freshDb, root } from './testDb';

const look = (fur: number, background: number, head: number, neck: number, eyes: number) => ({
  fur,
  background,
  head,
  neck,
  eyes,
});

describe('migration 0006 (bear parts)', () => {
  let dir: string;
  const wrangler = (...args: string[]) =>
    execFileSync('npx', ['wrangler', ...args, '--local', '--persist-to', join(dir, 'db')], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, CI: '1' },
    });
  const sql = (command: string) =>
    JSON.parse(wrangler('d1', 'execute', 'DB', '--json', '--command', command))[0].results;

  beforeAll(() => {
    // A copy of the database setup with only the migrations before 0006, local files only.
    dir = mkdtempSync(join(tmpdir(), 'bearmatics-0006-'));
    mkdirSync(join(dir, 'migrations'));
    writeFileSync(
      join(dir, 'wrangler.jsonc'),
      JSON.stringify({
        name: 'bearmatics-migration-test',
        compatibility_date: '2026-11-09',
        d1_databases: [
          {
            binding: 'DB',
            database_name: 'bearmatics',
            database_id: '00000000-0000-4000-8000-000000000249',
            migrations_dir: 'migrations',
          },
        ],
      }),
    );
    for (const file of readdirSync(join(root, 'migrations'))) {
      if (file < '0006')
        copyFileSync(join(root, 'migrations', file), join(dir, 'migrations', file));
    }
    wrangler('d1', 'migrations', 'apply', 'DB');
  }, 120_000);
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('gives the 8 existing bears the same look as parts and keeps the old column', () => {
    const values = Array.from(
      { length: 8 },
      (_, i) => `('id${i + 1}', 'user${i + 1}', 'user${i + 1}', 'Cub ${i + 1}', ${i + 1}, 1)`,
    );
    sql(
      `INSERT INTO accounts (id, username, username_key, nickname, bear, parent_confirmed_at)
       VALUES ${values.join(', ')}`,
    );
    copyFileSync(
      join(root, 'migrations', '0006_bear_parts.sql'),
      join(dir, 'migrations', '0006_bear_parts.sql'),
    );
    expect(wrangler('d1', 'migrations', 'apply', 'DB')).toContain('0006_bear_parts.sql');
    const rows = sql(
      `SELECT id, bear, bear_fur, bear_bg, bear_head, bear_neck, bear_eyes FROM accounts ORDER BY id`,
    ) as Record<string, number | string>[];
    expect(rows).toHaveLength(8);
    for (const row of rows) {
      const bear = row.bear as number;
      expect(`id${bear}`).toBe(row.id);
      expect({
        fur: row.bear_fur,
        background: row.bear_bg,
        head: row.bear_head,
        neck: row.bear_neck,
        eyes: row.bear_eyes,
      }).toEqual(OLD_BEARS[bear]);
    }
    expect(sql(`SELECT value FROM app_meta WHERE key = 'schema_version'`)).toEqual([
      { value: '6' },
    ]);
  });

  it('maps the old extras to their slots (star -> crown, leaf -> flower)', () => {
    expect(OLD_BEARS).toEqual({
      1: look(0, 0, 3, 0, 0), // brown, star -> crown
      2: look(1, 1, 2, 0, 0), // dark brown, hat
      3: look(3, 2, 0, 3, 0), // polar, scarf
      4: look(4, 3, 0, 0, 0), // panda patches -> panda fur
      5: look(5, 4, 4, 0, 0), // pink, bow
      6: look(6, 5, 0, 0, 1), // blue, glasses
      7: look(7, 6, 5, 0, 0), // mint, leaf -> flower
      8: look(2, 7, 3, 0, 0), // honey, crown
    });
  });
});

describe('bear parts through the API', () => {
  let db: Awaited<ReturnType<typeof freshDb>>;
  let env: Env;
  beforeAll(async () => {
    db = await freshDb();
    env = { DB: db.DB };
  }, 60_000);
  afterAll(() => db?.dispose());
  const api = apiCaller(() => env);
  const key = 'ab'.repeat(32);
  const signup = (username: string, extra: Record<string, unknown>) =>
    api('/api/auth/signup', {
      body: { username, key, nickname: 'Cub', parentConfirmed: true, ...extra },
    });
  const cookieOf = (response: Response) =>
    `${SESSION_COOKIE}=${/bm_session=([0-9a-f]+)/.exec(response.headers.get('set-cookie')!)![1]}`;

  const outOfRange: [string, Record<string, unknown>][] = [
    ['missing', {}],
    ['not an object', { look: 3 }],
    ['an old bear number only', { bear: 3 }],
    ...(Object.keys(PART_COUNTS) as (keyof BearLook)[]).flatMap(
      (part): [string, Record<string, unknown>][] => [
        [`${part} too big`, { look: { ...look(0, 0, 0, 0, 0), [part]: PART_COUNTS[part] } }],
        [`${part} negative`, { look: { ...look(0, 0, 0, 0, 0), [part]: -1 } }],
        [`${part} not whole`, { look: { ...look(0, 0, 0, 0, 0), [part]: 0.5 } }],
        [`${part} a string`, { look: { ...look(0, 0, 0, 0, 0), [part]: '1' } }],
      ],
    ),
  ];

  it('stores the look on sign-up, and the closest old bear for older app versions', async () => {
    const response = await signup('Parts1', { look: look(2, 6, 5, 4, 3) });
    expect(response.status).toBe(201);
    expect((await read(response)).account.look).toEqual(look(2, 6, 5, 4, 3));
    const row = await env.DB.prepare(
      'SELECT bear, bear_fur, bear_bg, bear_head, bear_neck, bear_eyes FROM accounts WHERE username_key = ?',
    )
      .bind('parts1')
      .first();
    expect(row).toEqual({
      bear: 8, // honey fur = old bear 8
      bear_fur: 2,
      bear_bg: 6,
      bear_head: 5,
      bear_neck: 4,
      bear_eyes: 3,
    });
  });

  it.each(outOfRange)('rejects a sign-up look: %s', async (_name, change) => {
    const response = await signup('Parts2', change);
    expect(response.status).toBe(400);
    expect(await read(response)).toEqual({ error: 'invalid', field: 'look' });
  });

  it.each(outOfRange.slice(2))('rejects a profile look: %s', async (_name, change) => {
    const created = await signup(`Prof${Math.random().toString(36).slice(2, 10)}`, {
      look: look(1, 1, 1, 1, 1),
    });
    const cookie = cookieOf(created);
    const response = await api('/api/me', { method: 'PATCH', cookie, body: change });
    expect(response.status).toBe(400);
    expect(await read(response)).toEqual({ error: 'invalid', field: 'look' });
    const me = await read(await api('/api/me', { cookie }));
    expect(me.account.look).toEqual(look(1, 1, 1, 1, 1));
  });

  it('changes the look in the profile (and the old column with it)', async () => {
    const cookie = cookieOf(await signup('Parts3', { look: look(0, 0, 0, 0, 0) }));
    const response = await api('/api/me', {
      method: 'PATCH',
      cookie,
      body: { look: { ...look(6, 7, 1, 5, 2), extra: 9 } },
    });
    expect(response.status).toBe(200);
    expect((await read(response)).account.look).toEqual(look(6, 7, 1, 5, 2));
    expect((await read(await api('/api/me', { cookie }))).account.look).toEqual(
      look(6, 7, 1, 5, 2),
    );
    const row = await env.DB.prepare('SELECT bear FROM accounts WHERE username_key = ?')
      .bind('parts3')
      .first();
    expect(row).toEqual({ bear: 6 });
    // Nickname alone leaves the look as it is.
    const renamed = await api('/api/me', { method: 'PATCH', cookie, body: { nickname: 'Max' } });
    expect((await read(renamed)).account.look).toEqual(look(6, 7, 1, 5, 2));
  });

  it("sends every player's parts on the leaderboard", async () => {
    const cookie = cookieOf(await signup('Board1', { look: look(4, 2, 3, 5, 1) }));
    await env.DB.prepare(
      `INSERT INTO progress (account_id, points) SELECT id, 7 FROM accounts WHERE username_key = ?`,
    )
      .bind('board1')
      .run();
    const board = await read(await api('/api/leaderboard', { cookie }));
    const mine = board.rows.find((row: { me: boolean }) => row.me);
    expect(mine).toMatchObject({ nickname: 'Cub', look: look(4, 2, 3, 5, 1) });
    expect(mine).not.toHaveProperty('bear');
  });
});
