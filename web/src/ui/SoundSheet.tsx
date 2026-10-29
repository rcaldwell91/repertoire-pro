import { copy } from '../core/copy';
import type { JumpLevel } from '../core/pitch';
import { Slider } from './Slider';

/* The sound sheet behind the gear (Robert, 24 and 28 Oct), the same on an
   exercise's page and while singing it: Any octave, Count-in sound, Hear
   yourself and its volume; on the page only, Sing the interval's level
   (changing it mid-round would change the round). A row shows only where
   it means something. */
export interface SheetRow<T> {
  readonly value: T;
  readonly set: (v: T) => void;
}

export function SoundSheet(props: {
  level?: SheetRow<JumpLevel>;
  anyOctave?: SheetRow<boolean>;
  countSound?: SheetRow<boolean>;
  hear?: SheetRow<boolean>;
  hearVolume?: SheetRow<number>;
}) {
  const { level, anyOctave, countSound, hear, hearVolume } = props;
  return (
    <section className="card sheet" id="sound-sheet" aria-label={copy.train.soundSheet}>
      {level && (
        <div className="choices" role="radiogroup" aria-label={copy.train.jumpLevel} id="jump-level">
          <p className="ex-label">{copy.train.jumpLevel}</p>
          {([1, 2, 3] as const).map((v) => (
            <button key={v} type="button" className="choice" role="radio" id={'level-' + v} aria-checked={level.value === v} onClick={() => level.set(v)}>
              {copy.levels[v]}
            </button>
          ))}
        </div>
      )}
      {anyOctave && (
        <label className="switch-row">
          <span>{copy.train.anyOctave}</span>
          <input type="checkbox" role="switch" id="any-octave" checked={anyOctave.value} onChange={(ev) => anyOctave.set(ev.target.checked)} />
        </label>
      )}
      {countSound && (
        <label className="switch-row">
          <span>{copy.train.countSound}</span>
          <input type="checkbox" role="switch" id="count-in-sound" checked={countSound.value} onChange={(ev) => countSound.set(ev.target.checked)} />
        </label>
      )}
      {hear && (
        <label className="switch-row">
          <span>{copy.song.hearYourself}</span>
          <input type="checkbox" role="switch" id="hear-yourself" checked={hear.value} onChange={(ev) => hear.set(ev.target.checked)} />
        </label>
      )}
      {hearVolume && <Slider id="monitor-volume" label={copy.song.hearVolume} value={hearVolume.value} onChange={hearVolume.set} />}
    </section>
  );
}
