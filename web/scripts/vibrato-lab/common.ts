/* Shared by the vibrato labs: the app's live reader over a sound, and a
   reference measure of a different kind (peaks and troughs of a fine
   pitch track, 500 readings a second) to compare with. */
import { LiveTrace } from '../../src/audio/pitch/core.ts';
import { yinHz, CLARITY } from '../../src/audio/pitch/yin.ts';
import { measures, hold, fitWave } from '../../src/core/vibrato.ts';

export const SR = 48000;

/** the app's live reader, fed in 128-sample blocks as a phone does */
export function live(x: Float32Array) {
  const tr = new LiveTrace(SR, null);
  const t: number[] = [], m: number[] = [], r: number[] = [];
  const B = 128;
  for (let i = 0; i + B <= x.length; i += B) {
    const pts = tr.push(x.slice(i, i + B), (i + B) / SR);
    for (const p of pts) {
      t[p.i] = p.at;
      m[p.i] = p.m;
      r[p.i] = p.r;
    }
  }
  return { t, m, r };
}

/** a fine pitch track: the same YIN, every 2 ms, a 1024-sample stretch */
export function fine(x: Float32Array, from = 0, to = x.length / SR) {
  const t: number[] = [], m: number[] = [];
  const need = 1024 + Math.floor(SR / 65) + 2;
  for (let at = from; at < to; at += 0.002) {
    const s = Math.round(at * SR) - 512;
    if (s < 0 || s + need > x.length) continue;
    const f = yinHz(x.subarray(s, s + need), SR, CLARITY);
    t.push(at);
    m.push(f > 0 ? 69 + 12 * Math.log2(f / 440) : NaN);
  }
  return { t, m };
}

/** the reference: a fine track smoothed over 20 ms, its peaks and troughs
    found directly, the width the mean rise and fall between neighbours,
    the speed one over the mean time from peak to peak */
export function reference(ft: { t: number[]; m: number[] }, from: number, to: number) {
  const t: number[] = [], y: number[] = [];
  for (let i = 0; i < ft.t.length; i++) if (ft.t[i] >= from && ft.t[i] <= to && Number.isFinite(ft.m[i])) { t.push(ft.t[i]); y.push(ft.m[i] * 100); }
  if (t.length < 50) return null;
  /* a 20 ms moving median, then a 20 ms moving mean */
  const k = 5;
  const med = y.map((_, i) => { const w = y.slice(Math.max(0, i - k), i + k + 1).sort((a, b) => a - b); return w[w.length >> 1]; });
  const sm = med.map((_, i) => { const w = med.slice(Math.max(0, i - k), i + k + 1); return w.reduce((a, b) => a + b, 0) / w.length; });
  /* remove a slow drift: a 0.5 s moving mean */
  const K = 125;
  const dr = sm.map((_, i) => { const w = sm.slice(Math.max(0, i - K), i + K + 1); return w.reduce((a, b) => a + b, 0) / w.length; });
  const z = sm.map((v, i) => v - dr[i]);
  const ext: Array<{ t: number; v: number; up: boolean }> = [];
  for (let i = 1; i < z.length - 1; i++) {
    if (z[i] > z[i - 1] && z[i] >= z[i + 1] && z[i] > 0) ext.push({ t: t[i], v: z[i], up: true });
    if (z[i] < z[i - 1] && z[i] <= z[i + 1] && z[i] < 0) ext.push({ t: t[i], v: z[i], up: false });
  }
  /* alternate peak and trough: keep the most extreme of a run of the same */
  const alt: typeof ext = [];
  for (const e of ext) {
    const last = alt[alt.length - 1];
    if (last && last.up === e.up) { if ((e.up && e.v > last.v) || (!e.up && e.v < last.v)) alt[alt.length - 1] = e; }
    else alt.push(e);
  }
  if (alt.length < 4) return null;
  const swings: number[] = [];
  for (let i = 1; i < alt.length; i++) swings.push(Math.abs(alt[i].v - alt[i - 1].v));
  const peaks = alt.filter((e) => e.up).map((e) => e.t);
  const per: number[] = [];
  for (let i = 1; i < peaks.length; i++) per.push(peaks[i] - peaks[i - 1]);
  if (!per.length) return null;
  return { width: swings.reduce((a, b) => a + b, 0) / swings.length, rate: per.length / per.reduce((a, b) => a + b, 0), cycles: per.length };
}

/** the app's measure of a hold, and the two simple ones it replaces: the
    highest less the lowest single reading in each cycle, and the same on
    the smoothed line the app draws */
export function appMeasure(lv: { t: number[]; m: number[]; r: number[] }, from: number, to: number) {
  const ms = measures(lv.t, lv.r, from, to);
  const h = hold(ms, from, to);
  const simple = (arr: number[]) => {
    const ts: number[] = [], ys: number[] = [];
    for (let i = 0; i < lv.t.length; i++) if (lv.t[i] >= from + 0.4 && lv.t[i] <= to && Number.isFinite(arr[i])) { ts.push(lv.t[i]); ys.push(arr[i] * 100); }
    if (!ts.length || !h.rate) return null;
    const per = 1 / h.rate, out: number[] = [];
    for (let a = ts[0]; a + per <= ts[ts.length - 1]; a += per) {
      const w = ys.filter((_, i) => ts[i] >= a && ts[i] < a + per);
      if (w.length >= 2) out.push(Math.max(...w) - Math.min(...w));
    }
    return out.length ? out.reduce((a, b) => a + b, 0) / out.length : null;
  };
  return { hold: h, ms, single: simple(lv.r), smoothed: simple(lv.m) };
}

export { fitWave };
