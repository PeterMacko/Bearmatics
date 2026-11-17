import { type Page } from '@playwright/test';

export type Language = 'English' | 'Slovenčina';

/** Opens the settings by the gear's exact name, picks a language, closes with the named ×. */
export async function switchLanguage(page: Page, language: string, gear: string, close: string) {
  await page.getByRole('button', { name: gear, exact: true }).click();
  await page.getByRole('button', { name: language, exact: true }).click();
  await page.getByRole('button', { name: close, exact: true }).click();
}

/**
 * Picks a language in the settings dialog. The gear is found by its class (default) or by the
 * English name "Settings"; the dialog closes with Escape (default) or its × button.
 */
export async function setLanguage(
  page: Page,
  language: Language,
  {
    gear = 'class',
    close = 'escape',
  }: { gear?: 'class' | 'name'; close?: 'escape' | 'button' } = {},
) {
  if (gear === 'class') await page.locator('.settings-button').click();
  else await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: language }).click();
  if (close === 'escape') await page.keyboard.press('Escape');
  else
    await page
      .getByRole('button', {
        name: language === 'Slovenčina' ? 'Zavrieť nastavenia' : 'Close settings',
      })
      .click();
}
