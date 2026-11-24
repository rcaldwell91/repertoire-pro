/* Proof 1: sounds of known speed and width. A voice-like sound (twenty
   harmonics, falling off, with a little breath noise) whose pitch wobbles
   by a known amount at a known speed, read by the app's live reader. */
import { SR, live, appMeasure, fine, reference } from './common.ts';

function seededRand(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** secs of a note `midi` wobbling `width` cents top to bottom at `rate` a second; `drift` cents a second */
export function wobbling(midi: number, rate: number, width: number, secs: number, seed = 1, drift = 0) {
  const rand = seededRand(seed);
  const n = Math.round(secs * SR), x = new Float32Array(n);
  const f0 = 440 * Math.pow(2, (midi - 69) / 12);
  const phase0 = rand() * 2 * Math.PI;
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const c = (width / 2) * Math.sin(2 * Math.PI * rate * t + phase0) + drift * t;
    const f = f0 * Math.pow(2, c / 1200);
    ph += (2 * Math.PI * f) / SR;
    let v = 0;
    for (let k = 1; k <= 20; k++) if (k * f < SR / 2) v += Math.sin(k * ph) / (k * (1 + Math.abs(k - 3) * 0.15));
    const env = Math.min(1, t / 0.05, (secs - t) / 0.05);
    x[i] = 0.25 * env * v + 0.004 * (rand() * 2 - 1);
  }
  return x;
}

const rows: string[] = [];
const err = { rate: [] as number[], width: [] as number[], single: [] as number[], smoothed: [] as number[], ref: [] as number[] };
let seed = 7;
for (const midi of [45, 52, 57, 64, 69]) {
  for (const rate of [4, 4.5, 5.5, 6.5, 7.5]) {
    for (const width of [30, 50, 80, 120, 150]) {
      const secs = 4;
      const x = wobbling(midi, rate, width, secs, seed++);
      const lv = live(x);
      const a = appMeasure(lv, 0.1, secs - 0.1);
      const ref = reference(fine(x, 0.4, secs - 0.2), 0.4, secs - 0.2);
      const h = a.hold;
      if (h.rate == null || h.width == null) { rows.push(`${midi} ${rate} ${width}: NOT MEASURED (${h.kind})`); err.rate.push(NaN); continue; }
      err.rate.push(h.rate - rate);
      err.width.push(h.width - width);
      if (a.single != null) err.single.push(a.single - width);
      if (a.smoothed != null) err.smoothed.push(a.smoothed - width);
      if (ref) err.ref.push(ref.width - width);
      rows.push(`${midi} rate ${rate} width ${width}: app ${h.rate.toFixed(2)}/s ${h.width.toFixed(0)}c (${h.kind}, ${h.wobbled}/${h.n}); single readings ${a.single?.toFixed(0)}c; smoothed line ${a.smoothed?.toFixed(0)}c; reference ${ref?.rate.toFixed(2)}/s ${ref?.width.toFixed(0)}c`);
    }
  }
}
const stat = (v: number[]) => {
  const f = v.filter(Number.isFinite), abs = f.map(Math.abs).sort((a, b) => a - b);
  return `n ${f.length}/${v.length}, mean ${(f.reduce((a, b) => a + b, 0) / f.length).toFixed(2)}, median |err| ${abs[abs.length >> 1]?.toFixed(2)}, 95% |err| ${abs[Math.floor(abs.length * 0.95)]?.toFixed(2)}, worst ${abs[abs.length - 1]?.toFixed(2)}`;
};
console.log(rows.join('\n'));
console.log('\nSPEED error (cycles a second): ' + stat(err.rate));
console.log('WIDTH error, app (cents): ' + stat(err.width));
console.log('WIDTH error, single readings highest less lowest (cents): ' + stat(err.single));
console.log('WIDTH error, smoothed line (cents): ' + stat(err.smoothed));
console.log('WIDTH error, reference (cents): ' + stat(err.ref));
