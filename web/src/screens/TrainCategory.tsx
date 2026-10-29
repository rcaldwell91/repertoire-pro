/* Goal: pick one exercise from this group. */
import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { copy, fill } from '../core/copy';
import { CATEGORIES, EXERCISES, measures, type Exercise } from '../core/exercises';
import { keyName } from '../core/notemap';
import { keptRange, onRange, pullRange } from '../data/range';
import { back, exRoute, navigate } from '../shell/router';
import { BackButton } from '../ui/BackButton';

/* One group of exercises (Robert, 24 Oct): its name in its colour, one
   line on what it is for, then its exercises as rows with the level, Quiet
   if it works at hum volume, and what the app measures. In Range, the
   range check's row shows your range, or "Not measured yet". */

/** what the app measures about it, as a tag */
export function measureTag(e: Exercise): string {
  const m = measures(e);
  return m === 'pitch' ? copy.train.tagPitch : m === 'time' ? copy.train.tagTime : m === 'range' ? copy.train.tagRange : copy.train.tagNone;
}

export function TrainCategory(props: { id: string }) {
  const cat = CATEGORIES.find((c) => c.id === props.id);
  const [range, setRange] = useState(keptRange);
  useEffect(() => onRange(() => setRange(keptRange())), []);
  useEffect(() => {
    if (cat?.id === 'range') void pullRange();
  }, [cat]);
  if (!cat) {
    return (
      <>
        <BackButton label={copy.tabs.train} onBack={() => back('/train')} />
        <p className="problem">{copy.train.missing}</p>
      </>
    );
  }
  const list = EXERCISES.filter((e) => e.category === cat.id);
  const line = (e: Exercise) => {
    if (e.engine.kind === 'range') {
      return <span className="ex-tags" id="range-value">{range ? fill(copy.train.rangeIs, { lo: keyName(range.lo), hi: keyName(range.hi) }) : copy.train.notMeasured}</span>;
    }
    const tag = { level: copy.levels[e.level], measure: measureTag(e) };
    return <span className="ex-tags">{fill(e.quiet ? copy.train.tagLineQuiet : copy.train.tagLine, tag)}</span>;
  };
  return (
    <section className="cat-page" id={'cat-' + cat.id} data-colour={cat.colour}>
      <BackButton label={copy.tabs.train} onBack={() => back('/train')} />
      <h1>{copy.cats[cat.id]}</h1>
      <p className="hint">{copy.catLines[cat.id]}</p>
      {list.map((e) => (
        <button key={e.id} type="button" className="ex-row" id={'ex-' + e.id} data-colour={cat.colour} onClick={() => navigate(exRoute(e.id), 'screen')}>
          <span className="ex-text">
            <strong>{copy.ex[e.id].name}</strong>
            {'plain' in copy.ex[e.id] && <span className="ex-plain">{(copy.ex[e.id] as { plain: string }).plain}</span>}
            {line(e)}
          </span>
          <ChevronRight size={22} strokeWidth={2} aria-hidden="true" />
        </button>
      ))}
    </section>
  );
}
