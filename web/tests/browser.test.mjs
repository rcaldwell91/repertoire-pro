/* The built app, in a real Chrome on a phone-sized screen, with a real
   voice in the microphone (RP_MIC, a WAV kept outside the repo).
   RULEBOOK 2.5: every test runs against the built app. Run after
   `npm run build`; APP_DIR points it at another build (the broken builds
   in scripts/mutate-app.mjs). Prints one line per check; exits 1 if any
   fails. Set ONLY=name,name to run some checks. */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './chrome.mjs';
import { allCopy, copy } from '../src/core/copy.ts';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const MIC = process.env.RP_MIC;
const SHOTS = process.env.SHOTS || '';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const QUIET_MS = 300;
const CONTRAST = '(' + CONTRAST_SRC.toString() + ')()';

if (!MIC || !existsSync(MIC)) {
  console.log('FAIL setup: RP_MIC must name a WAV of a real voice (it is kept outside the repo)');
  process.exit(1);
}
if (!existsSync(join(APP, 'index.html'))) {
  console.log('FAIL setup: no built app at ' + APP + ' (run npm run build)');
  process.exit(1);
}

/* GitHub Pages, locally: the repo at /repertoire-pro/, the build at app/ */
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.mp3': 'audio/mpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!path.startsWith('/repertoire-pro/')) {
    res.writeHead(404).end();
    return;
  }
  let rest = path.slice('/repertoire-pro/'.length);
  let root = REPO;
  if (rest === 'app' || rest.startsWith('app/')) {
    root = APP;
    rest = rest.slice(4);
  }
  let file = normalize(join(root, rest));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!existsSync(file)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = 'http://127.0.0.1:' + server.address().port;
const URL_APP = ORIGIN + '/repertoire-pro/app/';

/* Watches everything that can make sound or listen, from before the app
   loads: every AudioContext, every buffer source started and stopped,
   every getUserMedia call and every track it handed out. */
const PROBE = `(() => {
  const P = window.__probe = { contexts: 0, started: 0, gum: 0, live: new Set(), tracks: [], fetched: [],
    decoded: [], actionAt: null, quietAt: null, events: [] };
  const now = () => performance.now();
  const note = (k) => P.events.push([k, Math.round(now())]);
  P.micLive = () => P.tracks.filter((t) => t.readyState === 'live').length;
  P.quiet = () => P.live.size === 0 && P.micLive() === 0;
  const checkQuiet = () => { if (P.actionAt !== null && P.quietAt === null && P.quiet()) P.quietAt = now(); };
  P.mark = () => { P.actionAt = now(); P.quietAt = null; checkQuiet(); };
  const AC = window.AudioContext;
  window.AudioContext = class extends AC {
    constructor(...a) { super(...a); P.contexts++; note('context'); }
    decodeAudioData(buf, ...rest) {
      return super.decodeAudioData(buf, ...rest).then((b) => {
        const d = b.getChannelData(0);
        let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
        P.decoded.push({ seconds: b.duration, peak });
        return b;
      });
    }
  };
  const S = AudioBufferSourceNode.prototype;
  const start = S.start, stop = S.stop;
  S.start = function (...a) {
    P.started++; P.live.add(this); note('play');
    this.addEventListener('ended', () => { P.live.delete(this); checkQuiet(); });
    return start.apply(this, a);
  };
  S.stop = function (...a) { P.live.delete(this); note('stop'); const r = stop.apply(this, a); checkQuiet(); return r; };
  const T = MediaStreamTrack.prototype, tstop = T.stop;
  T.stop = function () { const r = tstop.apply(this); note('mic-closed'); checkQuiet(); return r; };
  const md = navigator.mediaDevices, gum = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => {
    P.gum++; note('mic-asked');
    const s = await gum(c);
    P.tracks.push(...s.getTracks()); note('mic-open');
    return s;
  };
  const f = window.fetch;
  window.fetch = (u, ...r) => f(u, ...r).then((res) => { P.fetched.push([String(u), res.status]); return res; });
  /* the action a check times from: a tap, the Back button, or hiding */
  document.addEventListener('click', () => P.mark(), true);
  window.addEventListener('popstate', () => P.mark(), true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') P.mark(); });
})();`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
}
/* a block runs if any of the checks it makes is wanted */
const want = (...names) => !ONLY.length || names.some((n) => ONLY.includes(n));

