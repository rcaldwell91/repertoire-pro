/* The Train tab, on the built app, in a real Chrome made to behave like
   Chrome on Android (tests/harness.mjs). The singer is a real voice: one
   steady sung note from the separator's real output for one song
   (RP_SPLIT), found by the test's own pitch reader and shifted onto each
   note an exercise asks for (tests/voice.mjs), given to the mic the moment
   the speaker plays the exercise (the mirror). Never a tone.

   Prints one line per check; exits 1 if any fails. ONLY=name,name runs
   some; APP_DIR points it at another build. RP_ONLINE=1 also checks a
   result reaches the account, signed in as the test singer (RULEBOOK 1d). */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './chrome.mjs';
import { ANDROID, MIRROR, PROBE, serve } from './harness.mjs';
import { pcm, singNotes, steadyNote } from './voice.mjs';
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

const ALL = ['train-tab', 'tab-bar', 'preview', 'start-only', 'ladder-sung', 'ladder-wrong', 'any-octave', 'hold', 'timed', 'cycle',
  'guided', 'range-check', 'range-used', 'mic-refused', 'close', 'routine', 'progress-phone', 'progress-online', 'no-page-errors'];
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
  /* 1. Train: the daily routine on top, your range, the groups in their colours, every exercise */
  if (want('train-tab', 'tab-bar')) {
    await go('/train');
    await page.goto(URL_APP + '?load=' + ++loads + '#/train');
    await page.waitFor(`!!document.querySelector('#daily')`, 8000);
    const t = await page.eval(`(() => {
      const cats = [...document.querySelectorAll('.train-cat')];
      const col = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
      const rgb = (c) => { const d = document.createElement('div'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v; };
      return {
        firstIsRoutine: document.querySelector('main').firstElementChild.nextElementSibling?.id === 'daily',
        steps: document.querySelectorAll('#daily .routine-steps li').length,
        cats: cats.map((c) => c.id.replace('cat-', '')),
        colours: cats.map((c) => getComputedStyle(c.querySelector('h2')).color === rgb(col('--' + c.dataset.colour)) ? c.dataset.colour : 'wrong'),
        exercises: document.querySelectorAll('.ex-row').length,
        range: document.querySelector('#range-value')?.textContent,
        tabs: !!document.querySelector('.tabs') };
    })()`);
    if (want('train-tab')) {
      check('train-tab', t.firstIsRoutine && t.steps === 7 && JSON.stringify(t.cats) === JSON.stringify(['warmup', 'breath', 'tone', 'agility', 'range']) &&
        JSON.stringify(t.colours) === JSON.stringify(['warmup', 'breath', 'tone', 'pitch', 'pitch']) && t.exercises === 28 && /\S/.test(t.range || ''),
        `daily routine first ${t.firstIsRoutine} with ${t.steps} steps; groups ${t.cats.join(', ')} in ${t.colours.join(', ')}; ${t.exercises} exercises; range "${t.range}"`);
    }
    if (want('tab-bar')) {
      await page.tap('#ex-mum');
      await page.waitFor(`!!document.querySelector('#ex-start')`, 5000);
      const hidden = await page.eval(`!document.querySelector('.tabs')`);
      await page.tap('.back');
      await page.waitFor(`!!document.querySelector('#daily')`, 5000);
      const back = await page.eval(`!!document.querySelector('.tabs')`);
      check('tab-bar', t.tabs && hidden && back, `on Train ${t.tabs}; hidden on an exercise ${hidden}; back on Train ${back}`);
    }
  }

  /* 2. The preview: name, tags, goal, how, a big Start; the notes play only on a tap, with no mic */
  if (want('preview')) {
    await openEx('mum');
    const v = await page.eval(`({ name: document.querySelector('#ex-name')?.textContent, tags: [...document.querySelectorAll('#ex-tags .tag')].map((t) => t.textContent),
      goal: document.querySelector('#ex-goal')?.textContent, how: document.querySelector('#ex-how')?.textContent,
      start: document.querySelector('#ex-start')?.textContent, started: window.__probe.started, gum: window.__probe.gum })`);
    await sleep(1500);
    const still = await page.eval(P('started'));
    await page.tap('#ex-hear');
    const played = await page.waitFor(P('started > 0'), 5000);
    const gum = await page.eval(P('gum'));
    await page.tap('#ex-hear');
    const stopped = await page.waitFor(`window.__probe.live.size === 0`, 3000);
    check('preview', v.name === copy.ex.mum.name && v.tags.join('|') === [copy.cats.tone, copy.levels[1], copy.train.tagQuiet, copy.train.tagPitch].join('|') &&
      v.goal === copy.ex.mum.goal && v.how === copy.ex.mum.how && v.start === copy.train.start && v.started === 0 && still === 0 && played && gum === 0 && stopped,
      `"${v.name}", tags ${v.tags.join(' / ')}; goal "${v.goal}"; how "${v.how}"; nothing played before the tap (${still}); the notes on a tap ${played}, mic asked ${gum}; a second tap stops them ${stopped}`);
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
      if (await page.eval(P('live.size > 0'))) break;
      await sleep(60);
    }
    const controls = await page.eval(`[...document.querySelectorAll('#ex-run button')].map((b) => b.id)`);
    await page.tap('#ex-close');
    check('start-only', before.s === 0 && before.gum === 0 && ['3', '2', '1'].every((x) => counts.has(x)) && JSON.stringify(controls) === JSON.stringify(['ex-close']),
      `before Start: notes ${before.s}, mic asked ${before.gum}; counted ${[...counts].join(', ')}; controls while singing: ${controls.join(', ')}`);
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
    if (await page.eval(`document.querySelector('#any-octave').checked`)) await page.tap('#any-octave');
    await singer(low);
    await page.tap('#ex-start');
    await result(exLength(MUM) * 1000 + 12000);
    const exact = await scoreOf();
    await openEx('mum');
    await page.tap('#any-octave');
    await singer(low);
    await page.tap('#ex-start');
    await result(exLength(MUM) * 1000 + 12000);
    const any = await scoreOf();
    await page.tap('#any-octave');
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
    await page.goto(URL_APP + '?load=' + ++loads + '#/train');
    await page.waitFor(`!!document.querySelector('#range-value')`, 5000);
    const before = await text('#range-value');
    await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/rangecheck');
    await page.waitFor(`!!document.querySelector('#ex-start')`, 5000);
    await singer(voice, true);
    await page.tap('#ex-start');
    const shown = await result(30000);
    const kept = await page.eval(`JSON.parse(localStorage.getItem('rp.range') || 'null')`);
    const said = await text('#ex-score');
    await page.goto(URL_APP + '?load=' + ++loads + '#/train');
    await page.waitFor(`!!document.querySelector('#range-value')`, 5000);
    const after = await text('#range-value');
    if (want('range-check')) {
      check('range-check', before === copy.train.notMeasured && shown && kept && Math.abs(kept.lo - lowM) <= 1 && Math.abs(kept.hi - highM) <= 1 && kept.by === 'test' &&
        after && after !== copy.train.notMeasured,
        `before: "${before}"; sung ${lowM} low and ${highM} high: kept ${kept ? kept.lo + '-' + kept.hi + ' by ' + kept.by : 'nothing'}; said "${said}"; Train now "${after}"`);
    }
    if (want('range-used') && kept) {
      /* the ladder now climbs that range: its first note is one above the bottom */
      await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/mum');
      await page.waitFor(`!!document.querySelector('#ex-start')`, 5000);
      const n = await page.eval(P('starts.length'));
      await noSinger();
      await page.tap('#ex-hear');
      await page.waitFor(P(`starts.length > ${n}`), 5000);
      const first = await page.eval(`(() => { const s = window.__probe.starts; return s[${n}]; })()`);
      await page.tap('#ex-hear');
      const want1 = 440 * 2 ** ((kept.lo + 1 - 69) / 12);
      /* the note heard: the sample it was played on, as measured, at the rate it was played */
      const samples = Object.entries(JSON.parse(readFileSync(join(REPO, 'audio/piano/notes.json'), 'utf8'))).map(([m, hz]) => ({ m: +m, hz }));
      const s = samples.reduce((a, b) => (Math.abs(b.m - (kept.lo + 1)) < Math.abs(a.m - (kept.lo + 1)) ? b : a));
      const heardHz = first ? s.hz * first.rate : null;
      check('range-used', heardHz != null && Math.abs(12 * Math.log2(heardHz / want1)) < 0.05,
        `the range kept ${kept.lo}-${kept.hi}: the first note played at ${heardHz ? heardHz.toFixed(1) : '?'} Hz, one above the bottom is ${want1.toFixed(1)} Hz`);
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
      await p.waitFor(`!!document.querySelector('#daily')`, 8000);
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
    await page.waitFor(P('quietAt !== null'), 2000);
    const ms = await page.eval(`Math.round(window.__probe.quietAt - window.__probe.actionAt)`);
    const preview = await page.eval(`!!document.querySelector('#ex-start')`);
    check('close', ms <= 300 && preview, `silence and the mic closed in ${ms} ms; back to the preview ${preview}`);
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
