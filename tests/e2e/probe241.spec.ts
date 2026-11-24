import { test } from '@playwright/test';
import { writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { DEVICE } from './support/devices';
import { findWord, gridWords, searchLayout, startSearch } from './support/wordsearch';

const OUT = '/home/pmacko/.hermes/profiles/dev/cache/scratch/scrum241/shots';
mkdirSync(OUT, { recursive: true });
const LEVEL = Number(process.env.WS_LEVEL ?? 1) as 1 | 2 | 3;
const LANG = (process.env.WS_LANG ?? 'en') as 'en' | 'sk';
const BIG = process.env.WS_BIG === '1';
const list = (
  process.env.WS_DEVICES ??
  'phone,smallPhone,smallPhoneLandscape,phoneLandscape,tablet,foldableVivaldi,desktop'
).split(',');

for (const key of list) {
  const d = DEVICE[key as keyof typeof DEVICE];
  test(`probe ${d.name} L${LEVEL} ${LANG}${BIG ? ' 200%' : ''}`, async ({ page }) => {
    await page.setViewportSize({ width: d.width, height: d.height });
    await page.addInitScript(() => localStorage.setItem('bearmatics-logic-demo-seen', '1'));
    await startSearch(page, { level: LEVEL, lang: LANG });
    if (BIG) await page.addStyleTag({ content: 'html{font-size:200% !important}' });
    await page.waitForTimeout(300);
    const before = await searchLayout(page);
    const words = await gridWords(page);
    await findWord(page, words[0]);
    await findWord(page, words[1]);
    await page.waitForTimeout(400);
    const after = await searchLayout(page);
    const name = `L${LEVEL}-${LANG}-${d.width}x${d.height}${BIG ? '-200' : ''}`;
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    for (const w of words.slice(2)) await findWord(page, w);
    await page.waitForTimeout(300);
    const solved = await searchLayout(page);
    await page.screenshot({ path: `${OUT}/${name}-solved.png`, fullPage: true });
    appendFileSync(`${OUT}/probe.jsonl`, JSON.stringify({ name, before, after, solved }) + '\n');
  });
}
void writeFileSync;
