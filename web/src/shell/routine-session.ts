import { exercise, routineSteps, type RoutineId, type RoutineStep } from '../core/exercises';
import { tensionEverDone } from '../data/tension';

/* A routine's steps, fixed when it starts (Robert, 4 Nov): the daily
   warm-up opens with the "Ah" tension check for anyone who has never done
   it, and finishing that check must not shift the steps after it. So the
   list is worked out once, when Start is tapped (or a routine is opened
   with none kept), and kept for this tab while the routine runs. */

const KEY = 'rp.routine.';

function valid(v: unknown): v is RoutineStep[] {
  return Array.isArray(v) && v.length > 0 && v.every((s) => s && typeof s.id === 'string' && !!exercise(s.id) && [1, 2, 3].includes(s.level));
}

/** start a routine: its steps worked out now, and kept */
export function beginRoutine(key: RoutineId): RoutineStep[] {
  const steps = routineSteps(key, tensionEverDone());
  try {
    sessionStorage.setItem(KEY + key, JSON.stringify(steps));
  } catch {
    /* nothing to keep it in: worked out again each step */
  }
  return steps;
}

/** the steps of a routine under way; if none were kept, it starts now */
export function routineNow(key: RoutineId): RoutineStep[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY + key) || 'null');
    if (valid(v)) return v;
  } catch {
    /* kept wrongly: worked out again */
  }
  return beginRoutine(key);
}
