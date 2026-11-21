/* Robert, 22 Nov: Learn a song's map follows Train's rule: the same 30 px a
   half step, never zooming, sliding up and down with the song's notes a
   moment ahead of them, and never so that a note about to be sung is off
   screen. "Check it with both test songs and with a song that covers a
   wide range: say how often the view moves and confirm no upcoming note is
   ever out of view."

   Real voices only, kept outside the repo:
     - RP_SPLIT: the separator's real output for one song (All of Me);
     - RP_SONG2=voice.mp3:music.mp3: a second song's separated voice and
       its music (Ride);
     - the wide song: RP_SPLIT's real voice and music, cut into passages
       each moved up or down (-12 to +12 half steps, without changing its
       speed), so it spans over three octaves, with leaps of up to 9 half
       steps between passages.
   Each is stored on the phone as a split song is, its line read by the app
   itself, and the map's height read at 390 x 844 and 360 x 740. Then, from
   the line the app read and the view's path (core/songview), every 0.05 s
   of each song: are the notes of the next LOOK seconds inside the view?
   And while it plays, is the view on screen the path's? Prints a line a
   song and width; exits 1 if an upcoming note the map could have shown is
   ever out of view. A leap wider than the map can't be on screen with the
   notes before it: those are counted, with how early the far note comes
   into view. SHOTS=dir saves screenshots. */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './chrome.mjs';
import { PROBE, serve } from './harness.mjs';
import { cleanLine } from '../src/core/notemap.ts';
import { LOOK, songView } from '../src/core/songview.ts';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const PREFIX = process.env.RP_SPLIT || '';
const [V2, M2] = (process.env.RP_SONG2 || '').split(':');
const SHOTS = process.env.SHOTS || '';
if (!existsSync(`${PREFIX}-voice.mp3`) || !existsSync(`${PREFIX}-music.mp3`) || !V2 || !existsSync(V2) || !M2 || !existsSync(M2)) {
  console.log('FAIL setup: RP_SPLIT names a split song and RP_SONG2=voice.mp3:music.mp3 a second (real voices, kept outside the repo)');
  process.exit(1);
}
const tmp = mkdtempSync(join(tmpdir(), 'rp-songmap-'));
const ff = (...a) => {
  const r = spawnSync(FFMPEG, ['-v', 'error', '-y', ...a]);
  if (r.status) throw new Error(String(r.stderr));
};
const cut30 = (src, out) => ff('-i', src, '-t', '30', '-ac', '2', '-b:a', '128k', out);

/* the wide song: passages of the real song, each moved, its speed kept */
const SHIFTS = [0, 7, 12, 5, -3, -10, -12, -5, 3, 10];
function widen(src, out) {
  const len = 26;
  const parts = SHIFTS.map((s, i) => `[0:a]atrim=${i * len}:${(i + 1) * len},asetpts=PTS-STARTPTS,rubberband=pitch=${Math.pow(2, s / 12).toFixed(6)}[p${i}]`);
  ff('-i', src, '-filter_complex', parts.join(';') + ';' + SHIFTS.map((_, i) => `[p${i}]`).join('') + `concat=n=${SHIFTS.length}:v=0:a=1[o]`,
    '-map', '[o]', '-ac', '2', '-b:a', '128k', out);
}
const SONGS = [
  { id: 'map-allofme', title: 'All of Me', voice: `${PREFIX}-voice.mp3`, music: `${PREFIX}-music.mp3`, voice30: `${PREFIX}-voice30.mp3`, music30: `${PREFIX}-music30.mp3` },
  { id: 'map-ride', title: 'Ride', voice: V2, music: M2 },
  { id: 'map-wide', title: 'Wide range', voice: join(tmp, 'wide-voice.mp3'), music: join(tmp, 'wide-music.mp3') },
];
widen(`${PREFIX}-voice.mp3`, SONGS[2].voice);
widen(`${PREFIX}-music.mp3`, SONGS[2].music);
for (const s of SONGS) {
  s.voice30 ??= join(tmp, s.id + '-voice30.mp3');
  s.music30 ??= join(tmp, s.id + '-music30.mp3');
  if (!existsSync(s.voice30)) cut30(s.voice, s.voice30);
  if (!existsSync(s.music30)) cut30(s.music, s.music30);
  const r = spawnSync(FFMPEG, ['-v', 'error', '-i', s.voice, '-f', 's16le', '-ac', '1', '-ar', '8000', '-'], { maxBuffer: 1 << 28 });
  s.seconds = r.stdout.length / 2 / 8000;
}

const { server, ORIGIN, URL_APP } = await serve(REPO, APP);
/* the mic allowed, as on the phone, with a real voice (RP_MIC) */
const env = await launch({ mic: process.env.RP_MIC, allowMic: true });
await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin: ORIGIN });
const { page } = env;
await page.addInitScript(PROBE);
const MAP = `document.querySelector('#note-map')`;
let loads = 0;
const fail = [];

