import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { copy } from './i18n';

// SCRUM-335 Wave 0 (review RF-06): the whole copy object, both languages, every key in its order
// and every string, against a fixture written from main (a58a696). Splitting `i18n.ts` into
// feature files must leave this test passing unchanged; a later intended text change rewrites
// the fixture in the same commit:
//   node --input-type=module -e "import { copy } from './src/i18n.ts'; import { writeFileSync }
//     from 'node:fs'; writeFileSync('src/__fixtures__/i18n-copy.json', JSON.stringify(copy, null, 2) + '\n')"
//   npx prettier --write src/__fixtures__/i18n-copy.json

const FIXTURE = 'src/__fixtures__/i18n-copy.json';

test('the copy (EN and SK) is the same as the fixture: keys, key order and strings', () => {
  const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as unknown;
  // Strings compare the key order too (JSON.parse keeps it); toEqual would ignore it.
  expect(JSON.stringify(copy)).toBe(JSON.stringify(fixture));
});

test('both languages have the same keys in the same order', () => {
  const keys = (value: unknown, path = ''): string[] =>
    value && typeof value === 'object'
      ? Object.entries(value).flatMap(([key, inner]) => [
          `${path}${key}`,
          ...(Array.isArray(inner) ? [] : keys(inner, `${path}${key}.`)),
        ])
      : [];
  expect(Object.keys(copy)).toEqual(['en', 'sk']);
  expect(keys(copy.sk)).toEqual(keys(copy.en));
});
