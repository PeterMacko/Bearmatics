/** Animated speaker: replays the word. Its label never contains the word itself. */
export default function SpeakerIcon() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M12 24h10l14-11v38L22 40H12z" fill="currentColor" />
      <path className="speaker-wave wave-one" d="M43 24a11 11 0 0 1 0 16" />
      <path className="speaker-wave wave-two" d="M48 18a19 19 0 0 1 0 28" />
      <path className="speaker-wave wave-three" d="M53 12a27 27 0 0 1 0 40" />
    </svg>
  );
}
