// SCRUM-281: the tidier profile: rows with pencils, edit windows and the grown-up question.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '../i18n';
import type { Account } from './api';
import { describeLook } from './bearLook';
import { checkGrownUp, grownUpQuestion } from './grownUp';
import { ProfileView } from './ProfileView';
import { releaseStrayTaps } from '../useShadeClose';

const api = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
  signOut: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock('./api', async (original) => ({ ...(await original<object>()), ...api }));
vi.mock('./passwordKey', () => ({
  passwordKey: async (user: string, password: string) => `${user}:${password}`,
}));

const KID: Account = {
  kind: 'password',
  username: 'kid',
  nickname: 'Cub',
  look: { fur: 2, background: 0, head: 3, neck: 0, eyes: 0 },
  email: 'parent@example.com',
  leaderboard: true,
};
const GOOGLE: Account = { ...KID, kind: 'google', username: null, email: null };

/** Random values for the grown-up question: each pair is (a, b). */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};
// a = 3 + floor(r * 4), b = 11 + floor(r * 39)
const Q_3_11 = [0, 0]; // 3³ + 11 = 38
const Q_5_21 = [0.5, 10 / 39 + 0.001]; // 5³ + 21 = 146
const Q_6_49 = [0.999, 0.999]; // 6³ + 49 = 265

let now = 0;
function show(account: Account = KID, language: 'en' | 'sk' = 'en', random = sequence(0, 0)) {
  const onAccount = vi.fn();
  const onSignedOut = vi.fn();
  function Harness({ value }: { value: Account }) {
    return (
      <ProfileView
        t={copy[language].account}
        headingRef={createRef()}
        onPrivacy={vi.fn()}
        account={value}
        onAccount={(next) => {
          onAccount(next);
          view.rerender(<Harness value={next} />);
        }}
        onSignedOut={onSignedOut}
        random={random}
      />
    );
  }
  const view = render(<Harness value={account} />);
  return { onAccount, onSignedOut };
}
const t = copy.en.account;
const button = (name: string | RegExp) => screen.getByRole('button', { name });
const dialog = () => screen.getByRole('dialog');
/** Lets the window's 600 ms double-tap guard pass. */
const settle = () => {
  now += 700;
};

