/* How loud things come out, measured at the speaker, on the built app, in a
   real Chrome made to behave like Chrome on Android (tests/harness.mjs).
   Robert's phone test, 22 Oct: Hear yourself was silent at first, then far
   too quiet with no level; and everything was too quiet at full volume.

   What leaves the app is measured as the speaker would sum it (everything
   connected to the way out), beside what the mic hears, over the same
   moments. The mic hears a real voice (RP_MIC), made as quiet as a raw
   phone mic with no auto gain: -24 dBFS on average. The songs are the
   separator's real first 30 seconds of one song (RP_SPLIT), as it is and
   made quiet. Loudness is recorded sample by sample at the speaker and
   read with ffmpeg's EBU R128 meter (LUFS, true peak). Prints one line per
   check; exits 1 if any fails. ONLY=name,name runs some; APP_DIR points it
   at another build. */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './chrome.mjs';
import { ANDROID, PROBE, serve } from './harness.mjs';
import { copy } from '../src/core/copy.ts';

/* Robert's numbers, written here as he said them (not read from the app):
   Hear yourself at 100 enough to stay about 3 dB over the music (23 Oct:
   measured, six times the mic), by ear (squared) like the other sliders;
   a song's loudest moment at -1 dBFS (22 Oct). */
const monitorOf = (v) => 6 * (v / 100) ** 2;
const SONG_PEAK = 10 ** (-1 / 20);

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (...names) => !ONLY.length || names.some((n) => ONLY.includes(n));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const PREFIX = process.env.RP_SPLIT || '';
const MIC = process.env.RP_MIC || '';
/* Ride, from RP_RECORDINGS ("Name:path,..."): its loud chorus has the sharp peaks a ceiling must hold between the samples */
const RIDE = ((process.env.RP_RECORDINGS || '').split(',').map((x) => x.split(':')).find((x) => x[0] === 'Ride') || [])[1] || '';
if (!['voice30', 'music30'].every((p) => existsSync(`${PREFIX}-${p}.mp3`)) || !existsSync(MIC) || !existsSync(RIDE)) {
  console.log('FAIL setup: RP_SPLIT must name the separator\'s output for one song, RP_MIC a WAV of a real voice, and RP_RECORDINGS hold Ride (all kept outside the repo)');
  process.exit(1);
}

const ALL = ['monitor-before-start', 'monitor-count-in', 'monitor-after-rebuild', 'monitor-unmute', 'monitor-level', 'monitor-remembered', 'song-level',
  'song-full', 'song-loudness', 'song-mic', 'song-louder', 'peaks-held', 'no-page-errors'];
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
/* Ride's chorus, 30 s from 3 minutes in, and silence beside it */
const RIDE30 = join(tmp, 'ride30.wav'), HUSH = join(tmp, 'hush.wav');
ff('-ss', '180', '-t', '30', '-i', RIDE, '-ac', '2', '-ar', '44100', RIDE30);
ff('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-t', '30', HUSH);
const micMean = meanOf(MIC_WAV);
/* the song's own files, voice and music added together: how loud it is in itself */
const SONG_OWN = r128Of(spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', `${PREFIX}-voice30.mp3`, '-i', `${PREFIX}-music30.mp3`, '-filter_complex',
  '[0:a][1:a]amix=inputs=2:normalize=0,ebur128=peak=true+sample:framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' }).stderr);
