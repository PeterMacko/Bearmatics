import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

// SCRUM-335 Wave 0 (review RF-07): logic.css keeps two blocks twice, word for word: the Logic
// two-column layout and the Level 2 (6 slots) slot grid, once for a wide lesson column
// (`@container logic (min-width: 520px)`) and once for wide-short windows
// (`@media (min-width: 621px) and (max-height: 700px)` around `@container logic
// (min-width: 440px)`). Until they are written once, an edit must change both copies: this test
// finds the blocks by their at-rules (not by line numbers) and fails when a pair differs after
// the indentation is normalised.

const WIDE = '@container logic (min-width: 520px)';
const SHORT_OUTER = '@media (min-width: 621px) and (max-height: 700px)';
const SHORT_INNER = '@container logic (min-width: 440px)';

type Block = { prelude: string; body: string; line: number };

/** The top-level `{ }` blocks of a style sheet (comments removed, line numbers kept). */
function blocks(css: string): Block[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  const out: Block[] = [];
  let depth = 0;
  let start = 0;
  let open = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      if (depth === 0) open = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        out.push({
          prelude: text.slice(start, open).trim(),
          body: text.slice(open + 1, i),
          line: text.slice(0, open).split('\n').length,
        });
        start = i + 1;
      }
    } else if (ch === ';' && depth === 0) start = i + 1;
  }
  if (depth !== 0) throw new Error('logic.css: unbalanced braces');
  return out;
}

/** Lines trimmed, blank lines dropped: the same rules whatever the nesting depth. */
const normalise = (body: string) =>
  body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');

/** The wide-column blocks and their wide-short twins, in file order. */
function twins(css: string) {
  const all = blocks(css);
  const wide = all.filter((b) => b.prelude === WIDE);
  const short = all
    .filter((b) => b.prelude === SHORT_OUTER)
    .map((outer) => {
      const inner = blocks(outer.body);
      return inner.length === 1 && inner[0].prelude === SHORT_INNER
        ? { ...inner[0], line: outer.line + inner[0].line - 1 }
        : null;
    })
    .filter((b): b is Block => b !== null);
  return { wide, short };
}

describe('logic.css twin blocks', () => {
  const css = readFileSync('src/styles/logic.css', 'utf8');
  const { wide, short } = twins(css);

  test('two wide-column blocks, each with its wide-short twin', () => {
    expect(wide).toHaveLength(2);
    expect(short).toHaveLength(2);
    // Which is which: the two-column layout first, then the Level 2 slot grid.
    expect(normalise(wide[0].body)).toMatch(/^\.logic-play \{\n--key: 56px;/);
    expect(normalise(wide[1].body)).toMatch(/^\.logic-practice\[data-arrows='6'\]/);
  });

  test.each([
    ['two-column layout', 0],
    ['Level 2 slot grid', 1],
  ])('%s: both copies are the same', (_name, i) => {
    expect(
      normalise(short[i].body),
      `logic.css:${short[i].line} must equal logic.css:${wide[i].line}`,
    ).toBe(normalise(wide[i].body));
  });

  test('the block finder reads nested at-rules and ignores comments', () => {
    const sample = `/* ${WIDE} { .x { a: 1 } } */
${WIDE} {
  .a { color: red; }
}
@import 'x.css';
${SHORT_OUTER} {
  ${SHORT_INNER} {
    .a {   color: red; }
  }
}`;
    const found = twins(sample);
    expect(found.wide.map((b) => b.line)).toEqual([2]);
    expect(found.short.map((b) => b.line)).toEqual([7]);
    expect(normalise(found.short[0].body)).toBe('.a {   color: red; }');
    expect(normalise(found.wide[0].body)).toBe('.a { color: red; }');
  });
});
