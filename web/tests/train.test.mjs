/* The Train tab, on the built app, in a real Chrome made to behave like
   Chrome on Android (tests/harness.mjs). The singer is a real voice: one
   steady sung note from the separator's real output for one song
   (RP_SPLIT), found by the test's own pitch reader and shifted onto each
   note an exercise asks for (tests/voice.mjs), given to the mic the moment
   the speaker plays the exercise (the mirror). Never a tone.

   Prints one line per check; exits 1 if any fails. ONLY=name,name runs
   some; APP_DIR points it at another build. RP_ONLINE=1 also checks a
   result reaches the account, signed in as the test singer (RULEBOOK 1d). */
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './chrome.mjs';
import { ANDROID, MIRROR, PROBE, serve } from './harness.mjs';
import { firstNote, pcm, pitchTrack, singNotes, steadyNote } from './voice.mjs';
import { copy, fill } from '../src/core/copy.ts';
import { SUPABASE_KEY, SUPABASE_URL } from '../src/data/config.ts';
import { EMAIL, password } from './test-account.mjs';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (...names) => !ONLY.length || names.some((n) => ONLY.includes(n));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const ONLINE = process.env.RP_ONLINE === '1';
const PREFIX = process.env.RP_SPLIT || '';
const SOURCE = `${PREFIX}-voice30.mp3`;
if (!existsSync(SOURCE)) {
  console.log('FAIL setup: RP_SPLIT must name the separator\'s output for one song (PREFIX-voice30.mp3), kept outside the repo');
  process.exit(1);
}

const ALL = ['train-tab', 'today', 'tab-bar', 'category', 'routines-page', 'preview', 'articulation', 'syllables', 'sound-sheet', 'more-about', 'titles', 'count-in-sound', 'start-only', 'singing-screen',
  'ladder-sung', 'ladder-wrong', 'any-octave', 'hold', 'timed', 'cycle', 'guided', 'range-check', 'range-used', 'mic-refused', 'close', 'routine',
  'pause-resume', 'ex-take', 'ex-takes-page', 'restart', 'pause-gear', 'pause-others',
  'content', 'interval', 'interval-view', 'interval-level', 'match', 'hold-note', 'long-soft', 'bay-results',
  'progress-phone', 'progress-online', 'ex-take-offline', 'ex-take-online', 'no-page-errors'];
/* the old app's groups, and how many exercises each has (CHECKLIST 5) */
const GROUPS = { warmup: 7, breath: 6, tone: 11, agility: 10, range: 5, words: 7, pitch: 3 };
const COLOURS = { warmup: 'warmup', breath: 'breath', tone: 'tone', agility: 'pitch', range: 'pitch', words: 'words', pitch: 'pitch' };
/** the count-in beep: the one short sound the app makes itself */
const isBeep = (x) => Math.abs(x.seconds - 0.08) < 0.01;
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
}

/* the singer: one steady note of a real voice, and its pitch */
const tmp = mkdtempSync(join(tmpdir(), 'rp-train-'));
const SILENCE = join(tmp, 'silence.wav');
spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '30', SILENCE]);
const STEADY = steadyNote(pcm(FFMPEG, SOURCE));
if (!STEADY || !existsSync(SILENCE)) {
  console.log('FAIL setup: no steady sung note found in the recording, or no silence made (FFMPEG)');
  process.exit(1);
}
const HOME = Math.round(STEADY.m);
/* the range the checks sing in: around the singer's own note */
const RANGE = { lo: HOME - 4, hi: HOME + 5 };

/* the old app's ladder (next.html 3706-3740), for the notes the singer must sing */
const PATTERNS = { five: { deg: [0, 2, 4, 5, 7, 5, 4, 2, 0], dur: [1, 1, 1, 1, 2, 1, 1, 1, 2], span: 7 } };
function ladder(pattern, bpm, range) {
  const p = PATTERNS[pattern], beat = 60 / bpm;
  const lo = range.lo + 1, top = range.hi - p.span;
  let roots = [];
  for (let r = lo; r <= top; r++) roots.push(r);
  if (!roots.length) roots = [lo];
  const notes = [];
  let b = 0;
  for (const root of roots) {
    p.deg.forEach((dg, i) => { notes.push({ m: root + dg, t: b * beat, d: p.dur[i] * beat }); b += p.dur[i]; });
    b += 2;
  }
  return notes;
}
/** a key's name, as the app writes it (core/notemap) */
const keyNameOf = (m) => ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
/** a recording of the singer, as base64, for the mirror */
const b64 = (v) => v.buffer.toString('base64');
const sing = (notes, opts) => b64(singNotes(FFMPEG, SOURCE, STEADY, notes, tmp, opts));
const MUM = ladder('five', 120, RANGE);

const { server, ORIGIN, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: SILENCE, allowMic: true, online: ONLINE });
await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin: ORIGIN });
const { page } = env;
await page.addInitScript(ANDROID);
await page.addInitScript(MIRROR);
await page.addInitScript(PROBE);
/* what reaches the speaker, recorded while asked (to hear which note played) */
await page.addInitScript(`(() => {
  const R = window.__rec = { on: false, chunks: [], rate: 48000 };
  const connect = AudioNode.prototype.connect, taps = new Map();
  const tap = (ctx) => { if (taps.has(ctx)) return taps.get(ctx);
    const g = ctx.createGain(), sp = ctx.createScriptProcessor(4096, 1, 1);
    connect.call(g, sp); connect.call(sp, ctx.destination); R.rate = ctx.sampleRate;
    sp.onaudioprocess = (e) => { if (R.on) R.chunks.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
    taps.set(ctx, g); return g; };
  AudioNode.prototype.connect = function (to, ...r) {
    if (to instanceof AudioDestinationNode && !(this instanceof ScriptProcessorNode)) connect.call(this, tap(this.context));
    return connect.call(this, to, ...r); };
  R.take = () => { let n = 0; R.chunks.forEach((c) => (n += c.length)); const out = new Float32Array(n); let k = 0;
    R.chunks.forEach((c) => { out.set(c, k); k += c.length; });
    const b = new Uint8Array(out.buffer); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s); };
})();`);
const P = (expr) => `window.__probe.${expr}`;
let loads = 0;

