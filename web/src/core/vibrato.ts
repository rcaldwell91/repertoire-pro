/* The wobble on a held note (Robert approved Vibrato on 16 Nov; the
   project's research report, 10 Sep: "vibrato rate and extent as measured
   numbers", typically 4.5 to 6.5 cycles a second and 50 to 120 cents top
   to bottom, and "vibrato contaminates every pitch statistic ... must
   detect and handle whole cycles").

   Measured, never judged: how fast it goes (cycles a second) and how wide
   (cents, top to bottom), beside the typical ranges. Nothing here says
   whether it is good.

   From the line's own readings, twenty a second, before the median of five
   (which flattens a wobble of four or five readings a cycle). At twenty a
   second a cycle is only three to five readings, so the highest and lowest
   single readings miss the true top and bottom (a wave read four times a
   cycle can be caught at 71% of its height). So each measure fits one
   smooth wave, on top of the note's own slow drift (a sung note bends as
   well as wobbles), to every reading across whole cycles of it, about a
   second's worth: the wave's speed is the one that fits best, and its
   height is read from the fit, not from any one reading.

   Proved 24 Nov (REPORTS): sounds of known speed and width, exact speed
   and width within 7 cents; real voices given a known wobble, within 5
   cents; real notes made steady, never a wobble; slow turns between two
   notes, never a wobble; the singers' own held notes against a fine
   reading, 15 of 24 seconds found, speed within 0.4 a second and width
   within 5 cents (typical), the narrow uneven ones (under about 40 cents)
   missed. Reading 40 or 100 times a second found no more. */

export const TYPICAL_RATE: readonly [number, number] = [4.5, 6.5];
export const TYPICAL_WIDTH: readonly [number, number] = [50, 120];
/** slower than this, the note is two notes taking turns, not a wobble */
export const SLOWEST = 3.5;
/** the fastest wave looked for: under half the readings' twenty a second */
export const FASTEST = 9;
/** each measure: about a second of readings, every quarter second */
export const SPAN = 1;
export const EVERY = 0.25;
/** a wobble at all: the wave explains over a third of the movement (a real
    singer's wobble is less even than a pure wave: 24 Nov), and is
    at least this wide (cents); a held note's own unsteadiness is less */
export const MIN_FIT = 0.35;
export const MIN_WIDTH = 20;
/** two notes taking turns: a slow wave that explains most of the movement and swings most of a half step */
export const TURNS_FIT = 0.5;
export const TURNS_WIDTH = 70;
/** the first part of a hold, while the note is found, isn't measured */
export const SETTLE = 0.4;

export type WobbleKind = 'wobble' | 'turns' | 'none';
export interface Fit {
  /** cycles a second */
  readonly rate: number;
  /** cents, top to bottom */
  readonly width: number;
  /** the share of the movement the wave explains, 0 to 1 */
  readonly fit: number;
}
export interface Measure extends Fit {
  /** the middle of the readings it used, in seconds */
  readonly at: number;
  readonly kind: WobbleKind;
}

/* least squares on a few columns, by the normal equations */
function solve(cols: number[][], y: number[]): { coef: number[]; sse: number } | null {
  const k = cols.length, n = y.length;
  const a: number[][] = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      let s = 0;
      for (let r = 0; r < n; r++) s += cols[i][r] * cols[j][r];
      a[i][j] = s;
    }
    let s = 0;
    for (let r = 0; r < n; r++) s += cols[i][r] * y[r];
    a[i][k] = s;
  }
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return null;
    [a[c], a[p]] = [a[p], a[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = a[r][c] / a[c][c];
      for (let j = c; j <= k; j++) a[r][j] -= f * a[c][j];
    }
  }
  const coef = a.map((row, i) => row[k] / row[i]);
  let sse = 0;
  for (let r = 0; r < n; r++) {
    let v = 0;
    for (let i = 0; i < k; i++) v += coef[i] * cols[i][r];
    sse += (y[r] - v) ** 2;
  }
  return { coef, sse };
}

