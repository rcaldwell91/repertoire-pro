import { SETTLE_CENTS, SETTLE_HOLD } from './pitch';

/* Find your resting note (Robert, 16 Nov). The singer hums and lets each
   "hmm" slide down until it comes to rest; the app says where. A slide is
   one stretch of sound, from its first note to the pause after it. Where it
   came to rest is the last part of it, before the sound stops, where the
   voice stayed settled: within 35 cents of where it sat for at least 0.6 s,
   the same measure as settling on Match the note (core/pitch: landing). It
   names that note and nothing more: never "your speaking pitch" or "your
   natural note", which the app does not measure. Not scored. */

/** a pause this long between sounds starts a new slide (seconds) */
export const REST_GAP = 0.4;
/** a slide is over once the sound has stopped this long */
export const REST_DONE = 0.6;
/** a shorter sound is not a slide (a cough, a breath) */
export const REST_MIN = 0.4;
/** readings further apart than this are not one settled stretch (the line's own hop is 0.05 s) */
const STEP = 0.11;

export interface Slide {
  readonly from: number;
  readonly to: number;
  /** the note it came to rest on, or null if it never settled */
  readonly note: number | null;
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** where one slide came to rest: the last stretch of at least SETTLE_HOLD
    seconds whose every reading is within SETTLE_CENTS of its middle */
export function restNote(t: readonly number[], m: readonly number[]): number | null {
  for (let j = t.length - 1; j >= 0; j--) {
    let best: number | null = null;
    for (let i = j; i >= 0; i--) {
      if (i < j && t[i + 1] - t[i] > STEP) break;
      const w = m.slice(i, j + 1);
      const mid = median(w);
      if (w.some((x) => Math.abs(x - mid) * 100 > SETTLE_CENTS)) break;
      if (t[j] - t[i] >= SETTLE_HOLD - 1e-6) best = mid;
    }
    if (best != null) return Math.round(best);
  }
  return null;
}

/** the slides in a line (times in seconds, notes as numbers; NaN where
    nothing was heard), finished ones only: a slide is finished once
    REST_DONE has passed since its last sound (by `now`, or the line's last
    reading), or `all` (Done tapped) */
export function restSlides(t: ArrayLike<number>, m: ArrayLike<number>, opts: { now?: number; all?: boolean } = {}): Slide[] {
  const pts: Array<{ t: number; m: number }> = [];
  for (let i = 0; i < t.length; i++) if (Number.isFinite(m[i])) pts.push({ t: t[i], m: m[i] });
  const now = opts.now ?? (t.length ? t[t.length - 1] : 0);
  const groups: Array<Array<{ t: number; m: number }>> = [];
  for (const p of pts) {
    const g = groups[groups.length - 1];
    if (g && p.t - g[g.length - 1].t <= REST_GAP) g.push(p);
    else groups.push([p]);
  }
  const out: Slide[] = [];
  for (const g of groups) {
    const from = g[0].t, to = g[g.length - 1].t;
    if (to - from < REST_MIN) continue;
    if (!opts.all && now - to < REST_DONE) continue;
    out.push({ from, to, note: restNote(g.map((p) => p.t), g.map((p) => p.m)) });
  }
  return out;
}
