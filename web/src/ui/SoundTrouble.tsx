import type { SoundTrouble as Trouble } from '../audio/conductor/conductor';
import { copy } from '../core/copy';

/* Sound that would not start, or stopped by itself, said on screen in plain
   words with what to do, in order (RULEBOOK 4, Sound, Android 8). */
export function SoundTrouble(props: { sound: Trouble | null; onCheck?: () => void }) {
  const s = props.sound;
  if (!s) return null;
  const line = s === 'stalled' ? copy.song.soundStalled : s === 'tap' ? copy.song.soundTap : copy.song.soundBlocked;
  return (
    <div className="sound-trouble" id="sound-trouble" role="alert">
      <p className="problem" id="sound-trouble-line">{line}</p>
      {s !== 'tap' && (
        <>
          <p className="hint">{copy.song.stepsTitle}</p>
          <ol id="sound-steps">
            <li>{copy.song.step1}</li>
            <li>{copy.song.step2}</li>
            <li>{copy.song.step3}</li>
            <li>{copy.song.step4}</li>
          </ol>
        </>
      )}
      {props.onCheck && (
        <button type="button" className="btn btn-quiet" id="sound-trouble-check" onClick={props.onCheck}>{copy.song.soundCheck}</button>
      )}
    </div>
  );
}
