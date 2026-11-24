import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { setLanguage } from './support/language';
import { cell, findWord, gridWords, startSearch, wrongPair } from './support/wordsearch';

const OUT = '/home/pmacko/.hermes/profiles/dev/cache/scratch/scrum241/shots/final';
mkdirSync(OUT, { recursive: true });

for (const [w, h] of [
  [390, 844],
  [320, 568],
  [568, 320],
  [844, 390],
  [733, 500],
  [1366, 900],
])
  for (const lang of ['en', 'sk'] as const)
    test(`courses ${w}x${h} ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      if (lang === 'sk') await setLanguage(page, 'Slovenčina');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/courses-${lang}-${w}x${h}.png` });
    });

for (const [w, h] of [
  [390, 844],
  [1366, 900],
  [568, 320],
])
  for (const lang of ['en', 'sk'] as const)
    test(`menu ${w}x${h} ${lang}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      if (lang === 'sk') await setLanguage(page, 'Slovenčina');
      await page.locator('.course-wordsearch').click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/menu-${lang}-${w}x${h}.png` });
    });

const CASES: [number, number, 'en' | 'sk', boolean][] = [
  [390, 844, 'en', false],
  [320, 568, 'sk', false],
  [568, 320, 'en', false],
  [844, 390, 'en', false],
  [820, 1180, 'en', false],
  [884, 600, 'en', false],
  [1366, 900, 'en', false],
  [320, 568, 'en', true],
];
for (const level of [1, 2, 3] as const)
  for (const [w, h, lang, big] of CASES)
    test(`L${level} ${w}x${h} ${lang}${big ? ' 200' : ''}`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await startSearch(page, { level, lang });
      if (big) await page.addStyleTag({ content: 'html{font-size:200% !important}' });
      await page.waitForTimeout(300);
      const words = await gridWords(page);
      await findWord(page, words[0]);
      await findWord(page, words[1]);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
      await page.screenshot({
        path: `${OUT}/L${level}-${lang}-${w}x${h}${big ? '-200' : ''}.png`,
        fullPage: big,
      });
    });

test('states: first cell selected, wrong pair flash, summary', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startSearch(page, { level: 1 });
  const words = await gridWords(page);
  const [a, b] = wrongPair(words);
  await cell(page, a).click();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${OUT}/state-selected.png` });
  await cell(page, b).click();
  await page.waitForTimeout(220);
  await page.screenshot({ path: `${OUT}/state-wrong-flash.png` });
  for (const w of words) await findWord(page, w);
  await page.screenshot({ path: `${OUT}/state-solved.png` });
  await page.getByRole('button', { name: /See how you did/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/state-summary.png` });
});

test('states: letters-in-order mode (keyboard)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startSearch(page, { level: 2 });
  await page.keyboard.press('Tab');
  await page.screenshot({ path: `${OUT}/state-letters-toggle-focus.png` });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/state-letters-mode.png`, fullPage: true });
});
