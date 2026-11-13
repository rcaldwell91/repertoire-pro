/* Goal: start one of the other routines. */
import { ChevronRight } from 'lucide-react';
import { copy, fill } from '../core/copy';
import { DAILY, ROUTINES, routineMins, routineSteps, type RoutineId } from '../core/exercises';
import { rangeNow } from '../data/range';
import { tensionEverDone } from '../data/tension';
import { beginRoutine } from '../shell/routine-session';
import { back, navigate, routineRoute } from '../shell/router';
import { BackButton } from '../ui/BackButton';

/* The routines other than the daily warm-up, and the cool-down (Robert,
   24 Oct): each a row with its length, opening its first step paused. */
export function TrainRoutines() {
  const more = (Object.keys(ROUTINES) as RoutineId[]).filter((k) => k !== DAILY);
  /* each one's length worked out from its exercises, for your range (Robert, 4 Nov) */
  const range = rangeNow();
  const stepsOf = (k: RoutineId) => routineSteps(k, tensionEverDone());
  return (
    <>
      <BackButton label={copy.tabs.train} onBack={() => back('/train')} />
      <h1>{copy.train.routines}</h1>
      <p className="hint">{copy.train.routinesLine}</p>
      <section className="train-more" id="more-routines-list">
        {more.map((k) => (
          <button key={k} type="button" className="btn btn-quiet btn-row" id={'routine-' + k} onClick={() => {
              beginRoutine(k);
              navigate(routineRoute(k, 0), 'screen');
            }}>
            <span>
              <strong>{copy.routineNames[k]}</strong>
              <span className="hint">{fill(copy.train.minsSteps, { mins: routineMins(stepsOf(k), range, !!ROUTINES[k].down), n: stepsOf(k).length })}</span>
            </span>
            <ChevronRight size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        ))}
      </section>
    </>
  );
}
