import { useMenuWink } from './useMenuWink';

/** Original SVG artwork and expressions created for Bearmatics. */
export type BearMood = 'neutral' | 'happy' | 'sad';
export default function Bear({ mood = 'neutral', idleWink = false }: { mood?: BearMood; idleWink?: boolean }) {
  const { winking, idleMotion } = useMenuWink(idleWink && mood === 'neutral');
  return <svg className={`bear bear-${mood}`} data-mood={mood} data-winking={winking || undefined} data-idle-motion={idleMotion} viewBox="0 0 260 280" aria-hidden="true" focusable="false">
    <ellipse className="bear-shadow" cx="130" cy="262" rx="82" ry="10" fill="#efdcbf" />
    <g className="bear-character">
      <ellipse cx="130" cy="205" rx="67" ry="62" fill="#a96e45" />
      <ellipse cx="130" cy="216" rx="40" ry="43" fill="#e9bf86" />
      <ellipse cx="73" cy="244" rx="30" ry="19" fill="#805037" /><ellipse cx="187" cy="244" rx="30" ry="19" fill="#805037" />
      <ellipse cx="69" cy="196" rx="17" ry="32" fill="#a96e45" transform="rotate(18 69 196)" />
      <g className="bear-arm-right"><ellipse cx="191" cy="196" rx="17" ry="32" fill="#a96e45" transform="rotate(-18 191 196)" /></g>
      <circle cx="63" cy="66" r="32" fill="#a96e45" /><circle cx="197" cy="66" r="32" fill="#a96e45" />
      <circle cx="63" cy="66" r="18" fill="#e9bf86" /><circle cx="197" cy="66" r="18" fill="#e9bf86" />
      <rect x="44" y="55" width="172" height="139" rx="72" fill="#b87b4e" />
      <ellipse cx="130" cy="149" rx="41" ry="32" fill="#f1d4a4" />
      {mood === 'happy' ? <g fill="none" stroke="#382a22" strokeWidth="5" strokeLinecap="round"><path d="M90 121q7-12 14 0" /><path d="M156 121q7-12 14 0" /></g> : <g fill="#382a22"><ellipse cx="97" cy="119" rx="6" ry="8" />{winking ? <path className="bear-wink-eye" d="M156 120q7 6 14 0" fill="none" stroke="#382a22" strokeWidth="5" strokeLinecap="round" /> : <ellipse cx="163" cy="119" rx="6" ry="8" />}</g>}
      {mood === 'sad' && <g fill="none" stroke="#805037" strokeWidth="4" strokeLinecap="round"><path d="M88 105l15-5" /><path d="M157 100l15 5" /></g>}
      <ellipse cx="130" cy="139" rx="13" ry="9" fill="#382a22" />
      <path d={mood === 'sad' ? 'M130 146v7m-13 11q13-13 26 0' : mood === 'happy' ? 'M130 146v10m-17 0q17 23 34 0' : 'M130 146v9m-10 4q10 5 20 0'} fill="none" stroke="#382a22" strokeWidth="4" strokeLinecap="round" />
      <circle cx="78" cy="143" r="10" fill="#d99174" opacity=".65" /><circle cx="182" cy="143" r="10" fill="#d99174" opacity=".65" />
      <path d="M94 185l36 14 36-14-12 31h-48z" fill="#447eb9" />
    </g>
  </svg>;
}