const sel = {
  tab: (t) => '#tab-' + t,
  go: '#sound-check-go',
  entry: 'main .btn-row',
  backBtn: 'main .back',
  carryOn: 'main .carry-on',
};

const H1 = 'document.querySelector("main h1")?.textContent';
const LINE = 'document.querySelector("main .line")?.textContent';
const GO = 'document.querySelector("#sound-check-go")?.textContent';
const S = (expr) => `window.__probe.${expr}`;

let loads = 0;
/** a fresh load of the app (a new query, so even a same-screen load is real) */
async function fresh(env, hash = '') {
  await env.page.goto(URL_APP + '?load=' + ++loads + hash);
  await env.page.waitFor(`!!document.querySelector("main h1")`);
}

async function openSoundCheck(page) {
  await page.tap(sel.tab('profile'));
  await page.waitFor(`${H1} === ${JSON.stringify(copy.tabs.profile)}`);
  await page.tap(sel.entry);
  return page.waitFor(`${H1} === ${JSON.stringify(copy.soundCheck.title)}`);
}

/** Start, and wait until the voice bar is live */
async function startListening(page) {
  await page.tap(sel.go);
  const played = await page.waitFor(S('started > 0'), 5000);
  const open = await page.waitFor(S('micLive() > 0') + ` && ${LINE} === ${JSON.stringify(copy.soundCheck.listening)}`, 10000);
  return played && open;
}

/** how long after the action it went silent with the mic closed */
async function quietWithin(page) {
  await page.waitFor(S('quietAt !== null'), 2000);
  return page.eval(`(() => { const P = window.__probe;
    return { quiet: P.quiet(), ms: P.quietAt === null ? null : Math.round(P.quietAt - P.actionAt),
      live: P.live.size, mic: P.micLive() }; })()`);
}
const quietOk = (q) => q.quiet && q.ms !== null && q.ms <= QUIET_MS;
const quietSays = (q) => (q.quiet && q.ms !== null ? `silent, mic closed in ${q.ms} ms` : `still sounding ${q.live}, mic live ${q.mic}`);

/* ------------------------------------------------------------------ */

const FIRST_RUN = ['nothing-before-start', 'tabs', 'back', 'start', 'stop', 'tab-switch-note', 'tab-switch-listening',
  'hidden-note', 'hidden-listening', 'back-while-running', 'contrast', 'words', 'no-page-errors'];
const env = await launch({ mic: MIC, allowMic: true });
const { page } = env;
await page.addInitScript(PROBE);

