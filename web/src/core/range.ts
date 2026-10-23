import type { Range } from './notemap';

/* Your range: one source of truth (RULEBOOK 4, Screens), and how it was
   found. The old app's default until it is measured (rp-range.js: its
   built-in A2-A4, shown as "Not measured yet"), and its range check
   (next.html 3754-3790). Kept by data/range. */

export const DEFAULT_RANGE: Range = { lo: 45, hi: 69 };

export interface KeptRange extends Range {
  /** when it was found */
  readonly at: string;
  /** how: sung in the range check */
  readonly by: 'test' | 'preset';
}

/** four seconds of voiced singing at each end (twenty points a second) */
export const RANGE_POINTS = 80;

function percentile(a: readonly number[], p: number): number {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

/** the lowest comfortable note is the 5th percentile of the low singing,
    the highest the 95th of the high; less than seven notes apart, an octave */
export function rangeFrom(low: readonly number[], high: readonly number[]): Range {
  const lo = Math.round(percentile(low, 0.05));
  let hi = Math.round(percentile(high, 0.95));
  if (hi < lo + 7) hi = lo + 12;
  return { lo, hi };
}
