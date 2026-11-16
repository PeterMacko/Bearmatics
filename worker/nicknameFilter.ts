// SCRUM-148: a small filter of rude words for nicknames (Slovak and English). Shared by the
// server (worker/rules.ts) and the forms (src/account/rules.ts). Never complete; it catches the
// common words, also inside longer words, with accents, repeated letters and look-alike digits
// or symbols (0/o, 1/i or l, 3/e, 4/a, 5/s, 7/t, @/a, $/s).

// Written as they look after normalising: lower case, no accents, repeated letters collapsed.
const WORDS = [
  // English
  'fuck',
  'fuk',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'cock',
  'pusy',
  'whore',
  'slut',
  'bastard',
  'ashole',
  'arse',
  'niger',
  'niga',
  'fagot',
  'retard',
  'penis',
  'vagina',
  'porn',
  'sex',
  'wanker',
  'twat',
  'nazi',
  'hitler',
  // Slovak (and the Czech forms children use)
  'kokot',
  'pica',
  'pice',
  'pici',
  'picu',
  'jebat',
  'jebem',
  'jebo',
  'jebn',
  'kurva',
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
  'prdel',
  'mrdat',
  'mrdka',
  'skurvy',
  'buzna',
  'buzerant',
  'cigan',
  'idiot',
];

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
};

function normalise(text: string, one: 'i' | 'l'): string {
  const plain = text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  let out = '';
  for (const char of plain) {
    const mapped = char === '1' ? one : (LOOK_ALIKES[char] ?? char);
    if (/[a-z]/.test(mapped) && mapped !== out.at(-1)) out += mapped;
  }
  return out;
}

/** True when the nickname contains one of the listed rude words. */
export function isRudeNickname(nickname: string): boolean {
  return (['i', 'l'] as const).some((one) => {
    const text = normalise(nickname, one);
    return WORDS.some((word) => text.includes(word));
  });
}
