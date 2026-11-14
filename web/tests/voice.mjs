/* A real voice singing whatever notes a check needs (RULEBOOK 4, Tests:
   a real voice, never a tone). One steady sung note is found in a real
   recording, read with a small pitch reader of the test's own (the app's
   reader is what is being checked, so it is not used here), and shifted
   by ffmpeg's rubberband onto each note, at each note's time. */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const RATE = 48000;

/** a recording as mono samples at 48 kHz; `pre` cuts the input (before it), `args` filters it */
export function pcm(ffmpeg, file, args = [], pre = []) {
  const r = spawnSync(ffmpeg, ['-v', 'error', ...pre, '-i', file, ...args, '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, b.length / 4);
}

/** the pitch at a stretch of samples, as a note number (a plain YIN); NaN if unvoiced */
function pitchAt(x, from, size) {
  const W = size >> 1, tauMax = Math.floor(RATE / 70), tauMin = Math.floor(RATE / 1000);
  let e = 0;
  for (let i = 0; i < size; i++) e += x[from + i] * x[from + i];
  if (Math.sqrt(e / size) < 0.02) return NaN;
  const d = new Float32Array(tauMax + 1);
  for (let tau = tauMin; tau <= tauMax; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const v = x[from + i] - x[from + i + tau]; s += v * v; }
    d[tau] = s;
  }
  let run = 0;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    run += d[tau];
    const cm = run > 0 ? (d[tau] * (tau - tauMin + 1)) / run : 1;
    if (cm < 0.12) {
      while (tau + 1 <= tauMax && d[tau + 1] < d[tau]) tau++;
      const a = d[tau - 1], b = d[tau], c = d[tau + 1] ?? b;
      const shift = (a - c) / (2 * (a - 2 * b + c) || 1);
      return 69 + 12 * Math.log2(RATE / (tau + shift) / 440);
    }
  }
  return NaN;
}

/** the pitch every 10 ms, as note numbers (NaN where unvoiced) */
export function pitchTrack(x) {
  const hop = RATE / 100, size = 2048;
  const m = [];
  for (let at = 0; at + size + RATE / 70 < x.length; at += hop) m.push(pitchAt(x, at, size));
  return m;
}

/** the longest steady sung stretch: where it starts, how long, and its note */
export function steadyNote(x, minSecs = 0.5) {
  const m = pitchTrack(x);
  let best = null;
  for (let i = 0; i < m.length; i++) {
    if (!Number.isFinite(m[i])) continue;
    let j = i;
    const ref = m[i];
    while (j + 1 < m.length && Number.isFinite(m[j + 1]) && Math.abs(m[j + 1] - ref) < 0.3) j++;
    if (!best || j - i > best.n) best = { i, n: j - i };
  }
  if (!best || best.n / 100 < minSecs) return null;
  const seg = m.slice(best.i, best.i + best.n + 1).sort((a, b) => a - b);
  return { start: best.i / 100, secs: best.n / 100, m: seg[seg.length >> 1] };
}

/** That note, sung on each of `notes` ({ m, t, d } in seconds), with
    silence `lead` seconds before the first and `tail` after the last;
    `shift` semitones off every note (a wrong singer), as a WAV file. */
export function singNotes(ffmpeg, source, steady, notes, dir, { shift = 0, lead = 0, tail = 1, slides = null, slideSource = source } = {}) {
  const end = Math.max(...notes.map((n) => n.t + n.d)) + lead + tail;
  const out = new Float32Array(Math.ceil(end * RATE));
  const cache = new Map();
  notes.forEach((n0, k) => {
    let n = n0;
    /* with `slides` (13 Nov, runs at speed): every note after the first
       starts with a real slide from `slideSource` (the recording `slides`
       were found in), going the same way and
       moved so that it ends on the note; the steady stretch follows it */
    const prev = notes[k - 1];
    const way = prev ? Math.sign(n.m - prev.m) : 0;
    const ways = slides && way ? slides.filter((x) => Math.sign(x.to - x.from) === way) : [];
    const nearBy = ways.filter((x) => Math.abs(x.to - (n.m + shift)) <= 5);
    const fits = nearBy.length ? nearBy : ways;
    if (fits.length) {
      const size = Math.abs(n.m - prev.m);
      const sl = fits.reduce((a, b) => (Math.abs(Math.abs(b.to - b.from) - size) < Math.abs(Math.abs(a.to - a.from) - size) ? b : a));
      /* shifted with a quarter second either side (rubberband needs it on
         a clip this short), then the slide alone cut out, faded in 10 ms */
      const pad = Math.min(0.25, sl.start);
      const wide = pcm(ffmpeg, slideSource, ['-af', `rubberband=pitch=${Math.pow(2, (n.m + shift - sl.to) / 12)}:formant=preserved`],
        ['-ss', String(sl.start - pad), '-t', String(sl.secs + pad + 0.25)]);
      const g = wide.subarray(Math.round(pad * RATE), Math.round((pad + sl.secs) * RATE));
      const at0 = Math.round((lead + n.t) * RATE), fade = 0.01 * RATE;
      for (let i = 0; i < g.length && at0 + i < out.length; i++) out[at0 + i] += g[i] * Math.min(1, i / fade);
      n = { m: n.m, t: n.t + sl.secs, d: n.d - sl.secs };
    }
    const semis = n.m + shift - steady.m;
    /* the steady stretch, made as long as the note and moved onto it */
    const len = Math.max(0.1, n.d - 0.04);
    const key = semis.toFixed(3) + ':' + len.toFixed(3);
    let s = cache.get(key);
    if (!s) {
      const tempo = steady.secs / len;
      s = pcm(ffmpeg, source, ['-af',
        `rubberband=pitch=${Math.pow(2, semis / 12)}:tempo=${tempo}:formant=preserved,afade=t=in:d=0.02,areverse,afade=t=in:d=0.03,areverse`],
      ['-ss', String(steady.start), '-t', String(steady.secs)]);
      cache.set(key, s);
    }
    const at = Math.round((lead + n.t) * RATE);
    for (let i = 0; i < s.length && at + i < out.length; i++) out[at + i] += s[i];
  });
  return wav(out, join(dir, `sung-${Date.now()}-${Math.round(Math.random() * 1e6)}.wav`));
}

