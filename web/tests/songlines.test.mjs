/* Robert's song features (approved 16 Nov, built 27 Nov), on the built app,
   in a real Chrome made to behave like a phone, against the real database
   and takes store, with the two permanent test accounts only (RULEBOOK 1d):
   rp-test@example.com sings, rp-coach@example.com is its coach.
     - Practise a line: a line picked, three steps each sung twice, each
       pass scored, the next line or a longer stretch.
     - Speak it, then sing it: two recordings, back to back, nothing scored.
     - Your first take is your Before: marked, heard next to a later take
       with both lines on the map, another one chosen (on the account).
   Real voices only: the song on the phone is the separator's real output
   for one song (RP_SPLIT), and the singing is the mirror (tests/harness.mjs)
   - a real recording given to the mic the moment the speaker plays it,
   with phone-like delays; "sung off" is the same singer, seven seconds
   further on in the song than what plays.

   Every take and Before a run makes is deleted by the run; no other take
   is ever touched. Prints one line per check; exits 1 if any fails.
   ONLY=name,name runs some; APP_DIR points it at another build. */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './chrome.mjs';
import { MIRROR, PROBE, serve } from './harness.mjs';
import { strayWords } from './checks.mjs';
import { copy, fill } from '../src/core/copy.ts';
import { SUPABASE_KEY, SUPABASE_URL } from '../src/data/config.ts';
import { COACH_EMAIL, EMAIL, password } from './test-account.mjs';
import { clearTestTakes } from './clear-test-takes.mjs';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (...names) => !ONLY.length || names.some((n) => ONLY.includes(n));
const QUIET_MS = 300;
/* SHOTS=dir: pictures of the pages for the report, the whole page at a phone's size */
const SHOTS = process.env.SHOTS || '';
const PREFIX = process.env.RP_SPLIT || '';
const PARTS = ['voice', 'music', 'voice30', 'music30'];
if (!PARTS.every((p) => existsSync(`${PREFIX}-${p}.mp3`))) {
  console.log('FAIL setup: RP_SPLIT must name the separator\'s output for one song (PREFIX-voice.mp3 and so on), kept outside the repo');
  process.exit(1);
}

const ALL = ['line-door', 'line-pick', 'line-twice', 'line-scored', 'line-off', 'line-each-pass', 'line-steps', 'line-stop-early', 'line-leave', 'line-next',
  'speak-door', 'speak-pair', 'speak-back-to-back', 'speak-kept', 'speak-no-score', 'speak-no-mic',
  'before-first', 'before-compare', 'before-hear-either', 'before-apart', 'before-choose', 'before-private', 'before-new-phone', 'before-falls-back',
  'pages-360', 'pages-words', 'no-page-errors'];
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
}

/* the database as each test account sees it, through its own sign-in */
function rest(method, path, token, body, extra = []) {
  const args = ['-sS', '-X', method, SUPABASE_URL + path, '-H', 'apikey: ' + SUPABASE_KEY, '-H', 'authorization: Bearer ' + (token || SUPABASE_KEY),
    '-H', 'content-type: application/json', '-w', '\n%{http_code}', ...extra];
  if (body) args.push('--data', JSON.stringify(body));
  const out = execFileSync('curl', args, { encoding: 'utf8' });
  const i = out.lastIndexOf('\n');
  let json = null;
  try { json = JSON.parse(out.slice(0, i)); } catch { /* not JSON */ }
  return { status: +out.slice(i + 1), json };
}
const tokenOf = (email) => rest('POST', '/auth/v1/token?grant_type=password', null, { email, password: password(email) }).json.access_token;
const singerToken = tokenOf(EMAIL);
const coachToken = tokenOf(COACH_EMAIL);
const singerId = JSON.parse(Buffer.from(singerToken.split('.')[1], 'base64url')).sub;
const TITLE = 'Line test song';
const befores = (token) => rest('GET', `/rest/v1/song_befores?select=take_id,student_id&song_title=eq.${encodeURIComponent(TITLE)}`, token);
const clearBefores = () => rest('DELETE', `/rest/v1/song_befores?student_id=eq.${singerId}&song_title=eq.${encodeURIComponent(TITLE)}`, singerToken);

