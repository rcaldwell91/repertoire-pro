/* The pitch bake-off (Robert, 5 Oct): the old app's method against MPM and
   SwiftF0, on real voices only, scored the same way the old singer test
   scored the old app (RULEBOOK 5: 93.2% / 96.5% on the voice-only tracks).

     FFMPEG=... CREPE_WEIGHTS=... CREPE_MODEL_JSON=... node bakeoff.mjs BAKE_DIR "Name=path" ...

   BAKE_DIR holds reference.py's output for each name. Every candidate runs
   the code the app ships (src/audio/pitch), on the same 50 ms grid, with the
   same median of five and gap bridging, so only the pitch method differs.
   Writes BAKE_DIR/bakeoff.json and prints the table. */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { yinHz, CLARITY, GATE_LEVEL, yinOffset } from '../../src/audio/pitch/yin.ts';
import { mpmHz } from '../../src/audio/pitch/mpm.ts';
import { crepeBuild, crepePredict, actToMidiConf, crepeFrame } from '../../src/audio/pitch/crepe.ts';
import { traceFile } from '../../src/audio/pitch/trace.ts';
import { bridge, Median5, anchored } from '../../src/audio/pitch/line.ts';
import { FileTrace, LiveTrace } from '../../src/audio/pitch/core.ts';
import { loudPoints } from '../../src/audio/pitch/loud.ts';

const FF = process.env.FFMPEG || 'ffmpeg';
const SR = 44100;            /* the test browser's own rate, where the old app's numbers were measured */
const HOP = 0.05, WIN = 4096, LIVE_HZ = 60, ANCHOR = 0.22;
const [dir, ...specs] = process.argv.slice(2);

/* left and right averaged, as the app does (this decodes point for point
   to the same line as the old app: 5204 of 5204 points on All of Me) */
function decode(path, sr = SR) {
  const r = spawnSync(FF, ['-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', String(sr), '-'], { maxBuffer: 1 << 30 });
  const st = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length / 4);
  const mono = new Float32Array(st.length / 2);
  for (let i = 0; i < mono.length; i++) mono[i] = (st[2 * i] + st[2 * i + 1]) / 2;
  return mono;
}

const manifest = JSON.parse(readFileSync(process.env.CREPE_MODEL_JSON, 'utf8')).weightsManifest.flatMap((g) => g.weights);
const wbuf = readFileSync(process.env.CREPE_WEIGHTS);
const crepe = crepeBuild(manifest, new Float32Array(wbuf.buffer, wbuf.byteOffset, wbuf.length / 4).slice());

function anchorsFor(mono, sr, causal = false) {
  const n = Math.max(1, Math.floor(mono.length / sr / ANCHOR));
  const midi = new Float32Array(n), conf = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    /* live: the 64 ms ending now; file: centred */
    const tc = causal ? k * ANCHOR - 0.032 : k * ANCHOR;
    const r = actToMidiConf(crepePredict(crepe, crepeFrame(mono, sr, tc)));
    midi[k] = r.midi; conf[k] = r.conf;
  }
  return { step: ANCHOR, midi, conf };
}

/* the old singer test's loud and quiet: RMS every 50 ms, Otsu on log RMS */
function loudness(mono, sr) {
  const W = Math.round(HOP * sr), n = Math.floor(mono.length / W), rms = new Float32Array(n);
  for (let k = 0; k < n; k++) { let s = 0; for (let i = 0; i < W; i++) { const v = mono[k * W + i]; s += v * v; } rms[k] = Math.sqrt(s / W); }
  const logs = Array.from(rms, (v) => Math.log10(v || 1e-9));
  const lo = Math.min(...logs), hi = Math.max(...logs), B = 200, hist = new Array(B).fill(0);
  logs.forEach((v) => hist[Math.min(B - 1, Math.floor(((v - lo) / (hi - lo)) * B))]++);
  let sum = 0; for (let i = 0; i < B; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, bestT = 0;
  for (let i = 0; i < B; i++) {
    wB += hist[i]; if (!wB) continue; const wF = n - wB; if (!wF) break;
    sumB += i * hist[i]; const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; bestT = i; }
  }
  const th = Math.pow(10, lo + ((bestT + 0.5) / B) * (hi - lo));
  return Array.from(rms, (v) => v >= th);
}

function score(points, loud, ref) {
  let L = 0, LV = 0, V = 0, VQ = 0, R = 0, RA = 0, RO = 0, RV = 0;
  for (let k = 0; k < Math.min(points.length, loud.length); k++) {
    const v = points[k].m != null;
    if (loud[k]) { L++; if (v) LV++; }
    if (v) { V++; if (!loud[k]) VQ++; }
    const r = ref[Math.round(points[k].t / 0.01)];
    if (r != null) {
      R++;
      if (v) {
        RV++;
        const d = points[k].m - r;
        if (Math.abs(d) < 0.5) RA++;
        else if ([12, -12, 24, -24].some((o) => Math.abs(d - o) < 1)) RO++;
      }
    }
  }
  return { follows: (100 * LV) / L, gaps: (100 * VQ) / V, accuracy: (100 * RA) / RV, octave: (100 * RO) / RV, refCovered: (100 * RV) / R,
    lateMs: lateness(points, ref) };
}