function waveAt(t: number[], y: number[], f: number, curve: boolean) {
  const tc = (t[0] + t[t.length - 1]) / 2;
  const w = 2 * Math.PI * f;
  const cols = [t.map(() => 1), t.map((x) => x - tc)];
  if (curve) cols.push(t.map((x) => (x - tc) ** 2));
  cols.push(t.map((x) => Math.sin(w * (x - tc))), t.map((x) => Math.cos(w * (x - tc))));
  const r = solve(cols, y);
  return r && { sse: r.sse, height: 2 * Math.hypot(r.coef[cols.length - 2], r.coef[cols.length - 1]) };
}
function driftOnly(t: number[], y: number[], curve: boolean) {
  const tc = (t[0] + t[t.length - 1]) / 2;
  const cols = [t.map(() => 1), t.map((x) => x - tc)];
  if (curve) cols.push(t.map((x) => (x - tc) ** 2));
  return solve(cols, y);
}

/** The wave that best fits these readings (times in seconds, notes as
    note numbers) at a speed between `lo` and `hi` a second, on top of a
    drift (straight, or with `curve` a bend too: a sung note drifts as well
    as wobbles), fitted over whole cycles of it; null with too few. */
export function fitWave(t: readonly number[], m: readonly number[], lo = SLOWEST, hi = FASTEST, curve = true): Fit | null {
  /* a reading far from the rest (a slip of the reader) is left out */
  const sorted = [...m].sort((a, b) => a - b);
  const mid = sorted[sorted.length >> 1];
  const keep = m.map((x) => Math.abs(x - mid) <= 3);
  const tt = t.filter((_, i) => keep[i]), yy = m.filter((_, i) => keep[i]).map((x) => x * 100);
  if (tt.length < 10) return null;
  const best = (ts: number[], ys: number[], a: number, b: number, step: number) => {
    let out: { f: number; sse: number; height: number } | null = null;
    for (let f = a; f <= b + 1e-9; f += step) {
      const r = waveAt(ts, ys, f, curve);
      if (r && (!out || r.sse < out.sse)) out = { f, sse: r.sse, height: r.height };
    }
    return out;
  };
  const first = best(tt, yy, lo, hi, 0.05);
  if (!first) return null;
  /* whole cycles: the readings trimmed to a whole number of cycles of the
     wave found, kept centred, and the wave fitted again on just those */
  let ts = tt, ys = yy, b = first;
  const span = tt[tt.length - 1] - tt[0];
  const cycles = Math.floor(span * first.f + 1e-6);
  if (cycles >= 2) {
    const len = cycles / first.f, from = tt[0] + (span - len) / 2;
    const inside = tt.map((x) => x >= from - 1e-6 && x <= from + len + 1e-6);
    const t2 = tt.filter((_, i) => inside[i]), y2 = yy.filter((_, i) => inside[i]);
    const again = t2.length >= 10 ? best(t2, y2, Math.max(lo, first.f - 0.3), Math.min(hi, first.f + 0.3), 0.01) : null;
    if (again) {
      ts = t2;
      ys = y2;
      b = again;
    }
  }
  const base = driftOnly(ts, ys, curve);
  if (!base || base.sse <= 0) return null;
  return { rate: b.f, width: b.height, fit: Math.max(0, 1 - b.sse / base.sse) };
}

/** A second of readings, looked at both ways: a wobble (3.5 to 9 a second,
    over a bending drift), and two notes taking turns (1 to 3.5 a second,
    over a straight one). Turns when the slow swing explains the movement
    at least as well as a wobble does and is most of a half step wide (two
    notes a half step apart swing about 100 cents; a held note's own slow
    drift is less); otherwise a wobble if that fits; otherwise none. */
