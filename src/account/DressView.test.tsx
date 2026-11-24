// SCRUM-249: dress your bear (profile), and 4 random looks + Customize on sign-up / Google.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BearLook } from '../../shared/bearLook';
import { copy } from '../i18n';
import AccountScreens from './AccountScreens';
import type { AccountScreen } from './AccountViews';
import type { Account } from './api';
import { describeLook } from './bearLook';

const api = vi.hoisted(() => ({
  updateProfile: vi.fn(),
  signUp: vi.fn(),
  completeGoogle: vi.fn(),
}));
vi.mock('./api', async (original) => ({ ...(await original<object>()), ...api }));
vi.mock('./passwordKey', () => ({ passwordKey: async () => 'ab'.repeat(32) }));

const t = copy.en.account;
const sk = copy.sk.account;
const CROWN: BearLook = { fur: 2, background: 0, head: 3, neck: 0, eyes: 0 };
const KID: Account = {
  kind: 'password',
  username: 'kid',
  nickname: 'Cub',
  look: CROWN,
  email: null,
  leaderboard: true,
};

function show(screenName: AccountScreen, language: 'en' | 'sk' = 'en') {
  const onAccount = vi.fn();
  const onSubView = vi.fn();
  const view = render(
    <AccountScreens
      t={copy[language].account}
      screen={screenName}
      account={KID}
      notice=""
      googleReady={false}
      headingRef={createRef()}
      onAccount={onAccount}
      onOpen={vi.fn()}
      onSubView={onSubView}
    />,
  );
  return { ...view, onAccount, onSubView };
}

const groups = () => screen.getAllByRole('group').filter((g) => g.tagName === 'FIELDSET');