beforeEach(() => {
  now = 1000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  api.updateProfile.mockImplementation(async (changes: Partial<Account>) => ({
    ...KID,
    ...changes,
  }));
  api.changePassword.mockResolvedValue(undefined);
  api.signOut.mockResolvedValue(undefined);
  api.deleteAccount.mockResolvedValue(undefined);
});
afterEach(() => {
  releaseStrayTaps();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('SCRUM-281 profile layout', () => {
  it('greeting left, bear with "Dress your bear" (pencil) right, then rows and buttons', () => {
    show();
    const top = document.querySelector('.profile-top')!;
    expect([...top.children].map((el) => el.className)).toEqual(['menu-heading', 'profile-bear']);
    expect(within(top as HTMLElement).getByRole('heading', { level: 2 })).toHaveTextContent(
      'Hi, Cub!',
    );
    expect(top).toHaveTextContent('Your account');
    expect(top).toHaveTextContent('Signed in as kid');
    const bear = top.querySelector('.profile-bear') as HTMLElement;
    // The bear is a button now (full screen); its look is the full-screen picture's name.
    expect(
      within(bear).getByRole('button', {
        name: 'Show my bear big',
        description: 'Honey bear with a crown',
      }),
    ).toContainElement(bear.querySelector('svg.bear-icon[data-look]'));
    const dress = within(bear).getByRole('button', { name: 'Dress your bear' });
    expect(dress.querySelector('svg')).toHaveAttribute('data-icon', 'pencil');
    const rows = [...document.querySelectorAll('.profile-row')].map((row) => [
      row.querySelector('dt')!.textContent,
      row.querySelector('.profile-value')!.textContent,
      row.querySelector('button')!.getAttribute('aria-label'),
    ]);
    expect(rows).toEqual([
      ['Nickname', 'Cub', 'Change nickname'],
      ['Email', 'parent@example.com', 'Change email'],
      ['Leaderboard', 'Yes', 'Change leaderboard'],
    ]);
    const buttons = [...document.querySelectorAll('.profile-buttons > button')].map((b) => [
      b.textContent,
      b.querySelector('svg')?.getAttribute('data-icon') ?? null,
    ]);
    expect(buttons).toEqual([
      ['Change password', 'key'],
      ['Sign out', 'door'],
      ['Delete account', 'bin'],
      ['What we store', null],
    ]);
    // No forms or switch on the page any more.
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('every icon is hidden from screen readers; pencils are named by their label only', () => {
    show();
    const icons = document.querySelectorAll('svg.button-icon');
    expect(icons.length).toBe(7);
    for (const icon of icons) {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon).toHaveAttribute('focusable', 'false');
    }
    for (const name of ['Change nickname', 'Change email', 'Change leaderboard']) {
      expect(button(name)).toHaveAccessibleName(name);
      expect(button(name)).toHaveClass('profile-edit');
    }
  });

  it('no email saved: the row says so', () => {
    show({ ...KID, email: null });
    expect(button('Change email').closest('.profile-row')).toHaveTextContent('No email saved.');
  });

  it('Google accounts: no Email row and no Change password', () => {
    show(GOOGLE);
    expect(screen.queryByRole('button', { name: 'Change email' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change password' })).toBeNull();
    expect(document.querySelectorAll('.profile-row')).toHaveLength(2);
    expect(screen.getByText('Signed in with Google')).toBeInTheDocument();
  });

  it('is in Slovak: row labels, Áno / Nie, pencil and button names', () => {
    show({ ...KID, leaderboard: false }, 'sk');
    const rows = [...document.querySelectorAll('.profile-row')].map((row) => [
      row.querySelector('dt')!.textContent,
      row.querySelector('.profile-value')!.textContent,
      row.querySelector('button')!.getAttribute('aria-label'),
    ]);
    expect(rows).toEqual([
      ['Prezývka', 'Cub', 'Zmeniť prezývku'],
      ['E-mail', 'parent@example.com', 'Zmeniť e-mail'],
      ['Rebríček', 'Nie', 'Zmeniť rebríček'],
    ]);
    for (const name of ['Oblč medveďa', 'Zmeniť heslo', 'Odhlásiť sa', 'Zmazať účet']) {
      expect(button(name)).toBeInTheDocument();
    }
  });
});

describe('SCRUM-281 edit windows', () => {
  it('nickname: the field is focused, Save checks the rules, saves, updates the row and greeting', async () => {
    const { onAccount } = show();
    fireEvent.click(button('Change nickname'));
    const window = screen.getByRole('dialog', { name: 'Change nickname' });
    const field = within(window).getByLabelText('Nickname');
    expect(field).toHaveFocus();
    expect(field).toHaveValue('Cub');
    expect(field).toHaveAttribute('maxLength', '20');
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.click(within(window).getByRole('button', { name: 'Save' }));
    expect(within(window).getByRole('alert')).toHaveTextContent(t.errors.nickname);
    fireEvent.change(field, { target: { value: ' Honey Star ' } });
    await act(async () => {
      fireEvent.click(within(window).getByRole('button', { name: 'Save' }));
    });
    expect(api.updateProfile).toHaveBeenCalledWith({ nickname: 'Honey Star' });
    expect(onAccount).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Hi, Honey Star!');
    expect(button('Change nickname').closest('.profile-row')).toHaveTextContent('Honey Star');
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
    expect(button('Change nickname')).toHaveFocus();
  });

  it('a failed save keeps the window open with the message inside it', async () => {
    api.updateProfile.mockRejectedValueOnce(new Error('down'));
    show();
    fireEvent.click(button('Change nickname'));
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    });
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(t.errors.generic);
  });

  it.each(['Cancel', 'X', 'Escape'] as const)(
    '%s closes without saving and focus returns to the pencil',
    (how) => {
      show();
      fireEvent.click(button('Change email'));
      fireEvent.change(within(dialog()).getByLabelText('Email (optional)'), {
        target: { value: 'new@example.com' },
      });
      if (how === 'Cancel')
        fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
      if (how === 'X') fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));
      if (how === 'Escape') fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(api.updateProfile).not.toHaveBeenCalled();
      expect(button('Change email')).toHaveFocus();
      expect(button('Change email').closest('.profile-row')).toHaveTextContent(
        'parent@example.com',
      );
    },
  );

  /** A tap on the dark shade outside the window (press and release on the shade). */
  const tapShade = () => {
    const shade = document.querySelector('.modal-backdrop')!;
    fireEvent.pointerDown(shade);
    fireEvent.mouseDown(shade);
    fireEvent.pointerUp(shade);
    fireEvent.click(shade, { detail: 1 });
  };
  // Peter's review: a tap outside closes every window like Cancel (was: never closes).
  it.each([
    ['Change nickname', 'Change nickname'],
    ['Change email', 'Change email'],
    ['Change leaderboard', 'Leaderboard'],
    ['Change password', 'Change password'],
    ['Sign out', 'Sign out'],
    ['Delete account', 'Delete account'],
  ])(
    'a tap on the dark background closes "%s" like Cancel: nothing saved, focus back',
    (opener, title) => {
      show();
      fireEvent.click(button(opener));
      const window = screen.getByRole('dialog', { name: title });
      const field = window.querySelector('input:not([type="checkbox"])');
      if (field) fireEvent.change(field, { target: { value: '38' } });
      else fireEvent.click(within(window).getByRole('checkbox'));
      settle();
      tapShade();
      expect(screen.queryByRole('dialog')).toBeNull();
      for (const call of Object.values(api)) expect(call).not.toHaveBeenCalled();
      expect(button(opener)).toHaveFocus();
      // Typed text is gone: the window opens again with the saved value.
      fireEvent.click(button(opener));
      const again = screen.getByRole('dialog', { name: title });
      const fresh = again.querySelector<HTMLInputElement>('input:not([type="checkbox"])');
      if (fresh) expect(fresh.value).not.toBe('38');
      else expect(within(again).getByRole('checkbox')).toBeChecked();
    },
  );

  it('a press that starts inside the window and ends on the shade does not close (QA265-01)', () => {
    show();
    fireEvent.click(button('Change nickname'));
    settle();
    const shade = document.querySelector('.modal-backdrop')!;
    const field = within(dialog()).getByLabelText('Nickname');
    fireEvent.change(field, { target: { value: 'Typed' } });
    fireEvent.pointerDown(field);
    fireEvent.pointerUp(shade);
    fireEvent.click(shade, { detail: 1 });
    // And the other way round: starts on the shade, released inside.
    fireEvent.pointerDown(shade);
    fireEvent.pointerUp(field);
    fireEvent.click(shade, { detail: 1 });
    expect(screen.getByRole('dialog', { name: 'Change nickname' })).toBeInTheDocument();
    expect(field).toHaveValue('Typed');
  });

  it('the second tap of a double tap on a pencil presses nothing: shade, X, Cancel, Save', () => {
    show();
    fireEvent.click(button('Change email'));
    now += 150; // the second tap lands on the shade
    tapShade();
    expect(screen.getByRole('dialog', { name: 'Change email' })).toBeInTheDocument();
    // ... or on the X, Cancel or Save under the finger: pressed nothing either.
    for (const name of ['Close', 'Cancel', 'Save'])
      fireEvent.click(within(dialog()).getByRole('button', { name }), { detail: 2 });
    expect(screen.getByRole('dialog', { name: 'Change email' })).toBeInTheDocument();
    expect(api.updateProfile).not.toHaveBeenCalled();
    // A quick tap away from the pencil's spot is a deliberate one: Cancel closes.
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }), {
      detail: 1,
      clientX: 300,
      clientY: 300,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(button('Change email'));
    settle();
    tapShade();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('email: checks the address, saves, and Remove email empties the row', async () => {
    show();
    fireEvent.click(button('Change email'));
    const field = within(dialog()).getByLabelText('Email (optional)');
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: 'nope' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(t.errors.email);
    fireEvent.change(field, { target: { value: 'mum@example.com' } });
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    });
    expect(api.updateProfile).toHaveBeenLastCalledWith({ email: 'mum@example.com' });
    expect(button('Change email').closest('.profile-row')).toHaveTextContent('mum@example.com');
    fireEvent.click(button('Change email'));
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Remove email' }));
    });
    expect(api.updateProfile).toHaveBeenLastCalledWith({ email: null });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button('Change email').closest('.profile-row')).toHaveTextContent('No email saved.');
    expect(screen.getByRole('status')).toHaveTextContent('Email removed.');
    // No email saved: no Remove email in the window.
    fireEvent.click(button('Change email'));
    expect(within(dialog()).queryByRole('button', { name: 'Remove email' })).toBeNull();
  });

  it('password: three fields, today\'s checks, and "other devices are signed out"', async () => {
    show();
    fireEvent.click(button('Change password'));
    const window = screen.getByRole('dialog', { name: 'Change password' });
    expect(within(window).getByLabelText('Current password')).toHaveFocus();
    fireEvent.change(within(window).getByLabelText('Current password'), {
      target: { value: 'honeyPot42' },
    });
    fireEvent.change(within(window).getByLabelText('New password'), {
      target: { value: 'short' },
    });
    fireEvent.click(within(window).getByRole('button', { name: 'Save' }));
    expect(within(window).getByRole('alert')).toHaveTextContent(t.errors.password);
    fireEvent.change(within(window).getByLabelText('New password'), {
      target: { value: 'newHoney42' },
    });
    fireEvent.change(within(window).getByLabelText('New password again'), {
      target: { value: 'newHoney43' },
    });
    fireEvent.click(within(window).getByRole('button', { name: 'Save' }));
    expect(within(window).getByRole('alert')).toHaveTextContent(t.errors.mismatch);
    fireEvent.change(within(window).getByLabelText('New password again'), {
      target: { value: 'newHoney42' },
    });
    await act(async () => {
      fireEvent.click(within(window).getByRole('button', { name: 'Save' }));
    });
    expect(api.changePassword).toHaveBeenCalledWith('kid:honeyPot42', 'kid:newHoney42');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Password changed. Other devices are signed out.',
    );
    expect(button('Change password')).toHaveFocus();
  });

  it('Save and Cancel have a tick and a cross; Save is never disabled while saving', async () => {
    let finish: (value: Account) => void = () => {};
    api.updateProfile.mockImplementationOnce(
      () => new Promise<Account>((resolve) => (finish = resolve)),
    );
    show();
    fireEvent.click(button('Change nickname'));
    const save = within(dialog()).getByRole('button', { name: 'Save' });
    expect(save.querySelector('svg')).toHaveAttribute('data-icon', 'tick');
    expect(
      within(dialog()).getByRole('button', { name: 'Cancel' }).querySelector('svg'),
    ).toHaveAttribute('data-icon', 'cross');
    save.focus();
    fireEvent.click(save);
    expect(save).not.toBeDisabled();
    expect(save).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(save);
    expect(api.updateProfile).toHaveBeenCalledTimes(1);
    await act(async () => finish({ ...KID }));
  });
});

