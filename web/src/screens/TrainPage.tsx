/* Goal: start today's warm-up in one tap. */
import { Flame, MoveVertical, Music2, Wind, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { copy, fill } from '../core/copy';
import { CATEGORIES, DAILY, ROUTINES, type CategoryId } from '../core/exercises';
import { catRoute, navigate, routineRoute } from '../shell/router';

/* Train (RULEBOOK 1b, 3; Robert, 24 Oct). Tier one: the warm-up card with
   Start and one line to the other routines, then the five groups as cards
   in their colours. Nothing else. A group's list, the other routines and
   the range check are each one tap away. Nothing plays here. */

const PICTURE: Record<CategoryId, LucideIcon> = { warmup: Flame, breath: Wind, tone: Music2, agility: Zap, range: MoveVertical };

export function TrainPage() {
  const daily = ROUTINES[DAILY];
  return (
    <>
      <h1>{copy.tabs.train}</h1>

      <section className="card routine" id="daily">
        <h2>{copy.routineNames[DAILY]}</h2>
        <p className="hint">{fill(copy.train.minsSteps, { mins: daily.mins, n: daily.steps.length })}</p>
        <button type="button" className="btn btn-start" id="routine-start" onClick={() => navigate(routineRoute(DAILY, 0), 'screen')}>
          {copy.train.startRoutine}
        </button>
        <button type="button" className="btn btn-quiet btn-link" id="more-routines" onClick={() => navigate('/train/routines', 'screen')}>
          {copy.train.routines}
        </button>
      </section>

      <div className="cat-cards" id="cat-cards">
        {CATEGORIES.map((c) => {
          const Picture = PICTURE[c.id];
          return (
            <button key={c.id} type="button" className="cat-card" id={'cat-' + c.id} data-colour={c.colour}
              onClick={() => navigate(catRoute(c.id), 'screen')}>
              <Picture size={34} strokeWidth={2} aria-hidden="true" />
              <strong>{copy.cats[c.id]}</strong>
            </button>
          );
        })}
      </div>
    </>
  );
}
