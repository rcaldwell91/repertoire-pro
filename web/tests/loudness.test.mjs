/* How loud things come out, measured at the speaker, on the built app, in a
   real Chrome made to behave like Chrome on Android (tests/harness.mjs).
   Robert's phone test, 22 Oct: Hear yourself was silent at first, then far
   too quiet with no level; and everything was too quiet at full volume.

   What leaves the app is measured as the speaker would sum it (everything
   connected to the way out), beside what the mic hears, over the same
   moments. The mic hears a real voice (RP_MIC), made as quiet as a raw
   phone mic with no auto gain: -24 dBFS on average. The songs are the
   separator's real first 30 seconds of one song (RP_SPLIT), made quiet,
   and a plain tone for the chain's own gain. Prints one line per check;
   exits 1 if any fails. ONLY=name,name runs some; APP_DIR points it at
   another build. */
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './chrome.mjs';
import { ANDROID, PROBE, serve } from './harness.mjs';
import { copy } from '../src/core/copy.ts';

/* Robert's numbers, 22 Oct, written here as he said them (not read from the
   app): Hear yourself at 100 about +12 dB over the mic, by ear (squared)
   like the other sliders; a song's loudest moment at -1 dBFS. */
const monitorOf = (v) => 10 ** (12 / 20) * (v / 100) ** 2;
const SONG_PEAK = 10 ** (-1 / 20);

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (...names) => !ONLY.length || names.some((n) => ONLY.includes(n));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const PREFIX = process.env.RP_SPLIT || '';
const MIC = process.env.RP_MIC || '';
if (!['voice30', 'music30'].every((p) => existsSync(`${PREFIX}-${p}.mp3`)) || !existsSync(MIC)) {
  console.log('FAIL setup: RP_SPLIT must name the separator\'s output for one song, and RP_MIC a WAV of a real voice (both kept outside the repo)');
  process.exit(1);
}

const ALL = ['monitor-before-start', 'monitor-count-in', 'monitor-after-rebuild', 'monitor-unmute', 'monitor-level', 'song-level',
  'chain-unity', 'no-page-errors'];
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
}
const dB = (v) => (v > 0 ? (20 * Math.log10(v)).toFixed(1) : '-inf') + ' dB';

/* the recordings, made here, outside the repo */
const tmp = mkdtempSync(join(tmpdir(), 'rp-loud-'));
const ff = (...a) => spawnSync(FFMPEG, ['-v', 'error', '-y', ...a], { encoding: 'utf8' });
const meanOf = (f) => +(/mean_volume: (-?[\d.]+) dB/.exec(spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', f, '-af', 'volumedetect', '-f', 'null', '-'],
  { encoding: 'utf8' }).stderr) || [0, NaN])[1];
/* the voice, singing (from 30 s in), as quiet as a raw mic: -24 dBFS on average */
const RAW = join(tmp, 'raw.wav');
ff('-ss', '30', '-t', '60', '-i', MIC, '-ac', '1', '-ar', '48000', RAW);
const MIC_WAV = join(tmp, 'mic.wav');
ff('-i', RAW, '-af', `volume=${(-24 - meanOf(RAW)).toFixed(2)}dB`, '-ac', '1', '-ar', '48000', MIC_WAV);
/* a quiet song: the real voice and music, both made five times quieter */
const QUIET = {};
for (const p of ['voice30', 'music30']) {
  QUIET[p] = join(tmp, `quiet-${p}.wav`);
  ff('-i', `${PREFIX}-${p}.mp3`, '-af', 'volume=0.2', '-ac', '2', '-ar', '44100', QUIET[p]);
}
/* a plain tone at half scale (ffmpeg's sine is at 1/8), and silence beside it, at the speaker's own rate */
const TONE = join(tmp, 'tone.wav'), HUSH = join(tmp, 'hush.wav');
ff('-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=30', '-af', 'volume=4', '-ac', '2', TONE);
ff('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', '30', HUSH);
const micMean = meanOf(MIC_WAV);
if (![MIC_WAV, TONE, HUSH, ...Object.values(QUIET)].every(existsSync) || !(Math.abs(micMean + 24) < 0.5)) {
  console.log('FAIL setup: could not make the recordings (FFMPEG)');
  process.exit(1);
}

