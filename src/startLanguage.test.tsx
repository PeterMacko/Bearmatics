import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';
import { takeStartLanguage } from './startLanguage';

// SCRUM-218: the About page's Bearmatics link opens /?lang=sk|en in that language.
function at(address: string) {
  const url = new URL(address, 'https://bearmatics.test');
  const history = { state: { kept: 1 }, replaceState: vi.fn() };
  const language = takeStartLanguage(url, history);
  return { language, history };
}

describe('takeStartLanguage', () => {
  it.each([
    ['/?lang=sk', 'sk', '/'],
    ['/?lang=en', 'en', '/'],
    ['/?lang=sk&x=1#top', 'sk', '/?x=1#top'],
    ['/?x=1&lang=en', 'en', '/?x=1'],
    ['/?lang=sk&lang=en', 'sk', '/'],
  ])('%s starts in %s and leaves the address %s (replace, no new entry)', (address, lang, rest) => {
    const { language, history } = at(address);
    expect(language).toBe(lang);
    expect(history.replaceState).toHaveBeenCalledTimes(1);
    expect(history.replaceState).toHaveBeenCalledWith({ kept: 1 }, '', rest);
  });

  it.each(['/', '/?x=1', '/?lang=', '/?lang=SK', '/?lang=de', '/?lang=sk-SK', '/?language=sk'])(
    '%s is ignored: no language, the address stays',
    (address) => {
      const { language, history } = at(address);
      expect(language).toBeNull();
      expect(history.replaceState).not.toHaveBeenCalled();
    },
  );

  it('reads the real address and replaces it in the browser history', () => {
    window.history.pushState(null, '', '/?lang=sk');
    const length = window.history.length;
    expect(takeStartLanguage()).toBe('sk');
    expect(window.location.pathname + window.location.search).toBe('/');
    expect(window.history.length).toBe(length);
    window.history.replaceState(null, '', '/');
  });
});

describe('App start language', () => {
  it('starts in English without a start language, as before', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('starts in Slovak with startLanguage sk', () => {
    render(<App startLanguage="sk" />);
    expect(screen.getByRole('button', { name: 'Nastavenia' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('sk');
  });
});
