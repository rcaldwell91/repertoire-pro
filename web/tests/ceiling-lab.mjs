/* The way out, offline (Robert, 17 Nov: "the song is still too quiet"; and
   the 16 Nov report: the stage that rounds off the loudest peaks sat too
   close to -1 dB). The app's own sound chain (audio/engine-web: LOUD and
   CEILING, the same nodes in the same order) is built in Chrome's offline
   renderer, so a 30 s song renders in moments and the same way every time,
   and each version of it is measured with ffmpeg's EBU R128 meter: loudness
   (LUFS), true peak (between the samples) and sample peak.

   For each song (RP_SPLIT's voice and music; Ride's chorus, RP_RECORDINGS;
   the same song made five times quieter), at slider gains G, with your
   voice back at the top of Hear yourself or not (RP_MIC, at -24 dBFS, as
   tests/loudness), at several small offsets between the voice and the song
   (true peaks depend on how they line up), it prints one line per version
   of the chain. VARIANTS picks the versions (JSON). Measures; doesn't pass
   or fail. */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { launch } from './chrome.mjs';

const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const PREFIX = process.env.RP_SPLIT || '';
const RIDE = ((process.env.RP_RECORDINGS || '').split(',').map((x) => x.split(':')).find((x) => x[0] === 'Ride') || [])[1] || '';
const MIC = process.env.RP_MIC || '';
const tmp = mkdtempSync(join(tmpdir(), 'rp-ceiling-'));
const cut = (src, name, args) => {
  const out = join(tmp, name + '.mp3');
  spawnSync(FFMPEG, ['-v', 'error', '-y', ...args.pre, '-i', src, ...args.post, '-ac', '2', '-ar', '48000', '-b:a', '256k', out]);
  return readFileSync(out).toString('base64');
};
const files = {
  voice: cut(`${PREFIX}-voice30.mp3`, 'voice', { pre: [], post: [] }),
  music: cut(`${PREFIX}-music30.mp3`, 'music', { pre: [], post: [] }),
  ride: cut(RIDE, 'ride', { pre: ['-ss', '180', '-t', '30'], post: [] }),
  mic: cut(MIC, 'mic', { pre: ['-ss', '30', '-t', '30'], post: ['-af', 'volume=-6dB'] }),
};
/* the app's numbers (audio/engine-web/web-engine.ts, core/song.ts) */
const LOUD = { in: 0.9, body: { threshold: -12, knee: 6, ratio: 3, attack: 0.004, release: 0.22 }, raise: 1.4,
  limit: { threshold: -3, knee: 0, ratio: 20, attack: 0.001, release: 0.06 } };
const VARIANTS = JSON.parse(process.env.VARIANTS || JSON.stringify([
  { name: 'today', knee: 0.66, top: 0.8, os: '2x' },
  { name: 'today at 4x', knee: 0.66, top: 0.8, os: '4x' },
]));
const GAINS = JSON.parse(process.env.GAINS || '[1, 2, 4]');
const OFFSETS = JSON.parse(process.env.OFFSETS || '[0, 0.0071, 0.0133]');

const env = await launch({ mic: '/dev/null', allowMic: false });
const { page } = env;
await page.goto('about:blank');
for (const [k, b64] of Object.entries(files)) {
  await page.eval(`(window.__f = window.__f || {}, window.__f[${JSON.stringify(k)}] = Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0)).buffer, 0)`);
}
await page.eval(`window.LOUD = ${JSON.stringify(LOUD)}`);