beforeEach(() => {
  api.updateProfile.mockImplementation(async (changes: Partial<Account>) => ({
    ...KID,
    ...changes,
  }));
  api.signUp.mockImplementation(async (body: { look: BearLook }) => ({ ...KID, look: body.look }));
  api.completeGoogle.mockImplementation(async (body: { look: BearLook }) => ({
    ...KID,
    look: body.look,
  }));
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('dress your bear (profile)', () => {
  it('opens from the profile with one named radio group per part and a live, named preview', () => {
    const { onSubView } = show('profile');
    // The profile bear is a button (full screen); its look is the button's description.
    expect(
      screen.getByRole('button', { description: 'Honey bear with a crown' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dress your bear' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Dress your bear' })).toHaveFocus();
    expect(onSubView).toHaveBeenLastCalledWith(expect.any(Function));
    const parts = groups();
    expect(parts.map((g) => g.querySelector('legend')!.textContent)).toEqual([
      'Fur',
      'Background',
      'Head',
      'Neck',
      'Eyes',
    ]);
    expect(parts.map((g) => within(g).getAllByRole('radio').length)).toEqual([8, 8, 6, 6, 4]);
    expect(within(parts[2]).getByRole('radio', { name: 'Crown' })).toBeChecked();
    expect(within(parts[3]).getByRole('radio', { name: 'None' })).toBeChecked();
    // Every choice has a name.
    for (const radio of screen.getAllByRole('radio')) expect(radio).toHaveAccessibleName();

    fireEvent.click(within(parts[0]).getByRole('radio', { name: 'Panda' }));
    fireEvent.click(within(parts[3]).getByRole('radio', { name: 'Medal' }));
    fireEvent.click(within(parts[4]).getByRole('radio', { name: 'Star glasses' }));
    expect(
      screen.getByRole('img', { name: 'Panda with a crown, a medal and star glasses' }),
    ).toHaveAttribute('data-look', '4.0.3.5.3');
  });

  it('Save stores the look and goes back to the profile with focus on the button', async () => {
    const { onAccount, onSubView } = show('profile');
    fireEvent.click(screen.getByRole('button', { name: 'Dress your bear' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Sunglasses' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onAccount).toHaveBeenCalled());
    expect(api.updateProfile).toHaveBeenCalledWith({ look: { ...CROWN, eyes: 2 } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dress your bear' })).toHaveFocus(),
    );
    expect(screen.getByRole('status')).toHaveTextContent('Saved.');
    expect(onSubView).toHaveBeenLastCalledWith(null);
  });

  it('Cancel keeps the old look and sends nothing', async () => {
    show('profile');
    fireEvent.click(screen.getByRole('button', { name: 'Dress your bear' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Cap' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dress your bear' })).toHaveFocus(),
    );
    expect(api.updateProfile).not.toHaveBeenCalled();
    // The profile bear is a button (full screen); its look is the button's description.
    expect(
      screen.getByRole('button', { description: 'Honey bear with a crown' }),
    ).toBeInTheDocument();
  });

  it('a failed save stays on the screen with a message', async () => {
    api.updateProfile.mockRejectedValueOnce(new Error('down'));
    show('profile');
    fireEvent.click(screen.getByRole('button', { name: 'Dress your bear' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.generic);
    expect(screen.getByRole('heading', { level: 2, name: 'Dress your bear' })).toBeInTheDocument();
  });

  it('the bar Back (the closer given to App) cancels the dress screen', async () => {
    const { onSubView } = show('profile');
    fireEvent.click(screen.getByRole('button', { name: 'Dress your bear' }));
    const close = onSubView.mock.lastCall![0] as () => void;
    act(() => close());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Dress your bear' })).toHaveFocus(),
    );
  });

  it('Surprise me picks a different random look', () => {
    show('profile');
    fireEvent.click(screen.getByRole('button', { name: 'Dress your bear' }));
    // First random look equals the current one, so it draws again.
    const values = [2 / 8, 0, 3 / 6, 0, 0, 6 / 8, 1 / 8, 1 / 6, 2 / 6, 1 / 4];
    vi.spyOn(Math, 'random').mockImplementation(() => values.shift() ?? 0);
    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }));
    expect(
      screen.getByRole('img', { name: 'Blue bear with a cap, a tie and glasses' }),
    ).toBeInTheDocument();
  });

  it('SCRUM-273: Save has a tick, Cancel a cross, Surprise me a wand; icons hidden, names unchanged', () => {
    for (const [language, names] of [
      ['en', ['Save', 'Cancel', 'Surprise me']],
      ['sk', ['Uložiť', 'Zrušiť', 'Prekvap ma']],
    ] as const) {
      const { unmount } = show('profile', language);
      fireEvent.click(screen.getByRole('button', { name: copy[language].account.look.dress }));
      const icons = names.map((name) => {
        const button = screen.getByRole('button', { name });
        expect(button).toHaveAccessibleName(name);
        const icon = button.querySelector('svg.button-icon')!;
        expect(icon).toHaveAttribute('aria-hidden', 'true');
        return icon.getAttribute('data-icon');
      });
      expect(icons).toEqual(['tick', 'cross', 'wand']);
      unmount();
    }
  });

  it('SCRUM-273: the choices sit in their own pane between the bear and Save | Cancel', () => {
    show('profile');
    fireEvent.click(screen.getByRole('button', { name: 'Dress your bear' }));
    const pane = document.querySelector('.dress-choices')!;
    expect(groups().every((group) => pane.contains(group))).toBe(true);
    const order = [...document.querySelector('.dress-form')!.children].map((el) => el.className);
    expect(order[0]).toBe('dress-preview');
    expect(order[1]).toBe('dress-choices');
    expect(order[order.length - 1]).toContain('dress-actions');
    const actions = within(document.querySelector<HTMLElement>('.dress-actions')!);
    expect(actions.getAllByRole('button').map((b) => b.textContent)).toEqual(['Save', 'Cancel']);
  });

  it('is in Slovak with Slovak item names', () => {
    show('profile', 'sk');
    // The profile bear is a button (full screen); its look is the button's description.
    expect(
      screen.getByRole('button', { description: 'Medový medvedík s korunou' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Oblč medveďa' }));
    expect(groups().map((g) => g.querySelector('legend')!.textContent)).toEqual([
      'Srsť',
      'Pozadie',
      'Hlava',
      'Krk',
      'Oči',
    ]);
    expect(screen.getByRole('button', { name: 'Prekvap ma' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zrušiť' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Hviezdičkové okuliare' })).toBeInTheDocument();
    expect(sk.look.dress).toBe('Oblč medveďa');
  });
});

describe.each([
  ['signup', 'Create account'],
  ['google-new', 'Continue'],
] as const)('choosing a bear on %s', (screenName, submitLabel) => {
  const picker = () => screen.getByRole('group', { name: t.chooseBear });

  it('offers exactly 4 named random looks and Customize, no ready-made list', () => {
    show(screenName);
    const radios = within(picker()).getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(radios[0]).toBeChecked();
    for (const radio of radios) expect(radio.getAttribute('aria-label')).toMatch(/bear|Panda/);
    expect(new Set(radios.map((r) => r.getAttribute('aria-label'))).size).toBe(4);
    expect(within(picker()).getByRole('button', { name: 'Customize' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new ideas/i })).toBeNull();
    expect(screen.queryByRole('radio', { name: 'Sunny bear' })).toBeNull();
  });

  it('shows a new random set each time the screen opens', () => {
    const first = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    let i = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => first[i++ % first.length]);
    const { unmount } = show(screenName);
    const names = () =>
      within(picker())
        .getAllByRole('radio')
        .map((r) => r.getAttribute('aria-label'));
    const before = names();
    unmount();
    i = 3;
    show(screenName);
    expect(names()).not.toEqual(before);
  });

  it('Customize dresses the chosen look; Save puts it in its place and it is sent', async () => {
    show(screenName);
    const radios = within(picker()).getAllByRole('radio');
    fireEvent.click(radios[2]);
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Dress your bear' })).toHaveFocus();
    fireEvent.click(screen.getByRole('radio', { name: 'Mint' }));
    fireEvent.click(within(groups()[2]).getByRole('radio', { name: 'Flower' }));
    fireEvent.click(within(groups()[3]).getByRole('radio', { name: 'None' }));
    fireEvent.click(within(groups()[4]).getByRole('radio', { name: 'None' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Customize' })).toHaveFocus());
    const chosen = within(picker()).getAllByRole('radio')[2];
    expect(chosen).toBeChecked();
    expect(chosen).toHaveAccessibleName('Mint bear with a flower');

    // Fill the rest of the form and send it: the dressed look goes to the server.
    const form = chosen.closest('form')!;
    const fields = within(form).queryAllByRole('textbox');
    const values: Record<string, string> = {
      [t.username]: 'kid2026',
      [t.email]: '',
      [t.nickname]: 'Cub',
    };
    for (const field of fields) {
      const label = field.closest('.account-field')!.querySelector('label')!.textContent!;
      fireEvent.change(field, { target: { value: values[label] ?? '' } });
    }
    for (const input of form.querySelectorAll('input[type=password]'))
      fireEvent.change(input, { target: { value: 'secret123' } });
    fireEvent.click(within(form).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: submitLabel }));
    const call = screenName === 'signup' ? api.signUp : api.completeGoogle;
    await waitFor(() => expect(call).toHaveBeenCalled());
    const sent = call.mock.lastCall![0] as { look: BearLook };
    expect(describeLook(t.look, sent.look)).toBe('Mint bear with a flower');
    expect(sent).not.toHaveProperty('bear');
  });

  it('Cancel keeps the chosen look and the typed form', async () => {
    show(screenName);
    const nickname = screen.getByLabelText(t.nickname);
    fireEvent.change(nickname, { target: { value: 'Brave' } });
    const before = within(picker()).getAllByRole('radio')[0].getAttribute('aria-label');
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    fireEvent.click(screen.getByRole('button', { name: 'Surprise me' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Customize' })).toHaveFocus());
    expect(within(picker()).getAllByRole('radio')[0]).toHaveAccessibleName(before!);
    expect(screen.getByLabelText(t.nickname)).toHaveValue('Brave');
  });
});