/* the speaker and the mic, side by side, over the same moments */
const METER = `(() => {
  const M = window.__meter = { on: false, out: { sum: 0, n: 0, peak: 0 }, mic: { sum: 0, n: 0 }, sources: [], sides: 0 };
  const connect = AudioNode.prototype.connect, outs = new Map(), mics = [];
  const reader = (an) => { const b = new Float32Array(an.fftSize); return () => { an.getFloatTimeDomainData(b); return b; }; };
  const outOf = (ctx) => {
    if (outs.has(ctx)) return outs.get(ctx);
    const g = ctx.createGain(), an = ctx.createAnalyser();
    an.fftSize = 2048; connect.call(g, an);
    /* and each side on its own (an analyser mixes the two): the loudest of either */
    const split = ctx.createChannelSplitter(2);
    connect.call(g, split);
    for (const k of [0, 1]) {
      const side = ctx.createAnalyser(), b = new Float32Array(32768);
      side.fftSize = 32768; connect.call(split, side, k);
      setInterval(() => { if (ctx.state === 'closed') return; side.getFloatTimeDomainData(b);
        for (let i = 0; i < b.length; i++) { const v = Math.abs(b[i]); if (v > M.sides) M.sides = v; } }, 200);
    }
    outs.set(ctx, { g, read: reader(an), ctx });
    return outs.get(ctx);
  };
  AudioNode.prototype.connect = function (to, ...r) {
    if (to instanceof AudioDestinationNode && !(this instanceof AudioBufferSourceNode && this.buffer && this.buffer.length <= 1)) connect.call(this, outOf(this.context).g);
    return connect.call(this, to, ...r);
  };
  const ms = AudioContext.prototype.createMediaStreamSource;
  AudioContext.prototype.createMediaStreamSource = function (...a) {
    const node = ms.apply(this, a), an = this.createAnalyser();
    an.fftSize = 2048; connect.call(node, an);
    M.sources.push({ node, ctx: this, at: performance.now() });
    mics.push({ ctx: this, read: reader(an) });
    return node;
  };
  setInterval(() => {
    if (!M.on) return;
    const ctx = [...outs.keys()].filter((c) => c.state === 'running').pop();
    if (!ctx) return;
    const o = outs.get(ctx).read(), m = mics.filter((x) => x.ctx === ctx).pop();
    const mb = m ? m.read() : null;
    for (let i = 0; i < o.length; i++) {
      M.out.sum += o[i] * o[i]; M.out.n++; if (Math.abs(o[i]) > M.out.peak) M.out.peak = Math.abs(o[i]);
      if (mb) { M.mic.sum += mb[i] * mb[i]; M.mic.n++; }
    }
  }, 2048 / 48);
})();`;

const { server, ORIGIN, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: MIC_WAV, allowMic: true });
await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin: ORIGIN });
const { page } = env;
await page.addInitScript(ANDROID);
await page.addInitScript(PROBE);
await page.addInitScript(METER);
const A = (expr) => `window.__android.${expr}`;
const PLAY = `document.querySelector('#song-play')?.textContent`;
const TROUBLE = `document.querySelector('#sound-trouble-line')?.textContent`;
let loads = 0;

