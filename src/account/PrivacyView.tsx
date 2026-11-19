import { Screen, type Common } from './fields';

const LINK = /(https:\/\/\S+[^\s.]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/;

export function PrivacyView({ t, headingRef }: Omit<Common, 'onPrivacy'>) {
  return (
    <Screen t={t} title={t.privacyTitle} intro={t.privacy[0]} headingRef={headingRef}>
      <ul className="privacy-list">
        {t.privacy.slice(1).map((line) => (
          <li key={line}>
            {line.split(LINK).map((part, index) =>
              LINK.test(part) ? (
                <a
                  key={index}
                  href={part.includes('@') ? `mailto:${part}` : part}
                  target="_blank"
                  rel="noreferrer"
                >
                  {part}
                </a>
              ) : (
                part
              ),
            )}
          </li>
        ))}
      </ul>
    </Screen>
  );
}
