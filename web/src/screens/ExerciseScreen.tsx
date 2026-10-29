/* Goal: understand the exercise and start it; then sing its notes; then see what was measured. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Settings } from 'lucide-react';
import { copy, fill } from '../core/copy';
import {
  CATEGORIES, EXERCISES, ROUTINES, bubbleScore, exercise, firstRung, measures, notesFor, rungAt, rungStarts, type Exercise, type Note,
  type RoutineId,
} from '../core/exercises';
import { keyName, type Range } from '../core/notemap';
import { RANGE_POINTS, rangeFrom } from '../core/range';
import { micLine, monitorOf } from '../core/song';
import {
  intervalRound, matchRound, partLine, seeded, steadyParts, steadyShare, vfeParts, STEADY_LEAD, STEADY_SHARE, type JumpLevel, type Part,
} from '../core/pitch';
import { isRight } from '../core/takes';
import { clock as clockText } from '../core/time';
import { resultRow, type Outcome } from '../core/results';
import { SoundClock } from '../core/timed';
import type { Plan, Take } from '../audio/conductor/conductor';
import { joinTakes } from '../audio/recorder';
import { onRange, rangeNow, saveRange } from '../data/range';
import { saveResult } from '../data/results';
import { exerciseKey, saveTake } from '../data/takes';
import { useConductor, useSnapshot } from '../shell/conductor-context';
import { micBlockedBrowser } from '../shell/env';
import { useTakes } from '../shell/hooks';
import { pianoStep } from '../shell/piano-step';
import { back, exRoute, exTakesRoute, navigate, routineRoute } from '../shell/router';
import { anyOctaveFor, hearOn, hearVolume, jumpLevel, setAnyOctaveFor, setHearOn, setHearVolume, setJumpLevel } from '../shell/settings';
import { review, toStored, type Review } from '../shell/take-review';
import { useYourLine } from '../shell/your-line';
import { BackButton } from '../ui/BackButton';
import { Bubbles } from '../ui/Bubbles';
import { PatternCard } from '../ui/PatternCard';
import { SingLayout } from '../ui/SingLayout';
import { SoundSheet } from '../ui/SoundSheet';
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
   - singing it, through the one singing layout (ui/SingLayout): the note
     map, the bubbles with their syllables, a 3-2-1 count-in, the dots one
     per rung, and the controls (Robert, 28 Oct): Pause (sound and mic
     stop; Resume carries on from the start of the repeat it was in, with
     the count-in, and nothing scored is lost), Restart (from the first
     repeat, the score cleared), the gear (the sound sheet, paused or not)
     and Close. A clock-only exercise also has Done;
   - its result: only what was measured, Save take (a sung one: the voice
     alone, recorded while singing, Robert 28 Oct), Try again, Next. The
     result is saved at once; the take when Save take is tapped.
   Nothing starts until Start is tapped, and a routine never moves on by
   itself (Robert, 1 Oct): its next step opens paused, with End session.
   The conductor plays and listens; this screen only asks and shows. */

/** Long soft notes: how long the note plays before it is held */
const LONG_LEAD = 1.5;
/** points of your line, a second */
const HOP = 0.05;

