/* Robert, 23 Nov: "neither you nor I can hear, so every sound fix is
   measured: record the app's own audio output for each exercise you touch
   and read the waveform (when each piano note starts, how long it sounds,
   how it fades, and the gap to the next)".

   Runs exercises on the built app in a real Chrome and records exactly what
   the app sends to the speaker: everything connected to the audio output is
   also fed to a recorder in the page. Saves, for each, a WAV and the notes
   the app planned (OUT/<name>.wav, OUT/<name>.json); scripts/waveform.py
   measures and draws them.

   RUNS="mum:2,bwoop:2" picks exercises and levels; SECONDS how long each is
   recorded (default 12); the range is C3 to C5 so the first round starts
   on C3, as the course's men's tracks do. The mic is silent: the piano
   alone is recorded. */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { launch, sleep } from './chrome.mjs';
import { ANDROID, PROBE, serve } from './harness.mjs';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const OUT = resolve(process.env.OUT || 'audio-out');
const SECONDS = +(process.env.SECONDS || 12);
const RUNS = (process.env.RUNS || 'mum:2').split(',').map((x) => x.split(':'));
mkdirSync(OUT, { recursive: true });

/* the recorder: anything connected to an AudioContext's output is also
   connected to a recorder that keeps every sample it hears */
const TAP = `(() => {
  const keep = window.__tap = { chunks: [], rate: 0, first: null, notes: [] };
  const rec = new WeakMap();
  const connect = AudioNode.prototype.connect;
  /* which file each sound was decoded from, so each note scheduled is known
     by its sample and playback rate: what the app asked to be played */
  const urlOf = new WeakMap(), bufUrl = new WeakMap();
  const ab = Response.prototype.arrayBuffer;
  Response.prototype.arrayBuffer = async function () { const r = await ab.call(this); urlOf.set(r, this.url); return r; };
  const dec = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (a, ...rest) {
    const u = urlOf.get(a);
    return dec.call(this, a, ...rest).then((b) => { if (u) bufUrl.set(b, u); return b; });
  };
  const st = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when = 0, ...r) {
    if (keep.on && this.buffer && this.buffer.length > 1) keep.notes.push(this.__note = { when, url: bufUrl.get(this.buffer) || null, rate: this.playbackRate.value, now: this.context.currentTime });
    return st.call(this, when, ...r);
  };
  /* where the app lets each note go, and how fast: its gain's fall to 0 */
  const owner = new WeakMap();
  const cg = BaseAudioContext.prototype.createGain;
  BaseAudioContext.prototype.createGain = function (...a) { const g = cg.apply(this, a); owner.set(g.gain, g); return g; };
  const stt = AudioParam.prototype.setTargetAtTime;
  AudioParam.prototype.setTargetAtTime = function (target, time, tau) {
    const g = owner.get(this), n = g && g.__src && g.__src.__note;
    if (n && target === 0 && n.letGo == null) { n.letGo = time; n.tau = tau; }
    return stt.call(this, target, time, tau);
  };
  const recorder = (ctx) => {
    if (rec.has(ctx)) return rec.get(ctx);
    const sp = ctx.createScriptProcessor(4096, 2, 2);
    sp.onaudioprocess = (e) => {
      if (!keep.on) return;
      keep.rate = ctx.sampleRate;
      if (keep.first == null) keep.first = e.playbackTime;
      const a = e.inputBuffer.getChannelData(0), b = e.inputBuffer.getChannelData(1);
      const m = new Float32Array(a.length);
      for (let i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) / 2;
      keep.chunks.push(m);
    };
    const zero = ctx.createGain();
    zero.gain.value = 0;
    rec.set(ctx, sp);
    connect.call(sp, zero);
    connect.call(zero, ctx.destination);
    return sp;
  };
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = connect.call(this, dest, ...rest);
    if (this instanceof AudioBufferSourceNode && dest instanceof GainNode) dest.__src = this;
    if (dest instanceof AudioDestinationNode) {
      try { connect.call(this, recorder(dest.context)); } catch {}
    }
    return r;
  };
})();`;

