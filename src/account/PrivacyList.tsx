const LINK = /(https:\/\/\S+[^\s.]|[\w.+-]+@[\w-]+(?:\.[\w-]+)+)/;

/**
 * The "What we store" list (the account privacy lines after the intro). One rendering for the
 * account screen and the About page (SCRUM-218), so both always show the same text.
 */
export function PrivacyList({ lines }: { lines: readonly string[] }) {
  return (
    <ul className="privacy-list">
      {lines.map((line) => (
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
  );
}
