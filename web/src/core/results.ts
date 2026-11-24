import { copy } from './copy';
import { exercise, levelsOf, measures, type Exercise, type Level } from './exercises';
import type { Hold } from './vibrato';

/* What an exercise left behind, as the old app kept it (rp-cloud.js
   870-905, the results table): only numbers that were measured
   (rp-score.js). A sung exercise without the mic was done, not scored. */

export type Outcome =
  /* rounds: how many were sung, of how many, when some were left out (Robert,
     4 Nov); landing: Match the note's averages, in cents and seconds */
  | { kind: 'pitch'; hits: number; n: number; rounds?: { sung: number; of: number };
      landing?: { firstOn: number; tries: number; first: number | null; settleAfter: number | null; settled: number | null } }
  | { kind: 'time'; seconds: number }
  /** Long soft notes: how long each timed hold lasted, steps 1 and 4 */
  | { kind: 'holds'; step1: readonly number[]; step4: ReadonlyArray<{ m: number; s: number }> }
  /** Vibrato (24 Nov): each held note's wobble, measured, never scored;
      kept on this phone, not online (speed has no place in the results
      table, and its tables aren't changed without Robert) */
  | { kind: 'wobble'; holds: ReadonlyArray<Hold & { readonly m: number }> }
  | { kind: 'none' };

export interface ResultRow {
  readonly kind: 'practice';
  readonly label: string;
  readonly app_ex_id: string;
  readonly score?: number;
  readonly out_of?: number;
  readonly pct?: number;
  readonly seconds?: number;
  /** Match the note: first tries' average distance (cents) */
  readonly cents?: number;
  /** Match the note: how close it settled, on average (cents; 13 Nov) */
  readonly settle_cents?: number;
  /** the level it was sung at (Robert, 21 Nov), on an exercise with levels;
      online in the results table's own level column (Robert, 22 Nov) */
  readonly level?: Level;
}

/** the level of a saved result; null for one saved before it had its own
    level (Robert, 22 Nov: those stay without one) */
export function levelOfRow(r: { level?: Level | null }): Level | null {
  return r.level === 1 || r.level === 2 || r.level === 3 ? r.level : null;
}
/** the saved results sung at this level, newest first as given: "your best"
    and "last time" compare within a level only (Robert, 21 Nov) */
export function atSameLevel<T extends { level?: Level | null }>(rows: readonly T[], level: Level): T[] {
  return rows.filter((r) => levelOfRow(r) === level);
}
/** whether an exercise is sung at a level the singer picks */
export function hasLevels(e: Exercise): boolean {
  return levelsOf(e).length > 1 || e.engine.kind === 'interval';
}

export function resultRow(e: Exercise, o: Outcome, level: Level = e.level): ResultRow {
  const name = copy.ex[e.id].name;
  const base = { kind: 'practice' as const, app_ex_id: e.id, label: name, ...(hasLevels(e) ? { level } : {}) };
  if (o.kind === 'pitch' && o.n > 0) {
    const l = o.landing;
    return { ...base, score: o.hits, out_of: o.n, pct: Math.round((100 * o.hits) / o.n),
      ...(l?.first != null ? { cents: Math.round(l.first) } : {}),
      ...(l?.settleAfter != null ? { seconds: Math.round(l.settleAfter * 10) / 10 } : {}),
      ...(l?.settled != null ? { settle_cents: Math.round(l.settled) } : {}) };
  }
  /* the hiss: its seconds, and no target nobody measured (Robert, 4 Nov) */
  if (o.kind === 'time' && e.engine.kind === 'timed') {
    return { ...base, score: Math.round(o.seconds), seconds: Math.round(o.seconds * 10) / 10 };
  }
  /* Long soft notes: the longest hold on "ee" (step 1), the measure Stemple tracks */
  if (o.kind === 'holds' && o.step1.length) return { ...base, seconds: Math.round(Math.max(...o.step1) * 10) / 10 };
  return base;
}

/** whether an exercise is scored at all */
export function scored(id: string): boolean {
  const e = exercise(id);
  return !!e && measures(e) !== 'none';
}
