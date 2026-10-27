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

const ALL = ['train-tab', 'today', 'tab-bar', 'category', 'routines-page', 'preview', 'articulation', 'syllables', 'sound-sheet', 'more-about', 'count-in-sound', 'start-only', 'singing-screen',
  'ladder-sung', 'ladder-wrong', 'any-octave', 'hold', 'timed', 'cycle', 'guided', 'range-check', 'range-used', 'mic-refused', 'close', 'routine',
  'progress-phone', 'progress-online', 'no-page-errors'];
/* the old app's groups, and how many exercises each has (CHECKLIST 5) */
const GROUPS = { warmup: 4, breath: 5, tone: 10, agility: 5, range: 4, words: 7 };
const COLOURS = { warmup: 'warmup', breath: 'breath', tone: 'tone', agility: 'pitch', range: 'pitch', words: 'words' };
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
          const weight = parseFloat(getComputedStyle(svg).strokeWidth) === 2;
          return lines.length === 5 && faint && dots.length === 5 && solid && heights.size === 5 && curve && weight ? 'run'
            : 'wrong (' + JSON.stringify({ lines: lines.length, faint, dots: dots.length, solid, heights: heights.size, curve, weight }) + ')';
        })(),
        rows: document.querySelectorAll('.ex-row').length,
        tabs: !!document.querySelector('.tabs') };
    })()`);
    if (want('train-tab')) {
      /* one colour means one thing: five colours for six groups, Range sharing Agility's blue and no other two alike */
      const [warm, breath, tone, agility, range, words] = t.shades;
      const distinct = new Set([warm, breath, tone, agility, words]).size === 5 && range === agility;
      check('train-tab', JSON.stringify(t.order) === JSON.stringify(['h1', 'today', 'cat-cards']) && t.label === copy.train.today && t.name === copy.routineNames.daily &&
        t.length === fill(copy.train.minsSteps, { mins: 9, n: 7 }) && t.start === copy.train.start && t.more === copy.train.routines &&
        JSON.stringify(t.cats) === JSON.stringify(Object.keys(GROUPS)) && JSON.stringify(t.colours) === JSON.stringify(Object.values(COLOURS)) &&
        distinct && t.pictures === 6 && t.agility === 'run' && t.rows === 0 && t.tabs,
        `on the page: ${t.order.join(', ')}; "${t.label}": "${t.name}", "${t.length}", "${t.start}", "${t.more}"; cards ${t.cats.join(', ')} in ${t.colours.join(', ')} (five colours, Range as Agility ${distinct}), ${t.pictures} with a picture, ` +
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
    /* a renamed one keeps the old app's name there, and only there (Robert, 27 Oct) */
    await openEx('vfe');
    const onPage = await page.eval(`document.querySelector('main').textContent.includes('Vocal Function')`);
    await page.tap('#ex-more');
    await page.waitFor(`!!document.querySelector('#ex-about')`, 3000);
    const aka = await text('#ex-aka');
    check('more-about', !before && after && JSON.stringify(a.labels) === JSON.stringify([copy.train.why, copy.train.watchFor, copy.train.care]) &&
      a.text.includes(copy.about.mum.why) && a.text.includes(copy.about.mum.watch) && a.text.includes(copy.about.mum.care) && gone &&
      !onPage && aka === fill(copy.train.alsoCalled, { name: 'Vocal Function Exercises' }),
      `closed at first ${!before}; opened ${after} with ${a.labels.join(', ')}, the old app's words ${a.text.includes(copy.about.mum.why)}; closed again ${gone}; ` +
      `"${copy.ex.vfe.name}": the old name off the page ${!onPage}, and in More about this "${aka}"`);
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

  /* 3. Robert, 1 Oct: nothing starts until Start; the 3-2-1 count-in; the close button the only control */
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
    check('start-only', before.s === 0 && before.gum === 0 && ['3', '2', '1'].every((x) => counts.has(x)) && JSON.stringify(controls) === JSON.stringify(['ex-close']),
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
      return { top: run.top, height: run.height, inner: innerHeight, canvas: c.height, ...cv.dataset,
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
    check('singing-screen', a.top <= 1 && a.height >= a.inner - 2 && a.canvas >= 0.6 * a.inner && +a.visible > 0 && a.labelled === a.visible && +a.names >= 6 &&
      +a.bubble >= 40 && +a.nowBubble > +a.bubble && a.dots === rungs && a.now === 0 && a.done === 0 && b.done === 1 && b.now === 1 && zoomed && glided,
      `fills the screen: top ${a.top}, ${a.height} of ${a.inner} px, the map ${a.canvas} px; ${a.labelled} of ${a.visible} bubbles with their syllable; ` +
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
    const t0 = new Date(Date.now() - 5000).toISOString();
    await openEx('straw');
    await page.tap('#ex-start');
    await sleep(500);
    await page.tap('#ex-done');
    await page.waitFor(`!!document.querySelector('#ex-saved')`, 10000);
    const saidWhere = await text('#ex-saved');
    const token = JSON.parse(execFileSync('curl', ['-sS', '-X', 'POST', SUPABASE_URL + '/auth/v1/token?grant_type=password', '-H', 'apikey: ' + SUPABASE_KEY,
      '-H', 'content-type: application/json', '--data', JSON.stringify({ email: EMAIL, password: password(EMAIL) })], { encoding: 'utf8' })).access_token;
    const rows = JSON.parse(execFileSync('curl', ['-sS', SUPABASE_URL + `/rest/v1/results?select=app_ex_id,kind,label,score,created_at&app_ex_id=eq.straw&created_at=gte.${encodeURIComponent(t0)}`,
      '-H', 'apikey: ' + SUPABASE_KEY, '-H', 'authorization: Bearer ' + token], { encoding: 'utf8' }));
    check('progress-online', saidWhere === copy.train.saved && rows.length >= 1 && rows[0].label === copy.ex.straw.name && rows[0].score == null,
      `said "${saidWhere}"; on the account: ${rows.length} row(s) ${rows[0] ? JSON.stringify({ label: rows[0].label, kind: rows[0].kind, score: rows[0].score }) : ''}`);
  }

  check('no-page-errors', page.errors.length === 0, page.errors.join(' | '));
} catch (e) {
  const why = 'the test stopped: ' + String(e.message || e).split('\n')[0];
  const said = new Set(results.map((r) => r.name));
  for (const name of ALL) if (want(name) && !said.has(name) && (name !== 'progress-online' || ONLINE)) check(name, false, why);
} finally {
  await env.close();
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} checks FAILED` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
