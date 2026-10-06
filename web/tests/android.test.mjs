/* Sound on an Android phone (RULEBOOK 4, Sound, Android), on the built app,
   in a real Chrome made to behave like Chrome on Android (tests/harness.mjs,
   ANDROID): sound that is born suspended, a resume that never answers or
   only answers inside a tap, a suspend that never comes back, and a clock
   that says "running" but stands still. Robert's first phone test failed
   on these: Start turned to Pause, nothing played, and after a minute it
   went back to Start with no message.

   The song is the separator's real first 30 seconds of one song (RP_SPLIT,
   kept outside the repo). The mic hears silence, never a tone (Android 10):
   nothing here can pass because a sound was heard. Prints one line per
   check; exits 1 if any fails. ONLY=name,name runs some; APP_DIR points it
   at another build. */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './chrome.mjs';
import { ANDROID, PROBE, serve } from './harness.mjs';
import { copy } from '../src/core/copy.ts';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (...names) => !ONLY.length || names.some((n) => ONLY.includes(n));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';

const PREFIX = process.env.RP_SPLIT || '';
if (!['voice30', 'music30'].every((p) => existsSync(`${PREFIX}-${p}.mp3`))) {
  console.log('FAIL setup: RP_SPLIT must name the separator\'s output for one song (PREFIX-voice30.mp3 and so on), kept outside the repo');
  process.exit(1);
}

const ALL = ['start-hangs', 'stall-rebuild', 'gesture-only', 'never-suspends', 'mic-first', 'ten-starts', 'hear-yourself-rebuilt', 'mic-held',
  'no-page-errors'];
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
}

const tmp = mkdtempSync(join(tmpdir(), 'rp-android-'));
const SILENCE = join(tmp, 'silence.wav');
spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '30', SILENCE]);
if (!existsSync(SILENCE)) {
  console.log('FAIL setup: could not make a silent recording for the mic (FFMPEG)');
  process.exit(1);
}

const { server, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: SILENCE, allowMic: true });
const { page } = env;
await page.addInitScript(ANDROID);
await page.addInitScript(PROBE);
const A = (expr) => `window.__android.${expr}`;
const P = (expr) => `window.__probe.${expr}`;
const PLAY = `document.querySelector('#song-play')?.textContent`;
const TROUBLE = `document.querySelector('#sound-trouble-line')?.textContent`;
const ID = 'android-song';
let loads = 0;

/** a fresh page on the song, with the phone's sound set up as asked */
async function open(android = {}) {
  await page.goto(URL_APP + '?load=' + ++loads + '#/sing/learn/song/' + ID);
  await page.eval(`Object.assign(window.__android, ${JSON.stringify(android)})`);
  await page.waitFor(`!!document.querySelector('#song-play') && !document.querySelector('#song-play').disabled`, 8000);
}
/** what Start says, watched until `until` is true or `ms` pass */
async function watchPlay(until, ms) {
  const seen = new Set();
  const end = Date.now() + ms;
  let done = false;
  while (Date.now() < end) {
    seen.add(await page.eval(PLAY));
    if (await page.eval(until)) { done = true; break; }
    await sleep(40);
  }
  return { done, seen: [...seen] };
}
const playing = () => page.waitFor(`${PLAY} === ${JSON.stringify(copy.song.pause)} && ${P('live.size')} >= 2`, 8000);
const stopped = () => page.waitFor(`${PLAY} === ${JSON.stringify(copy.song.start)}`, 3000);
const steps = () => page.eval(`[...document.querySelectorAll('#sound-steps li')].map((l) => l.textContent)`);
const STEPS = [copy.song.step1, copy.song.step2, copy.song.step3, copy.song.step4];
/** where the song is, as the play bar shows it */
const at = () => page.eval(`+document.querySelector('#song-position').value`);
/** the song's newest start: where in the song it started from */
const lastFrom = () => page.eval(`(() => { const s = window.__probe.starts; return s.length ? s[s.length - 1].offset : null; })()`);

