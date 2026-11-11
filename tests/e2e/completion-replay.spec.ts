import { expect, test } from '@playwright/test';

type Evidence = {
  notes: number[];
  clicks: { text: string; detail: number; trusted: boolean }[];
};

for (const review of [false, true]) {
  for (const replay of ['click', 'Enter', 'Space'] as const) {
    test(`Finish double-click preserves completion: review=${review}, replay=${replay}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.addInitScript(() => {
        const evidence: Evidence = { notes: [], clicks: [] };
        (window as unknown as { completionEvidence: Evidence }).completionEvidence = evidence;
        document.addEventListener('click', event => {
          const button = (event.target as Element).closest('button');
          if (button) evidence.clicks.push({ text: button.textContent!.trim(), detail: event.detail, trusted: event.isTrusted });
        }, true);
        // Observe native scheduling without replacing browser audio or app activation.
        const create = AudioContext.prototype.createOscillator;
        AudioContext.prototype.createOscillator = function () {
          const oscillator = create.call(this);
          const set = oscillator.frequency.setValueAtTime.bind(oscillator.frequency);
          oscillator.frequency.setValueAtTime = (value, time) => {
            evidence.notes.push(value);
            return set(value, time);
          };
          return oscillator;
        };
      });
      const evidence = () => page.evaluate(() => (window as unknown as { completionEvidence: Evidence }).completionEvidence);
      const solve = async (wrong = false) => {
        const value = await page.locator('.equation').evaluate(el => {
          const terms = [...el.querySelectorAll('[data-term]')];
          const blank = terms.findIndex(term => term.querySelector('input'));
          const [a, b, c] = terms.map(term => Number(term.textContent));
          return blank === 2 ? a + b : blank === 0 ? c - b : c - a;
        });
        await page.getByRole('textbox').fill(String(value + Number(wrong)));
        await page.getByRole('button', { name: 'Check answer', exact: true }).click();
      };
      await page.goto('/');
      await page.getByRole('radio', { name: '5 exercises', exact: true }).check();
      await page.getByRole('button', { name: 'Let’s count' }).click();
      for (let i = 0; i < 5; i++) {
        if (review && i === 4) await solve(true);
        await solve();
        if (i < 4) await page.getByRole('button', { name: 'Next exercise' }).click();
      }
      if (review) {
        await page.getByRole('button', { name: 'Review tricky ones' }).click();
        await solve();
      }
      const before = (await evidence()).notes.length;
      expect(before).toBe(review ? 20 : 15);
      const finish = page.getByRole('button', { name: 'See how you did' });
      const box = await finish.boundingBox();
      expect(box).not.toBeNull();
      // The lower part overlaps Replay in both flows/browsers; centre-only
      // Chromium review clicks can miss Replay and conceal the regression.
      await finish.dblclick({ position: { x: box!.width / 2, y: box!.height - 8 } });
      await expect(page.getByRole('heading', { name: 'Look how far you’ve come!' })).toBeVisible();
      await expect(page.locator('.completed-total')).toHaveText('5 exercises completed');
      await expect(page.locator('.first-try strong')).toHaveText(`${review ? 4 : 5} / 5`);
      await expect(page.getByRole('textbox')).toHaveCount(0);
      const completed = await evidence();
      expect(completed.clicks.slice(-2)).toEqual([
        { text: 'See how you did →', detail: 1, trusted: true },
        { text: 'Play again', detail: 2, trusted: true },
      ]);
      expect(completed.notes.slice(before)).toEqual([523.25, 659.25, 783.99, 1046.5]);
      // A separate gesture must still replay, including native keyboard clicks.
      const again = page.getByRole('button', { name: 'Play again' });
      if (replay === 'click') await again.click();
      else { await again.focus(); await page.keyboard.press(replay); }
      await expect(page.locator('.exercise-position')).toHaveText('Exercise 1 of 5');
      await expect(page.getByRole('textbox')).toHaveValue('');
      await expect(page.getByRole('button', { name: 'Check answer' })).toHaveAttribute('data-state', 'neutral');
      const restarted = await evidence();
      expect(restarted.clicks.at(-1)).toEqual({ text: 'Play again', detail: replay === 'click' ? 1 : 0, trusted: true });
      expect(restarted.notes).toHaveLength(before + 4);
      // Completing the new session proves score and completion-consumption reset.
      for (let i = 0; i < 5; i++) {
        await solve();
        await page.getByRole('button', { name: i < 4 ? 'Next exercise' : 'See how you did' }).click();
      }
      await expect(page.locator('.first-try strong')).toHaveText('5 / 5');
      const final = await evidence();
      expect(final.notes).toHaveLength(before + 4 + 15 + 4);
      expect(final.notes.filter(value => value === 1046.5)).toHaveLength(2);
      await testInfo.attach('completion-replay-evidence', { body: JSON.stringify({ browser: testInfo.project.name, review, replay, completed, restarted, final }, null, 2), contentType: 'application/json' });
    });
  }
}