async function store(s) {
  await page.goto(URL_APP + '?load=' + ++loads + '#/sing');
  await page.waitFor(`!!document.querySelector('main h1')`);
  await page.eval(`window.__parts = {}`);
  for (const p of ['voice', 'music', 'voice30', 'music30']) {
    const b64 = readFileSync(s[p]).toString('base64');
    await page.eval(`window.__parts[${JSON.stringify(p)}] = new Blob([Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0))], { type: 'audio/mpeg' })`);
  }
  await page.eval(`(async () => {
    const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app');
      q.onupgradeneeded = () => { const d = q.result; for (const s of ['songs', 'lines', 'takes']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); };
      q.onsuccess = () => ok(q.result); q.onerror = no; });
    const P = window.__parts;
    const song = { id: ${JSON.stringify(s.id)}, title: ${JSON.stringify(s.title)}, created: Date.now(), fileName: 'song.mp3', file: P.voice, seconds: ${s.seconds},
      state: 'ready', voice: P.voice, music: P.music, voice30: P.voice30, music30: P.music30 };
    await new Promise((ok) => { const t = db.transaction('songs', 'readwrite'); t.objectStore('songs').put(song); t.oncomplete = ok; });
    db.close();
    delete window.__parts;
  })()`);
}
async function open(s) {
  await page.goto(URL_APP + '?load=' + ++loads + '#/sing/learn/song/' + s.id);
  await page.waitFor(`!!document.querySelector('#song-play')`, 8000);
}
async function line(s) {
  return page.eval(`(async () => {
    const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app'); q.onsuccess = () => ok(q.result); q.onerror = no; });
    const l = await new Promise((ok) => { const q = db.transaction('lines').objectStore('lines').get(${JSON.stringify(s.id)}); q.onsuccess = () => ok(q.result); });
    db.close();
    return l && l.done ? { hop: l.hop, m: Array.from(l.m, (v) => (Number.isFinite(v) ? v : null)) } : null;
  })()`);
}
async function seek(seconds) {
  await page.eval(`(() => { const r = document.querySelector('#song-position'); r.focus();
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, ${seconds});
    r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await page.key('ArrowLeft');
  await page.key('ArrowRight');
}

/** every 0.05 s: the notes of the next LOOK seconds against the view. One
    the view could have held with everything else then due is a miss, and
    there must be none; one beyond a leap wider than the map can't be on
    screen with the notes before it, so for those: how long before it is
    sung it comes into view. */
function measure(m, hop, span) {
  const v = songView(m, hop, span);
  const clean = cleanLine(m);
  const n = clean.length, look = Math.round(LOOK / hop);
  let miss = 0, seen = 0, wide = 0, missAt = 0, outAhead = 0, seenAhead = 0;
  for (let k = 0; k < n; k++) {
    const mid = v.mid(k * hop), lo = mid - span / 2, hi = mid + span / 2;
    let a = Infinity, b = -Infinity;
    for (let j = k; j <= Math.min(n - 1, k + look); j++) {
      const x = clean[j];
      if (!Number.isFinite(x)) continue;
      a = Math.min(a, x);
      b = Math.max(b, x);
      seen++;
      if (x < lo || x > hi) {
        if (b - a > span) wide++;
        else if (!miss++) missAt = k * hop;
      }
    }
    for (let j = k; j < Math.min(n, k + Math.round(5.6 / hop)); j++) {
      if (!Number.isFinite(clean[j])) continue;
      seenAhead++;
      if (clean[j] < lo || clean[j] > hi) outAhead++;
    }
  }
  /* each note past a leap wider than the map: how long before it is sung
     it is in view, counted once a phrase */
  const leadWide = [];
  for (let j = 1; j < n; j++) {
    if (!Number.isFinite(clean[j])) continue;
    let p = j - 1;
    while (p >= 0 && !Number.isFinite(clean[p])) p--;
    if (p < 0 || (j - p) * hop > LOOK || Math.abs(clean[j] - clean[p]) <= span) continue;
    let k = j;
    while (k > 0) {
      const mid = v.mid((k - 1) * hop);
      if (clean[j] < mid - span / 2 || clean[j] > mid + span / 2) break;
      k--;
    }
    leadWide.push((j - k) * hop);
  }
  leadWide.sort((x, y) => x - y);
  const notes = Array.from(clean).filter(Number.isFinite);
  const gaps = v.moves.slice(1).map((mv, i) => mv.a - v.moves[i].b).sort((x, y) => x - y);
  const ahead = v.moves.map((mv) => {
    /* how long after the glide ends the first note it was for is sung */
    for (let j = Math.round(mv.b / hop); j < n; j++) if (Number.isFinite(clean[j]) && (clean[j] < mv.from - span / 2 || clean[j] > mv.from + span / 2)) return j * hop - mv.b;
    return NaN;
  }).filter(Number.isFinite).sort((x, y) => x - y);
  return { v, miss, missAt, seen, wide, leadWide, outAhead, seenAhead, lo: Math.min(...notes), hi: Math.max(...notes), ahead, gaps,
    steps: v.moves.map((mv) => Math.abs(mv.to - mv.from)).sort((x, y) => x - y), glides: v.moves.map((mv) => mv.b - mv.a).sort((x, y) => x - y) };
}
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pct = (a, b) => (b ? ((100 * a) / b).toFixed(a === 0 ? 0 : 2) : '-');

try {
  for (const s of SONGS) {
    await store(s);
    await open(s);
    const t0 = Date.now();
    let l = null;
    while (!(l = await line(s)) && Date.now() - t0 < 300_000) await sleep(1000);
    if (!l) {
      console.log(`FAIL ${s.title}: its line was not read`);
      fail.push(s.title);
      continue;
    }
    const m = Float32Array.from(l.m, (x) => (x == null ? NaN : x));
    if (process.env.LINES_OUT) writeFileSync(join(process.env.LINES_OUT, s.id + '.json'), JSON.stringify(l));
    for (const [w, h] of [[390, 844], [360, 740]]) {
      await page.c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: SHOTS ? 2 : 1, mobile: true });
      await open(s);
      await sleep(600);
      const H = await page.eval(`${MAP}.clientHeight`);
      const span = (H - 20) / 30;
      const r = measure(m, l.hop, span);
      /* while it plays: the view on screen is the path's, its rows 30 px */
      await seek(Math.max(0, r.v.moves[Math.floor(r.v.moves.length / 2)]?.a - 2 || 20));
      await page.tap('#song-play');
      let worstDiff = 0, rows = new Set(), samples = 0;
      for (let i = 0; i < 24; i++) {
        await sleep(200);
        const d = await page.eval(`({ lo: +${MAP}.dataset.lo, hi: +${MAP}.dataset.hi, now: +${MAP}.dataset.now, row: ${MAP}.dataset.row })`);
        rows.add(d.row);
        const span2 = d.hi - d.lo;
        worstDiff = Math.max(worstDiff, Math.abs((d.lo + d.hi) / 2 - r.v.mid(d.now)), Math.abs(span2 - span));
        samples++;
      }
      if (SHOTS) {
        await page.eval(`document.activeElement?.blur(); window.scrollTo(0, 0)`);
        await sleep(300);
      }
      if (SHOTS) writeFileSync(join(SHOTS, `song-${s.id.replace('map-', '')}-${w}x${h}.png`), await page.screenshot());
      await page.tap('#song-play');
      const mins = s.seconds / 60;
      const ok = r.miss === 0 && worstDiff < 0.06 && rows.size === 1 && rows.has('30');
      if (!ok) fail.push(`${s.title} ${w}`);
      const mid = (x) => x[x.length >> 1];
      console.log(`${ok ? 'PASS' : 'FAIL'} ${s.title} at ${w} x ${h}: ${clock(s.seconds)} long, notes ${r.lo.toFixed(1)} to ${r.hi.toFixed(1)} (${(r.hi - r.lo).toFixed(1)} half steps); ` +
        `the map shows ${span.toFixed(1)} half steps at ${[...rows].join('/')} px a row; ` +
        `the view moves ${r.v.moves.length} times (${(r.v.moves.length / mins).toFixed(1)} a minute), by ${r.steps[0]?.toFixed(1)} to ${r.steps[r.steps.length - 1]?.toFixed(1)} half steps (middle ${mid(r.steps)?.toFixed(1)}), ` +
        `gliding ${r.glides[0]?.toFixed(2)} to ${r.glides[r.glides.length - 1]?.toFixed(2)} s (${r.glides.filter((g) => g < 0.05).length} instant), at least ${r.gaps[0]?.toFixed(1)} s apart (middle ${mid(r.gaps)?.toFixed(1)} s), ` +
        `done ${r.ahead[0]?.toFixed(1)} to ${r.ahead[r.ahead.length - 1]?.toFixed(1)} s before the note it was for (middle ${mid(r.ahead)?.toFixed(1)} s); ` +
        `notes of the next ${LOOK} s out of view that the map could have shown: ${r.miss} of ${r.seen}${r.miss ? ` (first at ${clock(r.missAt)})` : ''}; ` +
        `beyond a leap wider than the map: ${r.wide} (${pct(r.wide, r.seen)}%), ${r.leadWide.length} such leaps, the far note in view ${r.leadWide[0]?.toFixed(2) ?? '-'} to ${r.leadWide[r.leadWide.length - 1]?.toFixed(2) ?? '-'} s before it is sung (middle ${mid(r.leadWide)?.toFixed(2) ?? '-'} s); ` +
        `of all 5.6 s shown ahead: ${pct(r.outAhead, r.seenAhead)}% out of view; on screen while playing, the view off the path by at most ${worstDiff.toFixed(3)} half steps over ${samples} looks`);
    }
  }
} finally {
  await env.close();
  server.close();
}
console.log(fail.length ? `\n${fail.length} failed: ${fail.join(', ')}` : '\nevery song, at both widths: no upcoming note out of view that the map could show');
process.exit(fail.length ? 1 : 0);
