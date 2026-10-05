import { foldTo } from './notemap.ts';

/* A take, as numbers: which of your notes were right, and the share of
   them. ONE rule, used both to colour your line on the note map and for
   a take's right-note % (RULEBOOK 3: only numbers the app measured). */

/** a note within half a semitone of the singer's (in the singer's octave
    when "Any octave" is on) */
export const RIGHT_WITHIN = 0.5;

export function isRight(m: number, singer: number, anyOctave: boolean): boolean {
  if (!Number.isFinite(m) || !Number.isFinite(singer)) return false;
  const you = anyOctave ? foldTo(m, singer) : m;
  return Math.abs(you - singer) < RIGHT_WITHIN;
}

/** the singer's note at time t, if they are singing then */
export function singerNow(line: ArrayLike<number>, hop: number, t: number): number {
  const k = Math.round(t / hop);
  return k >= 0 && k < line.length ? line[k] : NaN;
}

/** at least this many of your notes, sung where the singer sings, to give a % */
export const MIN_SCORED = 20;

/** Right notes as a whole %, over your notes sung where the singer sings;
    null when there are too few to say. */
export function rightPct(t: ArrayLike<number>, m: ArrayLike<number>, singer: ArrayLike<number>, hop: number, anyOctave: boolean): number | null {
  let n = 0, hit = 0;
  for (let i = 0; i < t.length; i++) {
    if (!Number.isFinite(m[i])) continue;
    const s = singerNow(singer, hop, t[i]);
    if (!Number.isFinite(s)) continue;
    n++;
    if (isRight(m[i], s, anyOctave)) hit++;
  }
  return n >= MIN_SCORED ? Math.round((100 * hit) / n) : null;
}
