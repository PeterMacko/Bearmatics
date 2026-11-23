// SCRUM-273: every choice on "Dress your bear" shows only its own part.
import { render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LOOK_PARTS, PART_COUNTS, type LookPart } from '../../shared/bearLook';
import { copy } from '../i18n';
import { BACKGROUNDS, FURS } from './BearIcon';
import { DressView } from './DressView';
import LookPartIcon, { NONE_SIGN, PART_OUTLINE, PART_TILE } from './LookPartIcon';

/** WCAG relative luminance and contrast ratio of two #rrggbb colours. */
function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

function tile(part: LookPart, index: number) {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<LookPartIcon part={part} index={index} />);
  return host.querySelector('svg')!;
}
const SHAPES = 'circle, ellipse, rect, path';
/** The drawing inside the tile (everything but the tile itself). */
const drawing = (svg: SVGSVGElement) => [...svg.querySelectorAll(SHAPES)].slice(1);
/** Own or inherited paint (fill/stroke) of a shape, as drawn. */
function paint(el: Element, name: 'fill' | 'stroke') {
  for (let node: Element | null = el; node && node.tagName !== 'svg'; node = node.parentElement) {
    const value = node.getAttribute(name);
    if (value) return value;
  }
  return name === 'fill' ? '#000000' : 'none';
}
const FACE_COLOURS = new Set(FURS.flatMap((f) => [f.fur, f.inner, f.muzzle]));
const range = (part: LookPart) => Array.from({ length: PART_COUNTS[part] }, (_, i) => i);
const ITEM_PARTS = ['head', 'neck', 'eyes'] as const;

