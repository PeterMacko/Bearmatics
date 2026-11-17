// Compares two snapshot trees written by run.mjs and prints a readable report.
// Usage alone: node scripts/equivalence/diff.mjs <out>/base <out>/head [--limit 40]
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, relative } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

/** 'FROM=>TO' -> [FROM, TO] (the --dom-replace syntax). */
export function parseReplace(spec) {
  const at = spec.indexOf('=>');
  if (at < 1) throw new Error(`--dom-replace expects FROM=>TO, got ${spec}`);
  return [spec.slice(0, at), spec.slice(at + 2)];
}

const load = (file) => JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'));

function files(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.json.gz')) out.push(relative(dir, p));
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.sort();
}

/** First differing region of two long strings, with some context, for DOM differences. */
function firstDifference(a, b, context = 80) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  let ea = a.length;
  let eb = b.length;
  while (ea > i && eb > i && a[ea - 1] === b[eb - 1]) {
    ea--;
    eb--;
  }
  const start = Math.max(0, i - context);
  return {
    at: i,
    base: a.slice(start, Math.min(ea + context, i + 300)),
    head: b.slice(start, Math.min(eb + context, i + 300)),
  };
}

/**
 * Applies the --dom-replace pairs to the base snapshot's HTML (body and focused element), so an
 * intended markup change (e.g. a removed class) is accepted while everything else still has to
 * match exactly. Returns the number of replaced occurrences.
 */
function normalise(base, replace) {
  let count = 0;
  const apply = (html) => {
    if (typeof html !== 'string') return html;
    for (const [from, to] of replace) {
      const parts = html.split(from);
      count += parts.length - 1;
      html = parts.join(to);
    }
    return html;
  };
  base.dom = apply(base.dom);
  const active = base.activeElement;
  if (active?.html) {
    // capture.mjs keeps the first 400 characters of the focused element; a shortening
    // replacement leaves fewer, so only that many characters of the head can be compared.
    const truncated = active.html.length >= 400;
    active.html = apply(active.html);
    if (truncated) active.compareLength = active.html.length;
  }
  return count;
}

/** Compares one state; pushes {category, key, property, base, head} items into diffs. */
export function compareSnapshot(base, head, push, replace = []) {
  if (base.error || head.error) {
    if (base.error !== head.error)
      push('state', '-', 'error', base.error ?? 'reached', head.error ?? 'reached');
    else push('state', '-', 'not reached in either build', base.error, head.error);
    return;
  }
  const replaced = replace.length ? normalise(base, replace) : 0;
  for (const key of ['pageErrors']) {
    const a = JSON.stringify(base[key] ?? []);
    const b = JSON.stringify(head[key] ?? []);
    if (a !== b) push('errors', '-', key, a, b);
  }
  const s = (v) => JSON.stringify(v);
  if (s(base.viewport) !== s(head.viewport))
    push('document', '-', 'viewport', s(base.viewport), s(head.viewport));
  for (const [k, v] of Object.entries(base.document))
    if (s(v) !== s(head.document[k])) push('document', '-', k, s(v), s(head.document[k]));
  if (base.activeElement.path !== head.activeElement.path)
    push('focus', '-', 'activeElement', base.activeElement.path, head.activeElement.path);
  else if (
    base.activeElement.html !==
    (base.activeElement.compareLength
      ? head.activeElement.html?.slice(0, base.activeElement.compareLength)
      : head.activeElement.html)
  )
    push(
      'focus',
      base.activeElement.path,
      'outerHTML',
      base.activeElement.html,
      head.activeElement.html,
    );
  if (base.dom !== head.dom) {
    const d = firstDifference(base.dom, head.dom);
    push('dom', `char ${d.at}`, 'body.outerHTML', d.base, d.head);
  }
  const paths = new Set([...Object.keys(base.elements), ...Object.keys(head.elements)]);
  for (const path of paths) {
    const a = base.elements[path];
    const b = head.elements[path];
    if (!a || !b) {
      push('elements', path, a ? 'removed' : 'added', a ? 'present' : '-', b ? 'present' : '-');
      continue;
    }
    if (s(a.box) !== s(b.box)) push('box', path, 'x,y,w,h', s(a.box), s(b.box));
    if (s(a.scroll) !== s(b.scroll)) push('box', path, 'scrollW,H,L,T', s(a.scroll), s(b.scroll));
    for (const part of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (part === 'box' || part === 'scroll') continue;
      const sa = a[part];
      const sb = b[part];
      const prefix = part === 'style' ? '' : part;
      if (!sa || !sb) {
        push('style', path, `${part}`, sa ? 'present' : '-', sb ? 'present' : '-');
        continue;
      }
      for (const prop of new Set([...Object.keys(sa), ...Object.keys(sb)]))
        if (sa[prop] !== sb[prop]) push('style', path, `${prefix}${prop}`, sa[prop], sb[prop]);
    }
  }
  return replaced;
}

