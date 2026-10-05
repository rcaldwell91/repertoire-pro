/* The note map on Learn a song, on the built app, in a real Chrome: the
   singer's line read from the separated voice FILE, your line from the
   mic, and where each lands. Real voices only (RULEBOOK 4, Tests): the
   song on the phone is the separator's real output for one song, named by
   RP_SPLIT (a path prefix: PREFIX-voice.mp3, -music.mp3, -voice30.mp3,
   -music30.mp3; kept outside the repo), stored as a split song would be.
   The splitting itself, and reading the line from the first 30 seconds
   while the rest is still splitting, are checked against the real server
   in tests/song.test.mjs.

   "Singing" is done by the mirror (tests/harness.mjs): the mic is given a
   real recording the moment the speaker would play it, with phone-like
   speaker and mic delays. Prints one line per check; exits 1 if any fails.
   ONLY=name,name runs some; APP_DIR points it at another build. */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './chrome.mjs';
import { MIRROR, PROBE, serve } from './harness.mjs';
import { copy } from '../src/core/copy.ts';
import { pinnedRange } from '../src/core/notemap.ts';
import { LINE_VER } from '../src/audio/pitch/core.ts';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (...names) => !ONLY.length || names.some((n) => ONLY.includes(n));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const QUIET_MS = 300;
/* the bake-off's measured rate for this recording (scripts/bakeoff) */
const BAKEOFF = existsSync(join(WEB, 'scripts/bakeoff/results.json')) ? JSON.parse(readFileSync(join(WEB, 'scripts/bakeoff/results.json'), 'utf8')) : { rows: [] };

const PREFIX = process.env.RP_SPLIT || '';
const PARTS = ['voice', 'music', 'voice30', 'music30'];
if (!PARTS.every((p) => existsSync(`${PREFIX}-${p}.mp3`))) {
  console.log('FAIL setup: RP_SPLIT must name the separator\'s output for one song (PREFIX-voice.mp3 and so on), kept outside the repo');
  process.exit(1);
}
const RECORDING = process.env.RP_SPLIT_NAME || 'All of Me (separated)';
const expected = BAKEOFF.rows.find((r) => r.song === RECORDING && r.method === BAKEOFF.winner);

const ALL = ['line-read', 'line-shared', 'line-follows', 'pinned', 'voice-zero', 'placement', 'octave-switch', 'hear-yourself', 'mic-leave', 'mic-hidden',
  'mic-refused', 'reopen-line', 'no-page-errors'];
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
}

