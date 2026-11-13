import { expect, test, type Page } from '@playwright/test';
import { openMathematics } from './course';

type Envelope = { value: number; time: number }[];
type Note = { frequency: number; start: number; stops: (number | null)[] };
type AudioTrace = { contexts: boolean[]; notes: Note[]; envelopes: Envelope[] };
async function trace(page: Page): Promise<AudioTrace> {
  return page.evaluate(() => (window as unknown as { audioTrace: AudioTrace }).audioTrace);
}
async function solve(page: Page, wrong = false) {
  const value = await page.locator('.equation').evaluate((el) => {
    const terms = [...el.querySelectorAll('[data-term]')];
    const blank = terms.findIndex((term) => term.querySelector('input'));
    const [a, b, c] = terms.map((term) => Number(term.textContent));
    return blank === 2 ? a + b : blank === 0 ? c - b : c - a;
  });
  await page.getByRole('textbox').fill(String(value + Number(wrong)));
  await page.getByRole('button', { name: 'Check answer' }).click();
}

test('native Web Audio is lazy, captures stronger bounded schedules and one gated two-second fanfare', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const state: AudioTrace = { contexts: [], notes: [], envelopes: [] };
    (window as unknown as { audioTrace: AudioTrace }).audioTrace = state;
    const Native = window.AudioContext;
    window.AudioContext = new Proxy(Native, {
      construct(Target, args) {
        state.contexts.push(navigator.userActivation.isActive);
        return Reflect.construct(Target, args);
      },
    });
    const createOscillator = Native.prototype.createOscillator;
    Native.prototype.createOscillator = function () {
      const node = createOscillator.call(this);
      const note: Note = { frequency: 0, start: 0, stops: [] };
      state.notes.push(note);
      const start = node.start.bind(node),
        stop = node.stop.bind(node);
      const setFrequency = node.frequency.setValueAtTime.bind(node.frequency);
      node.frequency.setValueAtTime = (value, time) => {
        note.frequency = value;
        return setFrequency(value, time);
      };
      node.start = (time = 0) => {
        note.start = time;
        start(time);
      };
      node.stop = (time?: number) => {
        note.stops.push(time ?? null);
        stop(time);
      };
      return node;
    };
    const createGain = Native.prototype.createGain;
    Native.prototype.createGain = function () {
      const node = createGain.call(this),
        events: Envelope = [];
      state.envelopes.push(events);
      const set = node.gain.setValueAtTime.bind(node.gain),
        ramp = node.gain.linearRampToValueAtTime.bind(node.gain);
      node.gain.setValueAtTime = (value, time) => {
        events.push({ value, time });
        return set(value, time);
      };
      node.gain.linearRampToValueAtTime = (value, time) => {
        events.push({ value, time });
        return ramp(value, time);
      };
      return node;
    };
  });
  await page.goto('/');
  await openMathematics(page);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sound requested' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Close settings' }).click();
  expect(await trace(page)).toEqual({ contexts: [], notes: [], envelopes: [] });
  await page.getByRole('radio', { name: '5 exercises', exact: true }).check();
  await page.getByRole('button', { name: 'Let’s count' }).click();
  expect((await trace(page)).contexts).toEqual([true]);
  await page.getByRole('button', { name: 'Check answer' }).click();
  expect((await trace(page)).notes).toHaveLength(0);
  for (let i = 0; i < 5; i++) {
    if (i === 4) await solve(page, true);
    await solve(page);
    await page.locator('form').evaluate((form) => (form as HTMLFormElement).requestSubmit());
    await page
      .getByRole('button', { name: i === 4 ? 'Review tricky ones' : 'Next exercise' })
      .click();
  }
  const short = await trace(page);
  expect(short.notes).toHaveLength(17); // five successes + one retry; no early fanfare
  const correct = short.notes.slice(0, 3),
    retry = short.notes.slice(12, 14);
  expect(correct[2].stops[0]! - correct[0].start).toBeCloseTo(1, 5);
  expect(retry[1].stops[0]! - retry[0].start).toBeCloseTo(0.9, 5);
  expect(correct.map((n) => n.frequency)).toEqual([523.25, 659.25, 783.99]);
  expect(retry.map((n) => n.frequency)).toEqual([329.63, 261.63]);
  // Subsequent feedback cancels prior sustained notes before their scheduled end.
  for (const note of [correct.at(-1)!, retry.at(-1)!]) expect(note.stops).toContain(null);
  await solve(page);
  // final review answer is still ordinary feedback
  expect((await trace(page)).notes).toHaveLength(20);
  await page.getByRole('button', { name: 'See how you did' }).dblclick();
  await expect(page.getByRole('heading', { name: 'Look how far you’ve come!' })).toBeVisible();
  const completed = await trace(page);
  expect(completed.notes).toHaveLength(24);
  const fanfare = completed.notes.slice(-4),
    envelopes = completed.envelopes.slice(-4);
  expect(fanfare.map((n) => n.frequency)).toEqual([523.25, 659.25, 783.99, 1046.5]);
  expect(fanfare[3].stops[0]! - fanfare[0].start).toBeCloseTo(2, 5);
  for (const envelope of completed.envelopes) {
    expect(envelope[0].value).toBe(0);
    expect(envelope[1].value).toBe(0.6);
    expect(envelope[2].value).toBe(0.48);
    expect(envelope[1].time - envelope[0].time).toBeCloseTo(0.015, 5);
    expect(envelope.at(-1)!.value).toBe(0);
  }
  let maximum = 0;
  for (let t = fanfare[0].start; t <= fanfare[0].start + 2; t += 0.001) {
    const sum = envelopes.reduce((total, events) => {
      const i = events.findIndex((e) => e.time >= t);
      if (i <= 0) return total;
      const a = events[i - 1],
        b = events[i];
      return total + a.value + ((b.value - a.value) * (t - a.time)) / (b.time - a.time);
    }, 0);
    maximum = Math.max(maximum, sum);
  }
  expect(maximum).toBeLessThanOrEqual(0.65);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Sound on' }).click();
  // Scheduled long final tone must be cancelled before its natural end.
  expect((await trace(page)).notes.at(-1)!.stops).toContain(null);
  await page.getByRole('button', { name: 'Sound off' }).click();
  await page.getByRole('button', { name: 'Slovenčina' }).click();
  await page.getByRole('button', { name: 'Zavrieť nastavenia' }).click();
  expect((await trace(page)).notes).toHaveLength(24);
  await testInfo.attach('native-audio-schedule', {
    body: JSON.stringify({ ...completed, maximumFanfareEnvelope: maximum }, null, 2),
    contentType: 'application/json',
  });
});
