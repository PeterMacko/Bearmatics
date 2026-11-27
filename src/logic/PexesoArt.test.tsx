// SCRUM-324: 15 card pictures + a card back, with SK/EN names (screen readers).
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { copy } from '../i18n';
import { PexesoBack, PexesoFace } from './PexesoArt';
import { PEXESO_PICTURES } from './pexeso';

const keysDeep = (value: unknown, prefix = ''): string[] =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value).flatMap(([k, v]) => keysDeep(v, `${prefix}${k}.`))
    : [prefix];

describe('Pexeso pictures (SCRUM-324)', () => {
  it('15 different pictures, each a decorative svg with its own drawing', () => {
    expect(PEXESO_PICTURES).toHaveLength(15);
    expect(new Set(PEXESO_PICTURES).size).toBe(15);
    const drawings = PEXESO_PICTURES.map((picture) => {
      const { container, unmount } = render(<PexesoFace picture={picture} />);
      const svg = container.querySelector('svg')!;
      expect(svg.getAttribute('aria-hidden'), picture).toBe('true');
      expect(svg.children.length, picture).toBeGreaterThan(0);
      const html = svg.innerHTML;
      unmount();
      return html;
    });
    expect(new Set(drawings).size).toBe(15);
    const { container } = render(<PexesoBack />);
    expect(container.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(drawings).not.toContain(container.querySelector('svg')!.innerHTML);
  });
  it('SK and EN name every picture, all names different', () => {
    for (const language of ['en', 'sk'] as const) {
      const names = PEXESO_PICTURES.map((p) => copy[language].pexeso.names[p]);
      expect(names.every((n) => n.length > 0)).toBe(true);
      expect(new Set(names).size, language).toBe(15);
    }
    expect(copy.sk.pexeso.names.boat).toBe('loďka');
    expect(copy.en.pexeso.names.umbrella).toBe('umbrella');
  });
  it('SK and EN have the same Pexeso texts', () => {
    expect(keysDeep(copy.sk.pexeso)).toEqual(keysDeep(copy.en.pexeso));
    for (const level of [6, 7, 8] as const) {
      expect(copy.en.logicLevels[level]).toBe('Matching pairs');
      expect(copy.sk.logicLevels[level]).toBe('Pexeso');
    }
    expect([6, 7, 8].map((l) => copy.en.logicDetails[l as 6].split(' ')[0])).toEqual([
      '6',
      '10',
      '15',
    ]);
    expect([6, 7, 8].map((l) => copy.sk.logicDetails[l as 6].split(' ')[0])).toEqual([
      '6',
      '10',
      '15',
    ]);
  });
});