const decode = (path, ac = 2) => {
  const r = spawnSync(FFMPEG, ['-v', 'error', '-i', path, '-f', 'f32le', '-ac', String(ac), '-ar', '44100', '-'], { maxBuffer: 1 << 30 });
  const x = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
  if (ac === 1) return x;
  const mono = new Float32Array(x.length / 2);
  for (let i = 0; i < mono.length; i++) mono[i] = (x[2 * i] + x[2 * i + 1]) / 2;
  return mono;
};
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* the old singer test's loud time: RMS every 50 ms, Otsu on log RMS */
function loudFrames(mono, sr) {
  const W = Math.round(0.05 * sr), n = Math.floor(mono.length / W), rms = new Float32Array(n);
  for (let k = 0; k < n; k++) { let s = 0; for (let i = 0; i < W; i++) { const v = mono[k * W + i]; s += v * v; } rms[k] = Math.sqrt(s / W); }
  const logs = Array.from(rms, (v) => Math.log10(v || 1e-9));
  const lo = Math.min(...logs), hi = Math.max(...logs), B = 200, hist = new Array(B).fill(0);
  logs.forEach((v) => hist[Math.min(B - 1, Math.floor(((v - lo) / (hi - lo)) * B))]++);
  let sum = 0; for (let i = 0; i < B; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, bestT = 0;
  for (let i = 0; i < B; i++) {
    wB += hist[i]; if (!wB) continue; const wF = n - wB; if (!wF) break;
    sumB += i * hist[i]; const v = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (v > best) { best = v; bestT = i; }
  }
  const th = Math.pow(10, lo + ((bestT + 0.5) / B) * (hi - lo));
  return Array.from(rms, (v) => v >= th);
}

/* where your line sits against the singer's: the shift (ms) that lines
   them up best, and how much of your line is then within half a semitone */
function placement(youT, youM, singer, hop, shift = 0) {
  const at = (t) => {
    const k = t / hop, a = Math.floor(k), b = a + 1;
    if (a < 0 || b >= singer.length || !Number.isFinite(singer[a]) || !Number.isFinite(singer[b])) return NaN;
    return singer[a] + (singer[b] - singer[a]) * (k - a);
  };
  let best = null;
  for (let L = -250; L <= 250; L += 2) {
    let err = 0, n = 0, hit = 0;
    for (let i = 0; i < youT.length; i++) {
      const m = youM[i];
      if (!Number.isFinite(m)) continue;
      const s = at(youT[i] - L / 1000);
      if (!Number.isFinite(s)) continue;
      const e = Math.min(1, Math.abs(m + shift - s));
      err += e; n++; if (e < 0.5) hit++;
    }
    if (n && (!best || err / n < best.err)) best = { lagMs: L, err: err / n, n, hits: hit / n };
  }
  return best;
}

const tmp = mkdtempSync(join(tmpdir(), 'rp-map-'));
/* the same real voice an octave down, as a lower voice singing along */
const LOW = join(tmp, 'voice-octave-down.mp3');
spawnSync(FFMPEG, ['-v', 'error', '-y', '-i', `${PREFIX}-voice.mp3`, '-af', 'asetrate=22050,aresample=44100,atempo=2', '-b:a', '192k', LOW]);

const { server, ORIGIN, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: `${PREFIX}-voice30.mp3`, allowMic: false, online: true });
const { page } = env;
await page.addInitScript(MIRROR);       /* before the probe, so the probe sees the mirror's mic */
await page.addInitScript(PROBE);
const S = (expr) => `window.__probe.${expr}`;
const MAP = `document.querySelector('#note-map')`;
const MAPLINE = `document.querySelector('#map-line')?.textContent`;
let loads = 0;
async function open(id) {
  await page.goto(URL_APP + '?load=' + ++loads + '#/sing/learn/song/' + id);
  await page.waitFor(`!!document.querySelector('#song-play')`, 8000);
}
const ID = 'test-song';
async function storedLine() {
  return page.eval(`(async () => {
    const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app'); q.onsuccess = () => ok(q.result); q.onerror = no; });
    const l = await new Promise((ok) => { const q = db.transaction('lines').objectStore('lines').get(${JSON.stringify(ID)}); q.onsuccess = () => ok(q.result); });
    db.close();
    return l ? { ...l, m: Array.from(l.m, (v) => (Number.isFinite(v) ? v : null)) } : null;
  })()`);
}
/** start singing (the mirror), from a point in the song */
async function startAt(seconds, mirror = true) {
  await page.eval(`window.__mirror.on = ${mirror}`);
  await page.eval(`(() => { const r = document.querySelector('#song-position'); r.focus(); })()`);
  await page.eval(`(() => { const r = document.querySelector('#song-position');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, ${seconds});
    r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await page.key('ArrowLeft');            /* lets go of the play bar where it is: a real key, as a person would */
  await page.key('ArrowRight');
  const n = await page.eval(S('starts.length'));
  await page.tap('#song-play');
  await page.waitFor(S(`starts.length >= ${n + 2} && window.__probe.live.size >= 2`), 8000);
}
async function stopSong() {
  if (await page.eval(S('live.size > 0'))) await page.tap('#song-play');
  await page.waitFor(S('live.size === 0'), 3000);
}
async function quietWithin() {
  await page.waitFor(S('quietAt !== null'), 2000);
  return page.eval(`(() => { const P = window.__probe; return { quiet: P.quiet(), ms: P.quietAt === null ? null : Math.round(P.quietAt - P.actionAt), live: P.live.size, mic: P.micLive() }; })()`);
}
const quietOk = (q) => q.quiet && q.ms !== null && q.ms <= QUIET_MS;
const says = (q) => (q.quiet && q.ms !== null ? `silence and the mic closed in ${q.ms} ms` : `still going (sounds ${q.live}, mic ${q.mic})`);

try {
  /* the split song, stored on the phone as the app stores one */
  await page.goto(URL_APP + '?load=0#/sing');
  await page.waitFor(`!!document.querySelector('main h1')`);
  await page.eval(`window.__parts = {}`);
  for (const p of PARTS) {
    const b64 = readFileSync(`${PREFIX}-${p}.mp3`).toString('base64');
    await page.eval(`window.__parts[${JSON.stringify(p)}] = new Blob([Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0))], { type: 'audio/mpeg' })`);
  }
  const voiceMono = decode(`${PREFIX}-voice.mp3`);
  const seconds = voiceMono.length / 44100;
  await page.eval(`(async () => {
    const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app');
      q.onupgradeneeded = () => { const d = q.result; for (const s of ['songs', 'lines', 'takes']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); };
      q.onsuccess = () => ok(q.result); q.onerror = no; });
    const P = window.__parts;
    const song = { id: ${JSON.stringify(ID)}, title: 'Test song', created: Date.now(), fileName: 'test.mp3', file: P.voice, seconds: ${seconds},
      state: 'ready', voice: P.voice, music: P.music, voice30: P.voice30, music30: P.music30 };
    await new Promise((ok) => { const t = db.transaction('songs', 'readwrite'); t.objectStore('songs').put(song); t.oncomplete = ok; });
    db.close();
    delete window.__parts;
  })()`);

  /* 1. the singer's line, read on the phone, with real progress */
  await open(ID);
  const seen = [];
  const t0 = Date.now();
  let drawnWhileReading = 0;
  for (;;) {
    const s = await page.eval(`({ line: ${MAPLINE}, singer: +(${MAP}?.dataset.singer || 0) })`);
    if (s.line && seen[seen.length - 1] !== s.line) seen.push(s.line);
    if (s.line) drawnWhileReading = Math.max(drawnWhileReading, s.singer);
    if (!s.line && seen.length) break;
    if (Date.now() - t0 > 240_000) break;
    await sleep(50);
  }
  const readMs = Date.now() - t0;
  const prog = seen.map((l) => /^Reading the singer's line… (\d+:\d\d) of (\d+:\d\d)$/.exec(l)).filter(Boolean);
  const at = prog.map((m) => m[1].split(':').reduce((a, b) => a * 60 + +b, 0));
  const line = await storedLine();
  if (want('line-read')) {
    const rising = at.join() === [...at].sort((a, b) => a - b).join() && new Set(at).size >= 10;
    check('line-read', prog.length > 0 && rising && prog.every((m) => m[2] === clock(seconds)) && at[0] <= 10 && at[at.length - 1] >= seconds - 15
      && line && line.ver === LINE_VER && line.whole && line.done && line.anchored && Math.abs(line.readTo - seconds) < 0.1,
      `progress shown ${prog.length} times, ${prog[0]?.[1]} → ${prog[prog.length - 1]?.[1]} of ${prog[0]?.[2]} (the voice is ${clock(seconds)}), in ${(readMs / 1000).toFixed(0)} s; ` +
      `kept on the phone: read to ${line?.readTo.toFixed(1)} s, version ${line?.ver}, whole voice ${line?.whole}, finished ${line?.done}, with the octave anchor ${line?.anchored}`);
  }

  if (want('line-shared')) {
    /* read faster by sharing the song out to several readers at once */
    const readers = await page.eval(S('readers.size'));
    const cores = await page.eval('navigator.hardwareConcurrency');
    check('line-shared', readers >= 2, `the song was shared out to ${readers} readers (this computer reports ${cores} cores); the whole ${clock(seconds)} read in ${(readMs / 1000).toFixed(0)} s`);
  }

  if (want('line-follows')) {
    const loud = loudFrames(voiceMono, 44100);
    let L = 0, LV = 0;
    for (let k = 0; k < Math.min(loud.length, line?.m.length ?? 0); k++) if (loud[k]) { L++; if (line.m[k] != null) LV++; }
    const follows = (100 * LV) / L;
    check('line-follows', !!expected && Math.abs(follows - expected.follows) <= 0.5,
      `the line on the phone follows the voice ${follows.toFixed(1)}% of the loud time; the bake-off's ${BAKEOFF.winner} on ${RECORDING}: ${expected?.follows.toFixed(1)}%`);
  }

  /* the view: the song's range ±3, pinned */
  const range = line ? pinnedRange(line.m.map((v) => (v == null ? NaN : v))) : null;
  const sungAt = (() => {
    /* a stretch of the song with plenty of singing, for the checks below */
    const m = line?.m ?? [];
    for (let k = Math.round(40 / 0.05); k < m.length - 400; k += 20) {
      let n = 0;
      for (let j = k; j < k + 400; j++) if (m[j] != null) n++;
      if (n > 300) return k * 0.05;
    }
    return 60;
  })();

  if (want('pinned', 'voice-zero')) {
    /* the Voice slider all the way down: the singer's line is still there */
    await page.eval(`document.querySelector('#voice-volume').focus()`);
    await page.key('Home');
    await startAt(sungAt, false);
    const views = new Set();
    let singerMin = Infinity, gains = null;
    for (let i = 0; i < 20; i++) {
      await sleep(250);
      const d = await page.eval(`({ lo: ${MAP}.dataset.lo, hi: ${MAP}.dataset.hi, singer: +${MAP}.dataset.singer, playing: window.__probe.playing() })`);
      views.add(d.lo + '–' + d.hi);
      singerMin = Math.min(singerMin, d.singer);
      gains = d.playing.map((p) => p.gain);
    }
    /* somewhere else in the song: the view does not move */
    await stopSong();
    await startAt(Math.max(5, seconds - 40), false);
    for (let i = 0; i < 8; i++) {
      await sleep(250);
      views.add(await page.eval(`${MAP}.dataset.lo + '–' + ${MAP}.dataset.hi`));
    }
    await stopSong();
    await page.eval(`document.querySelector('#voice-volume').focus()`);
    await page.key('End');
    if (want('voice-zero')) {
      check('voice-zero', gains && gains[0] === 0 && gains[1] > 0 && singerMin > 20,
        `Voice at 0 (voice / music volume ${gains?.map((g) => g.toFixed(2)).join(' / ')}): the singer's line still drawn, at least ${singerMin} points on screen throughout 5 s`);
    }
    if (want('pinned')) {
      const want = range ? `${range.lo}–${range.hi}` : '?';
      check('pinned', views.size === 1 && views.has(want),
        `the view across two places in the song: ${[...views].join(', ')}; the song's own range ±3 from its line: ${want}`);
    }
  }

  if (want('placement')) {
    await startAt(sungAt);
    const opened = await page.waitFor(S('micLive() === 1'), 5000);
    await sleep(20000);
    const d = await page.eval(`(() => { const l = ${MAP}.drawn.lines; return { youT: [...l.youT], youM: [...l.youM].map((v) => Number.isFinite(v) ? v : null), singer: Array.from(l.singer, (v) => Number.isFinite(v) ? v : null), hop: l.hop }; })()`);
    await stopSong();
    const sing = d.singer.map((v) => (v == null ? NaN : v));
    const p = placement(d.youT, d.youM.map((v) => (v == null ? NaN : v)), sing, d.hop);
    const loop = await page.eval(`window.__mirror.loop`);
    check('placement', opened && p && Math.abs(p.lagMs) <= 30 && p.hits >= 0.8 && p.n >= 200,
      `singing the song's own voice with the speaker 150 ms and the mic 50 ms behind (the test's own ${(loop * 1000).toFixed(1)} ms route into the mic taken off): your line lands ${p?.lagMs >= 0 ? p?.lagMs + ' ms after' : -p?.lagMs + ' ms before'} the singer's line ` +
      `(gate ±30 ms); ${(100 * (p?.hits ?? 0)).toFixed(0)}% of ${p?.n} points within half a semitone of it`);
  }

  if (want('octave-switch')) {
    const b64 = readFileSync(LOW).toString('base64');
    await page.eval(`window.__mirror.load(${JSON.stringify(b64)})`);
    await startAt(sungAt);
    await sleep(6000);
    const diff = async () => page.eval(`(() => { const d = ${MAP}.drawn; const S = d.lines.singer, hop = d.lines.hop; const out = [];
      for (const p of d.you) { if (!Number.isFinite(p.m)) continue; const s = S[Math.round(p.t / hop)]; if (Number.isFinite(s)) out.push(p.m - s); }
      out.sort((a, b) => a - b); return { median: out[out.length >> 1], n: out.length, any: d.anyOctave }; })()`);
    const off = await diff();
    await page.tap('#any-octave');
    await sleep(500);
    const on = await diff();
    await page.tap('#any-octave');
    await sleep(500);
    const offAgain = await diff();
    await stopSong();
    await page.eval(`window.__mirror.buffer = null`);
    check('octave-switch', !off.any && on.any && Math.abs(off.median + 12) < 0.6 && Math.abs(on.median) < 0.6 && Math.abs(offAgain.median + 12) < 0.6 && off.n > 30 && on.n > 30,
      `the same voice an octave down: drawn ${off.median?.toFixed(1)} semitones from the singer by default (exact), ` +
      `${on.median?.toFixed(1)} with "Any octave" on, ${offAgain.median?.toFixed(1)} off again`);
  }

  if (want('hear-yourself')) {
    await startAt(sungAt);
    await page.waitFor(S('micLive() === 1'), 5000);
    await sleep(500);
    const offWhileSinging = await page.eval(S('monitorNow()'));
    const levelShown = await page.eval(`document.querySelector('.card .level')?.dataset.on === 'true'`);
    await page.tap('#hear-yourself');
    await sleep(300);
    const onWhileSinging = await page.eval(S('monitorNow()'));
    const hint = await page.eval(`document.querySelector('#headphones')?.textContent`);
    await stopSong();
    await sleep(300);
    const afterStop = await page.eval(S('monitorNow() + window.__probe.micLive()'));
    /* the next visit: the switch starts off, and the hint is not shown again */
    await open(ID);
    await page.tap('#hear-yourself');
    await sleep(300);
    const again = await page.eval(`({ hint: !!document.querySelector('#headphones'), monitor: window.__probe.monitorNow() })`);
    await page.tap('#hear-yourself');
    check('hear-yourself', offWhileSinging === 0 && levelShown && onWhileSinging > 0.5 && hint === copy.song.headphones && afterStop === 0 && !again.hint && again.monitor === 0,
      `off by default while singing (${offWhileSinging}); your level shown ${levelShown}; switched on: your voice back at ${onWhileSinging.toFixed(2)} and "${hint}"; ` +
      `after stopping: nothing back, mic closed ${afterStop === 0}; next visit: hint again ${again.hint}, heard while not singing ${again.monitor}`);
  }

  if (want('mic-leave')) {
    await open(ID);
    await startAt(sungAt);
    await page.waitFor(S('micLive() === 1'), 5000);
    await page.tap('#tab-home');
    const q = await quietWithin();
    await sleep(1000);
    const still = await page.eval(S('quiet() && window.__probe.monitorNow() === 0'));
    check('mic-leave', quietOk(q) && still, `${says(q)} after tapping another tab; still the same 1 s later ${still}`);
  }

  if (want('mic-hidden')) {
    await open(ID);
    await startAt(sungAt);
    await page.waitFor(S('micLive() === 1'), 5000);
    const show = await env.hide();
    const hidden = await page.waitFor(`document.visibilityState === 'hidden'`, 2000);
    const q = await quietWithin();
    await sleep(800);
    await show();
    await sleep(1000);
    const after = await page.eval(S('quiet()'));
    check('mic-hidden', hidden && quietOk(q) && after, `really hidden ${hidden}; ${says(q)}; nothing resumed on coming back ${after}`);
  }

  if (want('mic-refused')) {
    /* no mirror: the phone says no to the mic */
    await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'denied', origin: ORIGIN });
    await open(ID);
    const gum0 = await page.eval(S('gum'));
    await startAt(sungAt, false);
    const said = await page.waitFor(`document.querySelector('#mic-line')?.innerText.includes(${JSON.stringify(copy.song.micRefused)})`, 5000);
    const carry = await page.eval(`document.querySelector('#carry-on')?.textContent`);
    await sleep(1000);
    const playing = await page.eval(S('live.size === 2'));
    await page.tap('#carry-on');
    await sleep(300);
    const gone = await page.eval(`!document.querySelector('#mic-line')?.innerText.trim()`);
    const stillPlaying = await page.eval(S('live.size === 2'));
    await stopSong();
    await startAt(sungAt, false);
    await sleep(800);
    const asked = (await page.eval(S('gum'))) - gum0;
    await stopSong();
    check('mic-refused', said && carry === copy.song.carryOn && playing && gone && stillPlaying && asked === 1,
      `"${copy.song.micRefused}" ${said} with "${carry}"; the song kept playing ${playing}; after Carry on without it: message gone ${gone}, still playing ${stillPlaying}; ` +
      `the mic was asked for ${asked} time(s) over two Starts`);
  }

  if (want('reopen-line')) {
    await page.goto(URL_APP + '?load=' + ++loads + '#/sing');
    await page.waitFor(`!!document.querySelector('main h1')`);
    const reads0 = await page.eval(S('reads'));
    await open(ID);
    await sleep(300);
    await startAt(sungAt, false);
    const drawn = await page.waitFor(`+(${MAP}?.dataset.singer || 0) > 20`, 3000);
    await sleep(1500);
    const reads = (await page.eval(S('reads'))) - reads0;
    const reading = await page.eval(`!!(${MAPLINE})`);
    await stopSong();
    check('reopen-line', drawn && reads === 0 && !reading, `opened again after a reload: the singer's line drawn at once ${drawn}; the voice read again ${reads} times; "Reading…" shown ${reading}`);
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
