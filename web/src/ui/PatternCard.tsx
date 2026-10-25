import { useEffect, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Play, Square } from 'lucide-react';
import { copy } from '../core/copy';
import { sylOf, type Note } from '../core/exercises';

/* The pattern card (Robert, 24 and 25 Oct): the exercise's pattern as a
   melody line of short dashes, one per note, each at its pitch height (low
   notes low, high notes high), wider for longer, with one play button. As
   it plays, the current dash lights and the note's syllable shows under
   the dashes, so the singer sees how it is sung before starting. Nothing
   plays until the button is tapped; the screen asks the conductor. */
export function PatternCard(props: { notes: readonly Note[]; colour: string; playing: boolean; now: () => number;
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

  /* the lowest note sits near the bottom, the highest near the top */
  const lo = Math.min(...notes.map((n) => n.m)), hi = Math.max(...notes.map((n) => n.m));
  const bottom = (m: number) => 6 + (hi > lo ? ((m - lo) / (hi - lo)) * 80 : 40);
  return (
    <section className="card pattern" id="pattern" data-colour={props.colour}>
      <div className="pattern-notes">
        <div className="pdashes" aria-hidden="true">
          {notes.map((n, i) => (
            <span key={i} className="pdash" data-pitch={n.m} data-now={i === cur ? 'true' : undefined} style={{ flexGrow: n.d }}>
              <i style={{ bottom: bottom(n.m) + '%' }} />
            </span>
          ))}
        </div>
        <p className="pattern-syl" id="pattern-syl" aria-live="polite">{cur >= 0 ? sylOf(notes[cur]) : ''}</p>
      </div>
      <button type="button" className="round pattern-play" id="pattern-play" aria-label={playing ? copy.train.stopPattern : copy.train.hearPattern}
        aria-pressed={playing} onClick={props.onPlay}>
        {playing ? <Square size={22} strokeWidth={2} aria-hidden="true" /> : <Play size={24} strokeWidth={2} aria-hidden="true" />}
      </button>
    </section>
  );
}
