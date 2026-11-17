// In-page snapshot of the rendered screen: runs inside the browser via page.evaluate.
// Keep it self-contained (no imports, no closures over module scope).

/** Computed properties compared for every element (and for ::before/::after when present). */
export const PROPERTIES = [
  // layout and box model
  'display',
  'position',
  'top',
  'right',
  'bottom',
  'left',
  'float',
  'clear',
  'z-index',
  'box-sizing',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border-top-width',
  'border-right-width',
  'border-bottom-width',
  'border-left-width',
  'border-top-style',
  'border-right-style',
  'border-bottom-style',
  'border-left-style',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-right-radius',
  'border-bottom-left-radius',
  'outline-style',
  'outline-width',
  'outline-color',
  'outline-offset',
  'overflow-x',
  'overflow-y',
  'aspect-ratio',
  'object-fit',
  'object-position',
  'vertical-align',
  'container-type',
  'container-name',
  // flex and grid
  'flex-direction',
  'flex-wrap',
  'flex-grow',
  'flex-shrink',
  'flex-basis',
  'order',
  'justify-content',
  'justify-items',
  'justify-self',
  'align-content',
  'align-items',
  'align-self',
  'row-gap',
  'column-gap',
  'grid-template-columns',
  'grid-template-rows',
  'grid-template-areas',
  'grid-auto-flow',
  'grid-auto-columns',
  'grid-auto-rows',
  'grid-column-start',
  'grid-column-end',
  'grid-row-start',
  'grid-row-end',
  // typography
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant-numeric',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-align',
  'text-indent',
  'text-transform',
  'text-decoration-line',
  'text-decoration-color',
  'text-decoration-style',
  'text-shadow',
  'text-overflow',
  'white-space',
  'word-break',
  'overflow-wrap',
  'hyphens',
  'direction',
  'writing-mode',
  'list-style-type',
  'list-style-position',
  // colours and painting
  'color',
  'background-color',
  'background-image',
  'background-size',
  'background-position',
  'background-repeat',
  'background-clip',
  'box-shadow',
  'opacity',
  'visibility',
  'filter',
  'backdrop-filter',
  'mix-blend-mode',
  'isolation',
  'clip-path',
  'mask-image',
  'accent-color',
  'caret-color',
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-dasharray',
  // transforms and motion (declared values; running animations are frozen before capture)
  'transform',
  'transform-origin',
  'translate',
  'rotate',
  'scale',
  'animation-name',
  'animation-duration',
  'animation-delay',
  'animation-iteration-count',
  'animation-timing-function',
  'animation-fill-mode',
  'transition-property',
  'transition-duration',
  'transition-delay',
  'transition-timing-function',
  // interaction
  'cursor',
  'pointer-events',
  'user-select',
  'touch-action',
  'scroll-behavior',
  'scroll-margin-top',
  'scroll-padding-top',
  'content',
];

/**
 * Collects the snapshot. Elements are keyed by a stable structural path from <body>
 * (tag + index among same-tag siblings), so a class or attribute change shows up as a
 * property/DOM difference rather than as a different element.
 */
export function snapshot(properties) {
  const round = (n) => Math.round(n * 1000) / 1000;
  const path = (el) => {
    const parts = [];
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      const parent = node.parentElement;
      const tag = node.tagName.toLowerCase();
      const same = parent ? [...parent.children].filter((c) => c.tagName === node.tagName) : [];
      parts.unshift(same.length > 1 ? `${tag}[${same.indexOf(node)}]` : tag);
    }
    return parts.join('>');
  };
  const read = (style) => {
    const out = {};
    for (const p of properties) out[p] = style.getPropertyValue(p);
    return out;
  };
  const elements = {};
  for (const el of [document.body, ...document.body.querySelectorAll('*')]) {
    const r = el.getBoundingClientRect();
    const entry = {
      box: [round(r.x), round(r.y), round(r.width), round(r.height)],
      scroll: [el.scrollWidth, el.scrollHeight, round(el.scrollLeft), round(el.scrollTop)],
      style: read(getComputedStyle(el)),
    };
    for (const pseudo of ['::before', '::after', '::marker', '::placeholder']) {
      const s = getComputedStyle(el, pseudo);
      const content = s.getPropertyValue('content');
      if (pseudo === '::marker' && s.getPropertyValue('display') !== 'list-item') continue;
      if (pseudo === '::placeholder' && !el.hasAttribute('placeholder')) continue;
      if ((pseudo === '::before' || pseudo === '::after') && (content === 'none' || !content))
        continue;
      entry[pseudo] = read(s);
    }
    elements[path(el)] = entry;
  }
  const active = document.activeElement;
  const scroller = document.scrollingElement;
  return {
    viewport: [innerWidth, innerHeight],
    document: {
      scrollWidth: scroller.scrollWidth,
      scrollHeight: scroller.scrollHeight,
      clientWidth: scroller.clientWidth,
      clientHeight: scroller.clientHeight,
      scrollX: round(scrollX),
      scrollY: round(scrollY),
      title: document.title,
      lang: document.documentElement.lang,
      htmlClass: document.documentElement.className,
      htmlStyle: document.documentElement.getAttribute('style') ?? '',
    },
    activeElement: active
      ? { path: path(active), html: active.outerHTML.slice(0, 400) }
      : { path: null, html: null },
    dom: document.body.outerHTML,
    elements,
  };
}

/** Freezes the page: fonts loaded, finite animations finished, infinite ones paused at 0. */
export async function settle() {
  await document.fonts.ready;
  for (const animation of document.getAnimations()) {
    try {
      const timing = animation.effect?.getComputedTiming();
      if (timing && timing.endTime !== Infinity) animation.finish();
      else {
        animation.pause();
        animation.currentTime = 0;
      }
    } catch {
      animation.cancel();
    }
  }
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}