try {
  await fresh(env);

  if (want('nothing-before-start')) {
    /* every tab, the Sound check screen, and back - and no Start */
    for (const t of ['train', 'sing', 'coach', 'learn', 'library', 'profile']) {
      await page.tap(sel.tab(t));
      await page.waitFor(`${H1} === ${JSON.stringify(copy.tabs[t])}`, 2000);
    }
    await page.tap(sel.entry);
    await page.waitFor(`${H1} === ${JSON.stringify(copy.soundCheck.title)}`);
    await sleep(1500);
    const p = await page.eval(`(() => { const P = window.__probe; return { contexts: P.contexts, started: P.started, gum: P.gum }; })()`);
    check('nothing-before-start', p.contexts === 0 && p.started === 0 && p.gum === 0,
      `sound engine made ${p.contexts}, notes played ${p.started}, mic asked ${p.gum}`);
  }

  if (want('tabs')) {
    await fresh(env, '#/home');
    const order = ['home', 'train', 'sing', 'coach', 'learn', 'library', 'profile'];
    let reached = 0;
    const seen = [];
    for (const t of order) {
      await page.tap(sel.tab(t));
      const ok = await page.waitFor(`${H1} === ${JSON.stringify(copy.tabs[t])} &&
        document.querySelector("#tab-${t}").getAttribute("aria-current") === "page"`, 2000);
      if (ok) reached++;
      seen.push(await page.eval(`[...document.querySelectorAll(".tab")].map((b) => b.innerText.trim()).filter(Boolean).join("|")`));
    }
    const labelsOk = seen.every((s, i) => s === copy.tabs[order[i]]);
    const icons = await page.eval(`[...document.querySelectorAll(".tab")].map((b) => b.querySelector("svg")?.getAttribute("class") || "")`);
    const allIcons = icons.length === 7 && icons.every((c) => c.includes('lucide'));
    const disc = icons[5].includes('disc');
    check('tabs', reached === 7 && labelsOk && allIcons && disc,
      `${reached} of 7 reached by tap; label only on the active tab: ${labelsOk}; icons ${icons.filter((c) => c.includes('lucide')).length} of 7, Library a disc: ${disc}`);
  }

  if (want('back')) {
    /* tap through every tab, then Back walks Library ... Home */
    await fresh(env, '#/home');
    for (const t of ['train', 'sing', 'coach', 'learn', 'library', 'profile']) {
      await page.tap(sel.tab(t));
      await page.waitFor(`${H1} === ${JSON.stringify(copy.tabs[t])}`, 2000);
    }
    const order = ['library', 'learn', 'coach', 'sing', 'train', 'home'];
    let ok = 0;
    for (const t of order) {
      await page.back();
      if (await page.waitFor(`${H1} === ${JSON.stringify(copy.tabs[t])}`, 2000)) ok++;
    }
    await openSoundCheck(page);
    await page.back();
    const phoneBack = await page.waitFor(`${H1} === ${JSON.stringify(copy.tabs.profile)}`, 2000);
    await page.tap(sel.entry);
    await page.waitFor(`${H1} === ${JSON.stringify(copy.soundCheck.title)}`);
    await page.tap(sel.backBtn);
    const screenBack = await page.waitFor(`${H1} === ${JSON.stringify(copy.tabs.profile)}`, 2000);
    check('back', ok === order.length && phoneBack && screenBack,
      `phone back through tabs ${ok} of ${order.length}; from Sound check by phone back ${phoneBack}, by its own back ${screenBack}`);
  }

  if (want('start', 'stop')) {
    await fresh(env, '#/profile/sound-check');
    const before = await page.eval(`[${GO}, ${LINE}]`);
    await page.tap(sel.go);
    const played = await page.waitFor(S('started === 1'), 5000);
    const stopShown = await page.waitFor(`${GO} === ${JSON.stringify(copy.soundCheck.stop)}`, 2000);
    const p = await page.eval(`(() => { const P = window.__probe; return { fetched: P.fetched, decoded: P.decoded }; })()`);
    const piano = p.fetched.find(([u, s]) => u.includes('audio/piano/60.mp3') && s === 200);
    const real = p.decoded[0] && p.decoded[0].seconds > 1 && p.decoded[0].peak > 0.1;
    const listening = await page.waitFor(S('micLive() > 0') + ` && ${LINE} === ${JSON.stringify(copy.soundCheck.listening)}`, 10000);
    /* the bar follows a real voice */
    let top = 0;
    for (let i = 0; i < 60; i++) {
      top = Math.max(top, await page.eval(`Number(document.querySelector('[role=meter]').getAttribute('aria-valuenow'))`));
      await sleep(50);
    }
    const barShown = await page.eval(`getComputedStyle(document.querySelector('[role=meter]')).visibility === 'visible'`);
    if (SHOTS) writeFileSync(join(SHOTS, 'sound-check-listening.png'), await page.screenshot());
    const order = await page.eval(`window.__probe.events.map((e) => e[0]).filter((k) => k !== 'context').join(' > ')`);
    check('start', before[0] === copy.soundCheck.start && before[1] === copy.soundCheck.ready && played && stopShown &&
      !!piano && real && listening && barShown && top >= 30 && order.startsWith('play > mic-asked > mic-open'),
      `piano note ${piano ? 'loaded' : 'NOT loaded'} (${p.decoded[0] ? p.decoded[0].seconds.toFixed(1) + ' s, peak ' + p.decoded[0].peak.toFixed(2) : 'not decoded'}); ` +
      `played ${played}; then mic open and bar shown ${listening && barShown}; bar reached ${top} of 100; order: ${order}`);

    await page.tap(sel.go);
    const q = await quietWithin(page);
    const back = await page.waitFor(`${GO} === ${JSON.stringify(copy.soundCheck.start)}`, 1000);
    check('stop', quietOk(q) && back, `${quietSays(q)}; Start shown again ${back}`);
  }

  if (want('tab-switch-note', 'tab-switch-listening')) {
    for (const when of ['note', 'listening']) {
      await fresh(env, '#/profile/sound-check');
      if (when === 'note') {
        await page.tap(sel.go);
        await page.waitFor(S('live.size > 0'), 5000);
      } else {
        await startListening(page);
      }
      await page.tap(sel.tab('sing'));
      const q = await quietWithin(page);
      await sleep(1500);
      const still = await page.eval(S('quiet()') + ` && ${H1} === ${JSON.stringify(copy.tabs.sing)}`);
      check('tab-switch-' + when, quietOk(q) && still, `${quietSays(q)}; still silent 1.5 s later ${still}`);
    }
  }

  if (want('hidden-note', 'hidden-listening')) {
    for (const when of ['note', 'listening']) {
      await fresh(env, '#/profile/sound-check');
      if (when === 'note') {
        await page.tap(sel.go);
        await page.waitFor(S('live.size > 0'), 5000);
      } else {
        await startListening(page);
      }
      const asked = await page.eval(S('gum'));
      const show = await env.hide();
      const hidden = await page.waitFor(`document.visibilityState === 'hidden'`, 2000);
      const q = await quietWithin(page);
      await sleep(1000);
      await show();
      await page.waitFor(`document.visibilityState === 'visible'`, 2000);
      await sleep(1500);
      const after = await page.eval(`({ quiet: window.__probe.quiet(), gum: window.__probe.gum, go: ${GO}, line: ${LINE} })`);
      const restart = after.quiet && after.gum === asked && after.go === copy.soundCheck.start && after.line === copy.soundCheck.ready;
      check('hidden-' + when, hidden && quietOk(q) && restart,
        `really hidden ${hidden}; ${quietSays(q)}; back in the app: nothing resumed, Start shown ${restart}`);
    }
  }

  if (want('back-while-running')) {
    await fresh(env, '#/profile');
    await page.tap(sel.entry);
    await page.waitFor(`${H1} === ${JSON.stringify(copy.soundCheck.title)}`);
    await startListening(page);
    await page.back();
    const q = await quietWithin(page);
    const where = await page.waitFor(`${H1} === ${JSON.stringify(copy.tabs.profile)}`, 2000);
    check('back-while-running', quietOk(q) && where, `${quietSays(q)}; on Profile ${where}`);
  }

  if (want('contrast')) {
    const screens = [];
    for (const hash of ['#/home', '#/profile', '#/profile/sound-check']) {
      await fresh(env, hash);
      screens.push([hash, await page.eval(CONTRAST)]);
    }
    await startListening(page);
    screens.push(['sound check, listening', await page.eval(CONTRAST)]);
    await page.tap(sel.go);
    const worst = screens.flatMap(([at, r]) => r.pairs.map((p) => ({ at, ...p }))).sort((a, b) => a.ratio - b.ratio);
    const unset = screens.flatMap(([at, r]) => r.unsetButtons.map((b) => at + ': ' + b));
    const low = worst.filter((p) => p.ratio < 3);
    check('contrast', low.length === 0 && unset.length === 0 && worst.length > 0,
      `${worst.length} pairs checked, lowest ${worst[0]?.ratio.toFixed(2)}:1 (${worst[0]?.what} on ${worst[0]?.at})` +
      (low.length ? '; below 3:1: ' + low.map((p) => `${p.what} ${p.ratio.toFixed(2)} on ${p.at}`).join(', ') : '') +
      (unset.length ? '; buttons without their colour set: ' + unset.join(', ') : ''));
  }

  if (want('words')) {
    const known = new Set(allCopy().map((c) => c.text));
    const strays = [];
    for (const hash of ['#/home', '#/train', '#/sing', '#/coach', '#/learn', '#/library', '#/profile', '#/profile/sound-check']) {
      await fresh(env, hash);
      const lines = await page.eval(`document.body.innerText.split("\\n").map((s) => s.trim()).filter(Boolean)`);
      for (const l of lines) if (!known.has(l)) strays.push(hash + ': ' + l);
    }
    check('words', strays.length === 0, strays.length ? 'not from the copy: ' + strays.join(', ') : 'every word on screen is from the copy');
  }

  check('no-page-errors', page.errors.length === 0, page.errors.join(' | '));
} catch (e) {
  /* a check that never got to say is a failed check, not a skipped one */
  const said = new Set(results.map((r) => r.name));
  for (const name of FIRST_RUN) if (want(name) && !said.has(name)) check(name, false, 'the test stopped: ' + e.message.split('\n')[0]);
} finally {
  await env.close();
}

