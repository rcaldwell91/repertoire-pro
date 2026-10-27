/* Goal: understand the exercise and start it; then sing its notes; then see what was measured. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Settings, X } from 'lucide-react';
import { copy, fill } from '../core/copy';
import {
  CATEGORIES, EXERCISES, ROUTINES, bubbleScore, exercise, firstRung, measures, notesFor, rungAt, rungStarts, type Exercise, type Note,
  type RoutineId,
} from '../core/exercises';
import { keyName, type Range } from '../core/notemap';
import { pianoFor } from '../core/piano';
import { RANGE_POINTS, rangeFrom } from '../core/range';
import { micLine, monitorOf } from '../core/song';
import { clock as clockText } from '../core/time';
import { resultRow, type Outcome } from '../core/results';
import { SoundClock } from '../core/timed';
import type { Plan } from '../audio/conductor/conductor';
import { onRange, rangeNow, saveRange } from '../data/range';
import { saveResult } from '../data/results';
import { useConductor, useSnapshot } from '../shell/conductor-context';
import { micBlockedBrowser } from '../shell/env';
import { back, exRoute, navigate, routineRoute } from '../shell/router';
import { anyOctaveFor, hearOn, hearVolume, setAnyOctaveFor, setHearOn, setHearVolume } from '../shell/settings';
import { useYourLine } from '../shell/your-line';
import { BackButton } from '../ui/BackButton';
import { Bubbles } from '../ui/Bubbles';
import { PatternCard } from '../ui/PatternCard';
import { Slider } from '../ui/Slider';
import { SoundTrouble } from '../ui/SoundTrouble';

/* One exercise (RULEBOOK 1b, 3; Robert, 24 Oct), on one screen, the tab
   bar hidden:
   - the page: back, the name, its group, the pattern card (the notes as
     bars, played only on its button, the current bar lit and the syllable
     under the card), Goal, How, Start. Behind one tap: the gear's sound
     sheet (Any octave, remembered for this exercise; Count-in sound; Hear
     yourself and its volume) and "More about this" (the old app's why,
     watch for and care). The level, Quiet and what is measured stay on the
     list rows, off this page;
   - singing it: the note map filling the screen, the bubbles with their
     syllables, a 3-2-1 count-in, the dots along the bottom one per rung,
     and the close button as the only control (a clock-only exercise has
     Done);
   - its result: only what was measured, Try again, Next. Saved at once.
   Nothing starts until Start is tapped, and a routine never moves on by
   itself (Robert, 1 Oct): its next step opens paused, with End session.
   The conductor plays and listens; this screen only asks and shows. */

/** the reference piano's volume */
const PIANO_GAIN = 0.8;
/** points of your line, a second */
const HOP = 0.05;

type View = 'preview' | 'run' | 'result';
type Shown = { o: Outcome; noMic: boolean; range?: Range; where: 'online' | 'phone' | null };
type About = { why: string; watch?: string; care?: string; aka?: string };

/** the piano notes of an exercise, as one step the conductor plays together */
function notesStep(notes: readonly Note[], listen: boolean, monitor = 0): Plan['steps'][number] {
  const keys = notes.map((n) => pianoFor(n.m));
  return { kind: 'song', urls: keys.map((k) => k.file), from: 0, gains: notes.map(() => PIANO_GAIN), starts: notes.map((n) => n.t),
    rates: keys.map((k) => k.rate), lengths: notes.map((n) => n.d), untilLast: true, listen, level: 1, monitor };
}

export function ExerciseScreen(props: { id?: string; routine?: string; step?: number }) {
  const routine = props.routine && props.routine in ROUTINES ? (props.routine as RoutineId) : null;
  const step = props.step ?? 0;
  const id = routine ? ROUTINES[routine].steps[step] : props.id;
  const e = id ? exercise(id) : undefined;
  if (!e) {
    return (
      <>
        <BackButton label={copy.tabs.train} onBack={() => back('/train')} />
        <p className="problem">{copy.train.missing}</p>
      </>
    );
  }
  return <ExerciseFor key={e.id + ':' + (routine ?? '') + ':' + step} e={e} routine={routine} step={step} />;
}