async function open(id) {
  await page.goto(URL_APP + '?load=' + ++loads + '#/sing/learn/song/' + id);
  await page.waitFor(`!!document.querySelector('#song-play') && !document.querySelector('#song-play').disabled`, 8000);
}
const playing = () => page.waitFor(`${PLAY} === ${JSON.stringify(copy.song.pause)} && window.__probe.live.size >= 2`, 10000);
const stopped = () => page.waitFor(`${PLAY} === ${JSON.stringify(copy.song.start)}`, 3000);
/** a slider moved by hand to a value */
const slide = (id, v) => page.eval(`(() => { const e = document.querySelector(${JSON.stringify(id)});
  if (!e) return false;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(String(v))});
  e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
/** the song itself silent, so only your voice can reach the speaker */
const songSilent = async () => {
  await slide('#voice-volume', 0);
  await slide('#music-volume', 0);
};
/** the speaker and the mic over the next `ms`: average and loudest */
async function measure(ms = 2500) {
  await page.eval(`Object.assign(window.__meter, { on: true, out: { sum: 0, n: 0, peak: 0 }, mic: { sum: 0, n: 0 } })`);
  await sleep(ms);
  return page.eval(`(() => { const M = window.__meter; M.on = false;
    const out = Math.sqrt(M.out.sum / Math.max(1, M.out.n)), mic = Math.sqrt(M.mic.sum / Math.max(1, M.mic.n));
    return { out, mic, peak: M.out.peak, ratio: mic > 0 ? out / mic : 0 }; })()`);
}
const near = (x, want, tol) => Math.abs(x / want - 1) <= tol;
const show = (m) => `your voice at the speaker ${dB(m.out)} for ${dB(m.mic)} at the mic (x${m.ratio.toFixed(2)})`;

try {
  await page.goto(URL_APP + '?load=0#/sing');
  await page.waitFor(`!!document.querySelector('main h1')`);
  await page.eval(`window.__parts = {}`);
  const put = async (name, file, type) => {
    const b64 = readFileSync(file).toString('base64');
    await page.eval(`window.__parts[${JSON.stringify(name)}] = new Blob([Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0))], { type: ${JSON.stringify(type)} })`);
  };
  for (const p of ['voice30', 'music30']) {
    await put(p, `${PREFIX}-${p}.mp3`, 'audio/mpeg');
    await put('quiet-' + p, QUIET[p], 'audio/wav');
  }
  await put('tone', TONE, 'audio/wav');
  await put('hush', HUSH, 'audio/wav');
  await page.eval(`(async () => {
    const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app');
      q.onupgradeneeded = () => { const d = q.result; for (const s of ['songs', 'lines', 'takes']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); };
      q.onsuccess = () => ok(q.result); q.onerror = no; });
    const P = window.__parts;
    const one = (id, title, voice, music) => ({ id, title, created: Date.now(), fileName: id + '.mp3', file: voice, seconds: 30, state: 'ready', voice, music });
    await new Promise((ok) => { const t = db.transaction('songs', 'readwrite'), s = t.objectStore('songs');
      s.put(one('loud-song', 'A song', P.voice30, P.music30));
      s.put(one('quiet-song', 'A quiet song', P['quiet-voice30'], P['quiet-music30']));
      s.put(one('tone-song', 'A tone', P.tone, P.hush));
      t.oncomplete = ok; });
    db.close();
    delete window.__parts;
  })()`);
  const at70 = monitorOf(70);

  /* 1. Switched on before Start: heard on the very first Start */
  if (want('monitor-before-start')) {
    await open('loud-song');
    await songSilent();
    await page.tap('#hear-yourself');
    await page.tap('#song-play');
    const ok = await playing();
    await sleep(300);
    const m = await measure();
    await page.tap('#song-play');
    await stopped();
    check('monitor-before-start', ok && near(m.ratio, at70, 0.15), `${show(m)}; the slider at 70 should give x${at70.toFixed(2)}`);
  }

  /* 2. Switched on during the 3-2-1: heard as soon as the song starts */
  if (want('monitor-count-in')) {
    await open('loud-song');
    await songSilent();
    await page.tap('#song-play');
    const counting = await page.waitFor(`!!document.querySelector('#count-in')`, 5000);
    await page.tap('#hear-yourself');
    const ok = await playing();
    await sleep(300);
    const m = await measure();
    await page.tap('#song-play');
    await stopped();
    check('monitor-count-in', counting && ok && near(m.ratio, at70, 0.15), `switched on while counting in ${counting}; ${show(m)}`);
  }

  /* 3. Start, the sound stalls, a tap rebuilds it: your voice on the new sound */
  if (want('monitor-after-rebuild')) {
    await open('loud-song');
    await songSilent();
    await page.tap('#hear-yourself');
    await page.tap('#song-play');
    const ok1 = await playing();
    await sleep(300);
    const before = await measure(1500);
    await page.eval(A('freeze()'));
    const said = await page.waitFor(`(${TROUBLE}) === ${JSON.stringify(copy.song.soundStalled)}`, 5000);
    await page.tap('#song-play');
    const ok2 = await playing();
    await sleep(300);
    const m = await measure();
    const fresh = await page.eval(`window.__meter.sources.filter((s) => s.ctx === window.__android.newest()).length`);
    await page.tap('#song-play');
    await stopped();
    check('monitor-after-rebuild', ok1 && near(before.ratio, at70, 0.15) && said && ok2 && fresh >= 1 && near(m.ratio, at70, 0.15),
      `before: ${show(before)}; stalled ${said}; after the tap, on the new sound: ${show(m)}`);
  }

  /* 4. The phone takes the mic and gives it back (a route change does this):
        the mic is wired again, as the old app did (1371-1374), and heard */
  if (want('monitor-unmute')) {
    await open('loud-song');
    await songSilent();
    await page.tap('#hear-yourself');
    await page.tap('#song-play');
    const ok = await playing();
    const n0 = await page.eval(`window.__meter.sources.length`);
    await page.eval(`(() => { const t = window.__probe.tracks.filter((x) => x.readyState === 'live').pop(); t.dispatchEvent(new Event('mute')); t.dispatchEvent(new Event('unmute')); })()`);
    await sleep(600);
    const n1 = await page.eval(`window.__meter.sources.length`);
    const live = await page.eval(`window.__meter.sources.filter((s) => !s.node.__off).length`);
    const m = await measure();
    await page.tap('#song-play');
    await stopped();
    check('monitor-unmute', ok && n1 === n0 + 1 && live === 1 && near(m.ratio, at70, 0.15),
      `the mic given back: wired again ${n1 - n0} time(s), live mic paths ${live}; ${show(m)}`);
  }

  /* 5. The Hear yourself slider: 70 at first, remembered, 0 is silent, 100
        about +12 dB over the mic and louder than the music at 100, never clipping */
  if (want('monitor-level')) {
    await open('loud-song');
    const first = await page.eval(`document.querySelector('#monitor-volume')?.value ?? null`);
    await songSilent();
    await page.tap('#hear-yourself');
    await page.tap('#song-play');
    const ok = await playing();
    await slide('#monitor-volume', 50);
    await sleep(300);
    const m50 = await measure();
    await slide('#monitor-volume', 0);
    await sleep(300);
    const m0 = await measure(1500);
    await slide('#monitor-volume', 100);
    await sleep(300);
    const m100 = await measure(4000);
    await page.tap('#song-play');
    await stopped();
    /* the music alone at 100, nothing else */
    await open('loud-song');
    const kept = await page.eval(`document.querySelector('#monitor-volume')?.value ?? null`);
    await slide('#voice-volume', 0);
    await page.tap('#song-play');
    await playing();
    await sleep(300);
    const music = await measure(4000);
    await page.tap('#song-play');
    await stopped();
    const louder = 20 * Math.log10(m100.out / music.out);
    check('monitor-level', first === '70' && ok && near(m50.ratio, monitorOf(50), 0.1) && m0.out < 1e-4 && m100.ratio >= 3.2 && m100.peak < 1 &&
      kept === '100' && louder >= 3,
      `the slider first at ${first}; at 50: ${show(m50)}; at 0: ${dB(m0.out)}; at 100: ${show(m100)}, loudest ${m100.peak.toFixed(3)}; ` +
      `the music alone at 100 ${dB(music.out)}, so your voice is ${louder.toFixed(1)} dB louder; remembered after leaving: ${kept}`);
  }

  /* 6. A quiet song comes out with its loudest moment at -1 dBFS; the level
        is kept with the song and read from there, not measured again */
  if (want('song-level')) {
    await open('quiet-song');
    await page.tap('#song-play');
    const ok = await playing();
    await page.eval(`window.__meter.sides = 0`);
    await sleep(500);
    const gains = await page.eval(`window.__probe.playing().map((p) => p.gain)`);
    /* the whole song, to its end, so its loudest moment is in it */
    const ended = await page.waitFor(`${PLAY} === ${JSON.stringify(copy.song.start)}`, 40000);
    await sleep(400);
    const peak = await page.eval(`window.__meter.sides`);
    /* the song as kept on the phone: read it, or change it */
    const idb = (body) => page.eval(`new Promise((ok, no) => { const q = indexedDB.open('repertoire-app');
      q.onerror = () => no(new Error('no store'));
      q.onsuccess = () => { const db = q.result, t = db.transaction('songs', 'readwrite'), s = t.objectStore('songs'), g = s.get('quiet-song');
        let value = null;
        g.onsuccess = () => { const out = (${body})(g.result) || {}; value = out.value ?? null; if (out.put) s.put(out.put); };
        t.oncomplete = () => { db.close(); ok(value); };
        t.onabort = t.onerror = () => { db.close(); no(new Error('could not read the song')); }; }; })`);
    const level = await idb(`(s) => ({ value: s.level ? s.level.full : null })`);
    /* kept: halve what is kept, and the song plays at half */
    await idb(`(s) => ({ put: s.level && s.level.full ? { ...s, level: { ...s.level, full: s.level.full / 2 } } : s })`);
    await open('quiet-song');
    await page.tap('#song-play');
    await playing();
    await page.eval(`window.__meter.sides = 0`);
    await page.waitFor(`${PLAY} === ${JSON.stringify(copy.song.start)}`, 40000);
    await sleep(400);
    const halved = await page.eval(`window.__meter.sides`);
    const same = gains.length === 2 && Math.abs(gains[0] - gains[1]) < 1e-6;
    check('song-level', ok && ended && same && near(peak, SONG_PEAK, 0.01) && typeof level === 'number' && level > 2 && near(halved, SONG_PEAK / 2, 0.01),
      `loudest at the speaker, either side, ${peak.toFixed(3)} (${dB(peak)}; -1 dBFS is ${SONG_PEAK.toFixed(3)}); voice and music lifted alike ${same} ` +
      `(${gains.map((g) => g.toFixed(2)).join(', ')}); kept with the song: x${typeof level === 'number' ? level.toFixed(2) : level}; ` +
      `with the kept level halved: ${halved.toFixed(3)}`);
  }

  /* 7. The way out adds nothing and takes nothing below 0.9: a tone at
        known levels comes out at exactly those levels */
  if (want('chain-unity')) {
    const rows = [];
    for (const v of [100, 70, 30]) {
      await open('tone-song');
      await slide('#voice-volume', v);
      await page.tap('#song-play');
      await playing();
      await sleep(500);
      const m = await measure(2000);
      await page.tap('#song-play');
      await stopped();
      const sent = SONG_PEAK * (v / 100) ** 2;
      rows.push({ v, sent, got: m.peak, gain: m.peak / sent });
    }
    check('chain-unity', rows.every((r) => near(r.gain, 1, 0.01)),
      rows.map((r) => `slider ${r.v}: sent ${r.sent.toFixed(3)}, came out ${r.got.toFixed(3)} (gain ${r.gain.toFixed(3)})`).join('; '));
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
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} of ${results.length} checks FAILED` : `\nall ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
