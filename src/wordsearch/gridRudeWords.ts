// QA247-01: short crude words a child could read in a grid of random letters. The shared
// nickname filter (shared/nicknameFilter.ts) leaves them out on purpose (it matches inside
// longer names, and 3-letter words like these would block ordinary nicknames), so the word
// search adds them for its grids only. Exact letter runs, upper case, any direction.
export const GRID_RUDE_WORDS: ReadonlySet<string> = new Set([
  // English
  'ASS',
  'ARSE',
  'BUM',
  'COCK',
  'CUM',
  'DICK',
  'NAZI',
  'PEE',
  'PISS',
  'POO',
  'POOP',
  'TIT',
  'TITS',
  'WTF',
  // Slovak
  'CIGAN',
  'CURAK',
  'DEBIL',
  'HOVNO',
  'PEDO',
  'PICA',
  'PICI',
  'PRD',
  'SRAC',
  'SRAT',
]);
