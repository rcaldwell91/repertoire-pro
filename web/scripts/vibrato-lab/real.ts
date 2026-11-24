/* Proofs 2 to 4, with real voices (the voice-only All of Me and Ride):
   2. a real sung note made steady, then given a wobble of known speed and
      width, by reading it faster and slower (exact: a sound read 1% faster
      is 1% higher), and the same note with none;
   3. the same notes taking turns with the half step above, slowly (1 to 3
      a second), which must not be called a wobble;
   4. the singers' own held notes, against the reference (peaks and
      troughs of a fine track). */
import { spawnSync } from 'node:child_process';
import { SR, live, appMeasure, fine, reference } from './common.ts';
import { measures, hold, fitSecond, SETTLE } from '../../src/core/vibrato.ts';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const FF = 'ffmpeg';
function pcm(file: string, args: string[] = [], pre: string[] = []) {
  const r = spawnSync(FF, ['-v', 'error', ...pre, '-i', file, ...args, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  const b = r.stdout as Buffer;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}
const REC = (process.env.RP_VOCALS_DIR ?? '') + '/';
const songs = [['All of Me', REC + 'allofme-vocals.mp3'], ['Ride', REC + 'ride-vocals.mp3']];

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };

/** held stretches: voiced, every fine point within 1.5 half steps of the stretch's median, at least `min` s */
function held(ft: { t: number[]; m: number[] }, min: number) {
  const out: Array<{ from: number; to: number; m: number }> = [];
  let i = 0;
  while (i < ft.t.length) {
    if (!Number.isFinite(ft.m[i])) { i++; continue; }
    let j = i;
    while (j + 1 < ft.t.length && Number.isFinite(ft.m[j + 1]) && Math.abs(ft.m[j + 1] - ft.m[i]) < 1.5) j++;
    if (ft.t[j] - ft.t[i] >= min) out.push({ from: ft.t[i], to: ft.t[j], m: med(ft.m.slice(i, j + 1)) });
    i = j + 1;
  }
  return out;
}

/** read x so that its pitch follows `want(t)` (note numbers), from its own smoothed contour */
function repitch(x: Float32Array, contour: (sec: number) => number, want: (t: number) => number, secs: number) {
  const out = new Float32Array(Math.round(secs * SR));
  let p = 0;
  for (let n = 0; n < out.length; n++) {
    const i = Math.floor(p);
    if (i + 1 >= x.length) return out.subarray(0, n);
    out[n] = x[i] + (x[i + 1] - x[i]) * (p - i);
    p += Math.pow(2, (want(n / SR) - contour(p / SR)) / 12);
  }
  return out;
}
function contourOf(x: Float32Array) {
  const ft = fine(x);
  /* fill gaps, then a 40 ms moving mean */
  const m = [...ft.m];
  let last = NaN;
  for (let i = 0; i < m.length; i++) { if (Number.isFinite(m[i])) last = m[i]; else m[i] = last; }
  for (let i = m.length - 1; i >= 0; i--) if (!Number.isFinite(m[i])) m[i] = m[i + 1];
  const k = 10, sm = m.map((_, i) => mean(m.slice(Math.max(0, i - k), i + k + 1)));
  return { at: (sec: number) => { const j = Math.min(sm.length - 1, Math.max(0, Math.round((sec - ft.t[0]) / 0.002))); return sm[j]; }, m0: med(sm) };
}

const stat = (v: number[]) => {
  const f = v.filter(Number.isFinite), abs = f.map(Math.abs).sort((a, b) => a - b);
  return `n ${f.length}/${v.length}, mean ${mean(f).toFixed(2)}, median |err| ${abs[abs.length >> 1]?.toFixed(2)}, 95% |err| ${abs[Math.floor(abs.length * 0.95)]?.toFixed(2)}, worst ${abs[abs.length - 1]?.toFixed(2)}`;
};
const lines: string[] = [];
const say = (s: string) => { lines.push(s); console.log(s); };
const errs = { rate: [] as number[], width: [] as number[], single: [] as number[] };
const flat: string[] = [], turns: string[] = [];
let srcCount = 0;
const own: Array<{ refWobble: boolean; ref: ReturnType<typeof reference>; f: ReturnType<typeof fitSecond> }> = [];

for (const [name, file] of songs) {
  const x = pcm(file);
  const cache = file + '.fine.json';
  const ft: { t: number[]; m: number[] } = existsSync(cache) ? JSON.parse(readFileSync(cache, 'utf8')) : fine(x);
  if (!existsSync(cache)) writeFileSync(cache, JSON.stringify({ t: ft.t, m: ft.m.map((v) => (Number.isFinite(v) ? v : null)) }));
  ft.m = ft.m.map((v) => (v == null ? NaN : v));
  /* proof 2 and 3: the steadiest real notes, made 4.4 s long */
  const steady = held(ft, 0.6).map((h) => {
    const seg = ft.m.filter((_, i) => ft.t[i] >= h.from && ft.t[i] <= h.to && Number.isFinite(ft.m[i]));
    const sd = Math.sqrt(mean(seg.map((v) => (v - h.m) ** 2))) * 100;
    return { ...h, sd };
  }).sort((a, b) => a.sd - b.sd).slice(0, 4);
  for (const s of steady) {
    srcCount++;
    const len = s.to - s.from;
    const clip = pcm(file, ['-af', `rubberband=tempo=${len / 4.6}:formant=preserved,afade=t=in:d=0.03,areverse,afade=t=in:d=0.05,areverse`], ['-ss', String(s.from), '-t', String(len)]);
    const c = contourOf(clip);
    const label = `${name} ${s.from.toFixed(1)} s (note ${c.m0.toFixed(1)})`;
    /* no wobble at all */
    {
      const y = repitch(clip, c.at, () => c.m0, 4.4);
      const h = appMeasure(live(y), 0.1, 4.2).hold;
      flat.push(`${label}: made steady -> ${h.kind}${h.width != null ? ` (${h.width.toFixed(0)}c)` : ''}`);
    }
    for (const rate of [4.5, 5.5, 6.5]) for (const width of [40, 70, 110]) {
      const ph = Math.random() * 6.28;
      const y = repitch(clip, c.at, (t) => c.m0 + (width / 200) * Math.sin(2 * Math.PI * rate * t + ph), 4.4);
      const a = appMeasure(live(y), 0.1, 4.2);
      const h = a.hold;
      if (h.rate == null || h.width == null) { say(`${label} ${rate}/s ${width}c: NOT MEASURED (${h.kind})`); errs.rate.push(NaN); errs.width.push(NaN); continue; }
      errs.rate.push(h.rate - rate); errs.width.push(h.width - width);
      if (a.single != null) errs.single.push(a.single - width);
      say(`${label} ${rate}/s ${width}c -> ${h.rate.toFixed(2)}/s ${h.width.toFixed(0)}c (${h.kind} ${h.wobbled}/${h.n}); single readings ${a.single?.toFixed(0)}c`);
    }
    /* proof 3: taking turns with the half step above, 1 to 3 a second, a 40 ms slide between */
    for (const per of [1, 1.5, 2, 3]) {
      const half = 1 / (2 * per);
      const want = (t: number) => {
        const k = Math.floor(t / half), into = t - k * half, a = k % 2 ? 1 : 0, b = k % 2 ? 0 : 1;
        return c.m0 + (into < 0.04 && k > 0 ? b + (a - b) * (into / 0.04) : a);
      };
      const y = repitch(clip, c.at, want, 4.4);
      const lv = live(y);
      const ms = measures(lv.t, lv.r, 0.1, 4.2);
      const h = hold(ms, 0.1, 4.2);
      turns.push(`${label} turns ${per}/s -> ${h.kind} (wobble in ${h.wobbled} of ${h.n} measures)`);
    }
  }
  /* proof 4: the singers' own held notes, 1.2 s or longer: each second
     of them against the reference over the same second, where the
     reference finds at least three cycles of a wobble */
  for (const h of held(ft, 1.2)) {
    const pad = 0.6;
    const seg = x.subarray(Math.max(0, Math.round((h.from - pad) * SR)), Math.round((h.to + pad) * SR));
    const off = Math.max(0, h.from - pad);
    const lv = live(seg);
    const ho = hold(measures(lv.t, lv.r, h.from - off - SETTLE, h.to - off), h.from - off - SETTLE, h.to - off);
    for (let a = h.from; a + 1 <= h.to + 1e-6; a += 0.25) {
      const ref = reference(ft, a, a + 1);
      const ts: number[] = [], ms: number[] = [];
      for (let i = 0; i < lv.t.length; i++) if (lv.t[i] + off >= a && lv.t[i] + off < a + 1 && Number.isFinite(lv.r[i])) { ts.push(lv.t[i]); ms.push(lv.r[i]); }
      if (ts.length < 14) continue;
      const f = fitSecond(ts, ms);
      const refWobble = !!ref && ref.cycles >= 3 && ref.rate >= 3.5 && ref.rate <= 9 && ref.width >= 20;
      own.push({ refWobble, ref, f });
    }
    say(`OWN ${name} ${h.from.toFixed(2)}-${h.to.toFixed(2)} s note ${h.m.toFixed(1)}: app ${ho.kind} ${ho.rate?.toFixed(2)}/s ${ho.width?.toFixed(0)}c (${ho.wobbled}/${ho.n})`);
  }
}
{
  const both = own.filter((o) => o.refWobble && o.f?.kind === 'wobble');
  const refW = own.filter((o) => o.refWobble), notRef = own.filter((o) => !o.refWobble);
  console.log(`\nSINGERS' OWN HELD NOTES: ${own.length} seconds measured; the reference finds a wobble in ${refW.length}`);
  console.log(`  of those, the app calls ${both.length} a wobble, ${refW.filter((o) => o.f?.kind === 'none').length} no wobble, ${refW.filter((o) => o.f?.kind === 'turns').length} turns`);
  console.log(`  where the reference finds none: the app calls ${notRef.filter((o) => o.f?.kind === 'wobble').length} of ${notRef.length} a wobble`);
  const dr = both.map((o) => (o.f as { rate: number }).rate - (o.ref as { rate: number }).rate), dw = both.map((o) => (o.f as { width: number }).width - (o.ref as { width: number }).width);
  console.log('  speed, app less reference: ' + stat(dr));
  console.log('  width, app less reference: ' + stat(dw));
}
console.log(`\nREAL VOICE, KNOWN WOBBLE (${srcCount} real notes):`);
console.log('speed error: ' + stat(errs.rate));
console.log('width error, app: ' + stat(errs.width));
console.log('width error, single readings: ' + stat(errs.single));
console.log('\nMADE STEADY:\n' + flat.join('\n'));
console.log('\nTAKING TURNS:\n' + turns.join('\n'));