/* how late the line is: the shift that best lines it up with the
   reference (positive: the line shows a note after it was sung) */
function lateness(points, ref) {
  let best = -1, bestL = 0;
  for (let L = -150; L <= 150; L += 5) {
    let hit = 0;
    for (const p of points) {
      if (p.m == null) continue;
      const r = ref[Math.round((p.t - L / 1000) / 0.01)];
      if (r != null && Math.abs(p.m - r) < 0.5) hit++;
    }
    if (hit > best) { best = hit; bestL = L; }
  }
  return bestL;
}

/* the app's own mic path: the core's LiveTrace fed as the phone feeds it
   (blocks of 1024 samples); a point counts from the moment it is shown */
function liveCore(mono, sr, method, withAnchor) {
  const live = new LiveTrace(sr, withAnchor ? crepe : null, method);
  const shown = [];
  for (let i = 0; i < mono.length; i += 1024) {
    const end = Math.min(mono.length, i + 1024);
    const now = (end - 1) / sr;
    for (const p of live.push(mono.subarray(i, end), now)) if (Number.isFinite(p.m)) shown.push({ now, at: p.at, m: p.m });
  }
  return shown;
}
function reactionCore(shown, ons) {
  const ds = [];
  let missed = 0, j = 0;
  for (const o of ons) {
    while (j < shown.length && shown[j].now < o.t) j++;
    let hit = null;
    for (let k = j; k < shown.length && shown[k].now - o.t <= 1; k++) {
      if (shown[k].at >= o.t - 0.05 && Math.abs(shown[k].m - o.m) < 0.5) { hit = shown[k].now - o.t; break; }
    }
    if (hit == null) missed++; else ds.push(hit * 1000);
  }
  ds.sort((a, b) => a - b);
  return { median: ds[Math.floor(ds.length / 2)], missed: (100 * missed) / ons.length, n: ons.length };
}
function corePoints(mono, sr, method, withAnchor, gate) {
  const m = new FileTrace(mono, sr, withAnchor ? crepe : null, method).next(1e9);
  if (gate) {
    const loud = loudPoints(mono, sr, HOP);
    for (let k = 0; k < m.length; k++) if (!loud[k]) m[k] = NaN;
  }
  return bridge(Array.from(m, (v, k) => ({ t: +(k * HOP).toFixed(2), m: Number.isFinite(v) ? +v.toFixed(2) : null })));
}

/* reference note starts: a run of reference pitch of 0.3 s or more after
   0.2 s or more without one; its pitch is the median of its first 0.3 s */
function onsets(ref) {
  const out = [];
  let gap = 0;
  for (let i = 0; i < ref.length; i++) {
    if (ref[i] == null) { gap++; continue; }
    if (gap >= 20) {
      let j = i; while (j < ref.length && ref[j] != null) j++;
      if (j - i >= 30) { const s = ref.slice(i, i + 30).sort((a, b) => a - b); out.push({ t: i * 0.01, m: s[15] }); }
    }
    gap = 0;
  }
  return out;
}

/* live: what each method shows at each moment from the past only */
function liveYinLike(mono, sr, detect, readW, anc) {
  const step = 1 / LIVE_HZ, n = Math.floor(mono.length / sr / step), med = new Median5(), out = new Array(n);
  const buf = new Float32Array(WIN);
  for (let k = 0; k < n; k++) {
    const T = k * step, end = Math.round(T * sr), start = end - WIN;
    let rms = 0;
    for (let j = 0; j < WIN; j++) { const sp = start + j; const v = sp >= 0 ? mono[sp] : 0; buf[j] = v; rms += v * v; }
    rms = Math.sqrt(rms / WIN);
    let m = null;
    if (rms >= GATE_LEVEL) { const f = detect(buf, sr); if (f > 0) m = 69 + 12 * Math.log2(f / 440); }
    if (m != null && anc) {
      /* the newest anchor already made, if under 1.2 s old */
      const ai = Math.floor(T / ANCHOR);
      if (ai >= 0 && T - ai * ANCHOR < 1.2) m = anchored(m, ai * ANCHOR, anc);
    }
    out[k] = med.push(m);
  }
  return out;
}
function liveSwift(sw) {
  const step = 1 / LIVE_HZ, n = Math.floor((sw.pitch.length * 0.016) / step), med = new Median5(), out = new Array(n);
  let last = -1, cur = null;
  for (let k = 0; k < n; k++) {
    const T = k * step;
    /* a frame is final once 10 later frames exist (its authors' streaming rule) */
    const f = Math.floor(T / 0.016) - 11;
    while (last < f) {
      last++;
      const v = last >= 0 && sw.conf[last] >= 0.5 ? 69 + 12 * Math.log2(sw.pitch[last] / 440) : null;
      cur = med.push(v);
    }
    out[k] = cur;
  }
  return out;
}
function reaction(live, ons) {
  const step = 1 / LIVE_HZ, ds = [];
  let missed = 0;
  for (const o of ons) {
    let hit = null;
    for (let k = Math.ceil(o.t / step); k < live.length && k * step - o.t <= 1; k++) {
      if (live[k] != null && Math.abs(live[k] - o.m) < 0.5) { hit = k * step - o.t; break; }
    }
    if (hit == null) missed++; else ds.push(hit * 1000);
  }
  ds.sort((a, b) => a - b);
  return { median: ds[Math.floor(ds.length / 2)], missed: (100 * missed) / ons.length, n: ons.length };
}