describe('part-only choice pictures', () => {
  it('background: a colour tile only', () => {
    for (const index of range('background')) {
      const svg = tile('background', index);
      expect(svg.querySelectorAll(SHAPES)).toHaveLength(1);
      expect(svg.querySelector('rect')).toHaveAttribute('fill', BACKGROUNDS[index]);
    }
  });

  it('fur: the plain face on the neutral tile, no background colour and no items', () => {
    for (const index of range('fur')) {
      const svg = tile('fur', index);
      expect(svg.querySelector('rect')).toHaveAttribute('fill', PART_TILE);
      expect(svg.querySelectorAll('[data-shape]')).toHaveLength(1);
      expect(svg.querySelector('[data-shape="face"]')).not.toBeNull();
      const fills = drawing(svg).map((el) => paint(el, 'fill'));
      // Ears, inner ears, head, muzzle, eyes, nose, mouth (+ panda patches).
      expect(fills).toHaveLength(FURS[index].patches ? 12 : 10);
      expect(fills).toContain(FURS[index].fur);
      for (const fill of fills) expect(BACKGROUNDS).not.toContain(fill);
      // Item colours (purple cap, red tie, gold medal...) never appear.
      for (const fill of fills)
        expect(['#7b4fc0', '#d63c4a', '#ffd23f', '#21466d']).not.toContain(fill);
    }
  });

  it('head, neck and eyes: the item alone, enlarged; no face and no background', () => {
    for (const part of ITEM_PARTS)
      for (const index of range(part).slice(1)) {
        const svg = tile(part, index);
        const where = `${part} ${index}`;
        expect(svg.querySelector('rect'), where).toHaveAttribute('fill', PART_TILE);
        const item = svg.querySelector('[data-shape="item"]')!;
        expect(item, where).not.toBeNull();
        // Enlarged: a crop of the 64-unit bear drawing, smaller than the whole drawing.
        const [, , width] = item.getAttribute('viewBox')!.split(' ').map(Number);
        expect(width, where).toBeLessThanOrEqual(44);
        const shapes = drawing(svg);
        expect(shapes.length, where).toBeGreaterThan(0);
        for (const el of shapes)
          expect(FACE_COLOURS.has(paint(el, 'fill')), `${where} face colour`).toBe(false);
        // No bear background: the only tile-sized shape is the neutral tile itself.
        expect(
          shapes.filter((el) => el.getAttribute('width') === '64'),
          where,
        ).toHaveLength(0);
        // No ears or head ellipse.
        expect(svg.querySelector('ellipse[rx="24"]'), where).toBeNull();
      }
  });

  it('None: an empty tile with a "no" sign (circle with a slash)', () => {
    for (const part of ITEM_PARTS) {
      const svg = tile(part, 0);
      const sign = svg.querySelector('[data-shape="none"]')!;
      expect(sign).not.toBeNull();
      expect(sign.querySelectorAll('circle')).toHaveLength(1);
      expect(sign.querySelectorAll('path')).toHaveLength(1);
      expect(drawing(svg)).toHaveLength(2);
      expect(contrast(NONE_SIGN, PART_TILE)).toBeGreaterThanOrEqual(3);
    }
  });

  it('pale faces (polar, panda) and every face have an outline of at least 3:1 on the tile', () => {
    expect(contrast(PART_OUTLINE, PART_TILE)).toBeGreaterThanOrEqual(3);
    for (const index of range('fur')) {
      const svg = tile('fur', index);
      // Both ears and the head carry the outline.
      const edged = drawing(svg).filter(
        (el) => el.getAttribute('stroke') === PART_OUTLINE && paint(el, 'fill') !== 'none',
      );
      expect(
        edged.map((el) => el.tagName),
        `fur ${index}`,
      ).toEqual(['circle', 'circle', 'ellipse']);
    }
    // Polar white and panda really are pale: without the outline they would vanish.
    expect(contrast(FURS[3].fur, PART_TILE)).toBeLessThan(1.5);
    expect(contrast(FURS[4].fur, PART_TILE)).toBeLessThan(1.5);
  });

  it('every item shape stands out from the tile: fill or edge at least 3:1 (pale items have an edge)', () => {
    for (const part of ITEM_PARTS)
      for (const index of range(part).slice(1))
        for (const el of drawing(tile(part, index))) {
          const fill = paint(el, 'fill');
          const stroke = paint(el, 'stroke');
          const best = Math.max(
            fill.startsWith('#') ? contrast(fill, PART_TILE) : 0,
            stroke.startsWith('#') ? contrast(stroke, PART_TILE) : 0,
          );
          // Inner details drawn on the item, not on the tile: the white glint on the black
          // sunglass lenses and the yellow middle of the pink flower.
          if (part === 'eyes' && index === 2 && stroke === '#ffffff') continue;
          if (part === 'head' && index === 5 && fill === '#ffd23f') continue;
          expect(best, `${part} ${index} ${el.outerHTML}`).toBeGreaterThanOrEqual(3);
        }
  });

  it('on the dress screen no choice shows a whole bear; names, 32 choices and the chosen frame stay', () => {
    const t = copy.en.account;
    render(
      <DressView
        t={t}
        initial={{ fur: 3, background: 1, head: 2, neck: 0, eyes: 1 }}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    let total = 0;
    for (const part of LOOK_PARTS) {
      const group = screen.getByRole('group', { name: t.look.parts[part] });
      const radios = within(group).getAllByRole('radio');
      expect(radios).toHaveLength(PART_COUNTS[part]);
      radios.forEach((radio, index) => {
        expect(radio).toHaveAccessibleName((t.look[part] as readonly string[])[index]);
        const label = radio.closest('label')!;
        expect(label).toHaveClass('look-option');
        expect(label.querySelector('.bear-icon')).toBeNull();
        const picture = label.querySelector('svg.look-part-icon')!;
        expect(picture).toHaveAttribute('data-part', part);
        expect(picture).toHaveAttribute('data-choice', String(index));
        expect(picture).toHaveAttribute('aria-hidden', 'true');
        total++;
      });
    }
    expect(total).toBe(32);
    // The only whole bear is the big preview.
    expect(document.querySelectorAll('.bear-icon')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Polar white' })).toBeChecked();
  });
});
