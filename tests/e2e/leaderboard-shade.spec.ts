import { expect, test } from '@playwright/test';
import { nextFrames } from './support/layout';
import { mockApi } from './support/mockApi';

// Peter 2026-11-23 (SCRUM-258 review): a tap on the shade outside closes the leaderboard and
// the badge details; a double tap there does not press what lies under the shade; a drag that
// starts inside the window does not close it.
const ROWS = Array.from({ length: 5 }, (_, i) => ({
  place: i + 1,
  nickname: `Hráč ${i + 1}`,
  look: { fur: 1, background: 1, head: 2, neck: 0, eyes: 0 },
  points: 400 - i * 50,
  streak: 3,
  frozen: false,
  me: i === 2,
}));

for (const [width, height] of [
  [390, 844],
  [1366, 900],
] as const) {
  test(`shade closes the leaderboard and badge details at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await mockApi(page, {
      nickname: 'Hráč 3',
      points: 300,
      streak: 3,
      frozen: false,
      today: true,
      leaderboard: { rows: ROWS, gapBefore: 0 },
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Maths', exact: true }).click();
    const board = page.getByRole('button', { name: /^Leaderboard,/ });
    await board.click();
    const dialog = page.getByRole('dialog', { name: 'Leaderboard' });
    await expect(dialog.getByRole('table')).toBeVisible();
    await nextFrames(page);

    // A drag from inside the table to the shade keeps it open.
    const table = (await dialog.getByRole('table').boundingBox())!;
    await page.mouse.move(table.x + 10, table.y + 10);
    await page.mouse.down();
    await page.mouse.move(4, height - 4, { steps: 4 });
    await page.mouse.up();
    await expect(dialog).toBeVisible();

    // A double tap on the shade over a menu button: closes, and the button is not pressed.
    const box = (await dialog.boundingBox())!;
    const target = await page.evaluate((d) => {
      const outside = (r: DOMRect) =>
        r.bottom < d.y || r.top > d.y + d.height || r.right < d.x || r.left > d.x + d.width;
      const button = [...document.querySelectorAll('.app-shell button')]
        .map((b) => ({ b, r: b.getBoundingClientRect() }))
        .find(({ b, r }) => r.width > 0 && outside(r) && !b.closest('.app-bar'));
      return button
        ? {
            x: button.r.x + button.r.width / 2,
            y: button.r.y + button.r.height / 2,
            text: button.b.textContent,
          }
        : null;
    }, box);
    expect(target, 'a menu button outside the window').not.toBeNull();
    await page.evaluate(() => {
      const w = window as unknown as { pressed: string[] };
      w.pressed = [];
      document.addEventListener('click', (e) => {
        const b = (e.target as Element).closest('button');
        if (b) w.pressed.push(b.textContent ?? '');
      });
    });
    await page.mouse.dblclick(target!.x, target!.y);
    await expect(dialog).toBeHidden();
    await expect(board).toBeFocused();
    // Nothing under the shade was pressed.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { pressed: string[] }).pressed)).toEqual(
      [],
    );

    // Badge details close the same way.
    await page.waitForTimeout(700);
    const medal = page.getByRole('button', { name: /^Bear badge \d+,/ });
    await medal.click();
    const details = page.getByRole('dialog', { name: 'Your bear badge' });
    await expect(details).toBeVisible();
    await page.mouse.click(4, height - 4);
    await expect(details).toBeHidden();
    await expect(medal).toBeFocused();
  });
}