/**
 * Compares both trees. Returns { compared, missing, counts, byState, items, replaced }.
 * replace: [[from, to], ...] applied to the base HTML first (see normalise).
 */
export function compareTrees(baseDir, headDir, { limit = 40, replace = [] } = {}) {
  const a = files(baseDir);
  const b = new Set(files(headDir));
  const result = {
    compared: 0,
    differing: 0,
    missing: [],
    counts: {},
    byState: {},
    items: [],
    total: 0,
    replace,
    replaced: { occurrences: 0, snapshots: 0 },
  };
  for (const file of a) {
    if (!b.has(file)) {
      result.missing.push(file);
      continue;
    }
    b.delete(file);
    result.compared++;
    const [device, lang, name] = file.replace(/\.json\.gz$/, '').split(/[\\/]/);
    let differs = false;
    const replaced = compareSnapshot(
      load(join(baseDir, file)),
      load(join(headDir, file)),
      (cat, key, prop, x, y) => {
        differs = true;
        result.total++;
        result.counts[cat] = (result.counts[cat] ?? 0) + 1;
        result.byState[name] = (result.byState[name] ?? 0) + 1;
        if (result.items.length < limit)
          result.items.push({
            state: name,
            device,
            lang,
            category: cat,
            element: key,
            property: prop,
            base: x,
            head: y,
          });
      },
      replace,
    );
    if (replaced) {
      result.replaced.occurrences += replaced;
      result.replaced.snapshots++;
    }
    if (differs) result.differing++;
  }
  result.missing.push(...[...b].map((f) => `${f} (head only)`));
  return result;
}

export function formatReport(r) {
  const lines = [];
  lines.push(
    `Snapshots compared: ${r.compared}, with differences: ${r.differing}, differences: ${r.total}`,
  );
  if (r.replace?.length)
    lines.push(
      `DOM replacements applied to base (--dom-replace ${r.replace.map(([a, b]) => `'${a}' -> '${b}'`).join(', ')}): ${r.replaced.occurrences} occurrences in ${r.replaced.snapshots} snapshots`,
    );
  if (r.missing.length)
    lines.push(`Missing in one build: ${r.missing.length} (${r.missing.slice(0, 5).join(', ')})`);
  if (r.total) {
    lines.push(
      `By category: ${Object.entries(r.counts)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')}`,
    );
    lines.push(
      `By state: ${Object.entries(r.byState)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')}`,
    );
    lines.push(`First ${r.items.length} differences:`);
    for (const d of r.items) {
      const clip = (v) => (typeof v === 'string' && v.length > 400 ? `${v.slice(0, 400)}…` : v);
      lines.push(
        `- [${d.category}] ${d.state} ${d.device} ${d.lang} :: ${d.element} :: ${d.property}`,
      );
      lines.push(`    base: ${clip(d.base)}`);
      lines.push(`    head: ${clip(d.head)}`);
    }
  }
  return lines.join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [baseDir, headDir] = process.argv
    .slice(2)
    .filter(
      (a, i, all) => !a.startsWith('--') && !['--limit', '--dom-replace'].includes(all[i - 1]),
    );
  const at = process.argv.indexOf('--limit');
  const replace = process.argv
    .flatMap((a, i) => (a === '--dom-replace' ? [process.argv[i + 1]] : []))
    .map(parseReplace);
  const r = compareTrees(baseDir, headDir, {
    limit: at > 0 ? Number(process.argv[at + 1]) : 40,
    replace,
  });
  console.log(formatReport(r));
  process.exit(r.total || r.missing.length ? 1 : 0);
}
