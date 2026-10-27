import { ROUTINES, DAILY, type RoutineId } from '../core/exercises';
import { pickToday, routineToday, type TodayItem, type TodaySource } from '../core/today';

/* Today's sources, in core/today's order (Robert, 27 Oct). */

/** 1. what a coach assigned: not built yet (it comes with the Coach tab) */
const coachAssigned: TodaySource = async () => null;

/** 2. today's day of a program the singer bought: not built yet */
const programDay: TodaySource = async () => null;

/** the singer's own plan: the routine they chose as theirs, kept on this
    phone. Nothing in the app sets it yet. */
export const OWN_PLAN = 'rp.plan';

/** 3. their own plan; with none, the daily warm-up */
const ownPlan: TodaySource = async () => {
  let key: string | null = null;
  try {
    key = localStorage.getItem(OWN_PLAN);
  } catch {
    /* a private window, or storage turned off: no plan kept */
  }
  return routineToday(key && key in ROUTINES ? (key as RoutineId) : DAILY);
};

/** what to do today, asked of every source in order */
export function today(): Promise<TodayItem> {
  return pickToday({ coach: coachAssigned, program: programDay, own: ownPlan });
}
