/* Goal: hear the takes of this exercise, your voice over its notes. */
import { useState } from 'react';
import type { SyntheticEvent } from 'react';
import { copy } from '../core/copy';
import { exercise } from '../core/exercises';
import { exerciseKey, type StoredTake } from '../data/takes';
import { useConductor, useSnapshot } from '../shell/conductor-context';
import { pianoStep } from '../shell/piano-step';
import { back, exRoute } from '../shell/router';
import { BackButton } from '../ui/BackButton';
import { TakesList } from './TakesList';

/* "Your takes" for one exercise (Robert, 28 Oct): newest first, each heard
   as it was sung, your voice over the exercise's own piano notes, in time.
   Only heard for now: no send, no delete. */
export function ExerciseTakes(props: { id: string }) {
  const c = useConductor();
  const snap = useSnapshot();
  const e = exercise(props.id);
  const owner = 'extakes:' + props.id;
  const [heard, setHeard] = useState<string | null>(null);
  const playing = c.active() && snap.owner === owner;

  function play(ev: SyntheticEvent, t: StoredTake, url: string) {
    if (playing) c.stop();
    if (playing && heard === t.id) {
      setHeard(null);
      return;
    }
    setHeard(t.id);
    const notes = (t.exercise?.notes ?? []).map(([m, at, d]) => ({ m, t: at, d }));
    c.start(c.tap(ev.nativeEvent), { owner, steps: [pianoStep(notes, { take: { url, songAt: t.songAt } })] });
  }

  return (
    <>
      <BackButton label={e ? copy.ex[e.id].name : copy.tabs.train} onBack={() => back(e ? exRoute(e.id) : '/train')} />
      <h1>{copy.takes.title}</h1>
      {e && <p className="hint" id="ex-takes-of">{copy.ex[e.id].name}</p>}
      <TakesList songId={exerciseKey(props.id)} playing={playing ? heard : null} menu={false} onPlay={play} />
    </>
  );
}