function ExerciseFor({ e, routine, step }: { e: Exercise; routine: RoutineId | null; step: number }) {
  const c = useConductor();
  const snap = useSnapshot();
  const owner = 'ex:' + e.id;
  const previewOwner = 'preview:' + e.id;
  const cat = CATEGORIES.find((x) => x.id === e.category) ?? CATEGORIES[0];
  const kind = e.engine.kind;
  const sung = kind === 'ladder' || kind === 'hold';
  const usesMic = sung || kind === 'timed' || kind === 'glide' || kind === 'range';
  /* a count-in, and so a count-in sound: everything the conductor runs */
  const countsIn = kind !== 'cycle' && kind !== 'guided';
  const about = (copy.about as Partial<Record<string, About>>)[e.id];

  const [range, setRange] = useState<Range>(rangeNow);
  useEffect(() => onRange(() => setRange(rangeNow())), []);
  const plan = useMemo(() => notesFor(e, range), [e, range]);
  const pattern = useMemo(() => firstRung(plan.notes), [plan]);
  const rungs = useMemo(() => rungStarts(plan.notes).length, [plan]);

  /* the sound sheet's settings: Any octave for this exercise alone; the
     others shared with Learn a song (shell/settings; the conductor's count-in) */
  const [anyOctave, setAnyOctaveNow] = useState(() => anyOctaveFor(e.id));
  const setAnyOctave = (on: boolean) => {
    setAnyOctaveNow(on);
    setAnyOctaveFor(e.id, on);
  };
  const [countSound, setCountSoundNow] = useState(() => c.countSound());
  const setCountSound = (on: boolean) => {
    setCountSoundNow(on);
    c.setCountSound(on);
  };
  const [hear, setHearNow] = useState(hearOn);
  const [hearVol, setHearVolNow] = useState(hearVolume);
  const setHear = (on: boolean) => {
    setHearNow(on);
    setHearOn(on);
    c.setMonitor(on ? monitorOf(hearVol) : 0);
  };
  const setHearVol = (v: number) => {
    setHearVolNow(v);
    setHearVolume(v);
    if (hear) c.setMonitor(monitorOf(v));
  };
  const [sheet, setSheet] = useState(false);
  const [more, setMore] = useState(false);

  const [withMic, setWithMic] = useState(true);
  const [view, setView] = useState<View>('preview');
  const [shown, setShown] = useState<Shown | null>(null);
  /* the clock for a clock-only exercise (a breath cycle, guided), started by Start */
  const [clockFrom, setClockFrom] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const playing = c.active() && snap.owner === owner;
  const running = playing && snap.state === 'running';
  const listening = running && snap.mic === 'open';
  const counting = playing && snap.state === 'counting-in' ? snap.count : null;
  const previewing = c.active() && snap.owner === previewOwner;
  const trouble = snap.owner === owner && !playing ? snap.sound : null;
  const startedAt = snap.owner === owner ? snap.startedAt : null;

  /* your line: placed in the exercise by the conductor (its notes), or by
     time since it started (a siren, the range check) */
  const since = useRef<number | null>(null);
  useEffect(() => {
    since.current = startedAt;
  }, [startedAt]);
  const line = useYourLine(c, owner, listening, startedAt, sung ? undefined : (at) => (since.current == null ? null : at - since.current));
  /* was the mic ever open while it ran: a score needs it */
  const heard = useRef(false);
  useEffect(() => {
    if (listening) heard.current = true;
  }, [listening]);

  const finish = async (o: Outcome, extra: Partial<Shown> = {}) => {
    const noMic = usesMic && !heard.current;
    const out: Outcome = noMic ? { kind: 'none' } : o;
    setShown({ o: out, noMic, where: null, ...extra });
    setView('result');
    const where = await saveResult(resultRow(e, out));
    setShown((s) => (s ? { ...s, where } : s));
  };

  /* a sung exercise ends with its last note: score it */
  const lastState = useRef(snap.state);
  useEffect(() => {
    const was = lastState.current;
    lastState.current = snap.state;
    if (snap.owner !== owner || view !== 'run') return;
    if (snap.state === 'finished' && was !== 'finished' && sung) {
      const s = bubbleScore(plan.notes, line.t, line.m, HOP, anyOctave);
      void finish(s.sung ? { kind: 'pitch', hits: s.hits, n: s.n } : { kind: 'none' });
    }
    /* stopped by leaving, hiding, a call or a stall: back to the preview */
    if (snap.state === 'stopped' && was !== 'stopped' && snap.why !== 'stop') setView('preview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.state, snap.owner]);

  /* the timed hiss and the range check: watched each frame while running */
  const clock = useRef<SoundClock | null>(null);
  const [heldNow, setHeldNow] = useState(0);
  const phase = useRef<{ which: 'low' | 'high'; from: number; low: number[] }>({ which: 'low', from: 0, low: [] });
  const [rangeProgress, setRangeProgress] = useState({ which: 'low' as 'low' | 'high', got: 0 });
  useEffect(() => {
    if (!running || (kind !== 'timed' && kind !== 'range')) return;
    let raf = 0;
    const frame = () => {
      if (kind === 'timed') {
        const k = clock.current ?? (clock.current = new SoundClock());
        k.feed(performance.now() / 1000, c.level());
        const st = k.state();
        setHeldNow(st.held);
        if (st.done) {
          c.stop();
          void finish({ kind: 'time', seconds: st.held });
          return;
        }
      } else {
        const p = phase.current;
        const got = line.m.slice(p.from).filter(Number.isFinite);
        setRangeProgress({ which: p.which, got: Math.min(RANGE_POINTS, got.length) });
        if (got.length >= RANGE_POINTS) {
          if (p.which === 'low') phase.current = { which: 'high', from: line.m.length, low: got.slice(0, RANGE_POINTS) };
          else {
            const r = rangeFrom(p.low, got.slice(0, RANGE_POINTS));
            c.stop();
            void saveRange(r, 'test');
            void finish({ kind: 'none' }, { range: r });
            return;
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, kind]);

  /* a clock-only exercise's clock */
  useEffect(() => {
    if (clockFrom == null) return;
    const t = setInterval(() => setElapsed((performance.now() - clockFrom) / 1000), 100);
    return () => clearInterval(t);
  }, [clockFrom]);

  /* the dots: which rung is being sung, from the conductor's clock */
  const [rungNow, setRungNow] = useState(-1);
  useEffect(() => {
    if (!running || !sung) return;
    const t = setInterval(() => setRungNow(rungAt(plan.notes, c.position() ?? -1)), 100);
    return () => clearInterval(t);
  }, [running, sung, plan, c]);
  const rung = running ? rungNow : -1;

  function start(ev: SyntheticEvent) {
    heard.current = false;
    clock.current = null;
    phase.current = { which: 'low', from: 0, low: [] };
    setRangeProgress({ which: 'low', got: 0 });
    setHeldNow(0);
    setShown(null);
    setSheet(false);
    setMore(false);
    if (kind === 'cycle' || kind === 'guided') {
      setClockFrom(performance.now());
      setElapsed(0);
      setView('run');
      return;
    }
    const beat = sung ? plan.beat : 1;
    const p: Plan = sung
      ? { owner, countIn: 3 * beat, countBeats: 3, steps: [notesStep(plan.notes, withMic, hear ? monitorOf(hearVol) : 0)] }
      : { owner, countIn: 3, countBeats: 3, steps: withMic ? [{ kind: 'listen' }] : [] };
    if (c.start(c.tap(ev.nativeEvent), p)) setView('run');
  }

  function close() {
    if (playing) c.stop();
    setClockFrom(null);
    setView('preview');
  }

  function done() {
    if (playing) c.stop();
    setClockFrom(null);
    void finish({ kind: 'none' });
  }

  /* the pattern card's button: the first rung, the piano alone, no mic */
  function hearPattern(ev: SyntheticEvent) {
    if (previewing) {
      c.stop();
      return;
    }
    c.start(c.tap(ev.nativeEvent), { owner: previewOwner, steps: [notesStep(pattern, false)] });
  }

  const mic = playing && withMic && usesMic ? micLine(snap.mic, micBlockedBrowser()) : null;
  const steps = routine ? ROUTINES[routine].steps : null;
  const nextId = steps ? steps[step + 1] : (() => {
    const list = EXERCISES.filter((x) => x.category === e.category);
    return list[(list.indexOf(e) + 1) % list.length].id;
  })();
  const name = copy.ex[e.id].name;

  if (view === 'run') {
    return (
      <div className="ex-run" data-colour={cat.colour} id="ex-run">
        <div className="ex-run-top">
          <strong>{name}</strong>
          <button type="button" className="round close" id="ex-close" aria-label={copy.train.close} onClick={close}>
            <X size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
        <div className="mic-line" id="mic-line">
          {mic && <p className="problem" role="status">{mic}</p>}
          {mic && (
            <button type="button" className="btn btn-quiet" id="carry-on" onClick={() => setWithMic(false)}>{copy.song.carryOn}</button>
          )}
        </div>
        {(sung || kind === 'glide') && (
          <Bubbles notes={sung ? plan.notes : []} you={line} now={() => (sung ? c.position() ?? 0 : startedAt == null ? 0 : c.position() ?? 0)}
            live={playing} anyOctave={anyOctave} colour={cat.colour} label={name} count={counting} />
        )}
        {sung && (
          <div className="dots" id="ex-dots" role="img" aria-label={copy.train.rungs}>
            {Array.from({ length: rungs }, (_, i) => (
              <span key={i} className="dot" data-done={i < rung ? 'true' : undefined} data-now={i === rung ? 'true' : undefined} />
            ))}
          </div>
        )}
        {!sung && kind !== 'glide' && counting != null && <div className="ex-big" id="count-in">{counting}</div>}
        {kind === 'glide' && <p className="hint">{copy.train.glide}</p>}
        {kind === 'timed' && counting == null && (
          <>
            <div className="ex-big" id="ex-held">{fill(copy.train.held, { s: (withMic ? heldNow : elapsed).toFixed(1) })}</div>
            <p className="hint">{withMic && running ? (heldNow > 0 ? copy.train.timedGo : copy.train.timedWait) : null}</p>
          </>
        )}
        {kind === 'range' && counting == null && (
          <>
            <p className="ex-line" id="range-prompt">{rangeProgress.which === 'low' ? copy.train.rangeLow : copy.train.rangeHigh}</p>
            <div className="range-bar"><div id="range-fill" style={{ width: (100 * rangeProgress.got) / RANGE_POINTS + '%' }} /></div>
          </>
        )}
        {kind === 'cycle' && e.engine.kind === 'cycle' && (() => {
          const counts = e.engine.counts;
          const total = counts.reduce((a, b) => a + b, 0);
          const at = elapsed % total;
          let acc = 0, ph = 0;
          for (let i = 0; i < counts.length; i++) {
            if (at < acc + counts[i]) { ph = i; break; }
            acc += counts[i];
          }
          return (
            <>
              <div className="ex-big" id="ex-count">{Math.ceil(acc + counts[ph] - at)}</div>
              <p className="ex-line" id="ex-phase">{[copy.train.cycleIn, copy.train.cycleHold, copy.train.cycleOut][ph]}</p>
            </>
          );
        })()}
        {kind === 'guided' && (
          <>
            <div className="ex-big" id="ex-clock">{clockText(elapsed)}</div>
            <p className="ex-line">{copy.ex[e.id].how}</p>
            <p className="hint">{copy.train.guided}</p>
          </>
        )}
        {(kind === 'cycle' || kind === 'guided' || kind === 'glide' || (kind === 'timed' && !withMic)) && (
          <button type="button" className="btn" id="ex-done" onClick={done}>{copy.train.done}</button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="ex-top">
        <BackButton label={copy.tabs.train} onBack={() => back('/train')} />
        {countsIn && view === 'preview' && (
          <button type="button" className="round gear" id="ex-gear" aria-label={copy.train.soundSheet} aria-expanded={sheet}
            onClick={() => setSheet((s) => !s)}>
            <Settings size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        )}
      </div>
      {routine && steps && (
        <p className="hint" id="routine-step">{fill(copy.train.step, { name: copy.routineNames[routine], i: step + 1, n: steps.length })}</p>
      )}
      <h1 id="ex-name">{name}</h1>
      <div className="tags" id="ex-tags">
        <span className="tag" data-colour={cat.colour}>{copy.cats[e.category]}</span>
      </div>

      {sheet && view === 'preview' && (
        <section className="card sheet" id="sound-sheet" aria-label={copy.train.soundSheet}>
          {sung && (
            <label className="switch-row">
              <span>{copy.train.anyOctave}</span>
              <input type="checkbox" role="switch" id="any-octave" checked={anyOctave} onChange={(ev) => setAnyOctave(ev.target.checked)} />
            </label>
          )}
          <label className="switch-row">
            <span>{copy.train.countSound}</span>
            <input type="checkbox" role="switch" id="count-in-sound" checked={countSound} onChange={(ev) => setCountSound(ev.target.checked)} />
          </label>
          {sung && (
            <>
              <label className="switch-row">
                <span>{copy.song.hearYourself}</span>
                <input type="checkbox" role="switch" id="hear-yourself" checked={hear} onChange={(ev) => setHear(ev.target.checked)} />
              </label>
              <Slider id="monitor-volume" label={copy.song.hearVolume} value={hearVol} onChange={setHearVol} />
            </>
          )}
        </section>
      )}

      {view === 'result' && shown && (
        <section className="card ex-result" id="ex-result">
          {shown.o.kind === 'pitch' && (
            <>
              <p className="ex-score" id="ex-score">{fill(copy.train.notesHit, { hits: shown.o.hits, n: shown.o.n })}</p>
              <p className="hint">{fill(copy.train.onPitch, { pct: Math.round((100 * shown.o.hits) / Math.max(1, shown.o.n)) })}</p>
            </>
          )}
          {shown.o.kind === 'time' && e.engine.kind === 'timed' && (
            <>
              <p className="ex-score" id="ex-score">{fill(copy.train.held, { s: shown.o.seconds.toFixed(1) })}</p>
              <p className="hint">{fill(copy.train.heldOf, { target: e.engine.target })}</p>
            </>
          )}
          {shown.range && (
            <p className="ex-score" id="ex-score">{fill(copy.train.rangeFound, { lo: keyName(shown.range.lo), hi: keyName(shown.range.hi) })}</p>
          )}
          {shown.o.kind === 'none' && !shown.range && (
            <p className="hint" id="ex-unscored">
              {shown.noMic ? copy.train.noMicScore : measures(e) === 'none' ? copy.train.notScored : copy.train.nothingSung}
            </p>
          )}
          {shown.where && <p className="hint" id="ex-saved">{shown.where === 'online' ? copy.train.saved : copy.train.savedPhone}</p>}
          <div className="ex-actions">
            <button type="button" className="btn btn-quiet" id="ex-again" onClick={start}>{copy.train.tryAgain}</button>
            {nextId ? (
              <button type="button" className="btn" id="ex-next"
                onClick={() => navigate(routine ? routineRoute(routine, step + 1) : exRoute(nextId), 'screen')}>
                {routine ? fill(copy.train.next, { name: copy.ex[nextId].name }) : copy.train.nextOne}
              </button>
            ) : (
              <p className="hint" id="routine-done">{copy.train.routineDone}</p>
            )}
          </div>
        </section>
      )}

      <SoundTrouble sound={trouble} onCheck={() => navigate('/profile/sound-check', 'screen')} />

      {view === 'preview' && (
        <>
          {sung && (
            <PatternCard notes={pattern} colour={cat.colour} playing={previewing} now={() => c.position() ?? -1} onPlay={hearPattern} />
          )}
          <p className="ex-label">{copy.train.goal}</p>
          <p className="ex-line" id="ex-goal">{copy.ex[e.id].goal}</p>
          <p className="ex-label">{copy.train.how}</p>
          <p className="ex-line" id="ex-how">{copy.ex[e.id].how}</p>
          <button type="button" className="btn btn-start" id="ex-start" onClick={start}>{copy.train.start}</button>
          {about && (
            <button type="button" className="btn btn-quiet btn-link" id="ex-more" aria-expanded={more} onClick={() => setMore((m) => !m)}>
              {copy.train.moreAbout}
            </button>
          )}
          {about && more && (
            <section className="card about" id="ex-about">
              {about.aka && <p className="hint" id="ex-aka">{fill(copy.train.alsoCalled, { name: about.aka })}</p>}
              <p className="ex-label">{copy.train.why}</p>
              <p>{about.why}</p>
              {about.watch && (
                <>
                  <p className="ex-label">{copy.train.watchFor}</p>
                  <p>{about.watch}</p>
                </>
              )}
              {about.care && (
                <>
                  <p className="ex-label">{copy.train.care}</p>
                  <p>{about.care}</p>
                </>
              )}
            </section>
          )}
        </>
      )}
      {routine && (
        <button type="button" className="btn btn-quiet" id="end-session" onClick={() => navigate('/train', 'screen')}>{copy.train.endSession}</button>
      )}
    </>
  );
}