/* the quiet song's loudest moment, voice and music together, as decoded at the speaker's rate */
const QUIET_PEAK = (() => {
  const out = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-i', QUIET.voice30, '-i', QUIET.music30, '-filter_complex',
    '[0:a][1:a]amix=inputs=2:normalize=0,aresample=48000,aformat=sample_fmts=flt,astats=measure_perchannel=none:measure_overall=Peak_level', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  return 10 ** (+((/Peak level dB: (-?[\d.]+)/.exec(out) || [])[1] ?? NaN) / 20);
})();
if (![MIC_WAV, RIDE30, HUSH, ...Object.values(QUIET)].every(existsSync) || !(Math.abs(micMean + 24) < 0.5) || !Number.isFinite(SONG_OWN.lufs) || !Number.isFinite(QUIET_PEAK)) {
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
    /* and every sample, both sides, while recording (for the loudness meter) */
    g.channelCount = 2; g.channelCountMode = 'explicit';
    const sp = ctx.createScriptProcessor(4096, 2, 2);
    connect.call(g, sp); connect.call(sp, ctx.destination);
    sp.onaudioprocess = (e) => { if (!M.rec || ctx.state !== 'running') return;
      M.l.push(new Float32Array(e.inputBuffer.getChannelData(0))); M.r.push(new Float32Array(e.inputBuffer.getChannelData(1))); M.at.push(e.playbackTime); M.rate = ctx.sampleRate; };
    outs.set(ctx, { g, read: reader(an), ctx });
    return outs.get(ctx);
  };
  M.rec = false; M.l = []; M.r = []; M.at = []; M.rate = 48000;
  /* what was recorded, both sides interleaved, as base64, a piece at a time */
  M.take = (from, n) => { const l = M.l.slice(from, from + n), r = M.r.slice(from, from + n);
    let len = 0; l.forEach((c) => (len += c.length)); const out = new Float32Array(len * 2); let k = 0;
    l.forEach((c, j) => { for (let i = 0; i < c.length; i++) { out[k++] = c[i]; out[k++] = r[j][i]; } });
    const b = new Uint8Array(out.buffer); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s); };
  AudioNode.prototype.connect = function (to, ...r) {
    if (to instanceof AudioDestinationNode && !(this instanceof AudioBufferSourceNode && this.buffer && this.buffer.length <= 1) && !(this instanceof ScriptProcessorNode)) connect.call(this, outOf(this.context).g);
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

/** the song's page, with Hear yourself off unless asked for (it is remembered between visits) */
async function open(id, hear = false) {
  await page.goto(URL_APP + '?load=' + ++loads + '#/sing/learn/song/' + id);
  await page.waitFor(`!!document.querySelector('#song-play') && !document.querySelector('#song-play').disabled`, 8000);
  await hearOn(hear);
}
const hearIs = () => page.eval(`document.querySelector('#hear-yourself')?.checked ?? null`);
/** Hear yourself switched on or off by hand, whichever it is now */
async function hearOn(on) {
  if ((await hearIs()) !== on) await page.tap('#hear-yourself');
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
/** EBU R128, as ffmpeg's meter reads it: integrated loudness (LUFS), true peak and sample peak (dBFS) */
function r128(args) {
  return r128Of(spawnSync(FFMPEG, ['-hide_banner', '-nostats', ...args, '-af', 'ebur128=peak=true+sample:framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' }).stderr);
}
function r128Of(out) {
  const pick = (re) => +((re.exec(out) || [])[1] ?? NaN);
  return { lufs: pick(/I:\s+(-?[\d.]+) LUFS/), truePeak: pick(/True peak:\s+Peak:\s+(-?[\d.]+)/), samplePeak: pick(/Sample peak:\s+Peak:\s+(-?[\d.]+)/) };
}
/* The loudest point between the samples, read the way the standard meter
   reads it (four times the rate, through a smooth filter), but only where
   the recording runs on unbroken. The recorder hands over the sound a block
   at a time; on a busy machine a block can be missed, and the jump where the
   recording joins up again reads as a peak the app never sent (17 Nov: one
   run of six read -1.0 dB that way). Each block carries its time, so a
   missed one is seen, counted, and the stretches either side are read on
   their own, away from their ends. */
const UP = 4, TAPS = 12;
const KERNEL = (() => {
  const k = [];
  for (let p = 0; p < UP; p++) {
    const row = [];
    for (let j = -TAPS; j < TAPS; j++) {
      const x = j - p / UP, w = 0.5 + 0.5 * Math.cos((Math.PI * x) / TAPS);
      row.push(x === 0 ? 1 : (Math.sin(Math.PI * x) / (Math.PI * x)) * w);
    }
    k.push(row);
  }
  return k;
})();
function truePeakOf(ch, from, to) {
  let peak = 0;
  for (let i = from + TAPS; i < to - TAPS; i++) {
    for (let p = 0; p < UP; p++) {
      const row = KERNEL[p];
      let s = 0;
      for (let j = 0; j < row.length; j++) s += row[j] * ch[i + j - TAPS + 1];
      const a = Math.abs(s);
      if (a > peak) peak = a;
    }
  }
  return peak;
}
/** what left the app while `run` ran, recorded at the speaker, measured */
async function recorded(run) {
  await page.eval(`Object.assign(window.__meter, { rec: true, l: [], r: [], at: [] })`);
  await run();
  await page.eval(`window.__meter.rec = false`);
  const n = await page.eval(`window.__meter.l.length`), rate = await page.eval(`window.__meter.rate`);
  const at = await page.eval(`window.__meter.at`), size = await page.eval(`window.__meter.l[0]?.length ?? 4096`);
  const bufs = [];
  for (let i = 0; i < n; i += 64) bufs.push(Buffer.from(await page.eval(`window.__meter.take(${i}, 64)`), 'base64'));
  const all = Buffer.concat(bufs);
  const raw = join(tmp, 'out-' + Date.now() + '.f32');
  writeFileSync(raw, all);
  /* unbroken stretches: a block that comes a block or more late starts a new one */
  const breaks = [0];
  /* (block times wobble by a render quantum, 128 samples, either way: a missed block is a whole one late) */
  for (let i = 1; i < at.length; i++) if (at[i] - at[i - 1] > 1.5 * size / rate) breaks.push(i);
  breaks.push(at.length);
  if (process.env.RP_DEBUG) console.log('blocks', at.length, 'size', size, 'rate', rate, 'steps', at.slice(1, 40).map((t, i) => ((t - at[i]) * rate).toFixed(1)).join(' '));
  const f = new Float32Array(all.buffer, all.byteOffset, all.length / 4);
  const len = f.length / 2, l = new Float32Array(len), r = new Float32Array(len);
  for (let i = 0; i < len; i++) { l[i] = f[2 * i]; r[i] = f[2 * i + 1]; }
  let tp = 0;
  for (let b = 0; b + 1 < breaks.length; b++) {
    const from = breaks[b] * size, to = breaks[b + 1] * size;
    tp = Math.max(tp, truePeakOf(l, from, to), truePeakOf(r, from, to));
  }
  const whole = r128(['-f', 'f32le', '-ar', String(rate), '-ac', '2', '-i', raw]);
  return { seconds: all.length / 8 / rate, ...whole, meterTruePeak: whole.truePeak, truePeak: 20 * Math.log10(tp), missed: breaks.length - 2 };
}
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
  await put('ride', RIDE30, 'audio/wav');
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
      s.put(one('ride-song', 'Ride', P.ride, P.hush));
      t.oncomplete = ok; });
    db.close();
    delete window.__parts;
  })()`);
  const at70 = monitorOf(70);

  /* 1. Switched on before Start: heard on the very first Start */
  if (want('monitor-before-start')) {
    await open('loud-song');
    await songSilent();
    await hearOn(true);
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
    await hearOn(true);
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
    await hearOn(true);
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
    await hearOn(true);
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
        at the top Robert set, never clipping, and about 3 dB over the music
        at 100 (Robert, 23 Oct: "clearly louder than the music") */
  if (want('monitor-level')) {
    await open('loud-song');
    const first = await page.eval(`document.querySelector('#monitor-volume')?.value ?? null`);
    await songSilent();
    await hearOn(true);
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
    /* at 100 the ceiling rounds off the voice's loudest moments, so a little
       under six: x5.6 with the ceiling at 0.8, x5.4 at 0.7, about x5.2 at
       0.66 (17 Nov: peaks under -1 dB between the samples), 2.8, 2.5 and
       about 2.3 dB over the music */
    check('monitor-level', first === '70' && ok && near(m50.ratio, monitorOf(50), 0.1) && m0.out < 1e-4 && near(m100.ratio, monitorOf(100), 0.15) && m100.peak < 1 &&
      kept === '100' && louder >= 2,
      `the slider first at ${first}; at 50: ${show(m50)}; at 0: ${dB(m0.out)}; at 100: ${show(m100)}, loudest ${m100.peak.toFixed(3)}; ` +
      `the music alone at 100 ${dB(music.out)}, so your voice is ${louder.toFixed(1)} dB louder; remembered after leaving: ${kept}`);
  }

  /* 5b. Robert, 23 Oct: whether Hear yourself is on is remembered between
         visits, as the old app did (rep_monitor, 1318-1320): on again, it is
         heard on the first Start; off again, nothing */
  if (want('monitor-remembered')) {
    await open('loud-song');
    await songSilent();
    await slide('#monitor-volume', 70);                /* the volume is remembered too: from 70 */
    await hearOn(true);
    await page.goto(URL_APP + '?load=' + ++loads + '#/sing/learn/song/loud-song');
    await page.waitFor(`!!document.querySelector('#song-play') && !document.querySelector('#song-play').disabled`, 8000);
    const on = await hearIs();
    await songSilent();
    await page.tap('#song-play');
    const ok = await playing();
    await sleep(300);
    const m = await measure();
    await page.tap('#song-play');
    await stopped();
    await hearOn(false);
    await page.goto(URL_APP + '?load=' + ++loads + '#/sing/learn/song/loud-song');
    await page.waitFor(`!!document.querySelector('#song-play') && !document.querySelector('#song-play').disabled`, 8000);
    const off = await hearIs();
    await songSilent();
    await page.tap('#song-play');
    await playing();
    await sleep(300);
    const quiet = await measure(1500);
    await page.tap('#song-play');
    await stopped();
    check('monitor-remembered', on === true && ok && near(m.ratio, at70, 0.15) && off === false && quiet.out < 1e-4,
      `switched on, then back to the song: on ${on}, ${show(m)}; switched off, then back: on ${off}, your voice at the speaker ${dB(quiet.out)}`);
  }

  /* 6. A quiet song is lifted so its loudest moment would be at -1 dBFS,
        voice and music alike, before the loudness stage; the level is kept
        with the song and read from there, not measured again */
  if (want('song-level')) {
    /* the song's own loudest moment, as decoded: what it is lifted from */
    await open('quiet-song');
    await page.tap('#song-play');
    const ok = await playing();
    await sleep(500);
    const gains = await page.eval(`window.__probe.playing().map((p) => p.gain)`);
    await page.tap('#song-play');
    await stopped();
    const own = QUIET_PEAK;
    /* the song as kept on the phone: read it, or change it */
    const idb = (body) => page.eval(`new Promise((ok, no) => { const q = indexedDB.open('repertoire-app');
      q.onerror = () => no(new Error('no store'));
      q.onsuccess = () => { const db = q.result, t = db.transaction('songs', 'readwrite'), s = t.objectStore('songs'), g = s.get('quiet-song');
        let value = null;
        g.onsuccess = () => { const out = (${body})(g.result) || {}; value = out.value ?? null; if (out.put) s.put(out.put); };
        t.oncomplete = () => { db.close(); ok(value); };
        t.onabort = t.onerror = () => { db.close(); no(new Error('could not read the song')); }; }; })`);
    const level = await idb(`(s) => ({ value: s.level ? s.level.full : null })`);
    /* kept: halve what is kept, and the song is sent at half */
    await idb(`(s) => ({ put: s.level && s.level.full ? { ...s, level: { ...s.level, full: s.level.full / 2 } } : s })`);
    await open('quiet-song');
    await page.tap('#song-play');
    await playing();
    await sleep(500);
    const halved = await page.eval(`window.__probe.playing().map((p) => p.gain)`);
    await page.tap('#song-play');
    await stopped();
    const same = gains.length === 2 && Math.abs(gains[0] - gains[1]) < 1e-6;
    check('song-level', ok && same && near(gains[0] * own, SONG_PEAK, 0.01) && typeof level === 'number' && near(level, gains[0], 1e-6) &&
      halved.length === 2 && near(halved[0], gains[0] / 2, 1e-6),
      `the quiet song's loudest moment ${own.toFixed(3)}, sent at x${gains.map((g) => g.toFixed(2)).join(' and x')} (voice and music alike ${same}), ` +
      `so at ${(gains[0] * own).toFixed(3)} (-1 dBFS is ${SONG_PEAK.toFixed(3)}); kept with the song: x${typeof level === 'number' ? level.toFixed(2) : level}; ` +
      `with the kept level halved, sent at x${halved.map((g) => g.toFixed(2)).join(' and x')}`);
  }

  /* 6b. A song whose parts together already reach full volume is brought
         up, never down: it plays as it is, and the limiter holds its peaks
         (the real song: voice and music together peak at +0.4 dB) */
  if (want('song-full')) {
    await open('loud-song');
    await page.tap('#song-play');
    const ok = await playing();
    await sleep(500);
    const gains = await page.eval(`window.__probe.playing().map((p) => p.gain)`);
    await page.tap('#song-play');
    await stopped();
    check('song-full', ok && gains.length === 2 && gains.every((g) => Math.abs(g - 1) < 1e-6),
      `a song already at full volume plays at ${gains.map((g) => g.toFixed(3)).join(' / ')} (1 is as it is)`);
  }

  /* 7. Robert, 23 Oct: the old app's v9.8 loudness stage, as it was, peaks
        held under -1 dB. His song at sliders 100 comes out 3 to 6 dB louder
        than its own files (which is how it played before), by the standard
        meter (EBU R128) */
  if (want('song-loudness')) {
    await open('loud-song');
    await page.tap('#song-play');
    const ok = await playing();
    const m = await recorded(() => page.waitFor(`${PLAY} === ${JSON.stringify(copy.song.start)}`, 40000));
    const lift = m.lufs - SONG_OWN.lufs;
    check('song-loudness', ok && m.seconds > 25 && lift >= 3 && lift <= 6 && m.truePeak < -1 && m.samplePeak < -1,
      `the song's own files ${SONG_OWN.lufs.toFixed(1)} LUFS (peak ${SONG_OWN.truePeak.toFixed(1)} dBFS); at the speaker over ${m.seconds.toFixed(0)} s: ` +
      `${m.lufs.toFixed(1)} LUFS, ${lift >= 0 ? '+' : ''}${lift.toFixed(1)} dB louder; true peak ${m.truePeak.toFixed(1)} dBFS, sample peak ${m.samplePeak.toFixed(1)} dBFS`);
  }

  /* Robert, 17 Nov: "the song is still too quiet", even with Hear yourself
     off. The song at 100 with the mic open and with it refused (Carry on):
     what the app sends to the speaker is the same either way; and with
     Hear yourself at his 42 */
  if (want('song-mic')) {
    const take = async () => {
      await page.tap('#song-play');
      const ok = await playing();
      const m = await recorded(() => sleep(15000));
      await page.tap('#song-play');
      await stopped();
      return { ok, ...m };
    };
    await open('loud-song');
    const on = await take();
    /* the mic refused: the song plays all the same (RULEBOOK 3), with no mic */
    await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'denied', origin: ORIGIN });
    await open('loud-song');
    const off = await take();
    const noMic = await page.eval(`window.__probe.micLive() === 0`);
    await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin: ORIGIN });
    await open('loud-song', true);
    await slide('#monitor-volume', 42);
    const hear = await take();
    await slide('#monitor-volume', 70);
    await hearOn(false);
    const db = (x) => `${x.lufs.toFixed(1)} LUFS (true peak ${x.truePeak.toFixed(1)} dBFS)`;
    check('song-mic', on.ok && off.ok && noMic && off.seconds > 12 && Math.abs(on.lufs - off.lufs) <= 0.5 && hear.lufs >= on.lufs - 0.5,
      `the song at 100, 15 s: with the mic open ${db(on)}; with the mic refused ${db(off)} (no mic open ${noMic}); ` +
      `with the mic open and Hear yourself at 42 ${db(hear)}`);
  }

  /* Robert, 17 Nov: "He wants it louder": Voice and Music go on to 200,
     twice the song's level, as the old app's Hear me did. Moved by hand to
     the top, they stop at 200, the song is sent at twice, and it comes out
     louder than at 100 (the same 15 s), its peaks still under -1 dB */
  if (want('song-louder')) {
    const at = async (v) => {
      await open('loud-song');
      await slide('#voice-volume', v);
      await slide('#music-volume', v);
      const shown = await page.eval(`[...document.querySelectorAll('#voice-volume, #music-volume')].map((e) => [e.max, e.value, e.closest('label').textContent.trim()])`);
      await page.tap('#song-play');
      const ok = await playing();
      await sleep(300);
      const gains = await page.eval(`window.__probe.playing().map((p) => p.gain)`);
      const m = await recorded(() => sleep(15000));
      await page.tap('#song-play');
      await stopped();
      return { ok, shown, gains, ...m };
    };
    const a = await at(100), b = await at(250);
    const louder = b.lufs - a.lufs;
    const db = (x) => `${x.lufs.toFixed(1)} LUFS, true peak ${x.truePeak.toFixed(1)} dBFS, sample peak ${x.samplePeak.toFixed(1)} dBFS`;
    check('song-louder', a.ok && b.ok && b.shown.every(([max, v, t]) => max === '200' && v === '200' && t.endsWith('200%')) &&
      a.gains.every((g) => Math.abs(g - 1) < 1e-6) && b.gains.length === 2 && b.gains.every((g) => Math.abs(g - 2) < 1e-6) &&
      louder >= 0.8 && b.truePeak < -1 && b.samplePeak < -1 && a.truePeak < -1,
      `the sliders moved to the top: ${b.shown.map(([max, v, t]) => `${t} (stops at ${max})`).join(', ')}; sent at x${b.gains.map((g) => g.toFixed(2)).join(' and x')}; ` +
      `the song, 15 s, at 100: ${db(a)}; at 200: ${db(b)}; ${louder >= 0 ? '+' : ''}${louder.toFixed(1)} dB louder`);
  }

  /* 8. Everything at the top at once, the song and your voice back at the
        top of its slider: still never over -1 dB, between the samples.
        And Ride's chorus, whose sharp peaks get past a ceiling between the
        samples unless it runs faster than the sound (measured offline:
        -0.7 dB at the plain rate). At 100, and at 200 (Robert, 17 Nov:
        "on every test song at every slider setting, every run") */
  if (want('peaks-held')) {
    const rows = [];
    let all = true;
    for (const v of [100, 200]) {
      await open('ride-song');
      await slide('#voice-volume', v);
      await slide('#music-volume', v);
      await page.tap('#song-play');
      const rideOk = await playing();
      const ride = await recorded(() => page.waitFor(`${PLAY} === ${JSON.stringify(copy.song.start)}`, 40000));
      await open('loud-song', true);
      await slide('#voice-volume', v);
      await slide('#music-volume', v);
      await slide('#monitor-volume', 100);
      await page.tap('#song-play');
      const ok = await playing();
      const m = await recorded(() => sleep(12000));
      await page.tap('#song-play');
      await stopped();
      await slide('#monitor-volume', 70);
      await hearOn(false);
      all = all && rideOk && ride.seconds > 25 && ride.truePeak < -1 && ride.samplePeak < -1 && ok && m.seconds > 10 && m.truePeak < -1 && m.samplePeak < -1;
      /* at most two blocks missed (each 0.09 s), so nearly all of it is read */
      all = all && ride.missed <= 2 && m.missed <= 2;
      const tp = (x) => `true peak ${x.truePeak.toFixed(2)} dBFS (the standard meter over the whole: ${x.meterTruePeak.toFixed(1)}; blocks missed by the recorder: ${x.missed})`;
      rows.push(`Ride's chorus at ${v}, over ${ride.seconds.toFixed(0)} s: ${tp(ride)}, sample peak ${ride.samplePeak.toFixed(1)} dBFS, ${ride.lufs.toFixed(1)} LUFS; ` +
        `the song at ${v} and your voice back at 100, over ${m.seconds.toFixed(0)} s: ${tp(m)}, sample peak ${m.samplePeak.toFixed(1)} dBFS, ${m.lufs.toFixed(1)} LUFS`);
    }
    check('peaks-held', all, rows.join('; '));
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