/* ------------------------------------------------------------------ */
/* the mic refused: the note still works, and "Carry on without it" */
if (want('mic-refused')) {
  const no = await launch({ mic: MIC, allowMic: false });
  try {
    await no.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'denied', origin: ORIGIN });
    await no.page.addInitScript(PROBE);
    const p = no.page;
    await p.goto(URL_APP + '#/profile/sound-check');
    await p.waitFor(`!!document.querySelector("main h1")`);
    await p.tap(sel.go);
    const played = await p.waitFor(S('started === 1'), 5000);
    const said = await p.waitFor(`${LINE} === ${JSON.stringify(copy.soundCheck.refused)}`, 10000);
    const offered = await p.waitFor(`document.querySelector("main .carry-on")?.textContent === ${JSON.stringify(copy.soundCheck.carryOn)}`, 1000);
    const tabsShowing = await p.eval(`(() => { const r = document.querySelector('.tabs').getBoundingClientRect(); return r.height > 0 && r.bottom <= innerHeight + 1; })()`);
    if (SHOTS) writeFileSync(join(SHOTS, 'sound-check-refused.png'), await p.screenshot());
    let again = false;
    let asked = -1;
    if (offered) {
      const gumBefore = await p.eval(S('gum'));
      await p.tap(sel.carryOn);
      await p.waitFor(`${LINE} === ${JSON.stringify(copy.soundCheck.again)}`, 1000);
      await p.tap(sel.go);
      again = await p.waitFor(S('started === 2'), 5000);
      await p.waitFor(`${GO} === ${JSON.stringify(copy.soundCheck.start)}`, 10000);
      asked = (await p.eval(S('gum'))) - gumBefore;
    }
    const tabs = await (async () => {
      await p.tap(sel.tab('home'));
      return p.waitFor(`${H1} === ${JSON.stringify(copy.tabs.home)}`, 2000);
    })();
    check('mic-refused', played && said && offered && tabsShowing && again && asked === 0 && tabs && p.errors.length === 0,
      `note played ${played}; said "${copy.soundCheck.refused}" ${said}; "${copy.soundCheck.carryOn}" offered ${offered}; tabs uncovered ${tabsShowing}; ` +
      `after it, Start played the note again ${again} without asking for the mic again ${asked === 0}; tabs still work ${tabs}` +
      (p.errors.length ? '; page errors: ' + p.errors.join(' | ') : ''));
  } catch (e) {
    if (!results.some((r) => r.name === 'mic-refused')) check('mic-refused', false, 'the test stopped: ' + e.message.split('\n')[0]);
  } finally {
    await no.close();
  }
}

