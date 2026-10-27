/* Goal: start what to sing today in one tap. */
import { useEffect, useState } from 'react';
import { Ear, Flame, MoveVertical, Music2, Speech, Wind } from 'lucide-react';
import type { ComponentType } from 'react';
import { copy, fill } from '../core/copy';
import { CATEGORIES, DAILY, type CategoryId } from '../core/exercises';
import { routineToday, type TodayItem } from '../core/today';
import { today } from '../data/today';
import { catRoute, exRoute, navigate, routineRoute } from '../shell/router';
import { QuickRun } from '../ui/icons';

/* Train (RULEBOOK 1b, 3; Robert, 24 and 27 Oct). Tier one: the Today card
   (what to sing next, its length and Start, with one line to the other
   routines), then the six groups as cards in their colours. Nothing else.
   What Today shows comes from one source (data/today), asked in order: a
   coach's assignment, a program's day, the singer's own plan, which falls
   back to the daily warm-up. This screen only shows what it picks. A
   group's list, the other routines and the range check are each one tap
   away. Nothing plays here. */

/* each group's simple picture; Agility's is a quick run on a staff (Robert,
   27 Oct); Pitch's an ear: hearing a note, then landing on it (28 Oct) */
const PICTURE: Record<CategoryId, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  warmup: Flame, breath: Wind, tone: Music2, agility: QuickRun, range: MoveVertical, words: Speech, pitch: Ear };

export function TrainPage() {
  /* the daily warm-up until the source answers */
  const [t, setT] = useState<TodayItem>(() => routineToday(DAILY));
  useEffect(() => {
    let live = true;
    void today().then((got) => live && setT(got));
    return () => {
      live = false;
    };
  }, []);
  const start = () => navigate(t.start.kind === 'routine' ? routineRoute(t.start.key, 0) : exRoute(t.start.id), 'screen');
  return (
    <>
      <h1>{copy.tabs.train}</h1>

      <section className="card routine" id="today" data-from={t.from}>
        <p className="ex-label">{copy.train.today}</p>
        <h2 id="today-name">{t.name}</h2>
        <p className="hint" id="today-length">{fill(copy.train.minsSteps, { mins: t.mins, n: t.count })}</p>
        <button type="button" className="btn btn-start" id="today-start" onClick={start}>
          {copy.train.start}
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
              <Picture size={34} strokeWidth={2} />
              <strong>{copy.cats[c.id]}</strong>
            </button>
          );
        })}
      </div>
    </>
  );
}