export function fitSecond(t: readonly number[], m: readonly number[]): Fit & { kind: WobbleKind } | null {
  const w = fitWave(t, m, SLOWEST, FASTEST, true);
  if (!w) return null;
  const slow = fitWave(t, m, 1, SLOWEST, false);
  if (slow && slow.fit >= TURNS_FIT && slow.width >= TURNS_WIDTH && slow.fit >= w.fit) return { ...slow, kind: 'turns' };
  if (w.fit >= MIN_FIT && w.width >= MIN_WIDTH) return { ...w, kind: 'wobble' };
  return { ...w, kind: 'none' };
}

/** The measures along a hold: about a second of readings each, every
    quarter second, from SETTLE after `from` to `to`. `t` and `r` are the
    readings' times and notes (NaN where none). */
export function measures(t: ArrayLike<number>, r: ArrayLike<number>, from: number, to: number): Measure[] {
  const out: Measure[] = [];
  for (let a = from + SETTLE; a + SPAN <= to + 1e-6; a += EVERY) {
    const ts: number[] = [], ms: number[] = [];
    for (let i = 0; i < t.length; i++) if (t[i] >= a && t[i] < a + SPAN && Number.isFinite(r[i])) {
      ts.push(t[i]);
      ms.push(r[i]);
    }
    /* most of the second voiced, or nothing is said about it */
    if (ts.length < 0.7 * SPAN * 20) continue;
    const f = fitSecond(ts, ms);
    if (f) out.push({ ...f, at: a + SPAN / 2 });
  }
  return out;
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};

export interface Part {
  readonly rate: number | null;
  readonly width: number | null;
}
/** One hold, in words to come: what most of it was, its speed and width
    over the whole hold, and at its start, middle and end (a third each),
    where it wobbled. */
export interface Hold extends Part {
  readonly kind: WobbleKind | 'unheard';
  readonly start: Part;
  readonly middle: Part;
  readonly end: Part;
  /** how many measures, and how many were a wobble */
  readonly n: number;
  readonly wobbled: number;
}
const partOf = (ms: readonly Measure[]): Part => {
  const w = ms.filter((x) => x.kind === 'wobble');
  return w.length ? { rate: median(w.map((x) => x.rate)), width: median(w.map((x) => x.width)) } : { rate: null, width: null };
};
export function hold(ms: readonly Measure[], from: number, to: number): Hold {
  if (!ms.length) {
    const none = { rate: null, width: null };
    return { kind: 'unheard', ...none, start: none, middle: none, end: none, n: 0, wobbled: 0 };
  }
  const third = (to - from - SETTLE) / 3, a = from + SETTLE;
  const count = (k: WobbleKind) => ms.filter((x) => x.kind === k).length;
  const wobbled = count('wobble'), turns = count('turns'), none = count('none');
  const kind: WobbleKind = wobbled >= turns && wobbled >= none ? 'wobble' : turns >= none ? 'turns' : 'none';
  return {
    kind, ...partOf(ms), n: ms.length, wobbled,
    start: partOf(ms.filter((x) => x.at < a + third)),
    middle: partOf(ms.filter((x) => x.at >= a + third && x.at < a + 2 * third)),
    end: partOf(ms.filter((x) => x.at >= a + 2 * third)),
  };
}

/** the speed and width over these holds, the median of the holds that
    wobbled; null if none did (what the result card shows first, and what
    the account keeps: Robert, 25 Nov) */
export function overall(holds: readonly Hold[]): { rate: number; width: number } | null {
  const w = holds.filter((h) => h.rate != null && h.width != null);
  return w.length ? { rate: median(w.map((h) => h.rate as number)), width: median(w.map((h) => h.width as number)) } : null;
}

/** where a number sits against a typical range: under it, in it, over it */
export function against(v: number, range: readonly [number, number]): 'under' | 'in' | 'over' {
  return v < range[0] ? 'under' : v > range[1] ? 'over' : 'in';
}
