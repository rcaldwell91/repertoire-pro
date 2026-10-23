import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { copy, fill } from '../core/copy';
import { CATEGORIES, DAILY, EXERCISES, ROUTINES, measures, type Exercise, type RoutineId } from '../core/exercises';
import { keyName } from '../core/notemap';
import { keptRange, onRange, pullRange } from '../data/range';
import { exRoute, navigate, routineRoute } from '../shell/router';

/* Train (RULEBOOK 1b): a short daily routine at the top, your range, then
   the exercises by group, each group in its colour. Tapping one opens its
   preview; nothing plays here. */

/** what the app measures about it, as a tag */
export function measureTag(e: Exercise): string {
  const m = measures(e);
  return m === 'pitch' ? copy.train.tagPitch : m === 'time' ? copy.train.tagTime : m === 'range' ? copy.train.tagRange : copy.train.tagNone;
}

export function TrainPage() {
  const [range, setRange] = useState(keptRange);
  useEffect(() => onRange(() => setRange(keptRange())), []);
  useEffect(() => {
    void pullRange();
  }, []);
  const daily = ROUTINES[DAILY];
  const more = (Object.keys(ROUTINES) as RoutineId[]).filter((k) => k !== DAILY);

  return (
    <>
      <h1>{copy.tabs.train}</h1>

      <section className="card routine" id="daily">
        <h2>{copy.routineNames[DAILY]}</h2>
        <p className="hint">
          <span>{fill(copy.train.mins, { n: daily.mins })}</span>
          <span className="dot" aria-hidden="true" />
          <span>{fill(copy.train.steps, { n: daily.steps.length })}</span>
        </p>
        <ol className="routine-steps">
          {daily.steps.map((id) => <li key={id}>{copy.ex[id].name}</li>)}
        </ol>
        <button type="button" className="btn btn-start" id="routine-start" onClick={() => navigate(routineRoute(DAILY, 0), 'screen')}>
          {copy.train.startRoutine}
        </button>
      </section>

      <button type="button" className="btn btn-quiet btn-row range-row" id="range-line" onClick={() => navigate(exRoute('rangecheck'), 'screen')}>
        <span>
          <strong>{copy.train.range}</strong>
          <span className="hint" id="range-value">
            {range ? fill(copy.train.rangeIs, { lo: keyName(range.lo), hi: keyName(range.hi) }) : copy.train.notMeasured}
          </span>
        </span>
        <ChevronRight size={24} strokeWidth={2} aria-hidden="true" />
      </button>

      {CATEGORIES.map((c) => (
        <section key={c.id} className="train-cat" id={'cat-' + c.id} data-colour={c.colour}>
          <h2>{copy.cats[c.id]}</h2>
          <p className="hint">{copy.catLines[c.id]}</p>
          {EXERCISES.filter((e) => e.category === c.id).map((e) => (
            <button key={e.id} type="button" className="ex-row" id={'ex-' + e.id} data-colour={c.colour}
              onClick={() => navigate(exRoute(e.id), 'screen')}>
              <span className="ex-text">
                <strong>{copy.ex[e.id].name}</strong>
                <span className="ex-tags">
                  <span>{copy.levels[e.level]}</span>
                  <span className="dot" aria-hidden="true" />
                  <span>{measureTag(e)}</span>
                </span>
              </span>
              <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
            </button>
          ))}
        </section>
      ))}

      <section className="train-more" id="more-routines">
        <h2>{copy.train.routines}</h2>
        {more.map((k) => (
          <button key={k} type="button" className="btn btn-quiet btn-row" id={'routine-' + k} onClick={() => navigate(routineRoute(k, 0), 'screen')}>
            <span>
              <strong>{copy.routineNames[k]}</strong>
              <span className="hint">{fill(copy.train.mins, { n: ROUTINES[k].mins })}</span>
            </span>
            <ChevronRight size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        ))}
      </section>
    </>
  );
}
