import { copy } from './copy';
import { ROUTINES, DAILY, routineMins, routineSteps, type RoutineId } from './exercises';
import type { Range } from './notemap';
import { DEFAULT_RANGE } from './range';

/* Today (Robert, 27 Oct): what the singer should do next, from one source,
   asked in this order:
     1. what a coach assigned;
     2. today's day of a program they bought;
     3. their own plan, which falls back to the daily warm-up.
   Each is a source that answers with something to do, or nothing. Only the
   third exists yet (data/today); the first two plug in there later, and the
   Train screen, which only shows what this picks, stays as it is. */

export type TodayFrom = 'coach' | 'program' | 'own';
export const TODAY_ORDER: readonly TodayFrom[] = ['coach', 'program', 'own'];

export interface TodayItem {
  /** where it came from */
  readonly from: TodayFrom;
  readonly name: string;
  /** about how long, in minutes, and how many exercises */
  readonly mins: number;
  readonly count: number;
  /** what Start opens */
  readonly start: { readonly kind: 'routine'; readonly key: RoutineId } | { readonly kind: 'exercise'; readonly id: string };
}

/** a source answers with something to do today, or nothing */
export type TodaySource = () => Promise<TodayItem | null>;

/** one of the app's routines, as something to do today: its length worked
    out for the singer's range (Robert, 4 Nov), and the daily one with the
    tension check first for anyone who has never done it */
export function routineToday(key: RoutineId, from: TodayFrom = 'own', range: Range = DEFAULT_RANGE, tensionDone = true): TodayItem {
  const steps = routineSteps(key, tensionDone);
  return { from, name: copy.routineNames[key], mins: routineMins(steps, range, !!ROUTINES[key].down), count: steps.length, start: { kind: 'routine', key } };
}

/** The first source in order that has something; a source that fails is
    passed over; with nothing anywhere, the daily warm-up. */
export async function pickToday(sources: Partial<Record<TodayFrom, TodaySource>>, fallback: () => TodayItem = () => routineToday(DAILY)): Promise<TodayItem> {
  for (const from of TODAY_ORDER) {
    const ask = sources[from];
    if (!ask) continue;
    try {
      const got = await ask();
      if (got) return { ...got, from };
    } catch {
      /* this source could not answer (offline, say): ask the next */
    }
  }
  return fallback();
}
