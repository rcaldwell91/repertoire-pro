import { copy } from './copy';
import { exercise, measures, type Exercise } from './exercises';

/* What an exercise left behind, as the old app kept it (rp-cloud.js
   870-905, the results table): only numbers that were measured
   (rp-score.js). A sung exercise without the mic was done, not scored. */

export type Outcome =
  | { kind: 'pitch'; hits: number; n: number }
  | { kind: 'time'; seconds: number }
  | { kind: 'none' };

export interface ResultRow {
  readonly kind: 'practice';
  readonly label: string;
  readonly app_ex_id: string;
  readonly score?: number;
  readonly out_of?: number;
  readonly pct?: number;
  readonly seconds?: number;
}

export function resultRow(e: Exercise, o: Outcome): ResultRow {
  const base = { kind: 'practice' as const, label: copy.ex[e.id].name, app_ex_id: e.id };
  if (o.kind === 'pitch' && o.n > 0) return { ...base, score: o.hits, out_of: o.n, pct: Math.round((100 * o.hits) / o.n) };
  if (o.kind === 'time' && e.engine.kind === 'timed') {
    return { ...base, score: Math.round(o.seconds), out_of: e.engine.target, seconds: Math.round(o.seconds * 10) / 10 };
  }
  return base;
}

/** whether an exercise is scored at all */
export function scored(id: string): boolean {
  const e = exercise(id);
  return !!e && measures(e) !== 'none';
}