function wav(samples, rate) {
  const b = Buffer.alloc(44 + samples.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + samples.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32767))), 44 + i * 2);
  return b;
}

const tmp = mkdtempSync(join(tmpdir(), 'rp-audio-'));
const SILENCE = join(tmp, 'silence.wav');
spawnSync(process.env.FFMPEG || 'ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '120', SILENCE]);
const { server, ORIGIN, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: SILENCE, allowMic: true });
await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin: ORIGIN });
const { page } = env;
/* first, so the scripts after it use its decoding */
await page.addInitScript(TAP);
await page.addInitScript(ANDROID);
await page.addInitScript(PROBE);
await page.c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
let loads = 0;
try {
  for (const [id, level, name = `${id}-L${level}`] of RUNS) {
    await page.goto(URL_APP + '?load=' + ++loads + '#/train');
    await page.waitFor(`!!document.querySelector('#today')`, 8000);
    /* C3 to C5: the first round on C3 (the ladder starts one above the bottom) */
    await page.eval(`localStorage.clear(); localStorage.setItem('rp.range', JSON.stringify({ lo: 47, hi: 72, at: '2026-11-23T00:00:00Z', by: 'test' }));
      localStorage.setItem('rp.level.${id}', '${level}'); localStorage.setItem('rp.headphones', '1')`);
    await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/' + id);
    await page.waitFor(`!!document.querySelector('#ex-start')`, 8000);
    const plan = await page.eval(`(() => { const d = document.querySelector('#ex-start').dataset; return { round: d.round ? JSON.parse(d.round) : null }; })()`);
    await page.eval(`window.__tap.chunks = []; window.__tap.notes = []; window.__tap.first = null; window.__tap.on = true`);
    await page.tap('#ex-start');
    await sleep(SECONDS * 1000);
    await page.eval(`window.__tap.on = false`);
    const rate = await page.eval(`window.__tap.rate`);
    /* each sound the app started: when (its clock), and for a piano note
       its pitch, from its sample and playback rate */
    const scheduled = (await page.eval(`window.__tap.notes`)).map((n) => {
      const f = /piano\/(\d+)\.mp3/.exec(n.url || '');
      const at = n.when > 0 ? n.when : n.now;
      return f ? { at, kind: 'piano', midi: +f[1] + 12 * Math.log2(n.rate), letGo: n.letGo ?? null, tau: n.tau ?? null } : { at, kind: n.url && n.url.startsWith('data:') ? 'click' : 'other' };
    });
    const n = await page.eval(`window.__tap.chunks.length`);
    const parts = [];
    for (let i = 0; i < n; i += 20) {
      const b64 = await page.eval(`(() => { const c = window.__tap.chunks.slice(${i}, ${i + 20}); const len = c.reduce((a, x) => a + x.length, 0);
        const all = new Float32Array(len); let o = 0; for (const x of c) { all.set(x, o); o += x.length; }
        let s = ''; const u = new Uint8Array(all.buffer); for (let k = 0; k < u.length; k += 32768) s += String.fromCharCode.apply(null, u.subarray(k, k + 32768)); return btoa(s); })()`);
      const buf = Buffer.from(b64, 'base64');
      parts.push(new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4));
    }
    const len = parts.reduce((a, x) => a + x.length, 0), all = new Float32Array(len);
    let o = 0;
    for (const x of parts) { all.set(x, o); o += x.length; }
    await page.tap('#ex-close').catch(() => {});
    writeFileSync(join(OUT, name + '.wav'), wav(all, rate));
    writeFileSync(join(OUT, name + '.json'), JSON.stringify({ id, level: +level, rate, seconds: len / rate, plan, scheduled }));
    console.log(`${name}: ${(len / rate).toFixed(1)} s at ${rate} Hz, peak ${all.reduce((m, x) => Math.max(m, Math.abs(x)), 0).toFixed(3)}`);
  }
} finally {
  await env.close();
  server.close();
}
