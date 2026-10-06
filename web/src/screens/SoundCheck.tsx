import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { copy, fill as fillIn } from '../core/copy';
import { barFill } from '../core/level';
import { PIANO_C4, rateFor } from '../core/piano';
import { reportWords, soundCheckView, type ReportWords } from '../core/sound-check';
import type { Plan } from '../audio/conductor/conductor';
import { useConductor, useSnapshot } from '../shell/conductor-context';
import { back } from '../shell/router';
import { BackButton } from '../ui/BackButton';
import { LevelBar } from '../ui/LevelBar';
import { SoundTrouble } from '../ui/SoundTrouble';

/* One tap: the mic opens, the sound wakes and its clock is checked, one
   real piano note plays, then the bar shows how loud the mic hears you.
   While the note plays, the screen asks what the phone says about its
   sound and shows it in plain words, to screenshot if sound won't play.
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
  const [report, setReport] = useState<ReportWords | null>(null);
  const run = useRef(0);

  const active = c.active() && snap.owner === OWNER;
  const view = soundCheckView({
    active,
    mine: mine && snap.owner === OWNER,
    state: snap.state,
    step: snap.step,
    mic: snap.mic,
    withoutMic,
  });
  const trouble = mine && snap.owner === OWNER && !active ? snap.sound : null;

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

  /* ask the phone while the note plays, or as soon as sound fails */
  const onNote = mine && active && snap.state === 'running' && snap.step === 0;
  const ask = onNote || !!trouble;
  useEffect(() => {
    if (!ask) return;
    const n = run.current;
    const mic = snap.mic;
    void c.report().then((r) => {
      if (run.current !== n) return;
      setReport(reportWords({ ...r, mic, micLabel: r.mic?.label ?? null }));
    });
  }, [ask, c, snap.mic]);

  function press(ev: MouseEvent) {
    if (view.button === 'stop') {
      c.stop();
      return;
    }
    run.current++;
    setReport(null);
    if (c.start(c.tap(ev.nativeEvent), withoutMic ? NOTE_ONLY : WITH_MIC)) setMine(true);
  }

  const S = copy.soundCheck;
  return (
    <>
      <BackButton label={S.back} onBack={() => back('/profile')} />
      <h1>{S.title}</h1>
      <button type="button" className="btn" id="sound-check-go" onClick={press}>
        {view.button === 'stop' ? S.stop : S.start}
      </button>
      <p className="line" role="status" id="sound-check-line">{S[view.line]}</p>
      <LevelBar on={view.level} fill={fill} label={S.level} />
      {view.carryOn && (
        <button type="button" className="btn btn-quiet carry-on" onClick={() => setWithoutMic(true)}>
          {S.carryOn}
        </button>
      )}
      <SoundTrouble sound={trouble} />
      {report && (
        <section className="card report" id="sound-report" aria-label={S.report}>
          <h2>{S.report}</h2>
          <p className="hint">{S.shoot}</p>
          <dl>
            <dt>{S.clock}</dt>
            <dd id="report-clock">{fillIn(S.clockLine, { word: S[report.clock], state: report.state })}</dd>
            <dt>{S.sentOut}</dt>
            <dd id="report-out">{report.sentOut ? S.yes : S.no}</dd>
            <dt>{S.mic}</dt>
            <dd id="report-mic">{S[report.mic]}</dd>
            <dt>{S.micName}</dt>
            <dd id="report-mic-name">{report.micName ?? S.unknown}</dd>
            <dt>{S.micHeard}</dt>
            <dd id="report-heard">{report.heard == null ? S.no : fillIn(S.micLevel, { yes: report.heard > 2 ? S.yes : S.no, n: report.heard })}</dd>
            <dt>{S.headphones}</dt>
            <dd id="report-headphones">{report.headphones ?? S.noneSeen}</dd>
            <dt>{S.output}</dt>
            <dd id="report-output">{report.output ?? S.unknown}</dd>
          </dl>
        </section>
      )}
    </>
  );
}
