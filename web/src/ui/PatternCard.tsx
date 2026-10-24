import { useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Play, Square } from 'lucide-react';
import { copy } from '../core/copy';
import type { Note } from '../core/exercises';

/* The pattern card (Robert, 24 Oct): the exercise's pattern as small bars,
   one per note, higher for higher, wider for longer, with one play button.
   As it plays, the current bar lights and the syllable shows under the
   card, so the singer sees how it is sung before starting. Nothing plays
   until the button is tapped; the screen asks the conductor. */
export function PatternCard(props: { notes: readonly Note[]; syl: string; colour: string; playing: boolean; now: () => number;
  onPlay: (ev: SyntheticEvent) => void }) {
  const [lit, setLit] = useState(-1);
  const { playing, now, notes } = props;
  /* while it plays, which note is sounding, read from the conductor's clock */
  useEffect(() => {
    if (!playing) return;
    const h = setInterval(() => {
      const t = now();
      setLit(notes.findIndex((n) => t >= n.t && t < n.t + n.d));
    }, 50);
    return () => clearInterval(h);
  }, [playing, now, notes]);
  const cur = playing ? lit : -1;

  const lo = Math.min(...notes.map((n) => n.m)), hi = Math.max(...notes.map((n) => n.m));
  const height = (m: number) => 30 + (hi > lo ? ((m - lo) / (hi - lo)) * 70 : 35);
  return (
    <>
      <section className="card pattern" id="pattern" data-colour={props.colour}>
        <div className="pbars" aria-hidden="true">
          {notes.map((n, i) => (
            <span key={i} className="pbar" data-now={i === cur ? 'true' : undefined} style={{ height: height(n.m) + '%', flexGrow: n.d }} />
          ))}
        </div>
        <button type="button" className="round pattern-play" id="pattern-play" aria-label={playing ? copy.train.stopPattern : copy.train.hearPattern}
          aria-pressed={playing} onClick={props.onPlay}>
          {playing ? <Square size={22} strokeWidth={2} aria-hidden="true" /> : <Play size={24} strokeWidth={2} aria-hidden="true" />}
        </button>
      </section>
      <p className="pattern-syl" id="pattern-syl" aria-live="polite">{cur >= 0 ? props.syl : ''}</p>
    </>
  );
}
