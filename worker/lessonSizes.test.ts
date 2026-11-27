// SCRUM-324: migration 0007 widens the lesson size check for Pexeso (6 / 15). Real local D1.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { root } from './testDb';

describe('migration 0007 (Pexeso lesson sizes)', () => {
  let dir: string;
  const wrangler = (...args: string[]) =>
    execFileSync('npx', ['wrangler', ...args, '--local', '--persist-to', join(dir, 'db')], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, CI: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  const sql = (command: string) =>
    JSON.parse(wrangler('d1', 'execute', 'DB', '--json', '--command', command))[0].results;
  const fails = (command: string) => {
    try {
      sql(command);
      return false;
    } catch (error) {
      return /CHECK constraint failed/.test(String((error as { stdout?: string }).stdout ?? error));
    }
  };

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'bearmatics-0007-'));
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
            database_id: '00000000-0000-4000-8000-000000000324',
            migrations_dir: 'migrations',
          },
        ],
      }),
    );
    for (const file of readdirSync(join(root, 'migrations'))) {
      if (file < '0007')
        copyFileSync(join(root, 'migrations', file), join(dir, 'migrations', file));
    }
    wrangler('d1', 'migrations', 'apply', 'DB');
    sql(
      `INSERT INTO accounts (id, username, username_key, nickname, bear, parent_confirmed_at)
       VALUES ('acc1', 'kid1', 'kid1', 'Cub', 1, 1)`,
    );
    sql(
      `INSERT INTO lessons (id, account_id, size, started_at, finished_at, claim)
       VALUES ('l1', 'acc1', 10, 100, NULL, NULL), ('l2', 'acc1', 20, 200, 250, 'c2')`,
    );
  }, 120_000);
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('before: sizes 6 and 15 are refused by the database', () => {
    expect(
      fails(`INSERT INTO lessons (id, account_id, size, started_at) VALUES ('x', 'acc1', 6, 1)`),
    ).toBe(true);
  });

  it(
    'after: keeps the lessons, takes 5 / 6 / 10 / 15 / 20 and still refuses other sizes',
    { timeout: 180_000 },
    () => {
      copyFileSync(
        join(root, 'migrations', '0007_pexeso_sizes.sql'),
        join(dir, 'migrations', '0007_pexeso_sizes.sql'),
      );
      expect(wrangler('d1', 'migrations', 'apply', 'DB')).toContain('0007_pexeso_sizes.sql');
      expect(
        sql('SELECT id, account_id, size, started_at, finished_at, claim FROM lessons ORDER BY id'),
      ).toEqual([
        { id: 'l1', account_id: 'acc1', size: 10, started_at: 100, finished_at: null, claim: null },
        { id: 'l2', account_id: 'acc1', size: 20, started_at: 200, finished_at: 250, claim: 'c2' },
      ]);
      sql(
        `INSERT INTO lessons (id, account_id, size, started_at) VALUES
       ('s5', 'acc1', 5, 1), ('s6', 'acc1', 6, 1), ('s15', 'acc1', 15, 1)`,
      );
      for (const size of [0, 7, 12, 30])
        expect(
          fails(
            `INSERT INTO lessons (id, account_id, size, started_at) VALUES ('y${size}', 'acc1', ${size}, 1)`,
          ),
          `size ${size}`,
        ).toBe(true);
      const indexes = sql(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'lessons' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      );
      expect(indexes).toEqual([{ name: 'lessons_account' }, { name: 'lessons_started' }]);
      // Lessons still go with the account.
      sql(`DELETE FROM accounts WHERE id = 'acc1'`);
      expect(sql('SELECT COUNT(*) AS n FROM lessons')).toEqual([{ n: 0 }]);
      expect(sql(`SELECT value FROM app_meta WHERE key = 'schema_version'`)).toEqual([
        { value: '7' },
      ]);
    },
  );
});
