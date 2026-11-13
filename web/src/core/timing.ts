/* When the voice arrives on each note (Robert, 13 Nov). He found that on the
   exercises sung with the piano, part of each note has gone before his
   voice gets there. Before any pause is added, this measures it, from a
   saved take: for every note sung over the piano, how long after the piano
   sounded it the voice was first on it. The whole spread, never one
   average: a pause has to be chosen from real singing (the rule: a
   threshold comes from the data).

   "On it": within half a half step (50 cents), for at least 0.1 s, the
   octave folded with Any octave. The search starts a quarter of a second
   before the note (a singer can arrive early) and ends with the note. A
   note never reached is counted as missed, not as late. */

export const ON_CENTS = 50;
export const STAY = 0.1;
export const EARLY = 0.25;

export type PianoNote = readonly [m: number, t: number, d: number];

export interface Arrival {
  readonly m: number;
  readonly t: number;
  readonly d: number;
  /** seconds after the piano note that the voice was on it; null if never */
  readonly after: number | null;
}

function off(m: number, note: number, anyOctave: boolean): number {
  let d = m - note;
  if (anyOctave) d = ((((d % 12) + 18) % 12) + 12) % 12 - 6;
  return Math.abs(d) * 100;
}

/** each piano note's arrival, from the line's points (time in the take's song time) */
export function arrivals(piano: readonly PianoNote[], t: ArrayLike<number>, m: ArrayLike<number>, anyOctave = false): Arrival[] {
  return piano.map(([note, at, d]) => {
    let first: number | null = null;
    for (let i = 0; i < t.length; i++) {
      if (t[i] < at - EARLY || t[i] >= at + d) continue;
      const v = m[i];
      if (!Number.isFinite(v) || off(v, note, anyOctave) > ON_CENTS) {
        first = null;
        continue;
      }
      if (first == null) first = t[i];
      if (t[i] - first >= STAY - 1e-6) return { m: note, t: at, d, after: first - at };
    }
    return { m: note, t: at, d, after: null };
  });
}

/** the spread: how many, how many reached, and the arrivals at each share */
export interface Spread {
  readonly notes: number;
  readonly reached: number;
  readonly sorted: readonly number[];
  /** arrival at 0, 10, 25, 50, 75, 90 and 100% */
  readonly at: Readonly<Record<'min' | 'p10' | 'p25' | 'median' | 'p75' | 'p90' | 'max', number | null>>;
  /** how many arrived in each 50 ms from -250 ms */
  readonly bins: ReadonlyArray<{ readonly from: number; readonly count: number }>;
}
export function spread(a: readonly Arrival[]): Spread {
  const sorted = a.map((x) => x.after).filter((x): x is number => x != null).sort((p, q) => p - q);
  const q = (f: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(f * (sorted.length - 1))))] : null);
  const bins: Array<{ from: number; count: number }> = [];
  if (sorted.length) {
    for (let from = -EARLY; from < sorted[sorted.length - 1] + 0.05; from += 0.05) {
      const f = Math.round(from * 1000) / 1000;
      bins.push({ from: f, count: sorted.filter((x) => x >= f - 1e-9 && x < f + 0.05 - 1e-9).length });
    }
  }
  return { notes: a.length, reached: sorted.length, sorted,
    at: { min: q(0), p10: q(0.1), p25: q(0.25), median: q(0.5), p75: q(0.75), p90: q(0.9), max: q(1) }, bins };
}
