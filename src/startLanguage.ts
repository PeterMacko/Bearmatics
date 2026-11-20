import type { Language } from './i18n';

/**
 * The app's starting language from the address (SCRUM-218): the About page's Bearmatics link opens
 * `/?lang=sk` or `/?lang=en`. Only `sk` and `en` count; the parameter is then removed from the
 * address with `history.replaceState` (no reload, no history entry). Any other value, or none, is
 * ignored and the address stays as it is, so the app starts as before (English).
 */
export function takeStartLanguage(
  location: Pick<Location, 'pathname' | 'search' | 'hash'> = window.location,
  history: Pick<History, 'state' | 'replaceState'> = window.history,
): Language | null {
  const params = new URLSearchParams(location.search);
  const value = params.get('lang');
  if (value !== 'sk' && value !== 'en') return null;
  params.delete('lang');
  const search = params.toString();
  history.replaceState(
    history.state,
    '',
    `${location.pathname}${search ? `?${search}` : ''}${location.hash}`,
  );
  return value;
}
