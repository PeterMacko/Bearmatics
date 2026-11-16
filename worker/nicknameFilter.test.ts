import { describe, expect, it } from 'vitest';
import { isRudeNickname } from './nicknameFilter';

describe('nickname filter (SCRUM-148)', () => {
  it('blocks the listed words in English and Slovak, also hidden and disguised', () => {
    for (const name of [
      'fuck',
      'FuckYou',
      'mr fuuuck',
      'Sh1t',
      'b1tch',
      'a$$hole',
      'Kokot',
      'kok0t',
      'Piča',
      'P1CA',
      'kurva123',
      'K U R V A',
      'k.u.r.v.a',
      'debil_7',
      'Hovno',
      'sračka',
      'zmrd',
      'čurák',
      'jebať',
      'superkokotko',
      'p0rn',
      // QA154-06 gaps
      'jebaný',
      'pojebaný',
      'kurvy',
      'Pičovina',
      'kurwa',
      'ass',
      'shyt',
      'fck',
      'phuck',
      'azzhole',
      'kokоt', // Cyrillic о
      'ｆｕｃｋ', // full-width
      'Dicky',
      'mr cock',
      'Pica',
      'sexy',
    ])
      expect(isRudeNickname(name), name).toBe(true);
  });

  it('lets ordinary names through', () => {
    for (const name of [
      'Maťko',
      'Peter',
      'Brave Cub',
      'Zuzka 7',
      'Medvedík',
      'Lucia',
      'Ninja',
      'Shadow',
      'Pikachu',
      'Kristián',
      'Šimon',
      'Bear_01',
      'Ema',
      'Miška',
      'Dominik',
      'Hugo',
      'Kubko',
      // QA154-06 false positives
      'Larsen',
      'Dickens',
      'Hancock',
      'Essex',
      'Sexton',
      'Middlesex',
      'Marseille',
      'Pearse',
      'Cockpit',
      'Picasso',
      'Prdelka',
      'Ash',
      'Asa',
    ])
      expect(isRudeNickname(name), name).toBe(false);
  });
});
