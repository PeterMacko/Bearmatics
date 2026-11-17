#!/usr/bin/env node
// Before/after equivalence check: builds two revisions, renders every screen state at every
// defined device in EN and SK, and compares element boxes, computed styles, the DOM and focus.
// See README "Refactor equivalence check". Exit code 1 on any difference.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { extname, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { gzipSync } from 'node:zlib';
import { PROPERTIES, settle, snapshot } from './capture.mjs';
import { compareTrees, formatReport } from './diff.mjs';
import { DEVICES, LANGUAGES, QUICK, STATES, initScript, mockApi } from './states.mjs';

const { values: args } = parseArgs({
  options: {
    base: { type: 'string' },
    head: { type: 'string' },
    'base-dist': { type: 'string' },
    'head-dist': { type: 'string' },
    browsers: { type: 'string', default: 'chromium' },
    only: { type: 'string' },
    quick: { type: 'boolean', default: false },
    states: { type: 'string' },
    langs: { type: 'string', default: LANGUAGES.join(',') },
    out: { type: 'string' },
    work: { type: 'string', default: join(tmpdir(), 'bearmatics-equivalence') },
    workers: { type: 'string', default: String(Math.max(1, cpus().length)) },
    limit: { type: 'string', default: '40' },
    screenshots: { type: 'boolean', default: false },
    rebuild: { type: 'boolean', default: false },
    'list-states': { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

const USAGE = `node scripts/equivalence/run.mjs --base <git-ref> --head <git-ref|WORKTREE> [options]
  --base-dist DIR / --head-dist DIR   use already built dist directories instead of refs
  --browsers chromium,firefox         (firefox needs PLAYWRIGHT_BROWSERS_PATH with Firefox installed)
  --only 390x844,844x390              devices (default: all ${DEVICES.length} defined devices);
                                      any other WxH is a touch device, WxH-mouse a desktop window
  --quick                             devices ${QUICK.join(', ')}
  --states course,menu-maths          states (default: all ${Object.keys(STATES).length}; --list-states)
  --langs en,sk                       languages (default: en,sk)
  --out DIR                           results (default: <work>/run-<time>)
  --work DIR                          build cache (default: $TMPDIR/bearmatics-equivalence)
  --workers N                         parallel browser contexts (default: CPU count)
  --limit N                           differences printed in the report (default 40)
  --screenshots                       also compare full-page screenshots (secondary, not failing)
  --rebuild                           rebuild refs even when a cached build exists`;

if (args.help) {
  console.log(USAGE);
  process.exit(0);
}
if (args['list-states']) {
  console.log(Object.keys(STATES).join('\n'));
  process.exit(0);
}

const REPO = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
const work = resolve(args.work);
mkdirSync(work, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const out = resolve(args.out ?? join(work, `run-${stamp}`));
mkdirSync(out, { recursive: true });

function vite(cwd, outDir) {
  execFileSync(
    process.execPath,
    [join(cwd, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir, '--emptyOutDir'],
    { cwd, stdio: ['ignore', 'ignore', 'inherit'] },
  );
}

/** Builds a git ref (cached by commit) or the current working tree; returns {dir, label}. */
function build(ref, dist) {
  if (dist) return { dir: resolve(dist), label: `dist ${resolve(dist)}` };
  if (!ref) throw new Error('give --base/--head refs or --base-dist/--head-dist');
  if (ref === 'WORKTREE') {
    const dir = join(work, `dist-worktree-${stamp}`);
    console.log(`Building the working tree ${REPO} ...`);
    vite(REPO, dir);
    return { dir, label: `WORKTREE of ${git('rev-parse', '--short', 'HEAD')} (${REPO})` };
  }
  const sha = git('rev-parse', '--verify', `${ref}^{commit}`);
  const dir = join(work, `dist-${sha}`);
  if (args.rebuild || !existsSync(join(dir, 'index.html'))) {
    const tree = join(work, `src-${sha}`);
    if (existsSync(tree)) git('worktree', 'remove', '--force', tree);
    console.log(`Building ${ref} (${sha.slice(0, 7)}) ...`);
    git('worktree', 'add', '--detach', tree, sha);
    try {
      symlinkSync(realpathSync(join(REPO, 'node_modules')), join(tree, 'node_modules'));
      vite(tree, dir);
    } finally {
      git('worktree', 'remove', '--force', tree);
    }
  }
  return { dir, label: `${ref} (${sha.slice(0, 7)})` };
}

function hashes(dir) {
  const out = {};
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(dir, p)] = createHash('sha256').update(readFileSync(p)).digest('hex');
    }
  };
  walk(dir);
  return out;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain',
};

/** Loopback static server with the same fallback as vite preview (unknown paths -> index.html). */
function serve(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = resolve(dir, `.${path}`);
    if (!file.startsWith(dir) || !existsSync(file) || statSync(file).isDirectory())
      file = join(dir, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((done) =>
    server.listen(0, '127.0.0.1', () =>
      done({ server, url: `http://127.0.0.1:${server.address().port}` }),
    ),
  );
}

const seedOf = (name) => [...name].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
// Fixed wall clock (streak days, timers) shared by both builds.
const CLOCK = new Date('2026-06-15T09:00:00+02:00');

async function captureState(browser, engine, url, device, lang, name, dir) {
  const state = STATES[name];
  const context = await browser.newContext({
    baseURL: url,
    viewport: { width: device.width, height: device.height },
    hasTouch: device.touch,
    isMobile: engine === 'chromium' && device.touch && device.width < 900,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'Europe/Bratislava',
  });
  const pageErrors = [];
  let result;
  try {
    await context.clock.install({ time: CLOCK });
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.addInitScript(initScript, seedOf(name));
    await mockApi(page, !!state.signedIn);
    await state.steps(page, lang);
    // The last click leaves the pointer over its button, and :hover rules would then hide that
    // button's own style (e.g. the green Next colour). Move the pointer off the page. Firefox often
    // ignores a move outside the viewport and keeps :hover on the clicked element, which then
    // differs randomly between two runs of the same build; the move to the corner first makes
    // that case deterministic (it lands on the page background, not on a control).
    await page.mouse.move(0, 0);
    await page.mouse.move(-10, -10);
    await page.evaluate(settle);
    result = await page.evaluate(snapshot, PROPERTIES);
    if (args.screenshots)
      await page.screenshot({
        path: join(dir, `${name}.png`),
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
      });
  } catch (e) {
    result = { error: String(e.message ?? e).split('\n')[0] };
  } finally {
    await context.close();
  }
  result.pageErrors = pageErrors;
  writeFileSync(join(dir, `${name}.json.gz`), gzipSync(JSON.stringify(result)));
  return result.error;
}

/** Counts differing pixels of two PNGs inside the browser (canvas), no extra dependencies. */
async function pixelDiff(page, a, b) {
  return page.evaluate(
    async ([a, b]) => {
      const img = async (data) => {
        const i = new Image();
        i.src = `data:image/png;base64,${data}`;
        await i.decode();
        const c = new OffscreenCanvas(i.width, i.height);
        const g = c.getContext('2d');
        g.drawImage(i, 0, 0);
        return g.getImageData(0, 0, i.width, i.height);
      };
      const [x, y] = [await img(a), await img(b)];
      if (x.width !== y.width || x.height !== y.height) return -1;
      let n = 0;
      for (let i = 0; i < x.data.length; i += 4)
        if (
          x.data[i] !== y.data[i] ||
          x.data[i + 1] !== y.data[i + 1] ||
          x.data[i + 2] !== y.data[i + 2] ||
          x.data[i + 3] !== y.data[i + 3]
        )
          n++;
      return n;
    },
    [a.toString('base64'), b.toString('base64')],
  );
}

async function main() {
  const devices = args.only
    ? args.only.split(',').map((id) => {
        const d = DEVICES.find((x) => x.id === id);
        if (d) return d;
        // Any other WIDTHxHEIGHT (e.g. breakpoint boundaries): a touch device; suffix
        // "-mouse" for a desktop window without touch.
        const m = /^(\d+)x(\d+)(-mouse)?$/.exec(id);
        if (!m)
          throw new Error(
            `unknown device ${id}; defined: ${DEVICES.map((x) => x.id).join(' ')} or any WxH[-mouse]`,
          );
        return { id, width: Number(m[1]), height: Number(m[2]), touch: !m[3] };
      })
    : args.quick
      ? DEVICES.filter((d) => QUICK.includes(d.id))
      : DEVICES;
  const names = args.states ? args.states.split(',') : Object.keys(STATES);
  for (const n of names) if (!STATES[n]) throw new Error(`unknown state ${n} (--list-states)`);
  const langs = args.langs.split(',');
  const engines = args.browsers.split(',');
  const started = Date.now();

  const builds = {
    base: build(args.base, args['base-dist']),
    head: build(args.head, args['head-dist']),
  };
  const ha = hashes(builds.base.dir);
  const hb = hashes(builds.head.dir);
  const identical = JSON.stringify(ha) === JSON.stringify(hb);
  const servers = {};
  for (const [key, b] of Object.entries(builds)) {
    servers[key] = await serve(b.dir);
    writeFileSync(
      join(out, `${key}-build.json`),
      JSON.stringify(
        { label: b.label, dir: b.dir, url: servers[key].url, files: key === 'base' ? ha : hb },
        null,
        2,
      ),
    );
  }
  const buildTime = Date.now() - started;
  console.log(`base: ${builds.base.label}\nhead: ${builds.head.label}`);
  console.log(
    `dist byte-identical: ${identical ? 'yes' : 'no'} (build ${Math.round(buildTime / 1000)} s)`,
  );
  console.log(
    `Matrix: ${names.length} states x ${devices.length} devices x ${langs.length} languages = ${names.length * devices.length * langs.length} per build and browser; browsers: ${engines.join(', ')}`,
  );

  const { chromium, firefox } = await import('@playwright/test');
  const launchers = { chromium, firefox };
  const workers = Number(args.workers);
  let failed = false;
  for (const engine of engines) {
    const browser = await launchers[engine].launch();
    const tasks = [];
    for (const device of devices)
      for (const lang of langs)
        for (const name of names)
          for (const key of ['base', 'head']) tasks.push({ key, device, lang, name });
    let next = 0;
    let done = 0;
    const errors = [];
    const t0 = Date.now();
    const worker = async () => {
      while (next < tasks.length) {
        const { key, device, lang, name } = tasks[next++];
        const dir = join(out, engine, key, device.id, lang);
        mkdirSync(dir, { recursive: true });
        const error = await captureState(
          browser,
          engine,
          servers[key].url,
          device,
          lang,
          name,
          dir,
        );
        if (error) errors.push(`${key} ${device.id} ${lang} ${name}: ${error}`);
        if (++done % 20 === 0 || done === tasks.length)
          process.stdout.write(
            `\r${engine}: ${done}/${tasks.length} snapshots, ${Math.round((Date.now() - t0) / 1000)} s`,
          );
      }
    };
    await Promise.all(Array.from({ length: workers }, worker));
    console.log('');
    for (const e of errors.slice(0, 10)) console.log(`  state not reached: ${e}`);

    const report = compareTrees(join(out, engine, 'base'), join(out, engine, 'head'), {
      limit: Number(args.limit),
    });
    const text = formatReport(report);
    console.log(`\n== ${engine} ==\n${text}`);
    let shots = '';
    if (args.screenshots) {
      const page = await browser.newPage();
      let compared = 0;
      const differing = [];
      for (const device of devices)
        for (const lang of langs)
          for (const name of names) {
            const a = join(out, engine, 'base', device.id, lang, `${name}.png`);
            const b = join(out, engine, 'head', device.id, lang, `${name}.png`);
            if (!existsSync(a) || !existsSync(b)) continue;
            compared++;
            const x = readFileSync(a);
            const y = readFileSync(b);
            if (x.equals(y)) continue;
            const n = await pixelDiff(page, x, y);
            if (n !== 0)
              differing.push(`${name} ${device.id} ${lang}: ${n < 0 ? 'size differs' : `${n} px`}`);
          }
      await page.close();
      shots = `Screenshots (secondary, not failing): ${compared} compared, ${differing.length} differ${differing.length ? `\n  ${differing.slice(0, 20).join('\n  ')}` : ''}`;
      console.log(shots);
    }
    writeFileSync(join(out, `${engine}-report.json`), JSON.stringify(report, null, 2));
    writeFileSync(join(out, `${engine}-report.txt`), `${text}\n${shots}\n`);
    if (report.total || report.missing.length) failed = true;
    await browser.close();
  }
  for (const s of Object.values(servers)) s.server.close();
  console.log(`\nTotal ${Math.round((Date.now() - started) / 1000)} s. Results: ${out}`);
  console.log(failed ? 'RESULT: DIFFERENCES FOUND' : 'RESULT: EQUIVALENT');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