describe("SCRUM-281 full-screen bear (Peter's review)", () => {
  const bearButton = () => button('Show my bear big');
  const big = () => screen.getByRole('dialog');

  it('the bear is a button (EN/SK name); a tap shows the bear full screen, X focused', () => {
    show(KID, 'sk');
    expect(button('Ukáž môjho medveďa naveľko')).toBeInTheDocument();
    cleanup();
    show();
    // The Dress your bear link stays a separate button.
    expect(button('Dress your bear')).not.toBe(bearButton());
    expect(screen.queryByRole('img')).toBeNull();
    fireEvent.click(bearButton());
    const view = big();
    const label = describeLook(t.look, KID.look);
    expect(view).toHaveAccessibleName(label);
    expect(within(view).getByRole('img', { name: label })).toHaveAttribute(
      'data-look',
      '2.0.3.0.0',
    );
    expect(within(view).getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  it.each(['tap', 'tap on the bear', 'X', 'Escape'] as const)(
    '%s closes it and focus returns to the bear button',
    (how) => {
      show();
      fireEvent.click(bearButton());
      settle();
      const view = big();
      const tap = (target: Element) => {
        fireEvent.pointerDown(target);
        fireEvent.mouseDown(target);
        fireEvent.pointerUp(target);
        fireEvent.click(target, { detail: 1 });
      };
      if (how === 'tap') tap(view);
      if (how === 'tap on the bear') tap(within(view).getByRole('img'));
      if (how === 'X')
        fireEvent.click(within(view).getByRole('button', { name: 'Close' }), { detail: 1 });
      if (how === 'Escape') fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(bearButton()).toHaveFocus();
    },
  );

  it('Tab stays on the X; keyboard Enter on the X closes at once', () => {
    show();
    fireEvent.click(bearButton());
    const close = within(big()).getByRole('button', { name: 'Close' });
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(close).toHaveFocus();
    fireEvent.click(close, { detail: 0 }); // keyboard: no 600 ms wait
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the second tap of a double tap on the bear keeps it open', () => {
    show();
    fireEvent.click(bearButton());
    now += 150;
    const view = big();
    fireEvent.pointerDown(view);
    fireEvent.pointerUp(view);
    fireEvent.click(view, { detail: 1 });
    fireEvent.click(within(view).getByRole('button', { name: 'Close' }), { detail: 1 });
    expect(big()).toBeInTheDocument();
  });
});

describe('SCRUM-281 grown-up question', () => {
  it('questions stay within a = 3–6, b = 11–49, and every value can come up', () => {
    const as = new Set<number>();
    const bs = new Set<number>();
    for (let i = 0; i <= 4000; i++) {
      const r = i / 4000;
      const q = grownUpQuestion(sequence(r, (r * 7.3) % 1));
      as.add(q.a);
      bs.add(q.b);
      expect(q.answer).toBe(q.a ** 3 + q.b);
    }
    for (const r of [0, 0.999999, 1, -1, 2]) {
      const q = grownUpQuestion(() => r);
      expect(q.a).toBeGreaterThanOrEqual(3);
      expect(q.a).toBeLessThanOrEqual(6);
      expect(q.b).toBeGreaterThanOrEqual(11);
      expect(q.b).toBeLessThanOrEqual(49);
    }
    expect([...as].sort()).toEqual([3, 4, 5, 6]);
    expect(bs.size).toBe(39);
    expect(Math.min(...bs)).toBe(11);
    expect(Math.max(...bs)).toBe(49);
    expect(grownUpQuestion(sequence(...Q_6_49)).answer).toBe(265);
    expect(grownUpQuestion(sequence(...Q_3_11)).answer).toBe(38);
  });

  it('checks answers: empty, right, wrong', () => {
    const q = grownUpQuestion(sequence(...Q_5_21));
    expect(q).toEqual({ a: 5, b: 21, answer: 146 });
    expect(checkGrownUp(q, '  ')).toBe('empty');
    expect(checkGrownUp(q, ' 146 ')).toBe('right');
    expect(checkGrownUp(q, '145')).toBe('wrong');
    expect(checkGrownUp(q, '146.0')).toBe('wrong');
    expect(checkGrownUp(q, '-146')).toBe('wrong');
  });

  it('Sign out: shows "5³ + 21 = ?", read as "5 to the power of 3 plus 21"; numeric field focused', () => {
    show(KID, 'en', sequence(...Q_5_21));
    fireEvent.click(button('Sign out'));
    const window = screen.getByRole('dialog', { name: 'Sign out' });
    expect(window).toHaveTextContent('Ask a grown-up to answer.');
    const shown = window.querySelector('.grown-up-question')!;
    expect(shown).toHaveTextContent('5³ + 21 = ?');
    expect(shown).toHaveAttribute('aria-hidden', 'true');
    const field = within(window).getByRole('textbox', { name: '5 to the power of 3 plus 21' });
    expect(field).toHaveAttribute('inputmode', 'numeric');
    expect(field).toHaveFocus();
  });

  it('Slovak: "Popros dospelého o odpoveď." and "5 na tretiu plus 21"', () => {
    show(KID, 'sk', sequence(...Q_5_21));
    fireEvent.click(button('Odhlásiť sa'));
    const window = screen.getByRole('dialog', { name: 'Odhlásiť sa' });
    expect(window).toHaveTextContent('Popros dospelého o odpoveď.');
    expect(
      within(window).getByRole('textbox', { name: '5 na tretiu plus 21' }),
    ).toBeInTheDocument();
    expect(within(window).getByRole('button', { name: 'Zrušiť' })).toBeInTheDocument();
  });

  it('Sign out: empty = message, same question; wrong = message, new question, field cleared and focused; right = signs out', async () => {
    const { onSignedOut } = show(KID, 'en', sequence(...Q_5_21, ...Q_3_11));
    fireEvent.click(button('Sign out'));
    settle();
    const window = dialog();
    const go = within(window).getByRole('button', { name: 'Sign out' });
    fireEvent.click(go);
    expect(within(window).getByRole('alert')).toHaveTextContent('Type the answer first.');
    expect(window.querySelector('.grown-up-question')).toHaveTextContent('5³ + 21 = ?');
    fireEvent.change(within(window).getByRole('textbox'), { target: { value: '145' } });
    fireEvent.click(go);
    expect(within(window).getByRole('alert')).toHaveTextContent(
      'That is not right. Here is a new question.',
    );
    expect(window.querySelector('.grown-up-question')).toHaveTextContent('3³ + 11 = ?');
    const field = within(window).getByRole('textbox', { name: '3 to the power of 3 plus 11' });
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
    expect(api.signOut).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: '38' } });
    await act(async () => {
      fireEvent.click(go);
    });
    expect(api.signOut).toHaveBeenCalledTimes(1);
    expect(onSignedOut).toHaveBeenCalledWith('signed-out');
  });

  it('Enter in the field checks the answer too', async () => {
    const { onSignedOut } = show(KID, 'en', sequence(...Q_3_11));
    fireEvent.click(button('Sign out'));
    const field = within(dialog()).getByRole('textbox');
    fireEvent.change(field, { target: { value: '38' } });
    await act(async () => {
      fireEvent.submit(field.closest('form')!);
    });
    expect(onSignedOut).toHaveBeenCalledWith('signed-out');
  });

  it('a new question each time the window opens; Cancel, X and Escape do nothing', () => {
    show(KID, 'en', sequence(...Q_5_21, ...Q_3_11, ...Q_6_49));
    fireEvent.click(button('Sign out'));
    expect(dialog().querySelector('.grown-up-question')).toHaveTextContent('5³ + 21 = ?');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));
    expect(button('Sign out')).toHaveFocus();
    fireEvent.click(button('Sign out'));
    expect(dialog().querySelector('.grown-up-question')).toHaveTextContent('3³ + 11 = ?');
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));
    fireEvent.click(button('Delete account'));
    expect(dialog().querySelector('.grown-up-question')).toHaveTextContent('6³ + 49 = ?');
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(button('Delete account')).toHaveFocus();
    expect(api.signOut).not.toHaveBeenCalled();
    expect(api.deleteAccount).not.toHaveBeenCalled();
  });

  it('Delete: warning, question, "Keep my account" focused first; Keep changes nothing', () => {
    show(KID, 'en', sequence(...Q_3_11));
    fireEvent.click(button('Delete account'));
    const window = screen.getByRole('dialog', { name: 'Delete account' });
    expect(window).toHaveTextContent(t.deleteWarning);
    expect(window).toHaveTextContent('Ask a grown-up to answer.');
    const keep = within(window).getByRole('button', { name: 'Keep my account' });
    expect(keep).toHaveFocus();
    const yes = within(window).getByRole('button', { name: 'Yes, delete forever' });
    expect(yes.querySelector('svg')).toHaveAttribute('data-icon', 'bin');
    fireEvent.click(keep);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.deleteAccount).not.toHaveBeenCalled();
    expect(button('Delete account')).toHaveFocus();
  });

  it('Delete: wrong answer does not delete; the right one deletes', async () => {
    const { onSignedOut } = show(KID, 'en', sequence(...Q_3_11, ...Q_5_21));
    fireEvent.click(button('Delete account'));
    settle();
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: '39' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Yes, delete forever' }));
    expect(api.deleteAccount).not.toHaveBeenCalled();
    fireEvent.change(within(dialog()).getByRole('textbox', { name: /^5 to the power/ }), {
      target: { value: '146' },
    });
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Yes, delete forever' }));
    });
    expect(api.deleteAccount).toHaveBeenCalledTimes(1);
    expect(onSignedOut).toHaveBeenCalledWith('deleted');
  });

  it('a double tap, or a tap right after the window opened, never presses the action button', async () => {
    show(KID, 'en', sequence(...Q_3_11));
    fireEvent.click(button('Delete account'));
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: '38' } });
    const yes = within(dialog()).getByRole('button', { name: 'Yes, delete forever' });
    // Within 600 ms of opening: ignored, even a deliberate single tap.
    now += 300;
    fireEvent.click(yes, { detail: 1 });
    settle();
    // The second click of a double tap: ignored.
    fireEvent.click(yes, { detail: 2 });
    expect(api.deleteAccount).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(yes, { detail: 1 });
    });
    expect(api.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('a failed sign-out shows the error inside the window; the button is never disabled', async () => {
    api.signOut.mockRejectedValueOnce(new Error('down'));
    show(KID, 'en', sequence(...Q_3_11));
    fireEvent.click(button('Sign out'));
    settle();
    fireEvent.change(within(dialog()).getByRole('textbox'), { target: { value: '38' } });
    await act(async () => {
      fireEvent.click(within(dialog()).getByRole('button', { name: 'Sign out' }));
    });
    await waitFor(() =>
      expect(within(dialog()).getByRole('alert')).toHaveTextContent(t.errors.generic),
    );
    expect(within(dialog()).getByRole('button', { name: 'Sign out' })).not.toBeDisabled();
  });

  it('Tab stays inside the window and reaches the field (keyboard-only use)', () => {
    show(KID, 'en', sequence(...Q_3_11));
    fireEvent.click(button('Sign out'));
    const window = dialog();
    const field = within(window).getByRole('textbox');
    expect(field).toHaveFocus();
    const cancel = within(window).getByRole('button', { name: 'Cancel' });
    cancel.focus();
    fireEvent.keyDown(cancel, { key: 'Tab' });
    expect(within(window).getByRole('button', { name: 'Close' })).toHaveFocus();
    // Shift+Tab from the field is not pulled away (the field is a tabbable control).
    field.focus();
    fireEvent.keyDown(field, { key: 'Tab', shiftKey: true });
    expect(field).toHaveFocus();
  });
});
