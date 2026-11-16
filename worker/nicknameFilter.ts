// SCRUM-148: a small filter of rude words for nicknames (Slovak and English). Shared by the
// server (worker/rules.ts) and the forms (src/account/rules.ts). Never complete; it catches the
// common words, also inside longer words, with accents, repeated letters and look-alike digits
// or symbols (0/o, 1/i or l, 3/e, 4/a, 5/s, 7/t, @/a, $/s).

// Written as they look after normalising: lower case, no accents, repeated letters collapsed.
// Found anywhere, also inside longer words and across spaces ("superkokotko", "K U R V A").
const ANYWHERE = [
  // English
  'fuck',
  'fuk',
  'fck',
  'phuk',
  'phuc',
  'shit',
  'shyt',
  'bitch',
  'cunt',
  'pusy',
  'whore',
  'slut',
  'bastard',
  'ashole',
  'azhole',
  'fagot',
  'retard',
  'penis',
  'vagina',
  'porn',
  'wanker',
  'twat',
  'hitler',
  // Slovak (and the Czech/Polish forms children use)
  'kokot',
  'picov',
  'picus',
  'jebat',
  'jeban',
  'jebem',
  'jebo',
  'jebn',
  'kurv',
  'kurw',
  'kurev',
  'debil',
  'chuj',
  'hovno',
  'sracka',
  'sraci',
  'zmrd',
  'curak',
  'kreten',
  'hajzel',
  'mrdat',
  'mrdka',
  'buzna',
  'buzerant',
  'cigan',
  'idiot',
];

// Short words that are also parts of ordinary names (Dickens, Hancock, Essex, Picasso,
// Marseille): only as a whole word, or with one more letter where listed ("dicky", "pici"), QA154-06.
const WHOLE: Record<string, number> = {
  // word: how many more letters may follow it
  as: 0, // "ass" after collapsing repeats; "Ash", "Asa" stay allowed
  arse: 1,
  dick: 1,
  cock: 1,
  sex: 1,
  niger: 1,
  niga: 1,
  nazi: 1,
  pica: 1,
  pice: 1,
  pici: 1,
  picu: 1,
  prdel: 1,
};

const LOOK_ALIKES: Record<string, string> = {
  '0': 'o',
  '3': 'e',
  '4': 'a',
  '@': 'a',
  '5': 's',
  $: 's',
  '7': 't',
  '8': 'b',
  '9': 'g',
  '!': 'i',
  '|': 'l',
  // Cyrillic letters that look Latin
  а: 'a',
  е: 'e',
  о: 'o',
  р: 'p',
  с: 'c',
  у: 'y',
  х: 'x',
  к: 'k',
  т: 't',
  і: 'i',
  м: 'm',
  в: 'b',
};

function normalise(text: string, one: 'i' | 'l'): string {
  // NFKC turns full-width letters into ordinary ones.
  const plain = text.normalize('NFKC').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  let out = '';
  for (const char of plain) {
    const mapped = char === '1' ? one : (LOOK_ALIKES[char] ?? char);
    if (/[a-z]/.test(mapped) && mapped !== out.at(-1)) out += mapped;
  }
  return out;
}

/** True when the nickname contains one of the listed rude words. */
export function isRudeNickname(nickname: string): boolean {
  const words = nickname.normalize('NFKC').split(/[\s._-]+/u);
  return (['i', 'l'] as const).some((one) => {
    const text = normalise(nickname, one);
    if (ANYWHERE.some((word) => text.includes(word))) return true;
    return words.some((part) => {
      const token = normalise(part, one);
      return Object.entries(WHOLE).some(
        ([word, extra]) => token.startsWith(word) && token.length <= word.length + extra,
      );
    });
  });
}
