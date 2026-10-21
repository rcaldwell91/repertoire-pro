import { useEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { copy, fill as fillIn } from '../core/copy';
import { barFill } from '../core/level';
import { PIANO_C4, rateFor } from '../core/piano';
import { reportWords, soundCheckView, type ReportWords } from '../core/sound-check';
import type { Plan } from '../audio/conductor/conductor';
import { useConductor, useSnapshot } from '../shell/conductor-context';
import { back } from '../shell/router';
import { micBlockedBrowser } from '../shell/env';
import { BackButton } from '../ui/BackButton';
import { LevelBar } from '../ui/LevelBar';
import { SoundTrouble } from '../ui/SoundTrouble';

/* One tap: the mic opens, the sound wakes and its clock is checked, one
   real piano note plays, then the bar shows how loud the mic hears you.
   While the note plays, the screen asks what the phone says about its
   sound and shows it in plain words, to screenshot if sound won't play.
   More buttons: "Test without mic" lets the mic go, waits for the phone
   to settle, makes the sound anew and says plainly whether it came back;
   "Use the phone's own mic" picks the built-in mic by its id, used on the
   first request from then on, and says which mic is in use; "Try another
   mode" is the only way to another mic mode (RULEBOOK 4, Sound, Android
   11), and only that hand choice is remembered.
   The conductor does all of it; this screen only asks and shows. */
const OWNER = 'sound-check';
const NO_MIC = 'sound-check:no-mic';
const NOTE = { kind: 'note', url: PIANO_C4.file, rate: rateFor(PIANO_C4) } as const;
const WITH_MIC: Plan = { owner: OWNER, steps: [NOTE, { kind: 'listen' }] };
const NOTE_ONLY: Plan = { owner: OWNER, steps: [NOTE] };
const NO_MIC_TEST: Plan = { owner: NO_MIC, quiet: 0.8, rebuild: true, steps: [NOTE] };
const MODE_WORDS: Record<string, keyof typeof copy.soundCheck> = { raw: 'modeRaw', phone: 'modePhone', processed: 'modeProcessed', basic: 'modeBasic' };

export function SoundCheck() {
  const c = useConductor();
  const snap = useSnapshot();
  const [mine, setMine] = useState(false);
  const [withoutMic, setWithoutMic] = useState(false);
  const [fill, setFill] = useState(0);
  const [report, setReport] = useState<ReportWords | null>(null);
  /* what the last tap was: the check, the test without the mic, or the phone's own mic */
  const [mode, setMode] = useState<'check' | 'no-mic' | 'phone' | 'mode'>('check');
  const [micMode, setMicMode] = useState(() => c.micMode());
  const [phoneMic, setPhoneMic] = useState(() => c.micChoice() === 'phone');
  const [crashed] = useState(() => c.micCrashed());
  const run = useRef(0);

  const ours = snap.owner === OWNER || snap.owner === NO_MIC;
  const active = c.active() && ours;
  const view = soundCheckView({
    active,
    mine: mine && ours,
    state: snap.state,
    step: snap.step,
    mic: snap.mic,
    withoutMic,
  });
  const trouble = mine && ours && !active ? snap.sound : null;

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

  /* a press that starts nothing (a repeat press mid-note) changes nothing on screen */
  function begin(ev: MouseEvent, plan: Plan, as: 'check' | 'no-mic' | 'phone' | 'mode') {
    if (!c.start(c.tap(ev.nativeEvent), plan)) return;
    run.current++;
    setReport(null);
    setMode(as);
    setMine(true);
  }

  function press(ev: MouseEvent) {
    if (view.button === 'stop') {
      c.stop();
      return;
    }
    begin(ev, withoutMic ? NOTE_ONLY : WITH_MIC, 'check');
  }

  /* did the sound come back without the mic: the clock moved and sound went out */
  const noMicDone = mode === 'no-mic' && mine && (report != null || !!trouble) && !(active && snap.state !== 'running');
  const cameBack = !!report && report.clock === 'moving' && report.sentOut && !trouble;

  const S = copy.soundCheck;
  return (
    <>
      <BackButton label={S.back} onBack={() => back('/profile')} />
      <h1>{S.title}</h1>
      <button type="button" className="btn" id="sound-check-go" onClick={press}>
        {view.button === 'stop' ? S.stop : S.start}
      </button>
      <p className="line" role="status" id="sound-check-line">
        {micBlockedBrowser() && ['refused', 'unavailable', 'failed', 'held'].includes(view.line) ? copy.song.micBrowser
          : view.line === 'held' ? S.held + ' ' + copy.song.tryStart : S[view.line]}
      </p>
      <LevelBar on={view.level} fill={fill} label={S.level} />
      {view.carryOn && (
        <button type="button" className="btn btn-quiet carry-on" onClick={() => setWithoutMic(true)}>
          {S.carryOn}
        </button>
      )}
      <div className="sound-check-tools">
        <button type="button" className="btn btn-quiet" id="test-without-mic" onClick={(e) => begin(e, NO_MIC_TEST, 'no-mic')}>{S.noMicTest}</button>
        <button type="button" className="btn btn-quiet" id="phone-mic" onClick={(e) => {
          if (active) c.stop();
          if (phoneMic) c.letPhoneChoose();
          else c.usePhoneMic();
          setPhoneMic(!phoneMic);
          begin(e, WITH_MIC, 'phone');
        }}>{phoneMic ? S.letPhoneChoose : S.phoneMic}</button>
        <button type="button" className="btn btn-quiet" id="another-mode" onClick={(e) => {
          if (active) c.stop();
          setMicMode(c.tryAnotherMode());
          begin(e, WITH_MIC, 'mode');
        }}>{S.anotherMode}</button>
      </div>
      <p className="hint" id="mic-mode">{fillIn(S.modeLine, { mode: S[MODE_WORDS[micMode] ?? 'modeRaw'] })}</p>
      {crashed && <p className="line problem" id="mic-crashed" role="status">{S.crashed} {S.crashedNot}</p>}
      {mode === 'no-mic' && mine && (
        <p className={'line' + (noMicDone && !cameBack ? ' problem' : '')} id="no-mic-result" role="status">
          {!noMicDone ? S.testing : cameBack ? S.noMicWorks : S.noMicStill}
        </p>
      )}
      {(mode === 'phone' || mode === 'mode') && mine && report?.micName && (
        <p className="line" id="mic-now" role="status">{fillIn(S.nowUsing, { mic: report.micName })}</p>
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