try {
  /* the song, stored on the phone as the app stores one */
  await page.goto(URL_APP + '?load=0#/sing');
  await page.waitFor(`!!document.querySelector('main h1')`);
  await page.eval(`window.__parts = {}`);
  for (const p of ['voice30', 'music30']) {
    const b64 = readFileSync(`${PREFIX}-${p}.mp3`).toString('base64');
    await page.eval(`window.__parts[${JSON.stringify(p)}] = new Blob([Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0))], { type: 'audio/mpeg' })`);
  }
  await page.eval(`(async () => {
    const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app');
      q.onupgradeneeded = () => { const d = q.result; for (const s of ['songs', 'lines', 'takes']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); };
      q.onsuccess = () => ok(q.result); q.onerror = no; });
    const P = window.__parts;
    const song = { id: ${JSON.stringify(ID)}, title: 'Android song', created: Date.now(), fileName: 'android.mp3', file: P.voice30, seconds: 30,
      state: 'ready', voice: P.voice30, music: P.music30, voice30: P.voice30, music30: P.music30 };
    await new Promise((ok) => { const t = db.transaction('songs', 'readwrite'); t.objectStore('songs').put(song); t.oncomplete = ok; });
    db.close();
    delete window.__parts;
  })()`);

  /* 1. Sound born suspended, and a resume that never answers: within a few
        seconds Start says so, with the steps in order, and never says Pause */
  if (want('start-hangs')) {
    await open({ born: 'suspended', resume: 'hang' });
    const t0 = Date.now();
    await page.tap('#song-play');
    const w = await watchPlay(`(${TROUBLE}) === ${JSON.stringify(copy.song.soundBlocked)}`, 8000);
    const ms = Date.now() - t0;
    const list = await steps();
    const after = await page.eval(`({ play: ${PLAY}, live: ${P('live.size')}, started: ${P('started')}, mic: ${P('micLive()')} })`);
    check('start-hangs', w.done && ms <= 5000 && !w.seen.includes(copy.song.pause) && JSON.stringify(list) === JSON.stringify(STEPS) &&
      after.play === copy.song.start && after.started === 0 && after.mic === 0,
      `message after ${(ms / 1000).toFixed(1)} s (${w.done ? 'shown' : 'NOT shown'}); Start said: ${w.seen.join(' → ')}; steps: ${list.join(' / ') || 'none'}; ` +
      `then: Start ${after.play === copy.song.start}, song parts started ${after.started}, mic left open ${after.mic}`);
  }

  /* 2. The clock stops while it says "running": seen as a stall, said;
        a tap closes it, makes a new one and carries on from the same spot */
  if (want('stall-rebuild')) {
    await open({ sticky: true });
    await page.tap('#song-play');
    const ok1 = await playing();
    await sleep(2500);
    const t0 = Date.now();
    await page.eval(A('freeze()'));
    const said = await page.waitFor(`(${TROUBLE}) === ${JSON.stringify(copy.song.soundStalled)}`, 5000);
    const ms = Date.now() - t0;
    const froze = await at();
    const quiet = await page.eval(`({ play: ${PLAY}, live: ${P('live.size')}, mic: ${P('micLive()')} })`);
    await page.tap('#song-play');
    const ok2 = await playing();
    const from = await lastFrom();
    const moving = await page.eval(A('moving()'));
    const ctx = await page.eval(`({ n: ${A('contexts.length')}, old: ${A('contexts[0].state')}, suspends: ${A('suspends')}, gone: !document.querySelector('#sound-trouble') })`);
    await page.tap('#song-play');
    await stopped();
    check('stall-rebuild', ok1 && said && ms <= 4000 && quiet.play === copy.song.start && quiet.live === 0 && quiet.mic === 0 &&
      ok2 && froze > 2 && from !== null && Math.abs(from - froze) < 0.3 && moving && ctx.n === 2 && ctx.old === 'closed' && ctx.suspends === 0 && ctx.gone,
      `stall said after ${(ms / 1000).toFixed(1)} s (${said}); then silent ${quiet.live === 0 && quiet.mic === 0}, Start shown ${quiet.play === copy.song.start}; ` +
      `froze at ${froze.toFixed(2)} s; after the tap: playing ${ok2} from ${from == null ? 'nowhere' : from.toFixed(2) + ' s'}, clock moving ${moving}, ` +
      `sounds made ${ctx.n} (the old one ${ctx.old}), suspended by the app ${ctx.suspends} times`);
  }

  /* 3. Resume works only inside a tap (Android's rule; desktop Chrome hides it) */
  if (want('gesture-only')) {
    await open({ born: 'suspended', resume: 'gesture' });
    await page.tap('#song-play');
    const ok = await playing();
    const moving = await page.eval(A('moving()'));
    const r = await page.eval(`({ refused: ${A('refused')}, trouble: ${TROUBLE} ?? null })`);
    await page.tap('#song-play');
    await stopped();
    check('gesture-only', ok && moving && !r.trouble, `played ${ok}, clock moving ${moving}; resumes refused (outside a tap) ${r.refused}; message ${r.trouble ?? 'none'}`);
  }

  /* 4. The app never suspends its sound: after stop, back 10 s, repeat, or leaving */
  if (want('never-suspends')) {
    await open({ sticky: true });
    const done = [];
    await page.tap('#song-play');
    done.push(await playing());
    await sleep(1500);
    await page.tap('#song-play');                       /* stop */
    done.push(await stopped());
    await sleep(800);
    await page.tap('#song-play');
    done.push(await playing());
    await sleep(1200);
    await page.tap('#back-10');
    await sleep(800);
    done.push(await playing());
    await page.tap('#repeat-part');
    await sleep(800);
    done.push(await playing());
    await page.tap('button.back');
    await sleep(1000);
    const s = await page.eval(`({ suspends: ${A('suspends')}, live: ${P('live.size')}, mic: ${P('micLive()')}, state: ${A('newest()?.state')} })`);
    check('never-suspends', done.every(Boolean) && s.suspends === 0 && s.live === 0 && s.mic === 0 && s.state === 'running',
      `start, stop, start, back 10 s, repeat, leave: each worked ${done.join(',')}; suspended by the app ${s.suspends} times; ` +
      `silent ${s.live === 0 && s.mic === 0}; the sound itself ${s.state}`);
  }

  /* 5. The mic opens before the sound is made or woken */
  if (want('mic-first')) {
    await open();
    await page.tap('#song-play');
    const ok1 = await playing();
    const o1 = await page.eval(A('order.slice()'));
    await page.tap('#song-play');
    await stopped();
    await page.eval(`window.__android.order.length = 0`);
    await page.tap('#song-play');
    const ok2 = await playing();
    const o2 = await page.eval(A('order.slice()'));
    await page.tap('#song-play');
    await stopped();
    const first = o1.indexOf('mic-open') >= 0 && o1.indexOf('mic-open') < o1.indexOf('context') && o1.indexOf('mic-open') < o1.indexOf('resume');
    const again = o2.indexOf('mic-open') >= 0 && o2.indexOf('mic-open') < o2.indexOf('resume');
    check('mic-first', ok1 && ok2 && first && again, `first Start: ${o1.join(' > ')}; next Start: ${o2.join(' > ')}`);
  }

  /* 6. Start, sound, stop, ten times in a row, the clock moving each time
        (on a phone where a suspended sound never comes back) */
  if (want('ten-starts')) {
    await open({ sticky: true });
    const each = [];
    for (let i = 0; i < 10; i++) {
      await page.tap('#song-play');
      const ok = await playing();
      const moving = ok && (await page.eval(A('moving()')));
      await sleep(300);
      await page.tap('#song-play');
      const off = await stopped();
      each.push(ok && moving && off);
      if (!ok) break;
      await sleep(500);
    }
    const n = await page.eval(A('contexts.length'));
    check('ten-starts', each.length === 10 && each.every(Boolean) && n === 1,
      `${each.filter(Boolean).length} of 10 played with the clock moving and stopped again; sounds made ${n}`);
  }

  /* 7. "Hear yourself" sounds while singing on a sound that was rebuilt */
  if (want('hear-yourself-rebuilt')) {
    await open();
    await page.tap('#hear-yourself');
    await page.tap('#song-play');
    const ok1 = await playing();
    await sleep(1000);
    await page.eval(A('freeze()'));
    const said = await page.waitFor(`(${TROUBLE}) === ${JSON.stringify(copy.song.soundStalled)}`, 5000);
    await page.tap('#song-play');
    const ok2 = await playing();
    await sleep(300);
    const m = await page.eval(`(() => { const P = window.__probe, E = window.__android, now = E.newest();
      const on = P.monitors.filter((g) => !g.__off && g.gain.value > 0.1);
      return { on: on.length, onNew: on.filter((g) => g.context === now).length, state: now.state, mic: P.micLive() }; })()`);
    const moving = await page.eval(A('moving()'));
    await page.tap('#song-play');
    await stopped();
    check('hear-yourself-rebuilt', ok1 && said && ok2 && m.onNew === 1 && m.on === 1 && moving && m.mic > 0,
      `stalled and said ${said}; after the tap: playing ${ok2}, your voice played back on the new sound ${m.onNew}, anywhere ${m.on}; ` +
      `new sound's clock moving ${moving}; mic open ${m.mic}`);
  }

  /* 8. Another app takes the mic while you sing: said plainly (Android 9) */
  if (want('mic-held')) {
    await open();
    await page.tap('#song-play');
    const ok = await playing();
    await page.eval(`(() => { const t = window.__probe.tracks.filter((x) => x.readyState === 'live').pop(); t.dispatchEvent(new Event('mute')); })()`);
    const said = await page.waitFor(`document.querySelector('#mic-line')?.textContent.includes(${JSON.stringify(copy.song.micHeld)})`, 2000);
    const still = await page.eval(`${P('live.size')} >= 2`);
    await page.tap('#song-play');
    await stopped();
    check('mic-held', ok && said && still, `playing ${ok}; "${copy.song.micHeld}" shown ${said}; the song played on ${still}`);
  }

  check('no-page-errors', page.errors.length === 0, page.errors.join(' | '));
} catch (e) {
  const why = 'the test stopped: ' + String(e.message || e).split('\n')[0];
  const said = new Set(results.map((r) => r.name));
  for (const name of ALL) if (want(name) && !said.has(name)) check(name, false, why);
} finally {
  await env.close();
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} of ${results.length} checks FAILED` : `\nall ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
