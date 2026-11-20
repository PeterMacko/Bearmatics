import type { Language } from '../i18n';

/** The About page (SCRUM-218) for this address, or null for the app. */
export type AboutRoute = {
  language: Language;
  /** The address names the language (/about/sk, /about/en); bare /about follows the browser. */
  explicit: boolean;
};

// /about, /about/ and /about/<one part>[/]. Any other part than sk or en behaves like /about.
const ABOUT = /^\/about(?:\/([^/]*))?\/?$/;

/** Slovak when the browser's preferred (first) language is Slovak, otherwise English. */
export function browserLanguage(languages: readonly string[]): Language {
  return languages[0]?.toLowerCase().startsWith('sk') ? 'sk' : 'en';
}

export function aboutRoute(pathname: string, languages: readonly string[]): AboutRoute | null {
  const match = ABOUT.exec(pathname);
  if (!match) return null;
  const part = match[1];
  if (part === 'sk' || part === 'en') return { language: part, explicit: true };
  return { language: browserLanguage(languages), explicit: false };
}

/** The About page address in one language (Settings link, language switch). */
export const aboutHref = (language: Language) => `/about/${language}`;
