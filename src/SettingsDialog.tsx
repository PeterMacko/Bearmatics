import type { MouseEvent, RefObject } from 'react';
import { aboutHref } from './about/aboutRoute';
import HintDialog from './HintDialog';
import type { Copy, Language } from './i18n';

/** Settings dialog: sound toggle, language switch, audio notice and the About page link. */
export default function SettingsDialog({
  t,
  language,
  soundEnabled,
  soundReady,
  soundBusy,
  audioUnavailable,
  triggerRef,
  onLanguageChange,
  onToggleSound,
  onAbout,
  onClose,
}: {
  t: Copy;
  language: Language;
  soundEnabled: boolean;
  soundReady: boolean;
  soundBusy: boolean;
  audioUnavailable: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onLanguageChange: (language: Language) => void;
  onToggleSound: () => void;
  /** Before the About link navigates (a running lesson asks first). */
  onAbout?: (event: MouseEvent<HTMLAnchorElement>) => void;
  onClose: () => void;
}) {
  return (
    <HintDialog
      titleId="settings-title"
      title={t.settings}
      closeLabel={t.closeSettings}
      onClose={onClose}
      triggerRef={triggerRef}
    >
      <div className="header-controls">
        <button
          className="sound-toggle"
          type="button"
          onClick={onToggleSound}
          aria-busy={soundBusy}
          aria-pressed={soundEnabled}
        >
          <span aria-hidden="true">{soundEnabled ? '♪' : '♩'}</span>{' '}
          {soundEnabled
            ? soundReady
              ? t.soundOn
              : audioUnavailable
                ? t.soundUnavailable
                : t.soundRequested
            : t.soundOff}
        </button>
        <nav className="language-switch" aria-label="Language / Jazyk">
          <button
            type="button"
            aria-pressed={language === 'sk'}
            onClick={() => onLanguageChange('sk')}
          >
            Slovenčina
          </button>
          <button
            type="button"
            aria-pressed={language === 'en'}
            onClick={() => onLanguageChange('en')}
          >
            English
          </button>
        </nav>
      </div>
      {audioUnavailable && (
        <span className="audio-notice" aria-live="polite">
          {t.audioUnavailable}
        </span>
      )}
      {/* SCRUM-218: a plain link (same tab) to the About page in the app's language. */}
      <a className="about-link" href={aboutHref(language)} onClick={onAbout}>
        {t.aboutApp}
      </a>
    </HintDialog>
  );
}
