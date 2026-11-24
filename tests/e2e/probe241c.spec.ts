import { test } from '@playwright/test';
import { appendFileSync, mkdirSync } from 'node:fs';
import { ALL_DEVICES } from './support/devices';
import { setLanguage } from './support/language';

const OUT = '/home/pmacko/.hermes/profiles/dev/cache/scratch/scrum241/shots';
mkdirSync(OUT, { recursive: true });
const TAG = process.env.WS_TAG ?? 'new';
const SHOTS = process.env.WS_SHOTS === '1';
const cases = [
  ...ALL_DEVICES.filter((d) => d.width !== 369 && d.width !== 742).map((d) => ({ d, big: false })),
  ...ALL_DEVICES.filter(
    (d) => (d.width === 390 && d.height === 844) || (d.width === 320 && d.height === 568),
  ).map((d) => ({ d, big: true })),
];
for (const { d, big } of cases)
  for (const lang of ['en', 'sk'] as const)
    test(`courses ${d.width}x${d.height} ${lang}${big ? ' 200%' : ''}`, async ({ page }) => {
      await page.setViewportSize({ width: d.width, height: d.height });
      await page.goto('/');
      if (lang === 'sk') await setLanguage(page, 'Slovenčina');
      if (big) await page.addStyleTag({ content: 'html{font-size:200% !important}' });
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const d = document.documentElement;
        const list = document.querySelector<HTMLElement>('.course-options')!;
        const cards = [...list.querySelectorAll<HTMLElement>('.course-option')];
        const vh = d.clientHeight;
        return {
          cards: cards.length,
          pageScroll: d.scrollHeight - d.clientHeight,
          sideScroll: d.scrollWidth - d.clientWidth,
          listHidden: list.scrollHeight - list.clientHeight,
          allVisible: cards.every((c) => {
            const b = c.getBoundingClientRect();
            const l = list.getBoundingClientRect();
            return b.top >= Math.max(0, l.top) - 0.5 && b.bottom <= Math.min(vh, l.bottom) + 0.5;
          }),
          minCard: Math.min(...cards.map((c) => c.offsetHeight)),
          mode: document.querySelector('.workspace')!.getAttribute('data-menu-mode'),
          compact: document.querySelector('.workspace')!.hasAttribute('data-menu-compact'),
          barRows: (() => {
            const items = [
              ...document.querySelectorAll<HTMLElement>('.app-bar button, .app-bar a'),
            ].filter((e) => e.offsetParent);
            return new Set(items.map((e) => Math.round(e.getBoundingClientRect().top / 20))).size;
          })(),
        };
      });
      const name = `courses-${TAG}-${lang}-${d.width}x${d.height}${big ? '-200' : ''}`;
      if (SHOTS) await page.screenshot({ path: `${OUT}/${name}.png` });
      appendFileSync(`${OUT}/courses.jsonl`, JSON.stringify({ name, ...m }) + '\n');
    });