/** a WAV file of these samples (16-bit, mono, 48 kHz) */
export function wav(x, file) {
  const n = x.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  spawnSync('true');
  return { file, buffer: b };
}

/** the first steady stretch (at least `minSecs`): when it starts and its note */
export function firstNote(x, minSecs = 0.1) {
  const m = pitchTrack(x);
  for (let i = 0; i < m.length; i++) {
    if (!Number.isFinite(m[i])) continue;
    let j = i;
    while (j + 1 < m.length && Number.isFinite(m[j + 1]) && Math.abs(m[j + 1] - m[i]) < 0.3) j++;
    if ((j - i) / 100 >= minSecs) {
      const seg = m.slice(i, j + 1).sort((a, b) => a - b);
      return { start: i / 100, secs: (j - i) / 100, m: seg[seg.length >> 1] };
    }
  }
  return null;
}

/** Real short sung sounds in a recording (13 Nov, for very short notes):
    every voiced stretch that starts and ends in silence or an unvoiced
    sound, `minSecs` to `maxSecs` long, holding one note (within half a
    semitone). Each keeps its own natural start and end. */
export function syllables(x, minSecs = 0.08, maxSecs = 0.5) {
  const m = pitchTrack(x);
  const out = [];
  for (let i = 1; i < m.length; i++) {
    if (!Number.isFinite(m[i]) || Number.isFinite(m[i - 1])) continue;
    let j = i;
    while (j + 1 < m.length && Number.isFinite(m[j + 1])) j++;
    const len = (j - i + 1) / 100;
    if (len >= minSecs && len <= maxSecs) {
      const seg = m.slice(i, j + 1).sort((a, b) => a - b);
      const med = seg[seg.length >> 1];
      if (seg[0] > med - 0.5 && seg[seg.length - 1] < med + 0.5) out.push({ start: i / 100, secs: len, m: med });
    }
    i = j;
  }
  return out;
}

/** Short notes sung with real syllables: each note `sungFor` seconds of a
    real sung sound of about that length (its own start and end, with 30 ms
    of what came before and after it), sung within five half steps of the
    note and moved onto it, at the note's start; `shift` semitones off (a
    wrong singer). */
export function singShort(ffmpeg, source, pool, notes, dir, { sungFor = 0.15, shift = 0, lead = 0, tail = 1, turn = 0 } = {}) {
  const end = Math.max(...notes.map((n) => n.t + n.d)) + lead + tail;
  const out = new Float32Array(Math.ceil(end * RATE));
  notes.forEach((n, k) => {
    /* one of the six sounds closest in length among those sung within five
       half steps of the note: a sound moved further is no longer a voice */
    const close = pool.filter((x) => Math.abs(x.m - (n.m + shift)) <= 5);
    const near = [...(close.length >= 6 ? close : pool)].sort((a, b) => Math.abs(a.secs - sungFor) - Math.abs(b.secs - sungFor)).slice(0, 6);
    const s0 = near[(k + turn) % near.length];
    const semis = n.m + shift - s0.m;
    const tempo = s0.secs / sungFor;
    const s = pcm(ffmpeg, source, ['-af', `rubberband=pitch=${Math.pow(2, semis / 12)}:tempo=${tempo}:formant=preserved`],
      ['-ss', String(Math.max(0, s0.start - 0.03)), '-t', String(s0.secs + 0.06)]);
    const at = Math.round((lead + n.t) * RATE);
    for (let i = 0; i < s.length && at + i < out.length; i++) out[at + i] += s[i];
  });
  return wav(out, join(dir, `short-${Date.now()}-${Math.round(Math.random() * 1e6)}.wav`));
}

/** Real slides in a recording (13 Nov, runs at speed): a voiced stretch of
    40 to 150 ms whose pitch moves one way, one to five half steps in all,
    and then holds a note (within 0.3 of a half step) for at least 0.1 s.
    How a real singer gets from one note to the next. */
export function slides(x) {
  const m = pitchTrack(x);
  const out = [];
  for (let i = 1; i < m.length - 1; i++) {
    if (!Number.isFinite(m[i])) continue;
    const way = Math.sign(m[i + 1] - m[i]);
    if (!way) continue;
    let j = i;
    while (j + 1 < m.length && Number.isFinite(m[j + 1]) && Math.sign(m[j + 1] - m[j]) === way && Math.abs(m[j + 1] - m[j]) < 1) j++;
    const move = Math.abs(m[j] - m[i]), secs = (j - i) / 100;
    let h = j;
    while (h + 1 < m.length && Number.isFinite(m[h + 1]) && Math.abs(m[h + 1] - m[j]) < 0.3) h++;
    if (secs >= 0.04 && secs <= 0.15 && move >= 1 && move <= 5 && (h - j) / 100 >= 0.1) out.push({ start: i / 100, secs, from: m[i], to: m[j] });
    i = j;
  }
  return out;
}