server.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} of ${results.length} checks FAILED` : `\nall ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);

/* ------------------------------------------------------------------ */
/* Every visible word and icon against what is behind it, and the voice
   bar against its track: at least 3:1 (RULEBOOK 3). Buttons must set
   their own background. */
function CONTRAST_SRC() {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1];
  };
  const lin = (x) => {
    x /= 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const behind = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c[3] > 0) return c;
    }
    return [255, 255, 255, 1];
  };
  const shown = (el) => {
    const s = getComputedStyle(el);
    return el.getClientRects().length > 0 && s.visibility === 'visible' && s.display !== 'none' && Number(s.opacity) > 0;
  };
  const pairs = [];
  for (const el of document.querySelectorAll('body *')) {
    if (!shown(el)) continue;
    const ownText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (ownText || el.tagName.toLowerCase() === 'svg') {
      const fg = parse(getComputedStyle(el).color);
      pairs.push({ what: ownText ? '"' + el.textContent.trim().slice(0, 30) + '"' : 'icon in ' + (el.closest('button')?.getAttribute('aria-label') || el.parentElement.textContent.trim().slice(0, 20)), ratio: ratio(fg, behind(el)) });
    }
  }
  const meter = document.querySelector('[role=meter]');
  if (meter && shown(meter)) {
    pairs.push({ what: 'voice bar on its track', ratio: ratio(parse(getComputedStyle(meter.firstElementChild).backgroundColor), behind(meter)) });
  }
  const unsetButtons = [...document.querySelectorAll('button')]
    .filter((b) => shown(b) && parse(getComputedStyle(b).backgroundColor)[3] < 1)
    .map((b) => b.getAttribute('aria-label') || b.textContent.trim());
  return { pairs, unsetButtons };
}
