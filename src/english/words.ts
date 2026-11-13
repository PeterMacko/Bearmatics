/**
 * SCRUM-79: English "listen and choose" word data (approved distractor table, Peter, SCRUM-82).
 * Each target has three alternatives per level: level 1 easy, level 2 similar-sounding.
 * Words are shown in lower case; names are capitalised. Audio lives in public/audio/words/<file>.mp3.
 */
export type EnglishLevel = 1 | 2;

export type WordEntry = {
  word: string;
  alternatives: Record<EnglishLevel, readonly [string, string, string]>;
};

export const WORDS: readonly WordEntry[] = [
  {
    word: 'seven',
    alternatives: { 1: ['apple', 'house', 'fish'], 2: ['seventy', 'oven', 'heaven'] },
  },
  { word: 'ten', alternatives: { 1: ['chair', 'ball', 'moon'], 2: ['pen', 'hen', 'tent'] } },
  { word: 'blue', alternatives: { 1: ['cake', 'sun', 'door'], 2: ['glue', 'blow', 'shoe'] } },
  { word: 'pink', alternatives: { 1: ['frog', 'bed', 'sock'], 2: ['ink', 'sink', 'wink'] } },
  { word: 'red', alternatives: { 1: ['tree', 'cup', 'snow'], 2: ['bed', 'bread', 'rod'] } },
  { word: 'dog', alternatives: { 1: ['sun', 'milk', 'chair'], 2: ['log', 'dot', 'frog'] } },
  { word: 'cat', alternatives: { 1: ['tree', 'bus', 'egg'], 2: ['hat', 'cut', 'cap'] } },
  {
    word: 'Suzy',
    alternatives: { 1: ['banana', 'robot', 'window'], 2: ['Lucy', 'Susan', 'Daisy'] },
  },
  {
    word: 'seventeen',
    alternatives: {
      1: ['umbrella', 'butterfly', 'computer'],
      2: ['seventy', 'sixteen', 'thirteen'],
    },
  },
  {
    word: 'eleven',
    alternatives: { 1: ['banana', 'garden', 'rabbit'], 2: ['elephant', 'heaven', 'lemon'] },
  },
  { word: 'book', alternatives: { 1: ['car', 'tree', 'ball'], 2: ['look', 'cook', 'hook'] } },
  { word: 'green', alternatives: { 1: ['house', 'apple', 'bird'], 2: ['queen', 'grin', 'cream'] } },
  { word: 'desk', alternatives: { 1: ['sun', 'train', 'fish'], 2: ['dress', 'deck', 'mask'] } },
  {
    word: 'yellow',
    alternatives: { 1: ['monkey', 'table', 'flower'], 2: ['hello', 'pillow', 'jelly'] },
  },
  { word: 'girl', alternatives: { 1: ['tree', 'cake', 'bus'], 2: ['curl', 'gold', 'pearl'] } },
  { word: 'boy', alternatives: { 1: ['milk', 'door', 'sun'], 2: ['toy', 'joy', 'bag'] } },
  {
    word: 'pencil',
    alternatives: { 1: ['rabbit', 'window', 'banana'], 2: ['pen', 'parcel', 'petal'] },
  },
  {
    word: 'ruler',
    alternatives: { 1: ['kitten', 'garden', 'flower'], 2: ['rubber', 'roller', 'cooler'] },
  },
  {
    word: 'sister',
    alternatives: { 1: ['window', 'monkey', 'table'], 2: ['mister', 'blister', 'sixty'] },
  },
  { word: 'star', alternatives: { 1: ['fish', 'cup', 'bed'], 2: ['car', 'stair', 'start'] } },
  { word: 'grey', alternatives: { 1: ['moon', 'ball', 'cake'], 2: ['grape', 'play', 'clay'] } },
];

/** Audio file name for a word (lower case, no extension). */
export function audioFile(word: string): string {
  return word.toLowerCase();
}

/** Every word that needs audio: targets plus all alternatives, without duplicates. */
export function allWords(): string[] {
  const seen = new Set<string>();
  for (const entry of WORDS) {
    seen.add(entry.word);
    for (const level of [1, 2] as const)
      for (const word of entry.alternatives[level]) seen.add(word);
  }
  return [...seen];
}
