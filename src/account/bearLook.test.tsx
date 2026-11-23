// SCRUM-249: looks built from parts, their spoken names and drawing.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  LOOK_PARTS,
  OLD_BEARS,
  PART_COUNTS,
  oldBearFor,
  randomLook,
  randomLooks,
  validLook,
  type BearLook,
} from '../../shared/bearLook';
import { copy } from '../i18n';
import BearIcon from './BearIcon';
import { describeLook } from './bearLook';

const plain: BearLook = { fur: 2, background: 0, head: 0, neck: 0, eyes: 0 };
const en = copy.en.account.look;
const sk = copy.sk.account.look;

describe('bear looks', () => {
  it('names every choice of every part in both languages', () => {
    for (const t of [en, sk]) {
      for (const part of LOOK_PARTS) {
        expect(t[part]).toHaveLength(PART_COUNTS[part]);
        expect(t[part].every((name) => name.length > 0)).toBe(true);
      }
      expect(t.bears).toHaveLength(PART_COUNTS.fur);
      expect(t.headWith).toHaveLength(PART_COUNTS.head);
      expect(t.neckWith).toHaveLength(PART_COUNTS.neck);
      expect(t.eyesWith).toHaveLength(PART_COUNTS.eyes);
    }
  });

  it('builds the spoken name from the parts (English)', () => {
    expect(describeLook(en, plain)).toBe('Honey bear');
    expect(describeLook(en, { ...plain, head: 3, eyes: 1 })).toBe(
      'Honey bear with a crown and glasses',
    );
    expect(describeLook(en, { fur: 4, background: 3, head: 1, neck: 5, eyes: 3 })).toBe(
      'Panda with a cap, a medal and star glasses',
    );
    expect(describeLook(en, { ...plain, fur: 3, neck: 3 })).toBe('Polar bear with a scarf');
  });

  it('builds the spoken name with Slovak grammar (s/so + instrumental)', () => {
    expect(describeLook(sk, plain)).toBe('Medový medvedík');
    expect(describeLook(sk, { ...plain, head: 3, eyes: 1 })).toBe(
      'Medový medvedík s korunou a okuliarmi',
    );
    expect(describeLook(sk, { ...plain, head: 1 })).toBe('Medový medvedík so šiltovkou');
    expect(describeLook(sk, { ...plain, neck: 3, eyes: 2 })).toBe(
      'Medový medvedík so šálom a slnečnými okuliarmi',
    );
    expect(describeLook(sk, { ...plain, eyes: 2 })).toBe('Medový medvedík so slnečnými okuliarmi');
    expect(describeLook(sk, { fur: 4, background: 0, head: 5, neck: 4, eyes: 3 })).toBe(
      'Panda s kvetom, náhrdelníkom a hviezdičkovými okuliarmi',
    );
  });

  it('accepts only whole numbers in range for each of the five parts', () => {
    expect(validLook(plain)).toBe(true);
    expect(validLook({ fur: 7, background: 7, head: 5, neck: 5, eyes: 3 })).toBe(true);
    for (const part of LOOK_PARTS) {
      expect(validLook({ ...plain, [part]: PART_COUNTS[part] })).toBe(false);
      expect(validLook({ ...plain, [part]: -1 })).toBe(false);
      expect(validLook({ ...plain, [part]: 1.5 })).toBe(false);
      expect(validLook({ ...plain, [part]: '1' })).toBe(false);
      const { [part]: _, ...missing } = plain;
      expect(validLook(missing)).toBe(false);
    }
    expect(validLook(null)).toBe(false);
    expect(validLook(3)).toBe(false);
    expect(validLook([0, 0, 0, 0, 0])).toBe(false);
  });

  it('keeps the first eight bears: valid looks, and the old number back from the fur', () => {
    for (let bear = 1; bear <= 8; bear++) {
      expect(validLook(OLD_BEARS[bear])).toBe(true);
      expect(oldBearFor(OLD_BEARS[bear])).toBe(bear);
    }
  });

  it('makes random looks in range, and sets of looks with different furs', () => {
    const values = [0, 0.99999, 0.5, 0.3, 0.7, 0.1, 0.9];
    let i = 0;
    const random = () => values[i++ % values.length];
    for (let n = 0; n < 50; n++) expect(validLook(randomLook(random))).toBe(true);
    expect(randomLook(() => 0.99999)).toEqual({ fur: 7, background: 7, head: 5, neck: 5, eyes: 3 });
    for (let n = 0; n < 50; n++) {
      const looks = randomLooks(4);
      expect(looks).toHaveLength(4);
      expect(looks.every(validLook)).toBe(true);
      expect(new Set(looks.map((look) => look.fur)).size).toBe(4);
    }
  });

  it('draws a plain bear when an answer carries no look instead of failing', () => {
    const answer: { look?: BearLook } = {};
    const { container } = render(<BearIcon look={answer.look} />);
    expect(container.querySelector('svg')).toHaveAttribute('data-look', '0.0.0.0.0');
  });

  it('draws a named picture when given a name, a hidden one otherwise', () => {
    const { container } = render(
      <>
        <BearIcon look={{ ...plain, head: 3 }} label="Honey bear with a crown" />
        <BearIcon look={plain} />
      </>,
    );
    const named = screen.getByRole('img', { name: 'Honey bear with a crown' });
    expect(named).toHaveAttribute('data-look', '2.0.3.0.0');
    const icons = container.querySelectorAll('svg.bear-icon');
    expect(icons[1]).toHaveAttribute('aria-hidden', 'true');
    expect(icons[1]).not.toHaveAttribute('role');
  });
});
