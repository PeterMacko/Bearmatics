import { type Page } from '@playwright/test';

/**
 * The bear badge button in the app bar. English names only unless `anyLanguage` (then the
 * Slovak bar matches too).
 */
export const badge = (page: Page, { anyLanguage = false } = {}) =>
  anyLanguage
    ? page.getByRole('navigation', { name: /Main controls|Hlavné ovládanie/ }).getByRole('button', {
        name: /badge|odznak/,
      })
    : page
        .getByRole('navigation', { name: 'Main controls' })
        .getByRole('button', { name: /badge/ });
