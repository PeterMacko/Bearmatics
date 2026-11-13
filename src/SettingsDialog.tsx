import type { RefObject } from 'react';
import HintDialog from './HintDialog';
import type { Copy, Language } from './i18n';

/** Settings dialog: sound toggle, language switch and audio notice. */
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
    </HintDialog>
  );
}