async function go(route, range = RANGE) {
  await page.goto(URL_APP + '?load=' + ++loads + '#' + route);
  await page.waitFor(`!!document.querySelector('main h1') || !!document.querySelector('#ex-run')`, 8000);
  if (range) {
    await page.eval(`localStorage.setItem('rp.range', ${JSON.stringify(JSON.stringify({ ...range, at: '2026-10-23T00:00:00Z', by: 'test' }))})`);
  }
}
/** an exercise's preview, fresh, with the range set */
async function openEx(id, range = RANGE) {
  await go('/train', range);
  await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/' + id);
  await page.waitFor(`!!document.querySelector('#ex-start')`, 8000);
}
/** signed in as the test singer, on this browser */
async function signIn() {
  await page.goto(URL_APP + '?load=' + ++loads + '#/profile/account');
  await page.waitFor(`!!document.querySelector('#email') || !!document.querySelector('#sign-out')`, 8000);
  if (await page.eval(`!!document.querySelector('#email')`)) {
    await page.tap('#email');
    await page.type(EMAIL);
    await page.tap('#password');
    await page.type(password(EMAIL));
    await page.tap('#sign-in');
    await page.waitFor(`document.querySelector('#signed-in-as')?.textContent.includes(${JSON.stringify(EMAIL)})`, 15000);
  }
}
const quietNow = () => page.eval(`(() => { const P = window.__probe; return P.live.size === 0 && P.micLive() === 0; })()`);
const text = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? null`);
/** give the singer this recording, from the exercise's first note (or at once) */
async function singer(b64data, atOnce = false) {
  await page.eval(`window.__mirror.on = true; window.__mirror.atOnce = ${atOnce}; window.__mirror.load(${JSON.stringify(b64data)})`);
}
const noSinger = () => page.eval(`window.__mirror.on = false; window.__mirror.atOnce = false`);
/** the result, once it is shown */
const result = (ms) => page.waitFor(`!!document.querySelector('#ex-result')`, ms);
const scoreOf = async () => {
  const s = (await text('#ex-score')) || '';
  const m = /(\d+) of (\d+)/.exec(s);
  return m ? { hits: +m[1], n: +m[2] } : null;
};
const exLength = (notes) => Math.max(...notes.map((n) => n.t + n.d));
/** when this run began: what it put online since then is its own */
const RUN_FROM = new Date(Date.now() - 60000).toISOString();
/** the test singer's own key for the database, as the app would hold it */
const singerToken = () => JSON.parse(execFileSync('curl', ['-sS', '-X', 'POST', SUPABASE_URL + '/auth/v1/token?grant_type=password', '-H', 'apikey: ' + SUPABASE_KEY,
  '-H', 'content-type: application/json', '--data', JSON.stringify({ email: EMAIL, password: password(EMAIL) })], { encoding: 'utf8' })).access_token;
/** what the phone keeps in a store of the app's own database */
const idb = (store, body) => page.eval(`(async () => {
  const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app'); q.onsuccess = () => ok(q.result); q.onerror = no; });
  const all = await new Promise((ok) => { const q = db.transaction(${JSON.stringify(store)}).objectStore(${JSON.stringify(store)}).getAll(); q.onsuccess = () => ok(q.result); });
  db.close();
  return (${body})(all);
})()`);
/** the exercise takes kept on this phone, newest first */
const exTakes = (id) => idb('takes', `(all) => all.filter((t) => t.songId === 'ex:${id}').sort((a, b) => b.created - a.created)
  .map((t) => ({ id: t.id, title: t.songTitle, seconds: t.seconds, songAt: t.songAt, path: t.path || null, rightPct: t.rightPct, exercise: t.exercise ?? null }))`);
/** the count-in's number while it shows; null after */
const countNow = () => page.eval(`document.querySelector('#count-in')?.textContent || null`);
/** the 3-2-1 seen, and the first moment after it: where the map stands */
async function countThenNow(ms = 8000) {
  const seen = new Set();
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const c = await countNow();
    if (c) seen.add(c);
    else if (seen.size && (await page.eval(P('starts.some((x) => x.seconds > 1)')))) break;
    await sleep(25);
  }
  const at = await page.eval(`+(document.querySelector('#bubbles')?.dataset.now ?? NaN)`);
  return { counted: ['3', '2', '1'].every((x) => seen.has(x)), at };
}

try {
  /* 1. Train (Robert, 24 Oct): the warm-up card with Start and one line to
        the other routines, then the five groups as cards in their colours.
        Nothing else. */
  if (want('train-tab', 'today', 'tab-bar')) {
    await go('/train');
    await page.goto(URL_APP + '?load=' + ++loads + '#/train');
    await page.waitFor(`!!document.querySelector('#today')`, 8000);
    const t = await page.eval(`(() => {
      const cards = [...document.querySelectorAll('.cat-card')];
      const col = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      const rgb = (c) => { const d = document.createElement('div'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; };
      const main = document.querySelector('main');
      return {
        order: [...main.children].map((el) => el.id || el.tagName.toLowerCase()),
        label: document.querySelector('#today .ex-label')?.textContent,
        name: document.querySelector('#today-name')?.textContent,
        length: document.querySelector('#today-length')?.textContent,
        start: document.querySelector('#today #today-start')?.textContent,
        more: document.querySelector('#today #more-routines')?.textContent,
        cats: cards.map((c) => c.id.replace('cat-', '')),
        colours: cards.map((c) => getComputedStyle(c.querySelector('svg')).color === rgb(col('--' + c.dataset.colour)) ? c.dataset.colour : 'wrong'),
        shades: cards.map((c) => getComputedStyle(c.querySelector('svg')).color),
        pictures: cards.filter((c) => c.querySelector('svg')).length,
        agility: (() => {
          /* a quick run on a staff (Robert, 27 Oct): five faint lines, five solid dots on different heights, one curve */
          const svg = document.querySelector('#cat-agility svg');
          if (!svg) return 'none';
          const lines = [...svg.querySelectorAll('[data-part=staff] line')], dots = [...svg.querySelectorAll('[data-part=dots] circle')];
          const faint = lines.every((l) => Math.abs(parseFloat(getComputedStyle(l).strokeOpacity) - 0.35) < 0.01);
          const solid = dots.every((d) => getComputedStyle(d).fill === getComputedStyle(svg).color && parseFloat(getComputedStyle(d).fillOpacity) === 1);
          const heights = new Set(dots.map((d) => d.getAttribute('cy')));
          const curve = svg.querySelectorAll('[data-part=run]').length === 1 && /C/.test(svg.querySelector('[data-part=run]').getAttribute('d'));
          /* the run at the full stroke, the staff at half of it (Robert, 28 Oct) */
          const weight = parseFloat(getComputedStyle(svg).strokeWidth) === 2 && lines.every((l) => parseFloat(getComputedStyle(l).strokeWidth) === 1);
          return lines.length === 5 && faint && dots.length === 5 && solid && heights.size === 5 && curve && weight ? 'run'
            : 'wrong (' + JSON.stringify({ lines: lines.length, faint, dots: dots.length, solid, heights: heights.size, curve, weight }) + ')';
        })(),
        rows: document.querySelectorAll('.ex-row').length,
        tabs: !!document.querySelector('.tabs') };
    })()`);
    if (want('train-tab')) {
      /* one colour means one thing: five colours for seven groups, Range and Pitch sharing Agility's blue (blue is pitch) and no other two alike */
      const [warm, breath, tone, agility, range, words, pitch] = t.shades;
      const distinct = new Set([warm, breath, tone, agility, words]).size === 5 && range === agility && pitch === agility;
      check('train-tab', JSON.stringify(t.order) === JSON.stringify(['h1', 'today', 'cat-cards']) && t.label === copy.train.today && t.name === copy.routineNames.daily &&
        t.length === fill(copy.train.minsSteps, { mins: 9, n: 7 }) && t.start === copy.train.start && t.more === copy.train.routines &&
        JSON.stringify(t.cats) === JSON.stringify(Object.keys(GROUPS)) && JSON.stringify(t.colours) === JSON.stringify(Object.values(COLOURS)) &&
        distinct && t.pictures === 7 && t.agility === 'run' && t.rows === 0 && t.tabs,
        `on the page: ${t.order.join(', ')}; "${t.label}": "${t.name}", "${t.length}", "${t.start}", "${t.more}"; cards ${t.cats.join(', ')} in ${t.colours.join(', ')} (five colours, Range and Pitch as Agility ${distinct}), ${t.pictures} with a picture, ` +
        `Agility's a ${t.agility}; exercise rows on it: ${t.rows}`);
    }
    /* Today follows its one source: the singer's own plan, kept on the phone, then the daily warm-up */
    if (want('today')) {
      await page.tap('#today-start');
      const daily = await page.waitFor(`location.hash === '#/train/routine/daily/0'`, 5000);
      await page.eval(`localStorage.setItem('rp.plan', 'cooldown')`);
      await page.goto(URL_APP + '?load=' + ++loads + '#/train');
      await page.waitFor(`document.querySelector('#today-name')?.textContent === ${JSON.stringify(copy.routineNames.cooldown)}`, 5000);
      const own = await page.eval(`({ name: document.querySelector('#today-name').textContent, length: document.querySelector('#today-length').textContent,
        from: document.querySelector('#today').dataset.from })`);
      await page.tap('#today-start');
      const cool = await page.waitFor(`location.hash === '#/train/routine/cooldown/0'`, 5000);
      await page.eval(`localStorage.removeItem('rp.plan')`);
      await page.goto(URL_APP + '?load=' + ++loads + '#/train');
      const back = await page.waitFor(`document.querySelector('#today-name')?.textContent === ${JSON.stringify(copy.routineNames.daily)}`, 5000);
      check('today', daily && own.name === copy.routineNames.cooldown && own.length === fill(copy.train.minsSteps, { mins: 3, n: 3 }) && own.from === 'own' && cool && back,
        `Start opened the daily warm-up ${daily}; with their own plan kept: "${own.name}", "${own.length}", from ${own.from}, Start opened it ${cool}; ` +
        `with none, the daily warm-up again ${back}`);
    }
    if (want('tab-bar')) {
      await page.tap('#cat-tone');
      await page.waitFor(`!!document.querySelector('#ex-mum')`, 5000);
      const onList = await page.eval(`!!document.querySelector('.tabs')`);
      await page.tap('#ex-mum');
      await page.waitFor(`!!document.querySelector('#ex-start')`, 5000);
      const hidden = await page.eval(`!document.querySelector('.tabs')`);
      await page.tap('.back');
      await page.waitFor(`!!document.querySelector('#today')`, 5000);
      const back = await page.eval(`!!document.querySelector('.tabs')`);
      check('tab-bar', t.tabs && onList && hidden && back, `on Train ${t.tabs}; on a group's list ${onList}; hidden on an exercise ${hidden}; back on Train ${back}`);
    }
  }

  /* 1b. A group's list: its name in its colour, the rows with the level,
         Quiet and what is measured; in Range, the range check's row shows your range */
  if (want('category')) {
    const seen = {};
    for (const id of Object.keys(GROUPS)) {
      await page.goto(URL_APP + '?load=' + ++loads + '#/train/cat/' + id);
      await page.waitFor(`document.querySelectorAll('.ex-row').length > 0`, 5000);
      seen[id] = await page.eval(`(() => {
        const col = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
        const rgb = (c) => { const d = document.createElement('div'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; };
        const page = document.querySelector('.cat-page');
        return { title: page.querySelector('h1').textContent, coloured: getComputedStyle(page.querySelector('h1')).color === rgb(col('--' + page.dataset.colour)),
          rows: [...page.querySelectorAll('.ex-row')].map((r) => r.querySelector('.ex-tags').textContent), range: document.querySelector('#range-value')?.textContent ?? null };
      })()`);
    }
    const mum = seen.tone.rows[0];
    const ok = Object.entries(GROUPS).every(([id, n]) => seen[id].title === copy.cats[id] && seen[id].coloured && seen[id].rows.length === n) &&
      mum === fill(copy.train.tagLineQuiet, { level: copy.levels[1], measure: copy.train.tagPitch }) && seen.range.range === fill(copy.train.rangeIs, { lo: 'G♯3', hi: 'F4' }).replace('G♯3', keyNameOf(RANGE.lo)).replace('F4', keyNameOf(RANGE.hi));
    check('category', ok, Object.entries(seen).map(([id, v]) => `${v.title} (${v.coloured ? 'in its colour' : 'wrong colour'}): ${v.rows.length} rows`).join('; ') +
      `; Mum's row "${mum}"; the range check's row "${seen.range.range}"`);
  }

  /* 1c. More routines: one line on the warm-up card opens the other routines; a routine opens its first step paused */
  if (want('routines-page')) {
    await page.goto(URL_APP + '?load=' + ++loads + '#/train');
    await page.waitFor(`!!document.querySelector('#more-routines')`, 5000);
    await page.tap('#more-routines');
    await page.waitFor(`!!document.querySelector('#more-routines-list')`, 5000);
    const rows = await page.eval(`[...document.querySelectorAll('#more-routines-list .btn-row')].map((r) => r.id.replace('routine-', ''))`);
    const title = await text('main h1');
    await page.tap('#routine-cooldown');
    await page.waitFor(`!!document.querySelector('#ex-start')`, 5000);
    await sleep(800);
    const step = await text('#routine-step');
    const quiet = await page.eval(`window.__probe.started === 0 && !!document.querySelector('#end-session')`);
    check('routines-page', title === copy.train.routines && JSON.stringify(rows) === JSON.stringify(['intermediate', 'advanced', 'quiet', 'cooldown']) &&
      step === fill(copy.train.step, { name: copy.routineNames.cooldown, i: 1, n: 3 }) && quiet,
      `"${title}": ${rows.join(', ')}; the cool-down opened at "${step}", paused ${quiet}`);
  }

  /* 2. The exercise page (Robert, 24 Oct): back, the name, its group alone
        as a tag, the pattern card, Goal, How, Start. The card's notes play
        only on its button, with no mic; the current bar lights and the
        syllable shows under the card; a second tap stops them */
  if (want('preview')) {
    await openEx('mum');
    const v = await page.eval(`({ back: !!document.querySelector('.back'), name: document.querySelector('#ex-name')?.textContent,
      tags: [...document.querySelectorAll('#ex-tags .tag')].map((t) => t.textContent), bars: document.querySelectorAll('#pattern .pdash').length,
      lit: document.querySelectorAll('#pattern .pdash[data-now]').length, syl: document.querySelector('#pattern-syl')?.textContent,
      dashes: [...document.querySelectorAll('#pattern .pdash i')].map((d) => { const r = d.getBoundingClientRect(); return { top: r.top, h: r.height, w: r.width }; }),
      gap: document.querySelector('.ex-label').getBoundingClientRect().top - document.querySelector('#pattern').getBoundingClientRect().bottom,
      goal: document.querySelector('#ex-goal')?.textContent, how: document.querySelector('#ex-how')?.textContent,
      start: document.querySelector('#ex-start')?.textContent, more: document.querySelector('#ex-more')?.textContent,
      sheet: !!document.querySelector('#sound-sheet'), anyOctave: !!document.querySelector('#any-octave'), started: window.__probe.started })`);
    await sleep(1500);
    const still = await page.eval(P('started'));
    await page.tap('#pattern-play');
    const played = await page.waitFor(P('started > 0'), 5000);
    const litUp = await page.waitFor(`document.querySelectorAll('#pattern .pdash[data-now]').length === 1`, 3000);
    const sylShown = await text('#pattern-syl');
    const gum = await page.eval(P('gum'));
    await page.tap('#pattern-play');
    const stopped = await page.waitFor(`window.__probe.live.size === 0`, 3000);
    await sleep(200);
    const sylGone = await text('#pattern-syl');
    /* a melody line (Robert, 25 Oct): the top note's dash highest, the first and last (the same note) lowest and level,
       every dash short, the two-beat last note's dash wider than the first's; nothing between the card and Goal */
    const d = v.dashes;
    const melody = d.length === 9 && d[4].top < Math.min(...d.filter((_, i) => i !== 4).map((x) => x.top)) && Math.abs(d[0].top - d[8].top) < 1 &&
      d[0].top >= Math.max(...d.map((x) => x.top)) - 1 && d.every((x) => x.h <= 10) && d[8].w > 1.5 * d[0].w;
    check('preview', v.back && v.name === copy.ex.mum.name && v.tags.join('|') === copy.cats.tone && melody && v.gap <= 30 && v.bars === 9 && v.lit === 0 && v.syl === '' &&
      v.goal === copy.ex.mum.goal && v.how === copy.ex.mum.how && v.start === copy.train.start && v.more === copy.train.moreAbout && !v.sheet && !v.anyOctave &&
      v.started === 0 && still === 0 && played && litUp && sylShown === copy.ex.mum.syl && gum === 0 && stopped && sylGone === '',
      `"${v.name}", tags ${v.tags.join(' / ')}; ${v.bars} dashes as a melody line ${melody} (${v.gap.toFixed(0)} px to Goal), none lit; goal "${v.goal}"; how "${v.how}"; "${v.start}", "${v.more}"; ` +
      `the sheet closed ${!v.sheet}, Any octave off the page ${!v.anyOctave}; nothing played before the tap (${still}); on the button: played ${played}, a bar lit ${litUp}, ` +
      `"${sylShown}" under the card, mic asked ${gum}; a second tap stops it ${stopped}, the syllable goes ${sylGone === ''}`);
  }

  /* 2a. Articulation (Robert, 25 Oct): the five vowels on one held note (five
         level dashes), the syllable under the dashes changing note by note */
  if (want('articulation')) {
    await openEx('vowels');
    const v = await page.eval(`({ tag: document.querySelector('#ex-tags .tag')?.textContent, colour: document.querySelector('#ex-tags .tag')?.dataset.colour,
      tops: [...document.querySelectorAll('#pattern .pdash i')].map((d) => d.getBoundingClientRect().top) })`);
    await noSinger();
    await page.tap('#pattern-play');
    const seen = [];
    const end = Date.now() + 6000;
    while (Date.now() < end && seen.length < 5) {
      const s = await text('#pattern-syl');
      if (s && seen[seen.length - 1] !== s) seen.push(s);
      await sleep(40);
    }
    await page.waitFor(P('live.size === 0'), 6000);
    check('articulation', v.tag === copy.cats.words && v.colour === 'words' && v.tops.length === 5 && v.tops.every((t) => Math.abs(t - v.tops[0]) < 1) &&
      JSON.stringify(seen) === JSON.stringify(copy.ex.vowels.syls),
      `"${v.tag}" in its own colour ${v.colour === 'words'}; ${v.tops.length} level dashes ${v.tops.every((t) => Math.abs(t - v.tops[0]) < 1)}; under them, in turn: ${seen.join(', ')}`);
  }

  /* 2a'. Syllables per note (Robert, 27 Oct): La-Ga alternates la, ga a note, as the old app's "la-ga la-ga" */
  if (want('syllables')) {
    await openEx('laga');
    await noSinger();
    await page.tap('#pattern-play');
    const seen = [];
    const end = Date.now() + 6000;
    while (Date.now() < end && seen.length < 9) {
      const i = await page.eval(`[...document.querySelectorAll('#pattern .pdash')].findIndex((d) => d.dataset.now)`);
      const s = await text('#pattern-syl');
      if (i >= 0 && s && (seen.length === 0 || seen[seen.length - 1].i !== i)) seen.push({ i, s });
      await sleep(30);
    }
    await page.waitFor(P('live.size === 0'), 6000);
    const want9 = ['la', 'ga', 'la', 'ga', 'la', 'ga', 'la', 'ga', 'la'];
    const ok = seen.length >= 7 && seen.every(({ i, s }) => s === want9[i]);
    check('syllables', ok, `La-Ga's card, note by note: ${seen.map(({ i, s }) => i + 1 + ' ' + s).join(', ')}`);
  }

  /* 2b. The gear's sound sheet: Any octave (off at first, remembered for
         this exercise alone), Count-in sound, Hear yourself and its volume */
  if (want('sound-sheet')) {
    await openEx('mum');
    await page.eval(`Object.keys(localStorage).filter((k) => k.startsWith('rp.anyOctave')).forEach((k) => localStorage.removeItem(k))`);
    await openEx('mum');
    await page.tap('#ex-gear');
    const opened = await page.waitFor(`!!document.querySelector('#sound-sheet')`, 3000);
    const sheet = await page.eval(`({ any: document.querySelector('#sound-sheet #any-octave')?.checked ?? null, count: document.querySelector('#sound-sheet #count-in-sound')?.checked ?? null,
      hear: document.querySelector('#sound-sheet #hear-yourself')?.checked ?? null, vol: document.querySelector('#sound-sheet #monitor-volume')?.value ?? null })`);
    await page.tap('#any-octave');
    await openEx('mum');
    await page.tap('#ex-gear');
    const mumAgain = await page.eval(`document.querySelector('#any-octave')?.checked ?? null`);
    await openEx('mee');
    await page.tap('#ex-gear');
    const mee = await page.eval(`document.querySelector('#any-octave')?.checked ?? null`);
    await page.tap('#ex-gear');
    const closed = await page.eval(`!document.querySelector('#sound-sheet')`);
    await openEx('mum');
    await page.tap('#ex-gear');
    await page.tap('#any-octave');
    check('sound-sheet', opened && sheet.any === false && sheet.count === true && sheet.hear === false && sheet.vol === '70' && mumAgain === true && mee === false && closed,
      `the gear opens it ${opened}: Any octave ${sheet.any}, Count-in sound ${sheet.count}, Hear yourself ${sheet.hear} at ${sheet.vol}; ` +
      `Any octave on for Mum is remembered for Mum ${mumAgain} and not for Mee ${mee === false}; the gear closes it ${closed}`);
  }

  /* 2c. "More about this" opens the old app's why, watch for and care */
  if (want('more-about')) {
    await openEx('mum');
    const before = await page.eval(`!!document.querySelector('#ex-about')`);
    await page.tap('#ex-more');
    const after = await page.waitFor(`!!document.querySelector('#ex-about')`, 3000);
    const a = await page.eval(`({ labels: [...document.querySelectorAll('#ex-about .ex-label')].map((l) => l.textContent), text: document.querySelector('#ex-about').textContent })`);
    await page.tap('#ex-more');
    const gone = await page.eval(`!document.querySelector('#ex-about')`);
    check('more-about', !before && after && JSON.stringify(a.labels) === JSON.stringify([copy.train.why, copy.train.watchFor, copy.train.care]) &&
      a.text.includes(copy.about.mum.why) && a.text.includes(copy.about.mum.watch) && a.text.includes(copy.about.mum.care) && gone,
      `closed at first ${!before}; opened ${after} with ${a.labels.join(', ')}, the old app's words ${a.text.includes(copy.about.mum.why)}; closed again ${gone}`);
  }

  /* 2c'. The proper name is the title, the plain name a small line under it, on the page and in the list; no "Also called" (Robert, 28 Oct) */
  if (want('titles')) {
    const NAMES = { vfe: ['Vocal Function Exercises', 'Long soft notes'], messa: ['Messa di voce', 'Soft, loud, soft'], penta: ['Pentatonic run', 'Skipping run'],
      chrom: ['Chromatic run', 'Half-step run'], arp19: ['Octave-and-a-half arpeggio', 'Big climb'], staccato: ['Staccato', 'Short bouncy notes'],
      farinelli: ['Farinelli breath', 'Breath counts'], ninetone: ['Nine-tone scale', 'Nine-note scale'] };
    const seen = [];
    for (const [id, [title, plain]] of Object.entries(NAMES)) {
      await openEx(id);
      const got = await page.eval(`(() => { const h = document.querySelector('#ex-name'), p = document.querySelector('#ex-plain');
        return { title: h?.textContent, plain: p?.textContent, under: !!h && h.nextElementSibling === p,
          small: !!h && !!p && parseFloat(getComputedStyle(p).fontSize) < parseFloat(getComputedStyle(h).fontSize) }; })()`);
      if (await page.eval(`!!document.querySelector('#ex-more')`)) await page.tap('#ex-more');
      const also = await page.eval(`/Also called/i.test(document.body.textContent)`);
      seen.push({ id, ok: got.title === title && got.plain === plain && got.under && got.small && !also, got });
    }
    await go('/train');
    await page.goto(URL_APP + '?load=' + ++loads + '#/train/cat/breath');
    await page.waitFor(`!!document.querySelector('#ex-vfe')`, 5000);
    const row = await page.eval(`[...document.querySelectorAll('#ex-vfe .ex-text > *')].map((x) => x.textContent)`);
    check('titles', seen.every((x) => x.ok) && row[0] === 'Vocal Function Exercises' && row[1] === 'Long soft notes',
      seen.map((x) => `${x.got.title} / ${x.got.plain}${x.ok ? '' : ' (wrong: ' + JSON.stringify(x.got) + ')'}`).join('; ') + `; in the list: ${row.slice(0, 2).join(' / ')}`);
  }

  /* 2d. The count-in sound (Robert, 24 Oct): a short beep on each of 3, 2,
         1, before the notes; none when off; remembered; nothing after Close */
  if (want('count-in-sound')) {
    const countIn = async () => {
      await noSinger();
      await page.tap('#ex-start');
      await page.waitFor(P('starts.some((x) => x.seconds > 1)'), 12000);
      const st = await page.eval(P('starts'));
      const first = st.findIndex((x) => x.seconds > 1);
      await page.tap('#ex-close');
      await page.waitFor(P('live.size === 0'), 3000);
      return { before: st.slice(0, first).filter(isBeep).length, all: st.filter(isBeep).length };
    };
    await openEx('mum');
    const on = await countIn();
    await openEx('mum');
    await page.tap('#ex-gear');
    await page.tap('#count-in-sound');
    const off = await countIn();
    await openEx('mum');
    await page.tap('#ex-gear');
    const remembered = await page.eval(`document.querySelector('#count-in-sound').checked`);
    await page.tap('#count-in-sound');
    await page.tap('#ex-gear');
    /* Close during the count-in: no more beeps, nothing plays */
    await page.tap('#ex-start');
    await page.waitFor(P('starts.length >= 1'), 8000);
    await page.eval(P('mark()'));
    await page.tap('#ex-close');
    const n = await page.eval(P('starts.length'));
    await sleep(2500);
    const later = await page.eval(P('starts.length'));
    const quiet = await quietNow();
    check('count-in-sound', on.before === 3 && on.all === 3 && off.all === 0 && remembered === false && n >= 1 && later === n && quiet,
      `on: ${on.before} beeps before the first note (${on.all} in all); off: ${off.all}; off remembered ${remembered === false}; ` +
      `after Close during the count-in: ${later - n} more sounds, quiet ${quiet}`);
  }

  /* 3. Robert, 1 Oct: nothing starts until Start; the 3-2-1 count-in; the controls while singing (28 Oct): Close, Pause, Restart, the gear */
  if (want('start-only')) {
    await openEx('mum');
    await sleep(2000);
    const before = await page.eval(`({ s: window.__probe.started, gum: window.__probe.gum })`);
    await noSinger();
    await page.tap('#ex-start');
    const counts = new Set();
    const end = Date.now() + 6000;
    while (Date.now() < end) {
      const c = await text('#count-in');
      if (c) counts.add(c);
      if (await page.eval(P('starts.some((x) => x.seconds > 1)'))) break;
      await sleep(60);
    }
    const controls = await page.eval(`[...document.querySelectorAll('#ex-run button')].map((b) => b.id)`);
    await page.tap('#ex-close');
    check('start-only', before.s === 0 && before.gum === 0 && ['3', '2', '1'].every((x) => counts.has(x)) &&
      JSON.stringify(controls) === JSON.stringify(['ex-close', 'ex-pause', 'ex-restart', 'ex-gear-run']),
      `before Start: notes ${before.s}, mic asked ${before.gum}; counted ${[...counts].join(', ')}; controls while singing: ${controls.join(', ')}`);
  }

  /* 3b. The singing screen (Robert, 24 Oct): the note map fills the screen,
         the ladder of note names at the left, every bubble with its syllable,
         the current one bigger, the dots along the bottom one per rung */
  if (want('singing-screen')) {
    await openEx('mum');
    await noSinger();
    await page.tap('#ex-start');
    await page.waitFor(P('starts.some((x) => x.seconds > 1)'), 12000);
    await sleep(600);
    const look = () => page.eval(`(() => {
      const run = document.querySelector('#ex-run').getBoundingClientRect(), cv = document.querySelector('#bubbles'), c = cv.getBoundingClientRect();
      const bar = document.querySelector('#ex-pause')?.getBoundingClientRect();
      return { top: run.top, height: run.height, inner: innerHeight, canvas: c.height, ...cv.dataset, bar: bar ? Math.round(bar.bottom) : null,
        barTop: bar ? Math.round(bar.top) : null, mapEnd: Math.round(c.bottom),
        dots: document.querySelectorAll('#ex-dots .dot').length, done: document.querySelectorAll('#ex-dots .dot[data-done]').length,
        now: [...document.querySelectorAll('#ex-dots .dot')].findIndex((d) => d.dataset.now) };
    })()`);
    const a = await look();
    await page.waitFor(`document.querySelectorAll('#ex-dots .dot[data-done]').length >= 1`, 12000);
    const b = await look();
    await sleep(1500);
    const c = await look();
    await page.tap('#ex-close');
    const rungs = MUM.length / 9;
    /* zoomed to the rung (Robert, 25 Oct): three semitones round the first rung's notes, then gliding up a
       half step with the second, never in one jump */
    const r0 = MUM.slice(0, 9), r1 = MUM.slice(9, 18);
    const near = (x, y) => Math.abs(+x - y) <= 0.3;
    const zoomed = near(a.viewLo, Math.min(...r0.map((n) => n.m)) - 3) && near(a.viewHi, Math.max(...r0.map((n) => n.m)) + 3) &&
      near(c.viewLo, Math.min(...r1.map((n) => n.m)) - 3) && near(c.viewHi, Math.max(...r1.map((n) => n.m)) + 3);
    const glided = +c.viewStep > 0 && +c.viewStep <= 0.3;
    /* the map smaller, to make room for the controls along the bottom (Robert, 28 Oct), and still the larger part of the screen */
    check('singing-screen', a.top <= 1 && a.height >= a.inner - 2 && a.canvas >= 0.6 * a.inner && a.mapEnd != null && a.bar != null && a.mapEnd < a.barTop && a.bar <= a.inner &&
      +a.visible > 0 && a.labelled === a.visible && +a.names >= 6 &&
      +a.bubble >= 40 && +a.nowBubble > +a.bubble && a.dots === rungs && a.now === 0 && a.done === 0 && b.done === 1 && b.now === 1 && zoomed && glided,
      `fills the screen: top ${a.top}, ${a.height} of ${a.inner} px, the map ${a.canvas} px down to ${a.mapEnd}, the controls under it from ${a.barTop} to ${a.bar} px; ${a.labelled} of ${a.visible} bubbles with their syllable; ` +
      `${a.names} note names; bubbles ${a.bubble} px, the current ${a.nowBubble} px; ${a.dots} dots for ${rungs} rungs, the first current; later ${b.done} done, the second current ${b.now === 1}; ` +
      `the view ${a.viewLo}-${a.viewHi} on the first rung, ${c.viewLo}-${c.viewHi} on the second ${zoomed}, in steps of at most ${c.viewStep} of a semitone ${glided}`);
  }

  /* 4. Sung right, by a real voice: the bubbles fill and the score says so */
  if (want('ladder-sung')) {
    await openEx('mum');
    await singer(sing(MUM));
    await page.tap('#ex-start');
    const shown = await result(exLength(MUM) * 1000 + 12000);
    const s = await scoreOf();
    const saved = await page.waitFor(`!!document.querySelector('#ex-saved')`, 8000) ? await text('#ex-saved') : null;
    check('ladder-sung', shown && s && s.n === MUM.length && s.hits >= Math.ceil(0.8 * s.n) && /Saved/.test(saved || ''),
      `${MUM.length} notes sung by a real voice: "${await text('#ex-score')}"; "${saved}"`);
  }

  /* 5. Sung three semitones off: the score says so */
  if (want('ladder-wrong')) {
    await openEx('mum');
    await singer(sing(MUM, { shift: 3 }));
    await page.tap('#ex-start');
    await result(exLength(MUM) * 1000 + 12000);
    const s = await scoreOf();
    check('ladder-wrong', s && s.hits <= Math.floor(0.2 * s.n), `the same voice three semitones off: "${await text('#ex-score')}"`);
  }

  /* 6. An octave down: wrong, octave exact; right with Any octave */
  if (want('any-octave')) {
    const low = sing(MUM, { shift: -12 });
    await openEx('mum');
    await page.eval(`localStorage.removeItem('rp.anyOctave.mum')`);
    await openEx('mum');
    await singer(low);
    await page.tap('#ex-start');
    await result(exLength(MUM) * 1000 + 12000);
    const exact = await scoreOf();
    await openEx('mum');
    await page.tap('#ex-gear');
    await page.tap('#any-octave');
    await page.tap('#ex-gear');
    await singer(low);
    await page.tap('#ex-start');
    await result(exLength(MUM) * 1000 + 12000);
    const any = await scoreOf();
    await page.eval(`localStorage.removeItem('rp.anyOctave.mum')`);
    check('any-octave', exact && any && exact.hits <= Math.floor(0.2 * exact.n) && any.hits >= Math.ceil(0.8 * any.n),
      `an octave down: exact "${exact ? exact.hits + ' of ' + exact.n : '-'}", with Any octave "${any ? any.hits + ' of ' + any.n : '-'}"`);
  }

  /* 7. A held note (Sustained note, 8 s): five notes through the range, each held by a real voice */
  if (want('hold')) {
    const a = RANGE.lo + 3, b = Math.max(a, RANGE.hi - 3);
    const notes = Array.from({ length: 5 }, (_, i) => ({ m: Math.round(a + ((b - a) * i) / 4), t: i * 11, d: 8 }));
    await openEx('sustain');
    await singer(sing(notes));
    await page.tap('#ex-start');
    await result(exLength(notes) * 1000 + 15000);
    const s = await scoreOf();
    check('hold', s && s.n === 5 && s.hits >= 4, `five held notes, sung: "${await text('#ex-score')}"`);
  }

  /* 8. The timed hiss: times itself from the first sound, stops after a second of quiet, the result stays */
  if (want('timed')) {
    const held = sing([{ m: HOME, t: 0, d: 6 }], { lead: 6, tail: 4 });
    await openEx('hiss');
    await singer(held, true);
    await page.tap('#ex-start');
    const shown = await result(25000);
    const secs = parseFloat((await text('#ex-score')) || 'NaN');
    await sleep(2500);
    const stays = await page.eval(`!!document.querySelector('#ex-result')`);
    const quiet = await quietNow();
    check('timed', shown && Math.abs(secs - 6) <= 0.6 && stays && quiet,
      `six seconds of real voice: "${await text('#ex-score')}"; the result stays ${stays}; silence and the mic closed ${quiet}`);
  }

  /* 9. The breath cycle: in, suspend, out, at a count a second; Done, and nothing scored */
  if (want('cycle')) {
    await openEx('farinelli');
    await page.tap('#ex-start');
    await sleep(500);
    const a = await text('#ex-phase');
    await sleep(4200);
    const b = await text('#ex-phase');
    const mic = await page.eval(P('gum'));
    await page.tap('#ex-done');
    await result(3000);
    const un = await text('#ex-unscored');
    check('cycle', a === copy.train.cycleIn && b === copy.train.cycleHold && mic === 0 && un === copy.train.notScored,
      `"${a}", then "${b}"; mic asked ${mic}; after Done: "${un}"`);
  }

  /* 10. A guided exercise: the how and a clock; Done; not scored */
  if (want('guided')) {
    await openEx('straw');
    await page.tap('#ex-start');
    await sleep(2200);
    const clock = await text('#ex-clock');
    await page.tap('#ex-done');
    await result(3000);
    const un = await text('#ex-unscored');
    check('guided', clock === '0:02' && un === copy.train.notScored, `the clock at ${clock}; after Done: "${un}"`);
  }

  /* 11. The range check: four seconds low, four high, by a real voice; kept, and shown on Train */
  if (want('range-check', 'range-used')) {
    const lowM = HOME - 7, highM = HOME + 8;
    const voice = sing([{ m: lowM, t: 0, d: 5.5 }, { m: highM, t: 5.5, d: 6 }], { lead: 5, tail: 2 });
    await go('/train', null);
    await page.eval(`localStorage.removeItem('rp.range'); localStorage.removeItem('rp_range')`);
    await page.goto(URL_APP + '?load=' + ++loads + '#/train/cat/range');
    await page.waitFor(`!!document.querySelector('#range-value')`, 5000);
    const before = await text('#range-value');
    await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/rangecheck');
    await page.waitFor(`!!document.querySelector('#ex-start')`, 5000);
    await singer(voice, true);
    await page.tap('#ex-start');
    const shown = await result(30000);
    const kept = await page.eval(`JSON.parse(localStorage.getItem('rp.range') || 'null')`);
    const said = await text('#ex-score');
    await page.goto(URL_APP + '?load=' + ++loads + '#/train/cat/range');
    await page.waitFor(`!!document.querySelector('#range-value')`, 5000);
    const after = await text('#range-value');
    if (want('range-check')) {
      check('range-check', before === copy.train.notMeasured && shown && kept && Math.abs(kept.lo - lowM) <= 1 && Math.abs(kept.hi - highM) <= 1 && kept.by === 'test' &&
        after && after !== copy.train.notMeasured,
        `before: "${before}"; sung ${lowM} low and ${highM} high: kept ${kept ? kept.lo + '-' + kept.hi + ' by ' + kept.by : 'nothing'}; said "${said}"; Train now "${after}"`);
    }
    if (want('range-used') && kept) {
      /* the ladder now climbs that range: its first note, as heard at the
         speaker and read by the test's own pitch reader, is one above the bottom */
      await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/mum');
      await page.waitFor(`!!document.querySelector('#ex-start')`, 5000);
      await noSinger();
      await page.eval(`Object.assign(window.__rec, { on: true, chunks: [] })`);
      await page.tap('#pattern-play');
      await page.waitFor(P('live.size > 0'), 5000);
      await sleep(400);
      await page.eval(`window.__rec.on = false`);
      await page.tap('#pattern-play');
      const raw = join(tmp, 'heard.f32');
      writeFileSync(raw, Buffer.from(await page.eval(`window.__rec.take()`), 'base64'));
      const heardPcm = pcm(FFMPEG, raw, [], ['-f', 'f32le', '-ar', String(await page.eval(`window.__rec.rate`)), '-ac', '1']);
      const heard = firstNote(heardPcm, 0.1);
      if (process.env.DEBUG) console.log(pitchTrack(heardPcm).filter((_, i) => i % 5 === 0).map((v) => (Number.isFinite(v) ? v.toFixed(1) : '-')).join(' '));
      check('range-used', !!heard && Math.abs(heard.m - (kept.lo + 1)) < 0.3,
        `the range kept ${kept.lo}-${kept.hi}: the first note heard at ${heard ? heard.m.toFixed(2) : '?'}; one above the bottom is ${kept.lo + 1}`);
    }
  }

  /* 12. Mic refused (a browser that has been told no): the exercise plays
         on, "Carry on without it", and nothing is scored */
  if (want('mic-refused')) {
    const no = await launch({ mic: SILENCE, allowMic: false });
    try {
      await no.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'denied', origin: ORIGIN });
      const p = no.page;
      await p.addInitScript(ANDROID);
      await p.addInitScript(PROBE);
      await p.goto(URL_APP + '#/train');
      await p.waitFor(`!!document.querySelector('#today')`, 8000);
      await p.eval(`localStorage.setItem('rp.range', ${JSON.stringify(JSON.stringify({ ...RANGE, at: '2026-10-23T00:00:00Z', by: 'test' }))})`);
      await p.goto(URL_APP + '?again=1#/train/ex/mum');
      await p.waitFor(`!!document.querySelector('#ex-start')`, 8000);
      await p.tap('#ex-start');
      const said = await p.waitFor(`document.querySelector('#mic-line')?.textContent.includes(${JSON.stringify(copy.song.micRefused)})`, 8000);
      const carry = await p.eval(`!!document.querySelector('#carry-on')`);
      const plays = await p.waitFor(`window.__probe.started > 0`, 6000);
      await p.waitFor(`!!document.querySelector('#ex-result')`, exLength(MUM) * 1000 + 12000);
      const un = await p.eval(`document.querySelector('#ex-unscored')?.textContent ?? null`);
      check('mic-refused', said && carry && plays && un === copy.train.noMicScore && p.errors.length === 0,
        `said ${said}, "Carry on without it" ${carry}; the notes played ${plays}; after: "${un}"`);
    } finally {
      await no.close();
    }
  }

  /* 13. Close: silence and the mic closed at once, back to the preview */
  if (want('close')) {
    await openEx('mum');
    await singer(sing(MUM));
    await page.tap('#ex-start');
    await page.waitFor(P('live.size > 0'), 8000);
    await sleep(1000);
    await page.eval(P('mark()'));
    await page.tap('#ex-close');
    const quiet = await page.waitFor(P('quietAt !== null'), 2000);
    const ms = quiet ? await page.eval(`Math.round(window.__probe.quietAt - window.__probe.actionAt)`) : null;
    const preview = await page.eval(`!!document.querySelector('#ex-start')`);
    check('close', quiet && ms >= 0 && ms <= 300 && preview, quiet ? `silence and the mic closed in ${ms} ms; back to the preview ${preview}` : 'still playing, or the mic still open, 2 s after closing');
  }

  /* 14. A routine never moves on by itself; each step opens paused; End session */
  if (want('routine')) {
    await go('/train');
    await page.goto(URL_APP + '?load=' + ++loads + '#/train/routine/cooldown/0');
    await page.waitFor(`!!document.querySelector('#ex-start')`, 5000);
    const step1 = await text('#routine-step');
    await page.tap('#ex-start');
    await sleep(500);
    await page.tap('#ex-done');
    await result(3000);
    const next = await text('#ex-next');
    await sleep(3000);
    const stayed = await page.eval(`location.hash`);
    await page.tap('#ex-next');
    await page.waitFor(`document.querySelector('#ex-name')?.textContent === ${JSON.stringify(copy.ex.hum.name)}`, 5000);
    await sleep(1500);
    const paused = await page.eval(`({ s: window.__probe.started, live: window.__probe.live.size, start: !!document.querySelector('#ex-start'), end: !!document.querySelector('#end-session') })`);
    await page.tap('#end-session');
    const home = await page.waitFor(`location.hash === '#/train'`, 3000);
    check('routine', step1 === fill(copy.train.step, { name: copy.routineNames.cooldown, i: 1, n: 3 }) && next === fill(copy.train.next, { name: copy.ex.hum.name }) &&
      stayed === '#/train/routine/cooldown/0' && paused.live === 0 && paused.start && paused.end && home,
      `"${step1}"; after it: "${next}", and three seconds later still on that step ${stayed === '#/train/routine/cooldown/0'}; ` +
      `the next step paused (playing ${paused.live}, Start ${paused.start}, End session ${paused.end}); End session back to Train ${home}`);
  }

  /* 14a. Pause, Resume and the take (Robert, 28 Oct), by a real voice: Pause
          is silence and the mic closed at once; Resume counts in again and
          carries on from the start of the repeat it was in; nothing scored is
          lost; the take is the voice of both stretches, saved on the phone */
  let savedTake = null;
  if (want('pause-resume', 'ex-take', 'ex-takes-page')) {
    await openEx('mum');
    await singer(sing(MUM));
    await page.tap('#ex-start');
    await page.waitFor(`document.querySelectorAll('#ex-dots .dot[data-done]').length >= 1`, 20000);
    await sleep(900);
    await page.eval(P('mark()'));
    await page.tap('#ex-pause');
    const quiet = await page.waitFor(P('quietAt !== null'), 2000);
    const ms = quiet ? await page.eval(`Math.round(window.__probe.quietAt - window.__probe.actionAt)`) : null;
    const paused = await page.eval(`({ label: document.querySelector('#ex-pause')?.textContent, run: !!document.querySelector('#ex-run'),
      done: document.querySelectorAll('#ex-dots .dot[data-done]').length, hits: +document.querySelector('#bubbles').dataset.hits })`);
    /* nothing reaches the speaker while paused (a note's scheduled end counts as a stop to the probe, so the speaker is listened to) */
    await sleep(1000);                     /* the speaker's tap remembers the last 0.7 s */
    await page.eval(`window.__probe.outPeak = 0`);
    await sleep(1500);
    const peak = await page.eval(`window.__probe.outPeak`);
    const still = (await quietNow()) && peak < 0.005 && (await page.eval(`!!document.querySelector('#ex-run')`));
    /* the singer sings on from the second repeat's start, as asked */
    const from = MUM[9].t;
    await singer(sing(MUM.slice(9).map((n) => ({ ...n, t: n.t - from }))));
    await page.tap('#ex-pause');
    const back = await countThenNow();
    await result(exLength(MUM) * 1000 + 12000);
    const s = await scoreOf();
    const ok = quiet && ms <= 300 && paused.label === copy.train.resume && paused.run && paused.done === 1 && paused.hits >= 7 && still &&
      back.counted && back.at >= from - 0.05 && back.at <= from + 0.6 && s && s.n === MUM.length && s.hits >= Math.ceil(0.8 * s.n);
    if (want('pause-resume')) {
      check('pause-resume', ok,
        `paused in the second repeat: silence and the mic closed in ${ms} ms, "${paused.label}", still on the singing screen ${paused.run}, ${paused.done} repeat done with ${paused.hits} notes hit; ` +
        `quiet 1.5 s later ${still} (loudest at the speaker ${peak.toFixed(4)}); Resume counted in ${back.counted} and carried on at ${back.at.toFixed(2)} s (the second repeat starts at ${from} s); ` +
        `in the end "${await text('#ex-score')}" of ${MUM.length}`);
    }
    /* Save take, next to the score with Try again and Next */
    const actions = await page.eval(`[...document.querySelectorAll('#ex-result .ex-actions button')].map((b) => b.id)`);
    const before = (await exTakes('mum')).length;
    if (actions.includes('ex-take-save')) await page.tap('#ex-take-save');
    await page.waitFor(`document.querySelector('#ex-take-save')?.textContent === ${JSON.stringify(copy.train.takeSaved)}`, 3000);
    await sleep(500);
    const kept = await exTakes('mum');
    savedTake = kept.length > before ? kept[0] : null;
    const t = savedTake;
    /* both stretches in it: from the first note to the last, in one take */
    const whole = t && t.songAt <= 0.6 && t.seconds >= exLength(MUM) - 1.5 && t.seconds <= exLength(MUM) + 1.5;
    if (want('ex-take')) {
      check('ex-take', JSON.stringify(actions) === JSON.stringify(['ex-take-save', 'ex-again', 'ex-next']) && !!t && t.title === copy.ex.mum.name && whole &&
        t.exercise?.id === 'mum' && t.exercise.notes.length === MUM.length && t.rightPct === Math.round((100 * s.hits) / s.n),
        `at the end: ${actions.join(', ')}; kept on the phone ${!!t}: "${t?.title}", ${t?.seconds.toFixed(1)} s from ${t?.songAt.toFixed(2)} s (the exercise is ${exLength(MUM).toFixed(1)} s) ${!!whole}; ` +
        `with its ${t?.exercise?.notes.length} piano notes, ${t?.rightPct}% right`);
    }
  }

  /* 14a'. "Your takes" on the exercise page: the take heard over the exercise's piano notes */
  if (want('ex-takes-page')) {
    await openEx('mum');
    await page.waitFor(`!!document.querySelector('#ex-takes')`, 5000);
    const line = await text('#ex-takes');
    if (line) await page.tap('#ex-takes');
    const opened = await page.waitFor(`location.hash === '#/train/ex/mum/takes' && !!document.querySelector('.take-row')`, 5000);
    const goal = await page.eval(`!!document.querySelector('main h1')`);
    const rowsNow = await page.eval(`[...document.querySelectorAll('.take-row')].map((r) => ({ id: r.dataset.take, menu: !!r.querySelector('.take-more') }))`);
    await page.waitFor(`!!document.querySelector('.take-row .take-hear:not([disabled])')`, 5000);
    await noSinger();
    await page.eval(P('mark()'));
    await page.tap('.take-row .take-hear');
    await page.waitFor(P('starts.length >= 2'), 6000);
    await sleep(500);
    const st = await page.eval(P('starts'));
    const voice = savedTake ? st.filter((x) => Math.abs(x.seconds - savedTake.seconds) < 0.3).length : 0;
    const piano = st.filter((x) => x.seconds > 1 && !(savedTake && Math.abs(x.seconds - savedTake.seconds) < 0.3)).length;
    await page.tap('.take-row .take-hear');
    await page.waitFor(P('live.size === 0'), 3000);
    check('ex-takes-page', line === copy.train.yourTakes && opened && goal && rowsNow.length >= 1 && rowsNow[0].id === savedTake?.id && !rowsNow[0].menu &&
      voice === 1 && piano >= MUM.length,
      `"${line}" on the page; opens its takes ${opened}: ${rowsNow.length} take(s), the newest the one just saved ${rowsNow[0]?.id === savedTake?.id}, no send or delete ${!rowsNow[0]?.menu}; ` +
      `heard: the voice ${voice}, over ${piano} piano notes`);
  }

  /* 14a''. Restart: from the first repeat, the score cleared */
  if (want('restart')) {
    await openEx('mum');
    await singer(sing(MUM));
    await page.tap('#ex-start');
    await page.waitFor(`document.querySelectorAll('#ex-dots .dot[data-done]').length >= 1`, 20000);
    await sleep(500);
    const hitsBefore = await page.eval(`+document.querySelector('#bubbles').dataset.hits`);
    await page.tap('#ex-restart');
    await sleep(150);
    await sleep(250);
    const cleared = await page.eval(`({ hits: +document.querySelector('#bubbles').dataset.hits, done: document.querySelectorAll('#ex-dots .dot[data-done]').length })`);
    const again = await countThenNow();
    await result(exLength(MUM) * 1000 + 12000);
    const s = await scoreOf();
    check('restart', hitsBefore >= 7 && cleared.hits === 0 && cleared.done === 0 && again.counted && again.at <= 0.6 && s && s.n === MUM.length &&
      s.hits >= Math.ceil(0.8 * s.n),
      `${hitsBefore} notes hit before Restart; after it ${cleared.hits} and ${cleared.done} repeats done; counted in ${again.counted}, from ${again.at.toFixed(2)} s; ` +
      `sung through again: "${await text('#ex-score')}"`);
  }

  /* 14a'''. The gear while paused: the same sound sheet; what is set there holds when it resumes */
  if (want('pause-gear')) {
    await openEx('mum');
    await noSinger();
    await page.tap('#ex-start');
    await page.waitFor(P('starts.some((x) => x.seconds > 1)'), 12000);
    await sleep(800);
    await page.tap('#ex-pause');
    await page.waitFor(P('live.size === 0'), 2000);
    await page.tap('#ex-gear-run');
    const sheet = await page.eval(`(() => { const s = document.querySelector('#ex-run #sound-sheet');
      return s ? ['any-octave', 'count-in-sound', 'hear-yourself', 'monitor-volume'].filter((id) => s.querySelector('#' + id)) : []; })()`);
    const wasOn = await page.eval(`document.querySelector('#count-in-sound')?.checked ?? null`);
    await page.tap('#count-in-sound');
    await page.tap('#ex-gear-run');
    const closed = await page.eval(`!document.querySelector('#sound-sheet')`);
    const n0 = await page.eval(P('starts.length'));
    await page.tap('#ex-pause');
    const back = await countThenNow();
    const st = (await page.eval(P('starts'))).slice(n0);
    const beeps = st.filter(isBeep).length;
    /* carried on: the notes played again, and the map moving on (a note's scheduled end counts as a stop to the probe, so not live.size) */
    await sleep(1500);
    const playing = (await page.eval(P('starts'))).slice(n0).filter((x) => x.seconds > 1).length >= MUM.length &&
      (await page.eval(`+document.querySelector('#bubbles').dataset.now`)) > back.at + 1;
    await page.tap('#ex-close');
    /* the count-in sound back on, as it was */
    await openEx('mum');
    await page.tap('#ex-gear');
    if (!(await page.eval(`document.querySelector('#count-in-sound').checked`))) await page.tap('#count-in-sound');
    check('pause-gear', JSON.stringify(sheet) === JSON.stringify(['any-octave', 'count-in-sound', 'hear-yourself', 'monitor-volume']) && wasOn === true && closed &&
      back.counted && beeps === 0 && playing,
      `paused, the gear opens the sound sheet with ${sheet.join(', ')}; Count-in sound switched off there, the sheet closed ${closed}; ` +
      `Resume counted in ${back.counted} with ${beeps} beeps, and carried on ${playing}`);
  }

  /* 14a''''. Pause elsewhere: a part starts again from its own start; a breath count's clock waits */
  if (want('pause-others')) {
    await openEx('holdnote');
    await noSinger();
    await page.tap('#ex-start');
    await page.waitFor(P('starts.some((x) => x.seconds > 1)'), 12000);
    await sleep(1500);
    const partA = await text('#ex-part-at');
    await page.tap('#ex-pause');
    await page.waitFor(P('live.size === 0'), 2000);
    const quietPart = await quietNow();
    const n0 = await page.eval(P('starts.length'));
    await page.tap('#ex-pause');
    const back = await countThenNow();
    const partB = await text('#ex-part-at');
    const replayed = (await page.eval(P('starts'))).slice(n0).filter((x) => x.seconds > 1).length;
    await page.tap('#ex-close');
    await openEx('farinelli');
    await page.tap('#ex-start');
    await sleep(1600);
    await page.tap('#ex-pause');
    const c1 = await text('#ex-count'), p1 = await text('#ex-phase');
    await sleep(2200);
    const c2 = await text('#ex-count'), p2 = await text('#ex-phase');
    await page.tap('#ex-pause');
    await sleep(1300);
    const c3 = await text('#ex-count');
    await page.tap('#ex-close');
    check('pause-others', quietPart && back.counted && partA === partB && partA === fill(copy.train.noteOf, { i: 1, n: 10 }) && replayed >= 1 &&
      c1 === c2 && p1 === p2 && c3 !== c1,
      `Hold the note paused on "${partA}": quiet ${quietPart}; Resume counted in ${back.counted} and played "${partB}" again (${replayed} note); ` +
      `Breath counts paused at ${c1} (${p1}), 2 s later still ${c2}; carried on to ${c3}`);
  }

  /* 14b. The content round (Robert, 28 Oct): the straw line, Loo, a true octave leap, twisters that fit, Bratty Bay gone */
  if (want('content')) {
    const card = async (id) => {
      await openEx(id);
      return page.eval(`({ n: document.querySelectorAll('#pattern .pdash').length, pitches: [...document.querySelectorAll('#pattern .pdash')].map((d) => +d.dataset.pitch),
        needs: document.querySelector('#ex-needs')?.textContent ?? null, name: document.querySelector('#ex-name')?.textContent })`);
    };
    const sylsOn = async () => {
      await noSinger();
      await page.tap('#pattern-play');
      const seen = [];
      const end = Date.now() + 9000;
      while (Date.now() < end) {
        const i = await page.eval(`[...document.querySelectorAll('#pattern .pdash')].findIndex((d) => d.dataset.now)`);
        const s = await text('#pattern-syl');
        if (i >= 0 && s && seen[i] === undefined) seen[i] = s;
        if (i < 0 && seen.length && !(await page.eval(P('live.size > 0')))) break;
        await sleep(30);
      }
      await page.waitFor(P('live.size === 0'), 8000);
      return seen;
    };
    await openEx('straw');
    const straw = await page.eval(`document.querySelector('#ex-needs')?.textContent ?? null`);
    const loo = await card('loo');
    const leap = await card('octleap');
    const red = await card('redleather');
    const redSyls = await sylsOn();
    const ny = await card('uniqueny');
    const nySyls = await sylsOn();
    await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/bay');
    await page.waitFor(`!!document.querySelector('main p.problem')`, 5000);
    const bay = await text('main p.problem');
    const ok = straw === copy.ex.straw.needs && loo.name === 'Loo' && leap.n === 3 && leap.pitches[1] - leap.pitches[0] === 12 && leap.pitches[2] === leap.pitches[0] &&
      red.n === copy.ex.redleather.syls.length && JSON.stringify(redSyls) === JSON.stringify(copy.ex.redleather.syls) &&
      ny.n === copy.ex.uniqueny.syls.length && JSON.stringify(nySyls) === JSON.stringify(copy.ex.uniqueny.syls) && bay === copy.train.missing;
    check('content', ok, `straw: "${straw}"; "${loo.name}"; Octave leaps ${leap.pitches.join(', ')}; Red leather ${red.n} notes: ${redSyls.join(' ')}; ` +
      `Unique New York ${ny.n} notes: ${nySyls.join(' ')}; Bratty Bay: "${bay}"`);
  }

  /* 14c. Sing the interval, by a real voice (Robert, 28 Oct): a note plays, the
          shape is shown in words, the singer sings its notes from it; the
          map shows the whole turn at once */
  if (want('interval', 'interval-view', 'interval-level')) {
    await openEx('interval');
    await page.eval(`localStorage.setItem('rp.interval.level', '2')`);
    await openEx('interval');
    /* the targets worked out by the test itself: each note heard, moved by its shape's own notes */
    const DEGS = { step: [2], third: [4], fourth: [5], fifth: [7], chord: [4, 7], sixth: [9], seventh: [11], octave: [12] };
    const WORDS = { step: 'A step up', third: 'A third up', fifth: 'A fifth up', chord: 'Up the chord: 1, 3, 5', octave: 'An octave up' };
    const round = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.round)`);
    const played = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.played)`);
    const shapes = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.shapes)`);
    const want2 = shapes.flatMap((sh, k) => (DEGS[sh.id] ?? [NaN]).map((d) => played[k][0] + (sh.down ? -d : d)));
    const targets = round.map(([, t, d], i) => ({ m: want2[i], t, d }));
    const fits = want2.length === round.length && round.every(([m], i) => m === want2[i]);
    /* each turn: the note heard, then its shape's notes in order */
    let at = 0;
    const turns = shapes.map((sh, k) => {
      const n = (DEGS[sh.id] ?? []).length, notes = round.slice(at, at + n);
      at += n;
      return { k, n, from: played[k][1], ms: [played[k][0], ...notes.map(([m]) => m)], end: Math.max(...notes.map(([, t, d]) => t + d)) };
    });
    if (want('interval', 'interval-view')) {
      await singer(sing(targets));
      await page.tap('#ex-start');
      const shown = new Set();
      const views = [];
      const end = Date.now() + exLength(targets) * 1000 + 15000;
      while (Date.now() < end && !(await page.eval(`!!document.querySelector('#ex-result')`))) {
        const v = await page.eval(`(() => { const d = document.querySelector('#bubbles')?.dataset || {}; return { j: document.querySelector('#ex-jump')?.textContent || '',
          now: +d.now, t0: +d.viewT0, t1: +d.viewT1, lo: +d.viewLo, hi: +d.viewHi, vis: +d.visible, heard: +d.heardShown,
          count: !!document.querySelector('#count-in') }; })()`);
        if (v.j) shown.add(v.j);
        if (!v.count) views.push(v);
        await sleep(200);
      }
      const right = await scoreOf();
      /* the view fits the turn being sung: from the note heard to the last note of the shape, every note in it */
      const heardAt = (k) => turns[k].from;
      const judged = views.filter((v) => Number.isFinite(v.now)).map((v) => {
        let k = 0;
        turns.forEach((x) => { if (heardAt(x.k) <= v.now + 0.01) k = x.k; });
        const x = turns[k], settled = v.now - heardAt(k) > 0.8;
        return v.t0 <= heardAt(k) && v.t1 >= x.end && v.vis === x.n && v.heard === 1 &&
          (!settled || (v.lo <= Math.min(...x.ms) && v.hi >= Math.max(...x.ms)));
      });
      const fitted = judged.filter(Boolean).length;
      if (want('interval')) {
        await openEx('interval');
        await singer(sing(targets, { shift: 3 }));
        await page.tap('#ex-start');
        await result(exLength(targets) * 1000 + 15000);
        const wrong = await scoreOf();
        const names = [...shown];
        check('interval', fits && right && right.n === targets.length && right.hits >= Math.ceil(0.8 * right.n) && wrong && wrong.hits <= Math.floor(0.2 * wrong.n) &&
          names.length >= 2 && names.every((n) => Object.values(WORDS).includes(n)) && shapes.every((sh) => sh.id in WORDS && !sh.down),
          `ten shapes at Intermediate (${shapes.map((x) => x.id).join(', ')}), their notes as the test works them out ${fits}; sung by a real voice: ` +
          `"${right ? right.hits + ' of ' + right.n : '-'}"; three semitones off: "${wrong ? wrong.hits + ' of ' + wrong.n : '-'}"; shown: ${names.join(', ')}`);
      }
      if (want('interval-view')) {
        check('interval-view', judged.length >= 20 && fitted >= 0.9 * judged.length,
          `${fitted} of ${judged.length} looks while singing showed the whole turn: the note heard (hollow) and every note of the shape, from its start to its end`);
      }
    }
    if (want('interval-level')) {
      await openEx('interval');
      await page.tap('#ex-gear');
      await page.tap('#level-3');
      const r3 = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.shapes)`);
      await openEx('interval');
      await page.tap('#ex-gear');
      const kept = await page.eval(`document.querySelector('#level-3').getAttribute('aria-checked')`);
      const r3b = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.shapes)`);
      await page.tap('#level-2');
      check('interval-level', kept === 'true' && r3.length === 10 && r3b.length === 10,
        `the level picked in the sound sheet: Advanced remembered ${kept === 'true'}; a round of ${r3b.length} shapes: ${r3b.map((x) => x.id + (x.down ? ' down' : '')).join(', ')}`);
    }
  }

  /* 14d. Match the note, by a real voice */
  if (want('match')) {
    await openEx('match');
    const round = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.round)`);
    const targets = round.map(([m, t, d]) => ({ m, t, d }));
    await singer(sing(targets));
    await page.tap('#ex-start');
    await result(exLength(targets) * 1000 + 15000);
    const right = await scoreOf();
    check('match', right && right.n === 10 && right.hits >= 8 && targets.every((n) => n.m >= RANGE.lo + 1 && n.m <= RANGE.hi - 1),
      `ten notes in the range, sung back by a real voice: "${right ? right.hits + ' of ' + right.n : '-'}"`);
  }

  /* 14e. Hold the note, by a real voice: each note waits for Next */
  if (want('hold-note')) {
    await openEx('holdnote');
    const parts = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.parts)`);
    let waited = true;
    for (let i = 0; i < parts.length; i++) {
      await singer(sing([{ m: parts[i], t: 0, d: 6.4 }]));
      await page.tap(i === 0 ? '#ex-start' : '#ex-next-part');
      await page.waitFor(`!!document.querySelector('#ex-next-part')`, 20000);
      if (i === 0) {
        await sleep(2000);
        waited = await page.eval(`!!document.querySelector('#ex-next-part') && window.__probe.live.size === 0`);
      }
    }
    await page.tap('#ex-next-part');
    await result(5000);
    const s = await scoreOf();
    check('hold-note', s && s.n === 10 && s.hits >= 7 && waited, `ten notes held by a real voice: "${await text('#ex-score')}"; after each, it waited for Next ${waited}`);
  }

  /* 14f. Long soft notes (Stemple's four steps), by a real voice: the holds timed */
  if (want('long-soft')) {
    await openEx('vfe');
    const parts = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.parts)`);
    const lower = parts[0] === 53;
    /* the readout while holding (Robert, 28 Oct): the note being sung and how close */
    const readouts = async (ms) => {
      const seen = [];
      const end = Date.now() + ms;
      while (Date.now() < end && !(await page.eval(`!!document.querySelector('#ex-next-part')`))) {
        const r = await page.eval(`(() => { const r = document.querySelector('#ex-readout'); return r ? r.querySelector('strong').textContent + ' ' + r.querySelector('span').textContent : null; })()`);
        if (r) seen.push(r);
        await sleep(100);
      }
      return seen;
    };
    let readOk = 0, longs = 0;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] == null) {
        /* a slide: sung from the moment the mic opens, after the count-in */
        await singer(sing([{ m: HOME, t: 0, d: 2 }], { lead: 3.4 }), true);
      } else {
        await singer(sing([{ m: parts[i], t: 1.5, d: 3 }]));
      }
      await page.tap(i === 0 ? '#ex-start' : '#ex-next-part');
      const seen = await readouts(25000);
      if (parts[i] != null) {
        longs++;
        if (seen.includes(keyNameOf(parts[i]) + ' ' + copy.train.readOn)) readOk++;
      }
    }
    await page.tap('#ex-next-part');
    await result(5000);
    const h1 = await text('#ex-held1'), h4 = await text('#ex-held4');
    const secs = (s) => [...(s || '').matchAll(/(\d+\.\d) s/g)].map((m) => +m[1]);
    const a = secs(h1), b = secs(h4);
    /* sung a little high, then a little low: the readout says so */
    const offBy = async (shift) => {
      await openEx('vfe');
      await singer(sing([{ m: parts[0], t: 1.5, d: 3 }], { shift }));
      await page.tap('#ex-start');
      const seen = await readouts(7000);
      await page.tap('#ex-close');
      return seen;
    };
    const high = await offBy(0.8), low = await offBy(-0.8);
    const highOk = high.includes(keyNameOf(parts[0] + 1) + ' ' + copy.train.readHigh), lowOk = low.includes(keyNameOf(parts[0] - 1) + ' ' + copy.train.readLow);
    check('long-soft', lower && parts.length === 16 && a.length === 2 && b.length === 10 && [...a, ...b].every((x) => Math.abs(x - 3) <= 0.7) &&
      readOk === longs && highOk && lowOk,
      `for this range, the lower notes ${lower} (F3, from C3); ${parts.length} parts; "${h1}"; "${h4}"; ` +
      `the readout said the note and "${copy.train.readOn}" on ${readOk} of ${longs} holds; sung high: "${high.slice(-1)[0]}" ${highOk}; sung low: "${low.slice(-1)[0]}" ${lowOk}`);
  }

  /* 14g. Bratty Bay's saved results stay in the results list */
  if (want('bay-results')) {
    await go('/train');
    await page.eval(`localStorage.setItem('rp.results', JSON.stringify([{ kind: 'practice', label: 'Bratty Bay', app_ex_id: 'bay', score: 9, out_of: 10, pct: 90,
      created_at: '2026-10-20T10:00:00Z', online: false }, ...JSON.parse(localStorage.getItem('rp.results') || '[]')]))`);
    await openEx('straw');
    await page.tap('#ex-start');
    await sleep(500);
    await page.tap('#ex-done');
    await page.waitFor(`!!document.querySelector('#ex-saved')`, 8000);
    const kept = await page.eval(`JSON.parse(localStorage.getItem('rp.results') || '[]').filter((r) => r.app_ex_id === 'bay')`);
    check('bay-results', kept.length === 1 && kept[0].score === 9, `a Bratty Bay result saved before: still in the results list after a new one ${kept.length === 1}`);
  }

  /* 15. Saved on the phone straight away, with only what was measured */
  if (want('progress-phone')) {
    const kept = await page.eval(`JSON.parse(localStorage.getItem('rp.results') || '[]')`);
    const mum = kept.find((r) => r.app_ex_id === 'mum' && r.out_of != null);
    const straw = kept.find((r) => r.app_ex_id === 'straw');
    check('progress-phone', !!mum && mum.score >= 0 && mum.out_of === MUM.length && mum.pct === Math.round((100 * mum.score) / mum.out_of) && !!straw && straw.score == null,
      `kept on the phone: ${kept.length}; Mum ${mum ? mum.score + ' of ' + mum.out_of + ', ' + mum.pct + '%' : 'missing'}; Straw with no number ${!!straw && straw.score == null}`);
  }

  /* 16. Signed in as the test singer: the result reaches the account (RP_ONLINE=1) */
  if (want('progress-online') && ONLINE) {
    await signIn();
    const t0 = new Date(Date.now() - 5000).toISOString();
    await openEx('straw');
    await page.tap('#ex-start');
    await sleep(500);
    await page.tap('#ex-done');
    await page.waitFor(`!!document.querySelector('#ex-saved')`, 10000);
    const saidWhere = await text('#ex-saved');
    const token = singerToken();
    const rows = JSON.parse(execFileSync('curl', ['-sS', SUPABASE_URL + `/rest/v1/results?select=app_ex_id,kind,label,score,created_at&app_ex_id=eq.straw&created_at=gte.${encodeURIComponent(t0)}`,
      '-H', 'apikey: ' + SUPABASE_KEY, '-H', 'authorization: Bearer ' + token], { encoding: 'utf8' }));
    check('progress-online', saidWhere === copy.train.saved && rows.length >= 1 && rows[0].label === copy.ex.straw.name && rows[0].score == null,
      `said "${saidWhere}"; on the account: ${rows.length} row(s) ${rows[0] ? JSON.stringify({ label: rows[0].label, kind: rows[0].kind, score: rows[0].score }) : ''}`);
  }

  /* 17. An exercise's take, signed in as the test singer (RP_ONLINE=1): saved
         with no signal it stays on the phone; back online it goes up, into
         the takes table with its kind set to exercise, private to the singer */
  if (want('ex-take-offline', 'ex-take-online') && ONLINE) {
    await signIn();
    await openEx('mum');
    await singer(sing(MUM));
    await page.tap('#ex-start');
    await page.waitFor(P('starts.some((x) => x.seconds > 1)'), 12000);
    const NET = (offline) => page.c.send('Network.emulateNetworkConditions', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await NET(true);
    await result(exLength(MUM) * 1000 + 12000);
    await page.tap('#ex-take-save');
    await sleep(3000);
    const t = (await exTakes('mum'))[0];
    await page.eval(`location.hash = '#/train/ex/mum/takes'`);
    await page.waitFor(`!!document.querySelector('.take-row')`, 5000);
    const offRow = await page.eval(`document.querySelector('.take-row[data-take=${JSON.stringify(t?.id ?? '')}] .take-where')?.textContent ?? null`);
    if (want('ex-take-offline')) {
      check('ex-take-offline', !!t && !t.path && offRow === copy.takes.onPhone, `saved with no signal: on the phone ${!!t}, online ${!!t?.path}; listed as "${offRow}"`);
    }
    await NET(false);
    await page.waitFor(`document.querySelector('.take-row[data-take=${JSON.stringify(t?.id ?? '')}] .take-where')?.textContent === ${JSON.stringify(copy.takes.saved)}`, 60000);
    const up = (await exTakes('mum')).find((x) => x.id === t?.id);
    if (want('ex-take-online')) {
      const token = singerToken();
      const rows = up?.path ? JSON.parse(execFileSync('curl', ['-sS', SUPABASE_URL + `/rest/v1/takes?select=kind,coach_id,title,notes&audio_path=eq.${encodeURIComponent(up.path)}`,
        '-H', 'apikey: ' + SUPABASE_KEY, '-H', 'authorization: Bearer ' + token], { encoding: 'utf8' })) : [];
      const status = (url, auth) => execFileSync('curl', ['-sS', '-o', '/dev/null', '-w', '%{http_code}', url, '-H', 'apikey: ' + SUPABASE_KEY,
        ...(auth ? ['-H', 'authorization: Bearer ' + auth] : [])], { encoding: 'utf8' });
      const open = up?.path ? status(`${SUPABASE_URL}/storage/v1/object/public/takes/${up.path}`) : '-';
      const own = up?.path ? status(`${SUPABASE_URL}/storage/v1/object/authenticated/takes/${up.path}`, token) : '-';
      await page.eval(`location.hash = '#/sing/learn'`);
      await page.waitFor(`!!document.querySelector('#your-takes') || !!document.querySelector('main h1')`, 8000);
      await sleep(1500);
      const inSongs = await page.eval(`!!document.querySelector('[data-take=${JSON.stringify(t?.id ?? '')}]')`);
      const r = rows[0];
      check('ex-take-online', rows.length === 1 && r.kind === 'exercise' && r.coach_id === null && r.title === copy.ex.mum.name && r.notes?.app === 'train' &&
        r.notes?.exercise === 'mum' && r.notes?.piano?.length === MUM.length && open !== '200' && own === '200' && !inSongs,
        `back online it went up: ${rows.length} row ${r ? JSON.stringify({ kind: r.kind, coach: r.coach_id, title: r.title, app: r.notes?.app, exercise: r.notes?.exercise }) : ''}; ` +
        `the recording without signing in: ${open}, as the singer: ${own}; in the Sing tab's song takes ${inSongs}`);
    }
  }

  check('no-page-errors', page.errors.length === 0, page.errors.join(' | '));
} catch (e) {
  const why = 'the test stopped: ' + String(e.message || e).split('\n')[0];
  const said = new Set(results.map((r) => r.name));
  for (const name of ALL) if (want(name) && !said.has(name) && (!['progress-online', 'ex-take-offline', 'ex-take-online'].includes(name) || ONLINE)) check(name, false, why);
} finally {
  /* the exercise takes this run put on the test account, and only those, deleted (RULEBOOK: delete test takes after live tests) */
  if (ONLINE) {
    try {
      const token = singerToken();
      const H = ['-H', 'apikey: ' + SUPABASE_KEY, '-H', 'authorization: Bearer ' + token];
      const mine = JSON.parse(execFileSync('curl', ['-sS', SUPABASE_URL + `/rest/v1/takes?select=id,audio_path&kind=eq.exercise&created_at=gte.${encodeURIComponent(RUN_FROM)}`, ...H], { encoding: 'utf8' }));
      if (mine.length) {
        execFileSync('curl', ['-sS', '-X', 'DELETE', SUPABASE_URL + `/rest/v1/takes?id=in.(${mine.map((x) => x.id).join(',')})`, ...H]);
        const paths = [...new Set(mine.map((x) => x.audio_path).filter(Boolean))];
        execFileSync('curl', ['-sS', '-X', 'DELETE', SUPABASE_URL + '/storage/v1/object/takes', ...H, '-H', 'content-type: application/json',
          '--data', JSON.stringify({ prefixes: paths })]);
      }
      console.log(`cleaned up: ${mine.length} test take row(s) of exercises from this run`);
    } catch (e) {
      console.log('FAIL cleanup: the test takes could not be deleted: ' + String(e.message || e).split('\n')[0]);
    }
  }
  await env.close();
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} checks FAILED` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