function r128(raw) {
  const out = spawnSync(FFMPEG, ['-hide_banner', '-nostats', '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', raw, '-af', 'ebur128=peak=true+sample:framelog=quiet', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const pick = (re) => +((re.exec(out) || [])[1] ?? NaN);
  return { lufs: pick(/I:\s+(-?[\d.]+) LUFS/), tp: pick(/True peak:\s+Peak:\s+(-?[\d.]+)/), sp: pick(/Sample peak:\s+Peak:\s+(-?[\d.]+)/) };
}

/* one render: the song (parts at gain g, lifted to its loudest moment at -1 dBFS), your voice back at `mon` (0 for none) offset by `off` s */
async function render(v, song, g, mon, off) {
  const b64 = await page.eval(`(async () => {
    const SECS = 28, R = 48000, L = window.LOUD, v = ${JSON.stringify(v)};
    const ctx = new OfflineAudioContext(4, SECS * R, R);
    const dec = (k) => ctx.decodeAudioData(window.__f[k].slice(0));
    const parts = ${JSON.stringify(song.parts)};
    const bufs = await Promise.all(parts.map(dec));
    /* the song's level: its loudest moment, parts summed, to -1 dBFS (core/song songLevel), at most +24 dB */
    let peak = 0;
    for (let c = 0; c < 2; c++) { const d = bufs.map((b) => b.getChannelData(Math.min(c, b.numberOfChannels - 1)));
      for (let i = 0; i < d[0].length; i++) { let s = 0; for (const x of d) s += x[i] * ${song.scale}; const a = Math.abs(s); if (a > peak) peak = a; } }
    const level = Math.min(10 ** (24 / 20), Math.max(1, 10 ** (-1 / 20) / peak));
    const out = ctx.createGain();
    for (const b of bufs) { const s = ctx.createBufferSource(); s.buffer = b; const gn = ctx.createGain(); gn.gain.value = ${g} * level * ${song.scale}; s.connect(gn); gn.connect(out); s.start(0); }
    const comp = (c) => { const n = ctx.createDynamicsCompressor(); n.threshold.value = c.threshold; n.knee.value = c.knee; n.ratio.value = c.ratio; n.attack.value = c.attack; n.release.value = c.release; return n; };
    const gain = (x) => { const n = ctx.createGain(); n.gain.value = x; return n; };
    const into = gain(L.in), body = comp(L.body), raise = gain(v.raise ?? L.raise), limit = comp(v.limit ? { ...L.limit, ...v.limit } : L.limit), half = gain(0.5);
    out.connect(into); into.connect(body); body.connect(raise); raise.connect(limit); limit.connect(half);
    const safety = (u) => { const a = Math.abs(u); return a <= v.knee ? u : Math.sign(u) * (v.knee + (v.top - v.knee) * Math.tanh((a - v.knee) / (v.top - v.knee))); };
    const n = 8193, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) curve[i] = safety(2 * ((i / (n - 1)) * 2 - 1));
    const ws = ctx.createWaveShaper(); ws.curve = curve; ws.oversample = v.os;
    half.connect(ws);
    let last = ws;
    if (v.trim) { const t = gain(v.trim); ws.connect(t); last = t; }
    /* channels 0-1 the way out, 2-3 the sound going into the ceiling (to see how much it rounds off: its curve takes twice that) */
    const merge = ctx.createChannelMerger(4), so = ctx.createChannelSplitter(2), si = ctx.createChannelSplitter(2);
    last.connect(so); so.connect(merge, 0, 0); so.connect(merge, 1, 1);
    half.connect(si); si.connect(merge, 0, 2); si.connect(merge, 1, 3);
    merge.connect(ctx.destination);
    if (${mon} > 0) { const m = ctx.createBufferSource(); m.buffer = await dec('mic'); const mg = gain(${mon}); m.connect(mg); mg.connect(half); m.start(${off}); }
    const r = await ctx.startRendering();
    const l = r.getChannelData(0), rr = r.getChannelData(1), o = new Float32Array(l.length * 2);
    /* how much the ceiling changed the sound: the energy it took off, against the sound's (dB), and the share of samples past its knee */
    let e = 0, d = 0, past = 0;
    for (const c of [2, 3]) { const x = r.getChannelData(c); for (let i = 0; i < x.length; i++) { const u = 2 * x[i]; e += u * u; const y = safety(u) - u; d += y * y; if (Math.abs(u) > v.knee) past++; } }
    window.__rounded = { off: 10 * Math.log10(d / e + 1e-30), past: past / (2 * l.length) };
    for (let i = 0; i < l.length; i++) { o[2 * i] = l[i]; o[2 * i + 1] = rr[i]; }
    const u8 = new Uint8Array(o.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  })()`);
  const raw = join(tmp, 'r.f32');
  writeFileSync(raw, Buffer.from(b64, 'base64'));
  return { ...r128(raw), ...(await page.eval('window.__rounded')) };
}

const SONGS = [
  { name: 'All of Me', parts: ['voice', 'music'], scale: 1 },
  { name: 'All of Me, five times quieter', parts: ['voice', 'music'], scale: 0.2 },
  { name: "Ride's chorus", parts: ['ride'], scale: 1 },
];
const f = (x) => x.toFixed(1).padStart(5);
for (const v of VARIANTS) {
  let worst = -Infinity;
  const rows = [];
  for (const song of SONGS) {
    for (const g of GAINS) {
      for (const mon of [0, 6]) {
        for (const off of mon ? OFFSETS : [0]) {
          const m = await render(v, song, g, mon, off);
          worst = Math.max(worst, m.tp);
          rows.push(`  ${song.name.padEnd(30)} x${String(g).padEnd(4)} voice back ${mon ? 'at 100, +' + (off * 1000).toFixed(1) + ' ms' : 'off'}`.padEnd(70) + `${f(m.lufs)} LUFS  true peak ${f(m.tp)}  sample ${f(m.sp)}  PLR ${f(m.tp - m.lufs)}  rounded ${f(m.off)} dB, ${(m.past * 100).toFixed(2)}% past knee`);
        }
      }
    }
  }
  console.log(`${v.name} ${JSON.stringify(v)}: worst true peak ${worst.toFixed(2)} dBFS`);
  rows.forEach((r) => console.log(r));
}
await env.close();
