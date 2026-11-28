import { expect, type Page } from '@playwright/test';
import { SETTLE_WAIT_MS, TURN_WAIT_MS } from './timing';

/** Opens Logic and starts a Pexeso level (6 / 7 / 8); waits until the board takes taps. */
export async function startPexeso(page: Page, level: 6 | 7 | 8, sk = false) {
  await page
    .getByRole('button', { name: sk ? /^Logika/ : /^Logic/ })
    .first()
    .click();
  // The row (a label), like the other Logic levels: a forced click on the hidden radio can land
  // beside it when the list is scrolled (seen once on macs4 at 844x390).
  await page.locator(`.logic-home .level-${level}`).click();
  await expect(page.locator(`input[name="logic-level"][value="${level}"]`)).toBeChecked();
  await page.locator('.start-button').click();
  await expect(page.locator('.pexeso-card').first()).toBeVisible();
  // The board ignores taps for its first 600 ms (the rest of the Start tap).
  await page.waitForTimeout(SETTLE_WAIT_MS);
}

/** Every card's accessible name ("Card 4, face down" / "Card 4, apple" / "apple, found"). */
export const cardNames = (page: Page) =>
  page
    .locator('.pexeso-card')
    .evaluateAll((cards) => cards.map((c) => c.getAttribute('aria-label') ?? ''));

/** A deliberate tap on card i (0-based), after the 300 ms between accepted card taps. */
export async function tapCard(page: Page, index: number) {
  await page.waitForTimeout(TURN_WAIT_MS);
  await page.locator('.pexeso-card').nth(index).click();
}

/** The picture name from a card's accessible name ("Card 4, apple" or "apple, found"). */
const pictureOf = (name: string) =>
  /^(?:Card|Karta) \d+, (.*)$/.exec(name)?.[1] ?? name.split(', ')[0];

/**
 * Plays the whole board from memory, never forgetting: opens an unseen card first; if its
 * partner was seen, opens that partner (a pair), otherwise another unseen card (a lucky miss).
 * Card identities are only learned by opening cards (the DOM never tells before). Returns the
 * number of turns.
 */
export async function playPerfect(page: Page): Promise<number> {
  const known = new Map<number, string>();
  const found = new Set<number>();
  const total = await page.locator('.pexeso-card').count();
  let turns = 0;
  const open = async (i: number) => {
    await tapCard(page, i);
    const name = (await cardNames(page))[i];
    // The last pair: the summary replaced the board.
    if (name === undefined) return 'done';
    known.set(i, pictureOf(name));
    return known.get(i)!;
  };
  const partnerOf = (i: number) =>
    [...known.entries()].find(([j, p]) => j !== i && !found.has(j) && p === known.get(i))?.[0];
  while (found.size < total && (await page.locator('.pexeso-card').count()) > 0) {
    turns++;
    // A known pair (both seen, not found yet) first.
    const pair = [...known.keys()].find((i) => !found.has(i) && partnerOf(i) !== undefined);
    if (pair !== undefined) {
      const other = partnerOf(pair)!;
      await open(pair);
      await open(other);
      found.add(pair).add(other);
      continue;
    }
    const unseen = () =>
      Array.from({ length: total }, (_, i) => i).filter((i) => !known.has(i) && !found.has(i));
    const first = unseen()[0];
    await open(first);
    const partner = partnerOf(first);
    if (partner !== undefined) {
      await open(partner);
      found.add(first).add(partner);
      continue;
    }
    const second = unseen()[0];
    await open(second);
    if (known.get(second) === known.get(first)) found.add(first).add(second);
  }
  return turns;
}
