import { existsSync, readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import PictureGroup, { PICTURE_THEMES } from './PictureGroup';

test('theme cycle is ordered and immutable', () => {
  expect(PICTURE_THEMES).toEqual(['pirates', 'bears', 'lollipops', 'boats', 'aircraft']);
  expect(Object.isFrozen(PICTURE_THEMES)).toBe(true);
});

test('each theme supplies distinct local decorative vector artwork for every positive count', () => {
  const artworks = new Set<string>();
  for (const theme of ['pirates', 'bears', 'lollipops', 'boats', 'aircraft'] as const) {
    for (let count = 1; count <= 6; count++) {
      const { container, unmount } = render(
        <PictureGroup count={count} theme={theme} {...labels} />,
      );
      const svgs = [...container.querySelectorAll('svg')];
      expect(svgs).toHaveLength(count);
      const pips = [...container.querySelectorAll<HTMLElement>('[data-picture-pip]')];
      expect(pips.map((pip) => [Number(pip.dataset.row), Number(pip.dataset.column)])).toEqual(
        positions[count],
      );
      expect(container.querySelectorAll('[role="img"]')).toHaveLength(1);
      for (const svg of svgs) {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
        expect(svg).toHaveAttribute('focusable', 'false');
        expect(svg).toHaveAttribute('viewBox', '0 0 64 64');
        expect(svg.querySelector('path, circle, ellipse')).not.toBeNull();
        expect(
          svg.querySelector('title, desc, text, image, use, foreignObject, script, animate'),
        ).toBeNull();
        expect(svg.outerHTML).not.toMatch(/https?:|href=|onload=/);
      }
      if (count === 1) artworks.add(svgs[0].innerHTML);
      expect(container.querySelector('button, input, a, [tabindex]')).toBeNull();
      unmount();
    }
  }
  expect(artworks.size).toBe(5);
});

test.each(['pirates', 'bears', 'lollipops', 'boats', 'aircraft'] as const)(
  'zero %s is visibly empty, not unknown',
  (theme) => {
    const { container } = render(
      <PictureGroup
        count={0}
        theme={theme}
        {...labels}
        label="Second group: count 0. Empty group."
      />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName('Second group: count 0. Empty group.');
    expect(screen.getByText(labels.emptyLabel)).toBeVisible();
    expect(container.querySelector('svg, [data-picture-pip]')).toBeNull();
    expect(container).not.toHaveTextContent('?');
  },
);

test('null renders only a count-neutral unknown marker, ignoring known-answer labels entirely', () => {
  const { container, rerender } = render(
    <PictureGroup
      count={null}
      theme="pirates"
      {...labels}
      label="SECRET result count 6"
      emptyLabel="SECRET empty"
    />,
  );
  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.getByRole('img')).toHaveAccessibleName(labels.unknownLabel);
  expect(screen.getByText('?')).toBeVisible();
  expect(screen.getByText(labels.unknownLabel)).toBeVisible();
  expect(
    container.querySelector(
      'svg, title, [data-picture-pip], [data-count], [data-row], [data-column]',
    ),
  ).toBeNull();
  expect(container.innerHTML).not.toMatch(/SECRET|count 6|empty/);
  const neutralMarkup = container.innerHTML;
  rerender(
    <PictureGroup
      count={null}
      theme="aircraft"
      {...labels}
      label="DIFFERENT answer 2"
      emptyLabel="OTHER"
    />,
  );
  expect(container.innerHTML).toBe(neutralMarkup);
});

test('switching from known to unknown removes all previous pictures and accessible counts', () => {
  const { container, rerender } = render(
    <PictureGroup count={6} theme="boats" {...labels} label="Result count 6" />,
  );
  rerender(<PictureGroup count={null} theme="boats" {...labels} label="Result count 6" />);
  expect(screen.getByRole('img')).toHaveAccessibleName(labels.unknownLabel);
  expect(container.querySelector('svg, [data-picture-pip]')).toBeNull();
  expect(container.innerHTML).not.toContain('6');
});

test.each([-1, 7, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, undefined, '3', true])(
  'rejects invalid count %s explicitly',
  (count) => {
    expect(() =>
      render(<PictureGroup count={count as number} theme="bears" {...labels} />),
    ).toThrow(new RangeError('PictureGroup count must be null or an integer from 0 to 6.'));
  },
);

test('all states share a bounded picture footprint with distinct empty and unknown treatments', () => {
  const { rerender } = render(<PictureGroup count={2} theme="bears" {...labels} />);
  expect(screen.getByRole('img')).toHaveClass('picture-group');
  expect(screen.getByRole('img').querySelector('.picture-grid')).not.toBeNull();
  rerender(<PictureGroup count={0} theme="bears" {...labels} />);
  expect(screen.getByRole('img')).toHaveClass('picture-group', 'picture-empty');
  rerender(<PictureGroup count={null} theme="bears" {...labels} />);
  expect(screen.getByRole('img')).toHaveClass('picture-group', 'picture-unknown');
});

test('local stylesheet defines a stable three by three grid without global clipping or motion', () => {
  const path = `${process.cwd()}/src/picture-groups.css`;
  expect(existsSync(path)).toBe(true);
  const css = readFileSync(path, 'utf8');
  expect(css).toMatch(/grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  expect(css).toMatch(/grid-template-rows:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  expect(css).toMatch(/clamp\(72px,\s*24vw,\s*84px\)/);
  expect(css).not.toMatch(/overflow:\s*hidden|animation:|transition:|@import|url\(/);
  const selectors = [...css.matchAll(/([^{}]+)\{/g)].map((match) => match[1].trim());
  expect(selectors.every((selector) => selector.startsWith('.picture-'))).toBe(true);
});

const positions = [
  [],
  [[1, 1]],
  [
    [0, 0],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [0, 2],
    [2, 0],
    [2, 2],
  ],
  [
    [0, 0],
    [0, 2],
    [1, 1],
    [2, 0],
    [2, 2],
  ],
  [
    [0, 0],
    [0, 2],
    [1, 0],
    [1, 2],
    [2, 0],
    [2, 2],
  ],
];
const labels = {
  label: 'First group: bears. Count: 1.',
  emptyLabel: 'Empty group',
  unknownLabel: 'Missing amount',
};

test('one picture is centered with a single group accessible name', () => {
  const { container } = render(<PictureGroup count={1} theme="bears" {...labels} />);
  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.getByRole('img')).toHaveAccessibleName(labels.label);
  const pip = container.querySelector('[data-picture-pip]');
  expect(pip).toHaveAttribute('data-row', '1');
  expect(pip).toHaveAttribute('data-column', '1');
  expect(container.querySelectorAll('svg')).toHaveLength(1);
  expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  expect(container.querySelector('svg')).toHaveAttribute('focusable', 'false');
});

test.each([2, 3, 4, 5, 6])('count %i occupies canonical dice positions', (count) => {
  const { container } = render(<PictureGroup count={count} theme="bears" {...labels} />);
  const pips = [...container.querySelectorAll<HTMLElement>('[data-picture-pip]')];
  expect(pips.map((pip) => [Number(pip.dataset.row), Number(pip.dataset.column)])).toEqual(
    positions[count],
  );
  expect(container.querySelectorAll('svg')).toHaveLength(count);
});