type View = 'preview' | 'run' | 'result';
type Shown = { o: Outcome; noMic: boolean; range?: Range; where: 'online' | 'phone' | null };
type About = { why: string; watch?: string; care?: string };
/** Long soft notes' readout: on the note within half a semitone, as the old app's interval card (next.html 23146) */
const READ_ON = 0.5;

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
  /* sung over the piano, bubble by bubble: the ladders, held notes, and a round of jumps or notes to match */
  const sung = kind === 'ladder' || kind === 'hold' || kind === 'interval' || kind === 'match';
  /* a part at a time, each started by a tap (Hold the note, Long soft notes) */
  const inParts = kind === 'steady' || kind === 'vfe';
  const usesMic = sung || inParts || kind === 'timed' || kind === 'glide' || kind === 'range';
  /* a count-in, and so a count-in sound: everything the conductor runs */
  const countsIn = kind !== 'cycle' && kind !== 'guided';
  const about = (copy.about as Partial<Record<string, About>>)[e.id];

  const [range, setRange] = useState<Range>(rangeNow);
  useEffect(() => onRange(() => setRange(rangeNow())), []);
  /* Sing the interval's level, remembered; a round's notes drawn once a visit */
  const [level, setLevelNow] = useState<JumpLevel>(jumpLevel);
  const setLevel = (v: JumpLevel) => {
    setLevelNow(v);
    setJumpLevel(v);
  };
  const [seed] = useState(() => Math.random());
  const plan = useMemo<{ notes: Note[]; played: Note[]; beat: number; labels?: readonly string[]; shapes?: ReadonlyArray<{ id: string; down: boolean }> }>(() => {
    const rand = seeded(seed);
    if (kind === 'interval') return intervalRound(level, range, rand);
    if (kind === 'match') return matchRound(range, rand);
    const n = notesFor(e, range);
    return { ...n, played: n.notes };
  }, [e, kind, range, level, seed]);
  /* the pattern card: one repeat; for a round, its first jump or note */
  const pattern = useMemo(() => (kind === 'interval' ? [plan.played[0], ...firstRung(plan.notes).map((n) => ({ ...n, d: 1.2 }))]
    : kind === 'match' ? [plan.played[0]] : firstRung(plan.notes)), [kind, plan]);
  const rungs = useMemo(() => rungStarts(plan.notes).length, [plan]);
  const parts = useMemo<Part[]>(() => {
    const rand = seeded(seed);
    return kind === 'steady' ? steadyParts(range, rand) : kind === 'vfe' ? vfeParts(range) : [];
  }, [kind, range, seed]);
  const [partAt, setPartAt] = useState(0);
  /* what each part left: a share held steady, seconds held, a slide done; null if not measured */
  const [partRes, setPartRes] = useState<Array<number | null>>([]);
  const [partDone, setPartDone] = useState(false);

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
  /* paused while singing: nothing sounds or listens until Resume */
  const [paused, setPaused] = useState(false);
  /* a sung exercise resumes from the start of the rung it was in */
  const resumeRung = useRef(0);
  /* where a resumed session begins: your line before it is kept */
  const keepFrom = useRef<number | null>(null);
  /* what the mic recorded, a stretch between each pause (a sung exercise) */
  const segments = useRef<Take[]>([]);
  const [take, setTake] = useState<Review | null>(null);
  const [takeSaved, setTakeSaved] = useState(false);
  const takes = useTakes(sung ? exerciseKey(e.id) : '-');
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
  const line = useYourLine(c, owner, listening, startedAt, sung ? undefined : (at) => (since.current == null ? null : at - since.current),
    () => keepFrom.current);
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

  /* the recording of the stretch just sung, kept for the take */
  const keepStretch = () => {
    const t = c.take(owner);
    if (t) segments.current.push(t);
    c.dropTake();
  };

  /* a sung exercise ends with its last note: score it, and the take is
     every stretch sung, joined */
  const lastState = useRef(snap.state);
  useEffect(() => {
    const was = lastState.current;
    lastState.current = snap.state;
    if (snap.owner !== owner || view !== 'run') return;
    if (snap.state === 'finished' && was !== 'finished' && sung) {
      keepStretch();
      const s = bubbleScore(plan.notes, line.t, line.m, HOP, anyOctave);
      const joined = joinTakes(segments.current);
      setTake(joined ? review({ ...joined, owner }, null, HOP, anyOctave) : null);
      setTakeSaved(false);
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

  /* a part at a time (Hold the note, Long soft notes): watched each frame
     while it runs. A steady hold ends after its seconds; a long hold, and a
     slide, after a second without the note (or any voice). Then it waits
     for Next. */
  const partClock = useRef<SoundClock | null>(null);
  const partFrom = useRef(0);
  /* Long soft notes: the note being sung while holding, and how close (Robert, 28 Oct) */
  const [readout, setReadout] = useState<{ m: number; d: number } | null>(null);
  useEffect(() => {
    if (!running || !inParts || partDone) return;
    const p = parts[partAt];
    if (!p) return;
    partFrom.current = performance.now();
    partClock.current = new SoundClock();
    let raf = 0;
    const end = (res: number | null) => {
      c.stop();
      setPartRes((r) => {
        const out = [...r];
        out[partAt] = res;
        return out;
      });
      setPartDone(true);
    };
    let seen = -1;
    const frame = () => {
      const at = (performance.now() - partFrom.current) / 1000;
      if (p.kind === 'steady') {
        if (at >= STEADY_LEAD + p.secs) return end(steadyShare(line.t, line.m, HOP, p.m, STEADY_LEAD, p.secs, anyOctave));
      } else {
        /* timed on the voice line's own clock, a point every 50 ms, silence
           included: the note held (a long hold) or any voice (a slide) */
        const lead = p.kind === 'long' ? LONG_LEAD : 0;
        const clk = partClock.current as SoundClock;
        for (let k = seen + 1; k < line.t.length; k++) {
          seen = k;
          if (line.t[k] < lead) continue;
          const m = line.m[k];
          const on = Number.isFinite(m) && (p.kind === 'slide' || isRight(m, p.m, anyOctave));
          clk.feed(line.t[k], on ? 1 : 0);
        }
        const st = clk.state();
        setHeldNow(st.held);
        if (p.kind === 'long') {
          const m = line.m[line.m.length - 1];
          if (!Number.isFinite(m)) setReadout(null);
          else {
            const d = anyOctave ? ((((m - p.m) % 12) + 18) % 12) - 6 : m - p.m;
            setReadout({ m, d });
          }
        }
        if (st.done) return end(p.kind === 'long' ? st.held : 1);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, inParts, partAt, partDone]);

  /* Sing the interval: the shape of this turn, in words, from the note heard first */
  const [jumpNow, setJumpNow] = useState('');
  useEffect(() => {
    const labels = plan.labels;
    if (!playing || !labels) return;
    const t = setInterval(() => {
      const at = c.position();
      if (at == null) return;
      let k = 0;
      plan.played.forEach((n, i) => {
        if (n.t <= at) k = i;
      });
      setJumpNow(labels[k] ?? '');
    }, 100);
    return () => clearInterval(t);
  }, [playing, plan, c]);

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
  /* paused: the repeat it will carry on from */
  const rung = running ? rungNow : paused && sung ? resumeRung.current : -1;

  /* Start, Try again and Restart: from the first repeat, nothing kept */
  function start(ev: SyntheticEvent) {
    heard.current = false;
    clock.current = null;
    phase.current = { which: 'low', from: 0, low: [] };
    setRangeProgress({ which: 'low', got: 0 });
    setHeldNow(0);
    setReadout(null);
    setShown(null);
    setSheet(false);
    setMore(false);
    setPaused(false);
    resumeRung.current = 0;
    keepFrom.current = null;
    segments.current = [];
    setTake(null);
    if (kind === 'cycle' || kind === 'guided') {
      setClockFrom(performance.now());
      setElapsed(0);
      setView('run');
      return;
    }
    if (inParts) {
      setPartRes([]);
      startPart(ev, 0);
      return;
    }
    run(ev, 0);
  }

  /* the conductor's session: a sung exercise from `from` seconds in (its
     notes before then silent, the timeline the same), anything else
     listening from its start */
  function run(ev: SyntheticEvent, from: number) {
    const beat = sung ? plan.beat : 1;
    const p: Plan = sung
      ? { owner, countIn: 3 * beat, countBeats: 3,
        steps: [pianoStep(plan.played, { listen: withMic, record: withMic, monitor: hear ? monitorOf(hearVol) : 0, from })] }
      : { owner, countIn: 3, countBeats: 3, steps: withMic ? [{ kind: 'listen' }] : [] };
    if (c.start(c.tap(ev.nativeEvent), p)) {
      setPaused(false);
      setView('run');
    }
  }

  /* where a sung exercise's rung begins: its first note, or the note heard before it */
  function rungTime(r: number): number {
    const i = rungStarts(plan.notes)[r] ?? 0;
    return plan.labels || kind === 'match' ? plan.played[r]?.t ?? 0 : plan.notes[i]?.t ?? 0;
  }

  /* Pause (Robert, 28 Oct): sound and mic stop, the screen stays */
  function pause() {
    if (kind === 'cycle' || kind === 'guided') {
      setClockFrom(null);
      setPaused(true);
      return;
    }
    if (sung) {
      const at = c.position();
      if (at != null) resumeRung.current = Math.max(0, Math.min(rungs - 1, rungAt(plan.notes, at)));
    }
    c.stop();
    if (sung) keepStretch();
    setPaused(true);
  }

  /* Resume: a sung exercise from the start of the rung it was in, with the
     count-in, its score kept; a part, a hiss or a range step again from
     its own start; a clock carries on */
  function resume(ev: SyntheticEvent) {
    if (kind === 'cycle' || kind === 'guided') {
      setClockFrom(performance.now() - elapsed * 1000);
      setPaused(false);
      return;
    }
    if (inParts) return startPart(ev, partAt);
    if (sung) {
      keepFrom.current = rungTime(resumeRung.current);
      return run(ev, keepFrom.current);
    }
    clock.current = null;
    setHeldNow(0);
    phase.current = { ...phase.current, from: 0 };
    setRangeProgress({ which: phase.current.which, got: 0 });
    run(ev, 0);
  }

  /* Restart: from the first repeat, the score cleared */
  function restart(ev: SyntheticEvent) {
    if (playing) c.stop();
    c.dropTake();
    line.clear();
    start(ev);
  }

  /* one part: the count-in, the note (not for a slide), then listening until it ends */
  function startPart(ev: SyntheticEvent, i: number) {
    const p = parts[i];
    setHeldNow(0);
    setReadout(null);
    const lead = p.kind === 'steady' ? STEADY_LEAD : LONG_LEAD;
    const steps: Array<Plan['steps'][number]> = p.kind === 'slide' ? [] : [pianoStep([{ m: p.m, t: 0, d: lead }], { listen: withMic })];
    if (withMic) steps.push({ kind: 'listen' });
    if (c.start(c.tap(ev.nativeEvent), { owner, countIn: 3, countBeats: 3, steps })) {
      setPartAt(i);
      setPartDone(false);
      setPaused(false);
      setView('run');
    }
  }

  /* after the last part: what was measured */
  function finishParts(res: Array<number | null>) {
    if (kind === 'steady') {
      const n = parts.length;
      return void finish({ kind: 'pitch', hits: res.filter((x) => x != null && x >= STEADY_SHARE).length, n });
    }
    const step1: number[] = [], step4: Array<{ m: number; s: number }> = [];
    parts.forEach((p, i) => {
      const v = res[i];
      if (p.kind !== 'long' || v == null) return;
      if (p.step === 1) step1.push(v);
      else step4.push({ m: p.m, s: v });
    });
    void finish(step1.length || step4.length ? { kind: 'holds', step1, step4 } : { kind: 'none' });
  }

  function nextPart(ev: SyntheticEvent) {
    if (partAt + 1 < parts.length) startPart(ev, partAt + 1);
    else finishParts(partRes);
  }

  /* a part without the mic: nothing is timed, Done moves on */
  function partByHand() {
    if (playing) c.stop();
    setPartRes((r) => {
      const out = [...r];
      out[partAt] = null;
      return out;
    });
    setPartDone(true);
  }

  function close() {
    if (playing) c.stop();
    c.dropTake();
    setClockFrom(null);
    setPaused(false);
    setSheet(false);
    setView('preview');
  }

  function done() {
    if (playing) c.stop();
    setClockFrom(null);
    void finish({ kind: 'none' });
  }

  /* Save take: on the phone now, online when it can, the singer's alone;
     with the piano notes it was sung over, to hear it over them again */
  function saveIt() {
    if (!take || takeSaved) return;
    const o = shown?.o;
    const pct = o?.kind === 'pitch' ? Math.round((100 * o.hits) / Math.max(1, o.n)) : null;
    void saveTake({ ...toStored(take, exerciseKey(e.id), name), rightPct: pct,
      exercise: { id: e.id, notes: plan.played.map((n) => [n.m, n.t, n.d] as const) } });
    setTakeSaved(true);
  }

  /* the pattern card's button: the first rung, the piano alone, no mic */
  function hearPattern(ev: SyntheticEvent) {
    if (previewing) {
      c.stop();
      return;
    }
    c.start(c.tap(ev.nativeEvent), { owner: previewOwner, steps: [pianoStep(pattern)] });
  }

  const mic = playing && withMic && usesMic ? micLine(snap.mic, micBlockedBrowser()) : null;
  const steps = routine ? ROUTINES[routine].steps : null;
  const nextId = steps ? steps[step + 1] : (() => {
    const list = EXERCISES.filter((x) => x.category === e.category);
    return list[(list.indexOf(e) + 1) % list.length].id;
  })();
  /* the proper name is the title; the plain words under it (Robert, 28 Oct) */
  const name = copy.ex[e.id].name;
  const plain = (copy.ex[e.id] as { plain?: string }).plain;

  /* the sound sheet's rows: the same behind the gear on the page and while singing */
  const sheetRows = {
    anyOctave: sung || inParts ? { value: anyOctave, set: setAnyOctave } : undefined,
    countSound: countsIn ? { value: countSound, set: setCountSound } : undefined,
    hear: sung ? { value: hear, set: setHear } : undefined,
    hearVolume: sung ? { value: hearVol, set: setHearVol } : undefined,
  };

  if (view === 'run') {
    const waiting = inParts && partDone;
    return (
      <SingLayout colour={cat.colour} title={name}
        controls={{ paused, pause: waiting ? undefined : pause, resume, restart, close,
          gear: countsIn ? { open: sheet, toggle: () => setSheet((x) => !x) } : undefined }}
        status={mic && (
          <>
            <p className="problem" role="status">{mic}</p>
            <button type="button" className="btn btn-quiet" id="carry-on" onClick={() => setWithMic(false)}>{copy.song.carryOn}</button>
          </>
        )}
        sheet={sheet && <SoundSheet {...sheetRows} />}
        prompt={kind === 'interval' ? <p className="ex-line ex-jump" id="ex-jump">{jumpNow}</p> : undefined}
        map={(sung || kind === 'glide') && (
          <Bubbles notes={sung ? plan.notes : []} you={line}
            now={() => c.position() ?? (!sung ? 0 : paused ? rungTime(resumeRung.current) : keepFrom.current ?? 0)}
            live={playing} anyOctave={anyOctave} colour={cat.colour} label={name} count={counting}
            heard={kind === 'interval' ? plan.played : undefined} />
        )}
        dots={sung && (
          <div className="dots" id="ex-dots" role="img" aria-label={copy.train.rungs}>
            {Array.from({ length: rungs }, (_, i) => (
              <span key={i} className="dot" data-done={i < rung ? 'true' : undefined} data-now={i === rung ? 'true' : undefined} />
            ))}
          </div>
        )}>
        {!sung && kind !== 'glide' && counting != null && <div className="ex-big" id="count-in">{counting}</div>}
        {inParts && parts[partAt] && (() => {
          const p = parts[partAt];
          const res = partRes[partAt];
          return (
            <div className="ex-part" id="ex-part" data-m={p.kind === 'slide' ? '' : p.m} data-kind={p.kind}>
              <p className="hint" id="ex-part-at">
                {p.kind === 'steady' ? fill(copy.train.noteOf, { i: partAt + 1, n: parts.length }) : fill(copy.train.stepOf, { step: p.step, k: p.round })}
              </p>
              {p.kind === 'steady' ? <div className="ex-big" id="ex-target">{partLine(p)}</div> : <p className="ex-line" id="ex-target">{partLine(p)}</p>}
              {p.kind === 'long' && counting == null && withMic && (
                <div className="ex-big" id="ex-held">{fill(copy.train.secs, { s: (partDone ? res ?? 0 : heldNow).toFixed(1) })}</div>
              )}
              {p.kind === 'long' && running && !partDone && withMic && (
                <p className="ex-readout" id="ex-readout" aria-live="polite" data-d={readout ? readout.d.toFixed(2) : ''}>
                  <strong>{readout ? keyName(Math.round(readout.m)) : '–'}</strong>
                  <span>{readout ? (Math.abs(readout.d) <= READ_ON ? copy.train.readOn : readout.d > 0 ? copy.train.readHigh : copy.train.readLow) : ''}</span>
                </p>
              )}
              {partDone && p.kind === 'steady' && res != null && (
                <p className="ex-line" id="ex-part-result">
                  {fill(res >= STEADY_SHARE ? copy.train.steadyYes : copy.train.steadyNo, { pct: Math.round(100 * res) })}
                </p>
              )}
              {partDone && p.kind === 'slide' && res != null && <p className="ex-line" id="ex-part-result">{copy.train.slid}</p>}
              {partDone && (
                <button type="button" className="btn btn-start" id="ex-next-part" onClick={nextPart}>{copy.train.nextOne}</button>
              )}
              {!partDone && !withMic && counting == null && (
                <button type="button" className="btn" id="ex-done" onClick={partByHand}>{copy.train.done}</button>
              )}
            </div>
          );
        })()}
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
      </SingLayout>
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
      {plain && <p className="ex-plain" id="ex-plain">{plain}</p>}
      <div className="tags" id="ex-tags">
        <span className="tag" data-colour={cat.colour}>{copy.cats[e.category]}</span>
      </div>
      {'needs' in copy.ex[e.id] && <p className="ex-line" id="ex-needs">{(copy.ex[e.id] as { needs: string }).needs}</p>}

      {sheet && view === 'preview' && <SoundSheet {...sheetRows} level={kind === 'interval' ? { value: level, set: setLevel } : undefined} />}

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
          {shown.o.kind === 'holds' && (
            <>
              <p className="ex-line" id="ex-held1">
                {fill(copy.train.vfeHeld1, { times: shown.o.step1.map((x) => fill(copy.train.secs, { s: x.toFixed(1) })).join(', ') })}
              </p>
              <p className="ex-line" id="ex-held4">
                {fill(copy.train.vfeHeld4, { times: shown.o.step4.map((x) => fill(copy.train.noteSecs, { note: keyName(x.m), s: x.s.toFixed(1) })).join(', ') })}
              </p>
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
            {take && (
              <button type="button" className="btn" id="ex-take-save" disabled={takeSaved} onClick={saveIt}>
                {takeSaved ? copy.train.takeSaved : copy.train.saveTake}
              </button>
            )}
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
          <button type="button" className="btn btn-start" id="ex-start" onClick={start}
            data-round={kind === 'interval' || kind === 'match' ? JSON.stringify(plan.notes.map((n) => [n.m, n.t, n.d])) : undefined}
            data-played={kind === 'interval' ? JSON.stringify(plan.played.map((n) => [n.m, n.t])) : undefined}
            data-shapes={plan.shapes ? JSON.stringify(plan.shapes) : undefined}
            data-parts={inParts ? JSON.stringify(parts.map((p) => (p.kind === 'slide' ? null : p.m))) : undefined}>
            {copy.train.start}
          </button>
          {!!takes?.length && (
            <button type="button" className="btn btn-quiet btn-link" id="ex-takes" onClick={() => navigate(exTakesRoute(e.id), 'screen')}>
              {copy.train.yourTakes}
            </button>
          )}
          {about && (
            <button type="button" className="btn btn-quiet btn-link" id="ex-more" aria-expanded={more} onClick={() => setMore((m) => !m)}>
              {copy.train.moreAbout}
            </button>
          )}
          {about && more && (
            <section className="card about" id="ex-about">
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
