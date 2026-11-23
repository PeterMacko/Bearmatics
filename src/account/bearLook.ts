// SCRUM-249: spoken names of a dressed bear ("Honey bear with a crown and glasses").
import type { BearLook } from '../../shared/bearLook';
import type { Copy } from '../i18n';

export type LookCopy = Copy['account']['look'];

/** "<bear> with A", "<bear> with A and B", "<bear> with A, B and C" (Slovak: s/so + instrumental). */
export function describeLook(t: LookCopy, look: BearLook): string {
  const bear = t.bears[look.fur] ?? t.bears[0];
  const items: string[] = [
    t.headWith[look.head],
    t.neckWith[look.neck],
    t.eyesWith[look.eyes],
  ].filter((item) => !!item);
  if (items.length === 0) return bear;
  const list =
    items.length === 1
      ? items[0]
      : `${items.slice(0, -1).join(', ')} ${t.and} ${items[items.length - 1]}`;
  const so = t.soLetters.includes(items[0][0]?.toLowerCase() ?? '');
  return `${bear} ${so ? t.withSo : t.with} ${list}`;
}
