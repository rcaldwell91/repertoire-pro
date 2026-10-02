import { useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { copy } from '../core/copy';
import { barFill } from '../core/level';
import { PIANO_C4, rateFor } from '../core/piano';
import { soundCheckView } from '../core/sound-check';
import type { Plan } from '../audio/conductor/conductor';
import { useConductor, useSnapshot } from '../shell/conductor-context';
import { back } from '../shell/router';
import { BackButton } from '../ui/BackButton';
import { LevelBar } from '../ui/LevelBar';

/* Start plays one real piano note, then shows how loud the mic hears you.
   The conductor does all of it; this screen only asks and shows. */
const OWNER = 'sound-check';
const NOTE = { kind: 'note', url: PIANO_C4.file, rate: rateFor(PIANO_C4) } as const;
const WITH_MIC: Plan = { owner: OWNER, steps: [NOTE, { kind: 'listen' }] };
const NOTE_ONLY: Plan = { owner: OWNER, steps: [NOTE] };

export function SoundCheck() {
  const c = useConductor();
  const snap = useSnapshot();
  const [mine, setMine] = useState(false);
  const [withoutMic, setWithoutMic] = useState(false);
  const [fill, setFill] = useState(0);

  const view = soundCheckView({
    active: c.active() && snap.owner === OWNER,
    mine: mine && snap.owner === OWNER,
    state: snap.state,
    mic: snap.mic,
    withoutMic,
  });

  useEffect(() => {
    if (!view.level) return;
    let raf = 0;
    const tick = () => {
      setFill(barFill(c.level()));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      setFill(0);
    };
  }, [view.level, c]);

  function press(ev: MouseEvent) {
    if (view.button === 'stop') {
      c.stop();
      return;
    }
    if (c.start(c.tap(ev.nativeEvent), withoutMic ? NOTE_ONLY : WITH_MIC)) setMine(true);
  }

  return (
    <>
      <BackButton label={copy.soundCheck.back} onBack={() => back('/profile')} />
      <h1>{copy.soundCheck.title}</h1>
      <button type="button" className="btn" id="sound-check-go" onClick={press}>
        {view.button === 'stop' ? copy.soundCheck.stop : copy.soundCheck.start}
      </button>
      <p className="line" role="status">{copy.soundCheck[view.line]}</p>
      <LevelBar on={view.level} fill={fill} label={copy.soundCheck.level} />
      {view.carryOn && (
        <button type="button" className="btn btn-quiet carry-on" onClick={() => setWithoutMic(true)}>
          {copy.soundCheck.carryOn}
        </button>
      )}
    </>
  );
}