function swiftPoints(sw, n, post) {
  const pts = [];
  const med = new Median5();
  for (let k = 0; k < n; k++) {
    const t = k * HOP, f = Math.round(t / 0.016);
    const v = f < sw.conf.length && sw.conf[f] >= 0.5 ? 69 + 12 * Math.log2(sw.pitch[f] / 440) : null;
    const m = post ? med.push(v) : v;
    pts.push({ t: +t.toFixed(2), m: m == null ? null : +m.toFixed(2) });
  }
  return post ? bridge(pts) : pts;
}

const rows = [];
for (const spec of specs) {
  const [name, path] = spec.split(/=(.*)/s);
  const R = JSON.parse(readFileSync(join(dir, name + '.json'), 'utf8'));
  const mono = decode(path), secs = mono.length / SR;
  const loud = loudness(mono, SR), ref = R.ref.midi, ons = onsets(ref);
  let t = performance.now();
  const anc = anchorsFor(mono, SR);
  const ancMs = performance.now() - t;
  const baseOpts = { hop: HOP, win: WIN, gate: GATE_LEVEL, offset: yinOffset(WIN, SR), anchors: anc };
  const mpmOff = (WIN >> 1) - Math.round(1024 + 0.002 * SR);
  const cands = [
    ['Old app (YIN + CREPE-tiny anchor + median of 5)', { ...baseOpts, detect: (w, sr) => yinHz(w, sr, CLARITY) }, true],
    ['MPM + the same anchor', { ...baseOpts, offset: mpmOff, detect: (w, sr) => mpmHz(w, sr) }, true],
    ['MPM alone', { ...baseOpts, offset: mpmOff, anchors: null, detect: (w, sr) => mpmHz(w, sr) }, false],
  ];
  const causalAnc = anchorsFor(mono, SR, true);
  for (const [label, opts, usesAnc] of cands) {
    t = performance.now();
    const pts = traceFile(mono, SR, opts);
    const ms = performance.now() - t + (usesAnc ? ancMs : 0);
    const detect = opts.detect;
    const live = liveYinLike(mono, SR, (b, sr) => detect(label.startsWith('Old') ? b : b.subarray(0), sr), 0, usesAnc ? causalAnc : null);
    rows.push({ song: name, method: label, ...score(pts, loud, ref), react: reaction(live, ons), msPerSec: ms / secs });
  }
  const yin = { name: 'yin', detect: (w, sr) => yinHz(w, sr, CLARITY), offset: (sr) => yinOffset(WIN, sr) };
  const methods = [
    ['This app: the old method, median centred', yin, true, false],
    ['This app: the old method, median centred, Otsu gate', yin, true, true],
    ['This app\'s core with MPM + the same anchor, Otsu gate', { name: 'mpm', detect: (w, sr) => mpmHz(w, sr), offset: () => mpmOff }, true, true],
  ];
  for (const [label, method, withAnchor, gate] of methods) {
    t = performance.now();
    const pts = corePoints(mono, SR, method, withAnchor, gate);
    const ms = performance.now() - t;
    rows.push({ song: name, method: label, ...score(pts, loud, ref), react: reactionCore(liveCore(mono, SR, method, withAnchor), ons), msPerSec: ms / secs });
  }
  const n = loud.length;
  rows.push({ song: name, method: 'SwiftF0 (+ median of 5 and bridging)', ...score(swiftPoints(R.swift, n, true), loud, ref),
    react: reaction(liveSwift(R.swift), ons), msPerSec: null });
  rows.push({ song: name, method: 'SwiftF0 alone', ...score(swiftPoints(R.swift, n, false), loud, ref),
    react: null, msPerSec: null });
  console.error('scored', name);
}
writeFileSync(join(dir, 'bakeoff.json'), JSON.stringify(rows, null, 1));
const f = (x, d = 1) => (x == null || Number.isNaN(x) ? '—' : x.toFixed(d));
console.log('| Recording | Method | Follows the voice (% of loud time) | Line in the gaps % | Right note (±½ semitone) % | Octave errors % | Line late by (ms) | Live reaction, median ms (missed %) | Reading ms per s of audio |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.song} | ${r.method} | ${f(r.follows)} | ${f(r.gaps)} | ${f(r.accuracy)} | ${f(r.octave, 2)} | ${f(r.lateMs, 0)} | ${r.react ? f(r.react.median, 0) + ' (' + f(r.react.missed, 0) + ')' : '—'} | ${f(r.msPerSec, 0)} |`);
