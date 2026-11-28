import { fireEvent, render, screen } from '@testing-library/react';
import App from '../App';

/** Renders the app and opens the Logic menu (in Slovak after switching the language). */
export function openLogic(lang: 'en' | 'sk' = 'en') {
  const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
  render(<App />);
  if (lang === 'sk') {
    click('Settings');
    click('Slovenčina');
    click('Zavrieť nastavenia');
    click('Logika');
  } else click('Logic');
}