clearTestTakes();
clearBefores();
const { server, ORIGIN, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: `${PREFIX}-voice30.mp3`, allowMic: false, online: true });
const allowMic = (on) => env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: on ? 'granted' : 'denied', origin: ORIGIN });
await allowMic(true);
const { page } = env;
await page.addInitScript(MIRROR);
await page.addInitScript(PROBE);
const S = (expr) => `window.__probe.${expr}`;
const ID = 'line-test-song';
let loads = 0;
const go = async (hash, ready) => {
  await page.goto(URL_APP + '?load=' + ++loads + '#' + hash);
  await page.waitFor(ready, 10000);
};
const openSong = () => go('/sing/learn/song/' + ID, `!!document.querySelector('#song-play')`);
const openLine = () => go('/sing/learn/song/' + ID + '/line', `!!document.querySelector('#line-which')`);
const openSpeak = () => go('/sing/learn/song/' + ID + '/speak', `!!document.querySelector('#line-which')`);
const text = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? null`);
const idb = (store, body) => page.eval(`(async () => {
  const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app'); q.onsuccess = () => ok(q.result); q.onerror = no; });
  const all = await new Promise((ok) => { const q = db.transaction(${JSON.stringify(store)}).objectStore(${JSON.stringify(store)}).getAll(); q.onsuccess = () => ok(q.result); });
  db.close();
  return (${body})(all);
})()`);
const takesKept = () => idb('takes', `(all) => all.filter((t) => t.songId === ${JSON.stringify(ID)}).map((t) => ({ id: t.id, created: t.created, songAt: t.songAt, seconds: t.seconds, path: t.path || null }))`);
/** a range input moved to a value, as a finger lets go of it there */
const slide = (sel, v) => page.eval(`(() => { const r = document.querySelector(${JSON.stringify(sel)}); r.focus();
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, ${v});
  r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); })()`);
async function quietWithin() {
  await page.waitFor(S('quietAt !== null'), 2000);
  return page.eval(`(() => { const P = window.__probe; return { quiet: P.quiet(), ms: P.quietAt === null ? null : Math.round(P.quietAt - P.actionAt), mic: P.micLive() }; })()`);
}
const quietOk = (q) => q.quiet && q.ms !== null && q.ms <= QUIET_MS;
/* the song's parts and the takes are long sounds; the count-in's beeps are short */
const SONG = 'starts.filter((x) => x.seconds > 1)';
const BEEPS = 'starts.filter((x) => x.seconds > 0 && x.seconds < 0.5)';

/** sing (the mirror) a stretch of the song on Learn a song: one take */
async function singTake(from, seconds) {
  await page.eval(`window.__mirror.on = true; window.__mirror.follow = false; window.__mirror.shift = 0`);
  await slide('#song-position', from);
  await page.key('ArrowLeft');
  await page.key('ArrowRight');
  const n = await page.eval(S(SONG + '.length'));
  await page.tap('#song-play');
  await page.waitFor(S(`${SONG}.length >= ${n + 2} && window.__probe.micLive() === 1`), 10000);
  await sleep(seconds * 1000);
  await page.tap('#song-play');
  return page.waitFor(`!!document.querySelector('#take-review')`, 5000);
}
async function saveTake(from, seconds) {
  const had = (await takesKept()).map((t) => t.id);
  await singTake(from, seconds);
  await page.tap('#take-save');
  await page.waitFor(`document.querySelectorAll('.take-row').length > ${had.length}`, 5000);
  const t = (await takesKept()).find((x) => !had.includes(x.id));
  if (t) made.add(t.id);
  return t;
}
/** Practise a line: sing the step (both passes), as the mirror */
async function singStep({ shift = 0, stopAfter = null, secondShift = null } = {}) {
  await page.eval(`window.__mirror.on = true; window.__mirror.follow = true; window.__mirror.shift = ${shift}`);
  const n = await page.eval(S(SONG + '.length'));
  const b = await page.eval(S(BEEPS + '.length'));
  await page.tap('#line-sing');
  /* the second time through sung differently from the first */
  if (secondShift != null) {
    await page.waitFor(S(`${SONG}.length >= ${n + 2}`), 15000);
    await page.eval(`window.__mirror.shift = ${secondShift}`);
  }
  if (stopAfter != null) {
    await page.waitFor(S(`${SONG}.length >= ${n + 2}`), 15000);
    await sleep(stopAfter * 1000);
    await page.tap('#line-sing');
  }
  const done = await page.waitFor(`!!document.querySelector('#line-scores') && document.querySelector('#line-sing')?.textContent === ${JSON.stringify(copy.line.sing)}`, 60000);
  const starts = await page.eval(S(`${SONG}.slice(${n})`));
  const beeps = await page.eval(S(`${BEEPS}.length`)) - b;
  const scores = await page.eval(`[...document.querySelectorAll('#line-scores li')].map((li) => ({ text: li.textContent, pct: li.dataset.pct === '' ? null : +li.dataset.pct }))`);
  return { done, starts, beeps, scores };
}
const lineLabel = () => text('#line-which');
async function shot(name, sel = null) {
  if (!SHOTS) return;
  const { writeFileSync } = await import('node:fs');
  await page.eval(`window.scrollTo(0, 0)`);
  const box = await page.eval(`(() => { const e = ${sel ? `document.querySelector(${JSON.stringify(sel)})` : 'null'};
    const h = Math.max(document.documentElement.scrollHeight, innerHeight);
    if (!e) return { x: 0, y: 0, width: innerWidth, height: h };
    const b = e.getBoundingClientRect(); return { x: 0, y: 0, width: innerWidth, height: Math.min(h, b.bottom + scrollY + 12) }; })()`);
  /* the bottom menu is fixed to the screen; in a picture of the whole page it would sit
     in the middle, so for the picture it goes just under what is shown */
  await page.eval(`(() => { const t = document.querySelector('.tabs'); if (!t) return;
    t.dataset.shot = t.style.cssText; t.style.position = 'absolute'; t.style.bottom = 'auto';
    t.style.top = ${box.height} + 'px'; })()`);
  box.height += await page.eval(`document.querySelector('.tabs')?.offsetHeight || 0`);
  const r = await page.c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...box, scale: 1 } });
  await page.eval(`(() => { const t = document.querySelector('.tabs'); if (t) { t.style.cssText = t.dataset.shot || ''; delete t.dataset.shot; } })()`);
  writeFileSync(join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64'));
}
const made = new Set();

/** sign in through the Account screen */
async function signIn() {
  await go('/profile/account', `!!document.querySelector('#email') || !!document.querySelector('#sign-out')`);
  if (await page.eval(`!!document.querySelector('#sign-out')`)) return;
  await page.tap('#email');
  await page.type(EMAIL);
  await page.tap('#password');
  await page.type(password(EMAIL));
  await page.tap('#sign-in');
  if (!(await page.waitFor(`document.querySelector('#signed-in-as')?.textContent.includes(${JSON.stringify(EMAIL)})`, 15000))) throw new Error('could not sign in');
}

try {
  await signIn();
  /* the split song, stored on the phone as the app stores one */
  await page.eval(`window.__parts = {}`);
  for (const p of PARTS) {
    const b64 = readFileSync(`${PREFIX}-${p}.mp3`).toString('base64');
    await page.eval(`window.__parts[${JSON.stringify(p)}] = new Blob([Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0))], { type: 'audio/mpeg' })`);
  }
  await page.eval(`(async () => {
    const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app');
      q.onupgradeneeded = () => { const d = q.result; for (const s of ['songs', 'lines', 'takes']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); };
      q.onsuccess = () => ok(q.result); q.onerror = no; });
    const P = window.__parts;
    const secs = await new Promise((ok) => { const a = new Audio(URL.createObjectURL(P.voice)); a.onloadedmetadata = () => ok(a.duration); });
    const song = { id: ${JSON.stringify(ID)}, title: ${JSON.stringify(TITLE)}, created: Date.now(), fileName: 'test.mp3', file: P.voice, seconds: secs,
      state: 'ready', voice: P.voice, music: P.music, voice30: P.voice30, music30: P.music30 };
    await new Promise((ok) => { const t = db.transaction('songs', 'readwrite'); t.objectStore('songs').put(song); t.oncomplete = ok; });
    db.close();
    delete window.__parts;
  })()`);
  await openSong();
  /* the singer's line first */
  await page.waitFor(`!document.querySelector('#song-reading') && +(document.querySelector('#note-map')?.dataset.lo || 0) !== 55`, 120000);

  /* ---------------- Practise a line ---------------- */
  if (want('line-door')) {
    const shown = await page.eval(`document.querySelector('#open-line')?.textContent`);
    await page.tap('#open-line');
    const there = await page.waitFor(`document.querySelector('main h1')?.textContent === ${JSON.stringify(copy.line.title)} && !!document.querySelector('#line-which')`, 10000);
    await page.tap('main .back');
    const back = await page.waitFor(`!!document.querySelector('#song-play')`, 5000);
    check('line-door', shown === copy.line.open && there && back, `"${shown}" on Learn a song opens Practise a line ${there}; its back button returns to the song ${back}`);
  }

  await openLine();
  const label0 = await lineLabel();
  const count = Number(/of (\d+)/.exec(label0 ?? '')?.[1] ?? 0);
  if (want('line-pick')) {
    await slide('#line-where', 62);
    await sleep(300);
    const at62 = await lineLabel();
    await page.tap('#line-next');
    const next = await lineLabel();
    await page.tap('#line-prev');
    const prev = await lineLabel();
    await page.tap('#line-longer');
    const longer = await lineLabel();
    const shorter = await page.eval(`!!document.querySelector('#line-shorter')`);
    await page.tap('#line-shorter');
    const one = await lineLabel();
    await openLine();
    const kept = await lineLabel();
    const n62 = Number(/^Line (\d+)/.exec(at62 ?? '')?.[1]);
    const span = /· (\d+:\d+)–(\d+:\d+)/.exec(at62 ?? '');
    const inLine = span && ((s) => { const [a, b] = s.map((x) => +x.split(':')[0] * 60 + +x.split(':')[1]); return a <= 62 && 62 <= b + 1; })([span[1], span[2]]);
    check('line-pick', count >= 20 && n62 > 1 && inLine && next?.startsWith(`Line ${n62 + 1} of`) && prev === at62 &&
      longer?.startsWith(`Lines ${n62} to ${n62 + 1} of`) && shorter && one === at62 && kept === at62,
      `the song in ${count} lines; picked at 1:02 on the timeline: "${at62}" (1:02 inside it ${!!inLine}); Next "${next}", Previous back "${prev}"; ` +
      `Add the next line "${longer}"; Back to one line "${one}"; kept after reopening "${kept}"`);
  }
  await slide('#line-where', 62);
  await sleep(300);
  const picked = await lineLabel();
  const [, a, b] = /· (\d+:\d+)–(\d+:\d+)/.exec(picked) ?? [];
  const secs = (s) => +s.split(':')[0] * 60 + +s.split(':')[1];

  if (want('line-twice', 'line-scored')) {
    const step = await page.eval(`document.querySelector('#line-step')?.dataset.step`);
    const r = await singStep();
    const from = r.starts.map((x) => +x.offset.toFixed(2));
    const lens = r.starts.map((x) => (x.stopAt != null ? +(x.stopAt - x.when).toFixed(2) : null));
    const map = await page.eval(`(() => { const c = document.querySelector('#note-map'); return { singer: +c.dataset.singer, you: +c.dataset.you, hit: +c.dataset.hit }; })()`);
    if (want('line-twice')) {
      const same = from.length === 4 && from.every((x) => Math.abs(x - from[0]) < 0.01) && from[0] >= secs(a) && from[0] < secs(a) + 1;
      const len = lens.every((x) => x != null && Math.abs(x - lens[0]) < 0.02) && lens[0] > 1 && lens[0] < (secs(b) - secs(a)) + 1.5;
      check('line-twice', step === 'notes' && r.done && same && len && r.beeps === 3,
        `Step 1 (${step}), Sing it twice: the song's two parts started ${r.starts.length / 2} times, each from ${from[0]} s (the line shows ${a}–${b}), ` +
        `each let go after ${lens[0]} s; count-in beeps ${r.beeps} (once, before the first pass)`);
    }
    if (want('line-scored')) {
      await shot('practise-line', '#line-step');
      const ok = r.scores.length === 2 && r.scores.every((s) => s.pct != null && s.pct >= 70);
      check('line-scored', ok && map.singer > 0 && map.you > 0 && map.hit > 0 && r.scores[0].text === fill(copy.line.passScore, { n: 1, pct: r.scores[0].pct }),
        `sung right (the singer's own voice): ${r.scores.map((s) => s.text).join('; ')}; on the map: the song's line ${map.singer} points, yours ${map.you}, green ${map.hit}`);
    }
  }

  if (want('line-off')) {
    const r = await singStep({ shift: 7 });
    const ok = r.scores.length === 2 && r.scores.every((s) => s.pct == null || s.pct <= 40);
    check('line-off', r.done && ok, `the same singer, seven seconds further on in the song than what plays: ${r.scores.map((s) => s.text).join('; ')}`);
  }

  if (want('line-each-pass')) {
    const r = await singStep({ secondShift: 7 });
    const [p1, p2] = r.scores.map((x) => x.pct);
    check('line-each-pass', r.done && p1 != null && p1 >= 70 && (p2 == null || p2 <= 40),
      `the first time through sung right, the second seven seconds out: ${r.scores.map((x) => x.text).join('; ')} - each scored on its own`);
  }

  if (want('line-steps')) {
    await openLine();
    await page.eval(`window.__mirror.shift = 0`);
    const s1 = await page.eval(`({ step: document.querySelector('#line-step-n')?.textContent, how: document.querySelector('#line-how')?.textContent, next: !!document.querySelector('#line-next-step') })`);
    await singStep();
    await page.tap('#line-next-step');
    const s2 = await page.eval(`({ step: document.querySelector('#line-step-n')?.textContent, title: document.querySelector('#line-step-title')?.textContent,
      sounds: [...document.querySelectorAll('.line-sounds .choice')].map((x) => x.textContent), how: document.querySelector('#line-how')?.textContent })`);
    await page.tap('.line-sounds .choice[data-sound="straw"]');
    const straw = await page.eval(`({ how: document.querySelector('#line-how')?.textContent, need: document.querySelector('#line-need')?.textContent })`);
    await page.tap('.line-sounds .choice[data-sound="mum"]');
    const mumHow = await text('#line-how');
    await singStep();
    await page.tap('#line-next-step');
    const s3 = await page.eval(`({ step: document.querySelector('#line-step-n')?.textContent, title: document.querySelector('#line-step-title')?.textContent,
      how: document.querySelector('#line-how')?.textContent, ease: document.querySelector('#line-ease')?.textContent })`);
    const r3 = await singStep();
    const end = await page.eval(`({ done: document.querySelector('#line-done')?.textContent, on: !!document.querySelector('#line-on'), longer: !!document.querySelector('#line-on-longer'),
      restart: !!document.querySelector('#line-restart'), nextStep: !!document.querySelector('#line-next-step') })`);
    const ok = s1.step === 'Step 1 of 3' && s1.how === copy.line.notesHow && !s1.next &&
      s2.step === 'Step 2 of 3' && s2.title === copy.line.sound && s2.sounds.join('|') === 'Lip trills|Mum|Straw singing' && s2.how === copy.ex.liptrill.how &&
      straw.how === copy.ex.straw.how && straw.need === copy.ex.straw.need && mumHow === copy.ex.mum.how &&
      s3.step === 'Step 3 of 3' && s3.title === copy.line.words && s3.how === copy.line.wordsHow && s3.ease === fill(copy.line.wordsEase, { sound: 'Mum' }) &&
      r3.scores.length === 2 && end.done === copy.line.done && end.on && end.longer && end.restart && !end.nextStep;
    check('line-steps', ok, `step 1 "${s1.how}" (no Next step before singing: ${!s1.next}); step 2 "${s2.title}": ${s2.sounds.join(', ')}, Train's own words ` +
      `("${s2.how}"; Straw singing "${straw.how}" with "${straw.need}"); step 3 "${s3.how}" "${s3.ease}", scored ${r3.scores.map((s) => s.pct).join(' and ')}; ` +
      `then "${end.done}" with Next line ${end.on}, Add the next line ${end.longer}, From the first step ${end.restart}`);
  }

  if (want('line-next')) {
    const was = await lineLabel();
    const n = Number(/^Lines? (\d+)/.exec(was)?.[1]);
    await page.tap('#line-on');
    const now = await lineLabel();
    const step = await text('#line-step-n');
    check('line-next', now?.startsWith(`Line ${n + 1} of`) && step === 'Step 1 of 3', `after the third step, Next line: "${was}" to "${now}", back to "${step}"`);
    await slide('#line-where', 62);
    await sleep(300);
  }

  if (want('line-stop-early')) {
    await openLine();
    const r = await singStep({ stopAfter: 1.5 });
    const next = await page.eval(`!!document.querySelector('#line-next-step')`);
    check('line-stop-early', r.scores.length === 2 && r.scores[1].text === fill(copy.line.passMissed, { n: 2 }) && !next,
      `stopped in the first pass: ${r.scores.map((s) => s.text).join('; ')}; Next step offered ${next}`);
  }

  if (want('line-leave')) {
    await openLine();
    await page.eval(`window.__mirror.on = true; window.__mirror.follow = true`);
    const n = await page.eval(S(SONG + '.length'));
    await page.tap('#line-sing');
    await page.waitFor(S(`${SONG}.length >= ${n + 2} && window.__probe.micLive() === 1`), 15000);
    await sleep(1000);
    await page.tap('#tab-home');
    const q = await quietWithin();
    check('line-leave', quietOk(q) && q.mic === 0, `the menu mid-line: ${q.quiet ? `silent in ${q.ms} ms` : 'still sounding'}, mic open ${q.mic}`);
  }

  /* ---------------- Speak it, then sing it ---------------- */
  await openLine();
  await slide('#line-where', 62);
  await sleep(300);
  const shared = await lineLabel();
  if (want('speak-door')) {
    await openSong();
    await page.tap('#open-speak');
    const there = await page.waitFor(`document.querySelector('main h1')?.textContent === ${JSON.stringify(copy.speak.title)} && !!document.querySelector('#line-which')`, 10000);
    const same = await lineLabel();
    const sing = await page.eval(`document.querySelector('#sing-record')?.disabled`);
    check('speak-door', there && same === shared && sing === true,
      `"${copy.speak.open}" on Learn a song opens it ${there}, on the line picked in Practise a line ("${same}"); Sing it waits for Speak it ${sing}`);
  }
  await openSpeak();
  let pair = null;
  if (want('speak-pair', 'speak-back-to-back', 'speak-kept', 'speak-no-score')) {
    await page.eval(`window.__mirror.on = true; window.__mirror.follow = false; window.__mirror.shift = 0`);
    const len = secs(b) - secs(a);
    await page.tap('#speak-record');
    const spoken = await page.waitFor(`/Spoken · /.test(document.querySelector('#speak-spoken-kept')?.textContent || '')`, 40000);
    await page.tap('#sing-record');
    const sung = await page.waitFor(`/Sung · /.test(document.querySelector('#speak-sung-kept')?.textContent || '')`, 40000);
    pair = await page.eval(`(async () => {
      const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-speak'); q.onsuccess = () => ok(q.result); q.onerror = no; });
      const p = await new Promise((ok) => { const q = db.transaction('pairs').objectStore('pairs').get(${JSON.stringify(ID)}); q.onsuccess = () => ok(q.result); });
      db.close();
      return p ? { start: p.start, end: p.end, spoken: p.spoken && p.spoken.seconds, sung: p.sung && p.sung.seconds,
        loud: [p.spoken, p.sung].map((s) => s ? Math.max(...Array.from(s.samples.subarray(0, 200000)).map(Math.abs)) : 0) } : null;
    })()`);
    if (want('speak-pair')) {
      await shot('speak-sing', '#speak-both');
      const ok = spoken && sung && pair && Math.abs(pair.spoken - len) < 1.5 && Math.abs(pair.sung - len) < 1.5 && pair.loud.every((v) => v > 1000);
      check('speak-pair', ok, `Speak it, then Sing it, each over the line once (${len} s): kept on the phone ${!!pair}, ` +
        `${pair?.spoken?.toFixed(2)} s and ${pair?.sung?.toFixed(2)} s, a voice in each (loudest ${pair?.loud.join(' and ')} of 32767)`);
    }
    if (want('speak-back-to-back') && pair) {
      const n = await page.eval(S(SONG + '.length'));
      const e0 = await page.eval(S('events.length'));
      await page.tap('#speak-hear');
      await page.waitFor(S(`${SONG}.length >= ${n + 2}`), 20000);
      await page.waitFor(`document.querySelector('#speak-hear')?.textContent === ${JSON.stringify(copy.speak.hear)}`, 30000);
      const heard = await page.eval(S(`${SONG}.slice(${n})`));
      const plays = await page.eval(S(`events.slice(${e0}).filter((e) => e[0] === 'play').map((e) => e[1])`));
      const gap = plays.length >= 2 ? (plays[plays.length - 1] - plays[0]) / 1000 : null;
      const ok = heard.length === 2 && Math.abs(heard[0].seconds - pair.spoken) < 0.05 && Math.abs(heard[1].seconds - pair.sung) < 0.05 &&
        gap != null && gap >= pair.spoken - 0.1 && gap <= pair.spoken + 0.8;
      check('speak-back-to-back', ok, `Hear both: ${heard.length} sounds, ${heard.map((h) => h.seconds.toFixed(2) + ' s').join(' then ')} (spoken, then sung); ` +
        `the second started ${gap?.toFixed(2)} s after the first, as the first ended; no song under them ${heard.every((h) => h.seconds < 60)}`);
    }
    if (want('speak-kept')) {
      await openSpeak();
      const kept = await page.waitFor(`/Spoken · /.test(document.querySelector('#speak-spoken-kept')?.textContent || '') && /Sung · /.test(document.querySelector('#speak-sung-kept')?.textContent || '')`, 5000);
      const words = await page.eval(`({ again: document.querySelector('#speak-record')?.textContent, kept: document.querySelector('#speak-kept')?.textContent })`);
      check('speak-kept', kept && words.again === copy.speak.speakAgain && words.kept === copy.speak.kept,
        `reopened: both still there ${kept}, "${words.again}", "${words.kept}"`);
    }
    if (want('speak-no-score')) {
      /* everything but the sound card, whose sliders say their volume as a % */
      const body = await page.eval(`[...document.querySelector('main').children].filter((e) => e.getAttribute('aria-label') !== ${JSON.stringify(copy.song.sound)}).map((e) => e.innerText).join('\\n')`);
      const bad = ['%', 'right notes', 'better', 'worse', 'best', 'score:'].filter((w) => body.toLowerCase().includes(w));
      const map = await page.eval(`!!document.querySelector('#note-map')`);
      check('speak-no-score', bad.length === 0 && !map && body.includes(copy.speak.listen),
        `the page says "${copy.speak.listen}"; nothing scored or compared on it: ${bad.length ? 'found ' + bad.join(', ') : 'none'}, no map ${!map}`);
    }
  }
  if (want('speak-no-mic')) {
    await allowMic(false);
    await openSpeak();
    await page.eval(`window.__mirror.on = false`);
    await page.tap('#speak-record');
    const said = await page.waitFor(`document.querySelector('#speak-no-mic')?.textContent === ${JSON.stringify(copy.speak.noMic)}`, 40000);
    const still = pair ? await page.waitFor(`/Spoken · /.test(document.querySelector('#speak-spoken-kept')?.textContent || '')`, 2000) : true;
    await allowMic(true);
    check('speak-no-mic', said && still, `the mic refused: "${copy.speak.noMic}" ${said}; the spoken one kept before stays ${still}`);
  }

  /* ---------------- the Before ---------------- */
  await openSong();
  let A = null, B = null, C = null;
  if (want('before-first', 'before-compare', 'before-hear-either', 'before-apart', 'before-choose', 'before-private', 'before-new-phone', 'before-falls-back')) {
    A = await saveTake(62, 8);
    B = await saveTake(64, 6);      /* a different length, so each take can be told apart as it plays */
    C = await saveTake(150, 3);
  }
  const marked = () => page.eval(`[...document.querySelectorAll('.take-row')].filter((r) => r.dataset.before === 'true').map((r) => r.dataset.take)`);
  if (want('before-first') && A && B && C) {
    const m = await page.waitFor(`document.querySelectorAll('.take-row[data-before="true"]').length === 1`, 8000);
    const which = await marked();
    const tag = await page.eval(`document.querySelector('.take-row[data-before="true"] #take-before')?.textContent`);
    check('before-first', m && which.length === 1 && which[0] === A.id && tag === copy.takes.before,
      `three takes saved: the first (${A.id.slice(0, 8)}) is marked "${tag}" ${which[0] === A.id}, and only it (${which.length})`);
  }
  if (want('before-compare', 'before-hear-either') && A && B) {
    await page.tap(`.take-row[data-take="${B.id}"] .take-more`);
    const items = await page.eval(`[...document.querySelectorAll('.take-row[data-take="${B.id}"] .take-menu button')].map((x) => x.textContent)`);
    await page.waitFor(`!document.querySelector('.take-row[data-take="${B.id}"] .take-compare')?.disabled`, 8000);
    await page.tap(`.take-row[data-take="${B.id}"] .take-compare`);
    const card = await page.waitFor(`!!document.querySelector('#compare-play')`, 5000);
    await sleep(600);
    const drawn = await page.eval(`(() => { const c = document.querySelector('#note-map'); const d = c.drawn;
      return { before: +c.dataset.before, you: +c.dataset.you, bT: d.before.map((p) => p.t), yT: d.you.map((p) => p.t) }; })()`);
    const inA = drawn.bT.length > 0 && drawn.bT.every((t) => t >= A.songAt - 0.2 && t <= A.songAt + A.seconds + 0.2);
    const inB = drawn.yT.length > 0 && drawn.yT.every((t) => t >= B.songAt - 0.2 && t <= B.songAt + B.seconds + 0.2);
    if (want('before-compare')) {
      await shot('before-compare', '#compare');
      check('before-compare', items.includes(copy.takes.compare) && items.includes(copy.takes.makeBefore) && card && drawn.before > 0 && drawn.you > 0 && inA && inB,
        `the later take's menu: ${items.join(', ')}; "${copy.takes.compare}": both lines on the map, the Before dashed (${drawn.before} points, all from the first take ${inA}) ` +
        `and this take (${drawn.you} points, all from it ${inB})`);
    }
    if (want('before-hear-either')) {
      const n = await page.eval(S(SONG + '.length'));
      await page.tap('#compare-play');
      await page.waitFor(S(`${SONG}.length >= ${n + 4}`), 15000);
      await sleep(700);
      const starts = await page.eval(S(`${SONG}.slice(${n})`));
      const gains = async () => page.eval(S(`playing().filter((p) => p.seconds < 60).map((p) => ({ s: +p.seconds.toFixed(1), g: +(p.gain ?? 0).toFixed(2) }))`));
      const g1 = await gains();
      await page.tap('#compare-before');
      await sleep(400);
      const g2 = await gains();
      await page.tap('#compare-this');
      await sleep(400);
      const g3 = await gains();
      await page.tap('#compare-play');
      const q = await quietWithin();
      const loud = (g) => g.filter((p) => p.g > 0.05).map((p) => p.s);
      const ok = starts.length === 4 && g1.length === 2 && loud(g1).length === 1 && loud(g2).length === 1 && loud(g3).length === 1 &&
        loud(g1)[0] === loud(g3)[0] && loud(g2)[0] !== loud(g1)[0] && quietOk(q);
      check('before-hear-either', ok, `Play: the voice, the music and both takes together from ${starts[0]?.offset.toFixed(1)} s, where both were sung (${starts.length} sounds); ` +
        `heard: this take's ${loud(g1).join()} s, then on "Before" the Before's ${loud(g2).join()} s, back on "This take" ${loud(g3).join()} s, switched without stopping; ` +
        `Stop: ${q.quiet ? `silent in ${q.ms} ms` : 'still sounding'}`);
    }
    await page.tap('#compare-done');
  }
  if (want('before-apart') && A && C) {
    await page.tap(`.take-row[data-take="${C.id}"] .take-more`);
    await page.waitFor(`!document.querySelector('.take-row[data-take="${C.id}"] .take-compare')?.disabled`, 8000);
    await page.tap(`.take-row[data-take="${C.id}"] .take-compare`);
    const apart = await page.waitFor(`document.querySelector('#compare-apart')?.textContent === ${JSON.stringify(copy.takes.apart)}`, 5000);
    const noPlay = await page.eval(`!document.querySelector('#compare-play')`);
    await page.tap('#compare-done');
    check('before-apart', apart && noPlay, `a take from another part of the song: "${copy.takes.apart}" ${apart}, nothing to play together ${noPlay}`);
  }
  if (want('before-choose', 'before-private', 'before-new-phone', 'before-falls-back') && A && B) {
    await page.tap(`.take-row[data-take="${B.id}"] .take-more`);
    await page.tap(`.take-row[data-take="${B.id}"] .take-make-before`);
    const moved = await page.waitFor(`document.querySelector('.take-row[data-take="${B.id}"]')?.dataset.before === 'true'`, 5000);
    const one = (await marked()).length === 1;
    await sleep(1500);
    const online = befores(singerToken);
    if (want('before-choose')) {
      check('before-choose', moved && one && online.status === 200 && online.json?.length === 1 && online.json[0].take_id === B.id,
        `"${copy.takes.makeBefore}" on the second take: it is marked Before ${moved}, the only one ${one}; on the account: ${online.json?.length} choice, that take ${online.json?.[0]?.take_id === B.id}`);
    }
    if (want('before-private')) {
      const coach = befores(coachToken);
      const anon = befores(null);
      const write = rest('POST', '/rest/v1/song_befores', coachToken, { student_id: singerId, song_title: TITLE, take_id: 'x' });
      const change = rest('PATCH', `/rest/v1/song_befores?student_id=eq.${singerId}`, coachToken, { take_id: 'x' }, ['-H', 'Prefer: return=representation']);
      const still = befores(singerToken).json?.[0]?.take_id === B.id;
      check('before-private', coach.status === 200 && coach.json?.length === 0 && anon.json?.length !== 1 && write.status >= 400 && (change.json ?? []).length === 0 && still,
        `the singer's choice, as the linked coach sees it: ${coach.json?.length} rows; signed out: ${anon.status}, ${Array.isArray(anon.json) ? anon.json.length + ' rows' : 'refused'}; ` +
        `the coach writing one for the singer: refused (${write.status}); changing it: ${(change.json ?? []).length} changed; the singer's choice unchanged ${still}`);
    }
    if (want('before-new-phone')) {
      await page.eval(`Object.keys(localStorage).filter((k) => k.startsWith('rp.before.')).forEach((k) => localStorage.removeItem(k))`);
      await openSong();
      const back = await page.waitFor(`document.querySelector('.take-row[data-take="${B.id}"]')?.dataset.before === 'true'`, 10000);
      check('before-new-phone', back, `the phone forgets the choice (as a new phone would have none): the second take is still the Before, from the account ${back}`);
    }
    if (want('before-falls-back')) {
      await page.tap(`.take-row[data-take="${B.id}"] .take-more`);
      await page.tap(`.take-row[data-take="${B.id}"] .take-delete`);
      const first = await page.waitFor(`document.querySelector('.take-row[data-take="${A.id}"]')?.dataset.before === 'true'`, 5000);
      await page.tap('#undo-delete');
      const backB = await page.waitFor(`document.querySelector('.take-row[data-take="${B.id}"]')?.dataset.before === 'true'`, 5000);
      check('before-falls-back', first && backB, `the chosen Before deleted: the first take saved is the Before again ${first}; Undo: the chosen one is back as the Before ${backB}`);
    }
  }

  /* ---------------- both pages ---------------- */
  if (want('pages-360')) {
    const out = [];
    for (const [w, h] of [[390, 844], [360, 740]]) {
      await page.c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
      for (const open of [openLine, openSpeak]) {
        await open();
        await sleep(400);
        /* a switch is tapped by its whole row (the label it sits in) */
        const r = await page.eval(`(() => { const small = [...document.querySelectorAll('main button, main input')].filter((e) => { const b = (e.closest('label') || e).getBoundingClientRect(); return b.width && (b.height < 44 || b.width < 44) && e.type !== 'range'; });
          return { scroll: document.documentElement.scrollWidth > innerWidth, small: small.map((e) => e.id || e.textContent).slice(0, 4) }; })()`);
        out.push({ w, page: open === openLine ? 'line' : 'speak', ...r });
      }
    }
    await page.c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    const bad = out.filter((o) => o.scroll || o.small.length);
    check('pages-360', bad.length === 0, out.map((o) => `${o.page} at ${o.w}: ${o.scroll ? 'scrolls sideways' : 'fits'}${o.small.length ? ', small: ' + o.small.join(', ') : ''}`).join('; '));
  }
  if (want('pages-words')) {
    const stray = [];
    for (const open of [openLine, openSpeak, openSong]) {
      await open();
      await sleep(500);
      stray.push(...(await strayWords(page)));
    }
    check('pages-words', stray.length === 0, stray.length ? 'words not from the copy: ' + stray.join(' | ') : 'every word on Practise a line, Speak it then sing it, and Learn a song with the Before is from the copy');
  }

  check('no-page-errors', page.errors.length === 0, page.errors.join(' | '));
} catch (e) {
  const why = 'the test stopped: ' + String(e.message || e).split('\n')[0];
  const said = new Set(results.map((r) => r.name));
  for (const name of ALL) if (want(name) && !said.has(name)) check(name, false, why);
} finally {
  try {
    const t = clearTestTakes();
    clearBefores();
    const leftB = befores(singerToken).json?.length ?? -1;
    console.log(`cleaned up: ${t.rows} take rows and ${t.files} recordings of the test singer, and its Before (${leftB} left)`);
  } catch (e) {
    console.log('FAIL cleanup - ' + (e.message || e));
    results.push({ name: 'cleanup', ok: false });
  }
  await env.close();
  server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `${failed.length} of ${results.length} checks failed` : `all ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
