import { copy } from './copy';
import { exercise, measures, type Exercise } from './exercises';

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
}

export function resultRow(e: Exercise, o: Outcome): ResultRow {
  const base = { kind: 'practice' as const, label: copy.ex[e.id].name, app_ex_id: e.id };
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
