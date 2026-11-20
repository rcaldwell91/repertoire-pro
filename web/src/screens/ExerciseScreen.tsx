/* Goal: understand the exercise and start it; then sing its notes; then see what was measured. */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SyntheticEvent } from 'react';
import { Settings } from 'lucide-react';
import { copy, fill } from '../core/copy';
import {
  CATEGORIES, ROUTINES, atLevel, bandAt, bandOf, bubbleScore, exercise, firstRung, levelsOf, measures, nextInGroup, notesFor, rungAt, rungStarts,
  rightFor, stepsFor, type Exercise, type Level, type Note, type RoutineId,
} from '../core/exercises';
import { keyName, type Range } from '../core/notemap';
import { RANGE_POINTS, rangeFrom } from '../core/range';
import { micLine, monitorOf } from '../core/song';
import {
  intervalRound, landing, matchRound, nearness, partLine, seeded, steadyParts, steadyShare, toneParts, vfeParts, waitParts, HOLD_TO_COUNT,
  MATCH_PLAY, ON_CENTS, STEADY_LEAD, STEADY_SHARE, TONE_LEAD, type JumpLevel, type Landing, type Part,
} from '../core/pitch';
import { isRight } from '../core/takes';
import { cueFor, pickReminder, SPOTS, type Spot } from '../core/tension';
import { clock as clockText } from '../core/time';
import { atSameLevel, hasLevels, resultRow, type Outcome } from '../core/results';
import { cycleAt, SoundClock } from '../core/timed';
import { restSlides, type Slide } from '../core/rest';
import type { Plan, Take } from '../audio/conductor/conductor';
import { joinTakes } from '../audio/recorder';
import { keptRange, onRange, rangeNow, saveRange } from '../data/range';
import { bestHiss, myResults, saveResult } from '../data/results';
import { exerciseKey, saveTake } from '../data/takes';
import { keptSpots, saveSpots } from '../data/tension';
import { useConductor, useSnapshot } from '../shell/conductor-context';
import { micBlockedBrowser } from '../shell/env';
import { useTakes } from '../shell/hooks';
import { pianoStep } from '../shell/piano-step';
import { toneStep } from '../shell/tone';
import { back, exRoute, exTakesRoute, navigate, routineRoute } from '../shell/router';
import {
  anyOctaveFor, cueSeen, hearOnFor, hearVolume, jumpLevel, levelFor, nextReminderTurn, reminderTurn, seeCue, setAnyOctaveFor, setHearOnFor, setHearVolume,
  setJumpLevel, setLevelFor, CUE_TIMES,
} from '../shell/settings';
import { routineNow } from '../shell/routine-session';
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
type Shown = { o: Outcome; noMic: boolean; range?: Range; was?: Range; where: 'online' | 'phone' | null; rest?: readonly Slide[] };
type About = { why: string; watch?: string; care?: string; right?: string; steps?: readonly string[] };
/** "A2", "A2 and G♯2", "A2, A2 and G♯2" */
function andList(v: readonly string[]): string {
  return v.length < 2 ? v.join('') : fill(copy.train.listAnd, { a: v.slice(0, -1).join(', '), b: v[v.length - 1] });
}
/** Long soft notes' readout: on the note within half a semitone, as the old app's interval card (next.html 23146) */
const READ_ON = 0.5;

export function ExerciseScreen(props: { id?: string; routine?: string; step?: number }) {
  const routine = props.routine && props.routine in ROUTINES ? (props.routine as RoutineId) : null;
  const step = props.step ?? 0;
  /* a routine's steps, fixed when it started (the daily one may open with the tension check) */
  const steps = routine ? routineNow(routine) : null;
  const id = steps ? steps[step]?.id : props.id;
  const e = id ? exercise(id) : undefined;
  if (!e) {
    return (
      <>
        <BackButton label={copy.tabs.train} onBack={() => back('/train')} />
        <p className="problem">{copy.train.missing}</p>
      </>
    );
  }
  return <ExerciseFor key={e.id + ':' + (routine ?? '') + ':' + step} e={e} routine={routine} step={step}
    steps={steps ? steps.map((x) => x.id) : null} stepLevel={steps?.[step]?.level ?? null} />;
}

function ExerciseFor({ e: base, routine, step, steps, stepLevel }: { e: Exercise; routine: RoutineId | null; step: number;
  steps: ReadonlyArray<Exercise['id']> | null; stepLevel: Level | null }) {
  /* the level inside it (Robert, 3 Nov): picked in the sound sheet and
     remembered for this exercise; in a routine, the step's own level
     (Robert, 4 Nov), capped at the exercise's top level */
  const levels = levelsOf(base);
  const [exLevel, setExLevelNow] = useState<Level>(() => (routine ? stepLevel ?? 1 : levelFor(base.id) ?? base.level));
  /* the Cool-down steps down from the middle of the range (Robert, 4 Nov) */
  const down = !!routine && !!ROUTINES[routine].down;
  const setExLevel = (v: Level) => {
    setExLevelNow(v);
    setLevelFor(base.id, v);
  };
  const e = useMemo(() => atLevel(base, exLevel), [base, exLevel]);
  const c = useConductor();
  const snap = useSnapshot();
  const owner = 'ex:' + e.id;
  const previewOwner = 'preview:' + e.id;
  const cat = CATEGORIES.find((x) => x.id === e.category) ?? CATEGORIES[0];
  const kind = e.engine.kind;
  const matchMode = e.engine.kind === 'match' ? e.engine.mode : null;
  /* sung over the piano, bubble by bubble: the ladders, held notes, and a round of jumps or notes to match */
  const sung = kind === 'ladder' || kind === 'hold' || kind === 'interval' || (kind === 'match' && matchMode !== 'wait');
  /* a part at a time, each started by a tap (Hold the note, Long soft notes,
     Match the note at Beginner, Match the tone) */
  const inParts = kind === 'steady' || kind === 'vfe' || kind === 'tone' || matchMode === 'wait';
  /* a part with your line on the map: one note's bubble (Robert, 4 and 13 Nov) */
  const partMap = kind === 'steady' || kind === 'tone' || matchMode === 'wait';
  const usesMic = sung || inParts || kind === 'timed' || kind === 'glide' || kind === 'range';
  /* Find your resting note: a slide, each one's resting note named (Robert, 16 Nov) */
  const resting = e.engine.kind === 'glide' && !!e.engine.rest;
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
  /* the band that counts at this level (Robert, 21 Nov), drawn as each bubble;
     Sing the interval's goes with its own level */
  const within = kind === 'interval' ? bandAt(e, level) : bandOf(e);
  /* the level it is sung at, shown on the result and kept with it */
  const sungLevel: Level = kind === 'interval' ? level : e.level;
  const [seed] = useState(() => Math.random());
  const plan = useMemo<{ notes: Note[]; played: Note[]; beat: number; labels?: readonly string[]; shapes?: ReadonlyArray<{ id: string; down: boolean }>;
    reveal?: readonly number[]; pattern?: Note[] }>(() => {
    const rand = seeded(seed);
    if (kind === 'interval') return intervalRound(level, range, rand);
    if (matchMode === 'window' || matchMode === 'blind') return matchRound(range, rand, matchMode);
    return notesFor(e, range, { down });
  }, [e, kind, matchMode, range, level, seed, down]);
  const parts = useMemo<Part[]>(() => {
    const rand = seeded(seed);
    return kind === 'steady' ? steadyParts(range, rand) : kind === 'vfe' ? vfeParts(range) : e.engine.kind === 'tone' ? toneParts(range, rand, e.engine.mode)
      : matchMode === 'wait' ? waitParts(range) : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, matchMode, range, seed, e]);
  /* the pattern card: one repeat; for a round, its first jump or note */
  const pattern = useMemo(() => (kind === 'interval' ? [plan.played[0], ...firstRung(plan.notes).map((n) => ({ ...n, d: 1.2 }))]
    : matchMode === 'wait' && parts[0]?.kind === 'wait' ? [{ m: parts[0].m, t: 0, d: MATCH_PLAY, syl: keyName(parts[0].m) + ' · ' + keyName(parts[0].m) }]
      : kind === 'match' ? [plan.played[0]] : plan.pattern ?? firstRung(plan.notes)), [kind, matchMode, plan, parts]);
  const rungs = useMemo(() => rungStarts(plan.notes).length, [plan]);
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
  const [hear, setHearNow] = useState(() => hearOnFor(e.id));
  const [hearVol, setHearVolNow] = useState(hearVolume);
  const setHear = (on: boolean) => {
    setHearNow(on);
    setHearOnFor(e.id, on);
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
  /* the line above the map while singing: a movement cue or a tension reminder, fixed for the run */
  const [lineNow, setLineNow] = useState<string | null>(null);
  /* the tension check's tick list, once it is done; and where the ticks got to */
  const [ticks, setTicks] = useState<Spot[] | null>(null);
  const [ticksWhere, setTicksWhere] = useState<'online' | 'phone' | null>(null);
  /* a new check replaces the old ticks: none until ticked again */
  const openTicks = () => {
    setTicks([]);
    setTicksWhere(null);
    void saveSpots([]);
  };
  const tick = (sp: Spot, on: boolean) => {
    const next = SPOTS.filter((x) => (x === sp ? on : !!ticks?.includes(x)));
    setTicks(next);
    void saveSpots(next).then(setTicksWhere);
  };
  const [takeSaved, setTakeSaved] = useState(false);
  /* your own numbers, read back (Robert, 4 Nov): the best hiss before this
     one (Steady hiss, and Vocal Function Exercises' goal), Long soft notes'
     longest "ee" by day, and how Match the note landed the last times */
  const [bestBefore, setBestBefore] = useState<number | null | undefined>(undefined);
  const [eeDays, setEeDays] = useState<Array<{ date: string; s: number }>>([]);
  const [lastLands, setLastLands] = useState<Array<{ cents?: number; seconds?: number; settle_cents?: number }>>([]);
  useEffect(() => {
    let live = true;
    if (kind === 'timed' || kind === 'vfe') void bestHiss().then((b) => live && setBestBefore(b));
    /* last time at this same level only (Robert, 21 Nov) */
    if (kind === 'match') void myResults('match').then((rs) => live && setLastLands(atSameLevel(rs, e.level).filter((r) => r.cents != null).slice(0, 3)));
    return () => {
      live = false;
    };
  }, [kind, e.level]);
  const readDays = () => void myResults('vfe').then((rs) => {
    const by = new Map<string, number>();
    for (const r of rs) {
      if (typeof r.seconds !== 'number') continue;
      const d = r.created_at.slice(0, 10);
      by.set(d, Math.max(by.get(d) ?? 0, r.seconds));
    }
    setEeDays([...by.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10).map(([date, sec]) => ({ date, s: sec })));
  });
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

  /* Find your resting note: the slides finished so far, looked at four times a second */
  const [restLive, setRestLive] = useState<readonly Slide[]>([]);
  useEffect(() => {
    if (!resting || !running) return;
    const id = window.setInterval(() => {
      const now = c.sinceStart();
      const got = restSlides(line.t, line.m, now == null ? {} : { now });
      setRestLive((was) => (was.length === got.length && was.every((x, k) => x.note === got[k].note) ? was : got));
    }, 250);
    return () => window.clearInterval(id);
  }, [resting, running, c, line]);  /* was the mic ever open while it ran: a score needs it */
  const heard = useRef(false);
  useEffect(() => {
    if (listening) heard.current = true;
  }, [listening]);

  const finish = async (o: Outcome, extra: Partial<Shown> = {}) => {
    const noMic = usesMic && !heard.current;
    const out: Outcome = noMic ? { kind: 'none' } : o;
    setShown({ o: out, noMic, where: null, ...extra });
    setView('result');
    const where = await saveResult(resultRow(e, out, sungLevel));
    setShown((s) => (s ? { ...s, where } : s));
    if (kind === 'vfe') readDays();
  };

  /* the delays the phone reported while singing, kept with the take (13 Nov) */
  const delaysAt = useRef<{ out: number; mic: number } | null>(null);
  /* the recording of the stretch just sung, kept for the take */
  const keepStretch = () => {
    delaysAt.current = c.delays();
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
    if (snap.state === 'finished' && was !== 'finished' && sung) endSung();
    /* stopped by leaving, hiding, a call or a stall: back to the preview */
    if (snap.state === 'stopped' && was !== 'stopped' && snap.why !== 'stop') setView('preview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.state, snap.owner]);

  /* What a sung exercise measured, from the rounds sung (Robert, 4 Nov:
     rounds you didn't sing don't count), and how each try landed on Match
     the note. The line shown but not scored measures nothing (3 Nov). */
  function sungOutcome(): Outcome {
    const s = bubbleScore(plan.notes, line.t, line.m, HOP, anyOctave, within);
    if (!s.sung || e.lineOnly || !s.n) return { kind: 'none' };
    const rounds = s.rounds.sung < s.rounds.of ? s.rounds : undefined;
    if (kind !== 'match') return { kind: 'pitch', hits: s.hits, n: s.n, rounds };
    return { kind: 'pitch', hits: s.hits, n: s.n, rounds, landing: landed(plan.notes.filter((_, i) => s.counted[i]).map((n) => ({ m: n.m, from: n.t, to: n.t + n.d }))) };
  }
  /* Match the note's landing, over each try it heard */
  function landed(tries: ReadonlyArray<{ m: number; from: number; to: number }>) {
    return averaged(tries.map((x) => landing(line.t, line.m, x.m, x.from, x.to, anyOctave)));
  }
  function averaged(ls: readonly Landing[]) {
    const all = ls.filter((l) => l.first != null);
    const avg = (v: Array<number | null>) => {
      const ok = v.filter((x): x is number => x != null);
      return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
    };
    return { firstOn: all.filter((l) => (l.first ?? Infinity) <= ON_CENTS).length, tries: all.length, first: avg(all.map((l) => l.first)),
      settleAfter: avg(all.map((l) => l.settleAfter)), settled: avg(all.map((l) => l.settled)) };
  }
  /* a sung exercise over (at its end, or stopped early by Close): scored on
     the rounds sung, the take every stretch sung, joined */
  function endSung() {
    keepStretch();
    const joined = joinTakes(segments.current);
    setTake(joined ? review({ ...joined, owner }, null, HOP, anyOctave) : null);
    setTakeSaved(false);
    void finish(sungOutcome());
    if (e.id === 'tensioncheck') openTicks();
  }
  /* whether any round has been sung yet: Close then shows what was (13 Nov) */
  function anyRoundSung(): boolean {
    if (sung) return bubbleScore(plan.notes, line.t, line.m, HOP, anyOctave, within).rounds.sung > 0;
    if (inParts) return partRes.some((x, i) => i < partAt + (partDone ? 1 : 0) && x !== undefined);
    return false;
  }

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
            /* the range it replaces, shown beside it when it was sung, not the default (Robert, 4 Nov) */
            const was = keptRange();
            void saveRange(r, 'test');
            void finish({ kind: 'none' }, { range: r, was: was && was.by === 'test' ? { lo: was.lo, hi: was.hi } : undefined });
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

  /* a part at a time (Hold the note, Long soft notes, Match the note at
     Beginner, Match the tone): watched each frame while it runs.
     - a steady hold (Hold the note) ends after its seconds; Match the tone
       the same, the tone playing through it;
     - a wait (Match the note, Beginner) has no time limit: held once it has
       been on the note 1.2 s in all;
     - a long hold, and a slide, end after a second without the note (or any voice).
     Then each waits for Next. A note left with no sound at all is marked
     -1: not sung, so not counted (Robert, 4 Nov). */
  const partClock = useRef<SoundClock | null>(null);
  const partFrom = useRef(0);
  /* how each part's try landed (Match the note at Beginner) */
  const partLanding = useRef<Landing[]>([]);
  /* Long soft notes: the note being sung while holding, and how close (Robert, 28 Oct) */
  const [readout, setReadout] = useState<{ m: number; d: number } | null>(null);
  /* Match the tone: the microphone is hearing the tone itself, not you */
  const [toneHeard, setToneHeard] = useState(false);
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
    const voiced = (from: number, to: number) => {
      for (let i = 0; i < line.t.length; i++) if (line.t[i] >= from && line.t[i] < to && Number.isFinite(line.m[i])) return true;
      return false;
    };
    let seen = -1;
    let onFor = 0;
    const frame = () => {
      const at = (performance.now() - partFrom.current) / 1000;
      if (p.kind === 'steady' || p.kind === 'tone') {
        const lead = p.kind === 'steady' ? STEADY_LEAD : TONE_LEAD;
        if (p.kind === 'tone') {
          /* a pure tone is dead steady and a voice never is: a line sitting
             exactly on the tone, unmoving for a second, is the tone */
          const last = line.t.length ? line.t[line.t.length - 1] : 0;
          const pts: number[] = [];
          for (let i = line.t.length - 1; i >= 0 && line.t[i] > last - 1; i--) pts.push(line.m[i]);
          const steady = pts.length >= 18 && pts.every(Number.isFinite) && Math.max(...pts) - Math.min(...pts) < 0.03 &&
            Math.abs(pts[0] - p.m) < 0.05;
          if (steady) setToneHeard(true);
        }
        if (at >= lead + p.secs) {
          /* Match the tone, scored (Robert, 20 Nov): how it landed, as Match the note's, from the first sound */
          if (p.kind === 'tone') partLanding.current[partAt] = landing(line.t, line.m, p.m, 0, lead + p.secs, anyOctave);
          return end(voiced(lead, lead + p.secs) ? steadyShare(line.t, line.m, HOP, p.m, lead, p.secs, anyOctave, within * 100) : -1);
        }
      } else if (p.kind === 'wait') {
        for (let k = seen + 1; k < line.t.length; k++) {
          seen = k;
          if (line.t[k] < MATCH_PLAY) continue;
          if (Number.isFinite(line.m[k]) && isRight(line.m[k], p.m, anyOctave, within)) onFor += HOP;
        }
        setHeldNow(onFor);
        if (onFor >= HOLD_TO_COUNT - 1e-6) {
          partLanding.current[partAt] = landing(line.t, line.m, p.m, MATCH_PLAY, Infinity, anyOctave);
          return end(1);
        }
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

  /* Match the note at Beginner: Next before the note is held ends it: a miss
     if you sang, not counted if you didn't */
  function waitNext() {
    const p = parts[partAt];
    if (p?.kind !== 'wait') return;
    if (playing) c.stop();
    const sang = line.t.some((t, i) => t >= MATCH_PLAY && Number.isFinite(line.m[i]));
    if (sang) {
      partLanding.current[partAt] = landing(line.t, line.m, p.m, MATCH_PLAY, Infinity, anyOctave);
    }
    setPartRes((r) => {
      const out = [...r];
      out[partAt] = sang ? 0 : -1;
      return out;
    });
    setPartDone(true);
  }

  /* Sing the interval: the shape of this turn, in words, from the note heard first */
  const [jumpNow, setJumpNow] = useState('');
  /* and its song, the first three times each shape comes (Robert, 13 Nov) */
  const [jumpCue, setJumpCue] = useState('');
  const cueTurn = useRef(-1);
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
      if (k !== cueTurn.current) {
        cueTurn.current = k;
        const sh = plan.shapes?.[k];
        const key = sh ? (sh.down ? sh.id + 'Down' : sh.id) : '';
        const cue = (copy.train.cues as Record<string, string>)[key];
        if (cue && cueSeen(key) < CUE_TIMES) {
          seeCue(key);
          setJumpCue(cue);
        } else setJumpCue('');
      }
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
    const t = setInterval(() => setRungNow(rungOf(c.position() ?? -1)), 100);
    return () => clearInterval(t);
    /* rungOf reads only the plan */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, sung, plan, c]);
  /* paused: the repeat it will carry on from */
  const rung = running ? rungNow : paused && sung ? resumeRung.current : -1;

  /* Start, Try again and Restart: from the first repeat, nothing kept */
  function start(ev: SyntheticEvent) {
    cueTurn.current = -1;
    setJumpCue('');
    partLanding.current = [];
    setToneHeard(false);
    /* the one line while singing: the movement cue, or the next tension reminder that suits it */
    const cue = cueFor(e.id);
    const spot = cue ? null : pickReminder(e.id, keptSpots(), reminderTurn(), e.level);
    if (spot) nextReminderTurn();
    setLineNow(cue ?? (spot ? copy.train.remind[spot] : null));
    setTicks(null);
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

  /* where a sung exercise's rung begins: its lead note (Robert, 20 Nov), or the note heard before it */
  function rungTime(r: number): number {
    const i = rungStarts(plan.notes)[r] ?? 0;
    if (plan.labels || kind === 'match') return plan.played[r]?.t ?? 0;
    const leads = plan.played.filter((n) => n.lead);
    return leads[r]?.t ?? plan.notes[i]?.t ?? 0;
  }

  /* the rung being sung at this moment: a rung begins with its lead note
     (Robert, 20 Nov), so its dot is lit, and Pause carries on from it,
     from the lead on; -1 before the first, `rungs` once all are sung */
  function rungOf(at: number): number {
    const r = rungAt(plan.notes, at);
    if (r >= rungs) return r;
    let k = r;
    while (k + 1 < rungs && rungTime(k + 1) <= at) k++;
    return k;
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
      if (at != null) resumeRung.current = Math.max(0, Math.min(rungs - 1, rungOf(at)));
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
    setToneHeard(false);
    const lead = p.kind === 'steady' ? STEADY_LEAD : p.kind === 'wait' ? MATCH_PLAY : LONG_LEAD;
    /* Match the tone: the plain tone, through the find and the hold, Hear yourself as set */
    const steps: Array<Plan['steps'][number]> = p.kind === 'slide' ? []
      : p.kind === 'tone' ? [toneStep(p.m, TONE_LEAD + p.secs, { listen: withMic, monitor: hear ? monitorOf(hearVol) : 0 })]
        : [pianoStep([{ m: p.m, t: 0, d: lead }], { listen: withMic })];
    if (withMic) steps.push({ kind: 'listen' });
    if (c.start(c.tap(ev.nativeEvent), { owner, countIn: 3, countBeats: 3, steps })) {
      setPartAt(i);
      setPartDone(false);
      setPaused(false);
      setView('run');
    }
  }

  /* after the last part (or the parts done, stopped early): what was measured */
  function partsOutcome(res: Array<number | null>, upTo = parts.length): Outcome {
    const done = parts.slice(0, upTo);
    if (kind === 'tone' && e.lineOnly) return { kind: 'none' };
    if (kind === 'steady' || kind === 'tone') {
      /* a note left without a sound doesn't count (Robert, 4 Nov) */
      const sungParts = done.map((_, i) => res[i]).filter((x): x is number => x != null && x >= 0);
      /* Match the tone: and how each landed, beside last time (Robert, 20 Nov) */
      const landed = kind === 'tone'
        ? { landing: averaged(done.flatMap((_, i) => (res[i] != null && (res[i] as number) >= 0 && partLanding.current[i] ? [partLanding.current[i]] : []))) }
        : {};
      return sungParts.length ? { kind: 'pitch', hits: sungParts.filter((x) => x >= STEADY_SHARE).length, n: sungParts.length,
        rounds: sungParts.length < done.length ? { sung: sungParts.length, of: done.length } : undefined, ...landed } : { kind: 'none' };
    }
    if (matchMode === 'wait') {
      /* held, missed (sung but not held), or skipped with no sound: not counted */
      const sungParts = done.map((_, i) => res[i]).filter((x): x is number => x != null && x >= 0);
      if (!sungParts.length) return { kind: 'none' };
      return { kind: 'pitch', hits: sungParts.filter((x) => x >= 1).length, n: sungParts.length,
        rounds: sungParts.length < done.length ? { sung: sungParts.length, of: done.length } : undefined,
        landing: averaged(done.flatMap((_, i) => (res[i] != null && (res[i] as number) >= 0 && partLanding.current[i] ? [partLanding.current[i]] : []))) };
    }
    const step1: number[] = [], step4: Array<{ m: number; s: number }> = [];
    done.forEach((p, i) => {
      const v = res[i];
      if (p.kind !== 'long' || v == null) return;
      if (p.step === 1) step1.push(v);
      else step4.push({ m: p.m, s: v });
    });
    return step1.length || step4.length ? { kind: 'holds', step1, step4 } : { kind: 'none' };
  }
  function finishParts(res: Array<number | null>, upTo = parts.length) {
    void finish(partsOutcome(res, upTo));
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

  /* a held part's one bubble, on the part's own clock: after its note, for
     its hold (Match the note at Beginner: open-ended, a minute drawn) */
  function partNotes(p: Part): Note[] {
    if (p.kind === 'slide') return [];
    const name = keyName(p.m) + ' · ' + keyName(p.m);
    if (p.kind === 'wait') return [{ m: p.m, t: MATCH_PLAY, d: 60, syl: name, need: HOLD_TO_COUNT }];
    if (p.kind === 'tone') return [{ m: p.m, t: TONE_LEAD, d: p.secs, syl: name }];
    if (p.kind === 'steady') return [{ m: p.m, t: STEADY_LEAD, d: p.secs, syl: name }];
    return [{ m: p.m, t: LONG_LEAD, d: 30, syl: name }];
  }

  /* the parts already finished, a part at a time */
  const partsDone = () => partAt + (partDone ? 1 : 0);

  function close() {
    if (view === 'run') {
      /* the tension check stopped early: the tick list still, once a round was sung */
      if (e.id === 'tensioncheck') {
        const at = c.position();
        const done = at != null ? rungOf(at) : paused ? resumeRung.current : 0;
        if (done >= 1) {
          if (playing) c.stop();
          c.dropTake();
          setPaused(false);
          setSheet(false);
          void finish({ kind: 'none' });
          openTicks();
          return;
        }
      } else if (sung && anyRoundSung()) {
        /* stopped early (Robert, 4 and 13 Nov): the result for the rounds sung */
        if (playing) c.stop();
        setPaused(false);
        setSheet(false);
        endSung();
        return;
      } else if (inParts && partsDone() > 0) {
        if (playing) c.stop();
        setPaused(false);
        setSheet(false);
        finishParts(partRes, partsDone());
        return;
      }
    }
    if (playing) c.stop();
    c.dropTake();
    setClockFrom(null);
    setPaused(false);
    setSheet(false);
    setView('preview');
  }

  /* Left by the menu at the bottom while singing (Robert, 13 Nov): the
     sound and the mic stop at once (the conductor, on the route change), and
     what was sung is kept as Close keeps it: once a round has been sung, its
     result is saved, without the result screen. */
  const leaving = useRef<() => void>(() => {});
  leaving.current = () => {
    if (view !== 'run' || shown) return;
    let o: Outcome = { kind: 'none' };
    if (sung && e.id !== 'tensioncheck' && anyRoundSung()) o = sungOutcome();
    else if (inParts && partsDone() > 0) o = partsOutcome(partRes, partsDone());
    if (o.kind !== 'none') void saveResult(resultRow(e, o, sungLevel));
  };
  useEffect(() => () => leaving.current(), []);

  function done() {
    if (playing) c.stop();
    setClockFrom(null);
    void finish({ kind: 'none' }, resting ? { rest: restSlides(line.t, line.m, { all: true }) } : {});
    setRestLive([]);
  }

  /* Save take: on the phone now, online when it can, the singer's alone;
     with the piano notes it was sung over, to hear it over them again */
  function saveIt() {
    if (!take || takeSaved) return;
    const o = shown?.o;
    const pct = o?.kind === 'pitch' ? Math.round((100 * o.hits) / Math.max(1, o.n)) : null;
    void saveTake({ ...toStored(take, exerciseKey(e.id), name), rightPct: pct,
      exercise: { id: e.id, notes: plan.played.filter((n) => !n.lead).map((n) => [n.m, n.t, n.d] as const) }, delays: delaysAt.current ?? c.delays() });
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
  /* Next: the routine's next step, or the next exercise in the group, by
     its id (13 Nov: found by the exercise itself, it was never found once
     a level was applied, so Next always went to the group's first, and on
     that one did nothing) */
  const nextId = steps ? steps[step + 1] : nextInGroup(e.id);
  /* the proper name is the title; the plain words under it (Robert, 28 Oct) */
  const name = copy.ex[e.id].name;
  const plain = (copy.ex[e.id] as { plain?: string }).plain;
  const need = (copy.ex[e.id] as { need?: string }).need;

  /* the sound sheet's rows: the same behind the gear on the page and while singing */
  const sheetRows = {
    anyOctave: sung || inParts ? { value: anyOctave, set: setAnyOctave } : undefined,
    countSound: countsIn ? { value: countSound, set: setCountSound } : undefined,
    hear: sung || kind === 'tone' ? { value: hear, set: setHear } : undefined,
    hearVolume: sung || kind === 'tone' ? { value: hearVol, set: setHearVol } : undefined,
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
        prompt={kind === 'interval' ? (
          <>
            <p className="ex-line ex-jump" id="ex-jump">{jumpNow}</p>
            {/* the song for this shape, the first three times (Robert, 13 Nov); its line kept, so the map never moves */}
            <p className="hint ex-jump-cue" id="ex-jump-cue">{jumpCue}</p>
          </>
        ) : lineNow ? <p className="ex-line ex-cue" id="ex-cue">{lineNow}</p> : undefined}
        map={(sung || kind === 'glide') ? (
          <Bubbles notes={sung ? plan.notes : []} you={line}
            now={() => c.position() ?? (!sung ? 0 : paused ? rungTime(resumeRung.current) : keepFrom.current ?? 0)}
            live={playing} anyOctave={anyOctave} colour={cat.colour} label={name} count={counting}
            heard={kind === 'interval' ? plan.played : undefined} scored={!e.lineOnly} reveal={plan.reveal} within={within} />
        ) : partMap && parts[partAt] && parts[partAt].kind !== 'slide' ? (
          /* a held note: its bubble and your line (Robert, 13 Nov); Match the
             note at Beginner fills by its own rule, 1.2 s on the note */
          <Bubbles notes={partNotes(parts[partAt])} you={line} now={() => c.sinceStart() ?? 0}
            live={playing} anyOctave={anyOctave} colour={cat.colour} label={name} count={counting}
            scored={parts[partAt].kind === 'wait'} within={within}
            hideYou={e.engine.kind === 'tone' && e.engine.mode === 'hidden' && !partDone} />
        ) : undefined}
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
          const held = p.kind === 'steady' || p.kind === 'tone' || p.kind === 'wait';
          return (
            <div className="ex-part" id="ex-part" data-m={p.kind === 'slide' ? '' : p.m} data-kind={p.kind}>
              <p className="hint" id="ex-part-at">
                {held ? fill(copy.train.noteOf, { i: partAt + 1, n: parts.length }) : fill(copy.train.stepOf, { step: p.step, k: p.round })}
              </p>
              {held ? <div className="ex-big" id="ex-target">{partLine(p)}</div> : <p className="ex-line" id="ex-target">{partLine(p)}</p>}
              {p.kind === 'tone' && toneHeard && <p className="problem" id="tone-heard" role="status">{copy.train.toneHeard.join(' ')}</p>}
              {p.kind === 'long' && counting == null && withMic && (
                <div className="ex-big" id="ex-held">{fill(copy.train.secs, { s: (partDone ? res ?? 0 : heldNow).toFixed(1) })}</div>
              )}
              {/* the goal: your best Steady hiss (Robert, 4 Nov; the workbook, 13 Nov) */}
              {p.kind === 'long' && counting == null && bestBefore !== undefined && (
                <p className="hint" id="ex-goal-time">{bestBefore != null ? fill(copy.train.goalIs, { s: bestBefore.toFixed(1) }) : copy.train.noGoal}</p>
              )}
              {p.kind === 'long' && running && !partDone && withMic && (
                <p className="ex-readout" id="ex-readout" aria-live="polite" data-d={readout ? readout.d.toFixed(2) : ''}>
                  <strong>{readout ? keyName(Math.round(readout.m)) : '–'}</strong>
                  <span>{readout ? (Math.abs(readout.d) <= READ_ON ? copy.train.readOn : readout.d > 0 ? copy.train.readHigh : copy.train.readLow) : ''}</span>
                </p>
              )}
              {partDone && (p.kind === 'steady' || (p.kind === 'tone' && !e.lineOnly)) && res != null && res >= 0 && (
                <p className="ex-line" id="ex-part-result">
                  {fill(res >= STEADY_SHARE ? copy.train.steadyYes : copy.train.steadyNo, { pct: Math.round(100 * res) })}
                </p>
              )}
              {partDone && p.kind === 'wait' && res === 1 && <p className="ex-line" id="ex-part-result">{copy.train.heldIt}</p>}
              {partDone && p.kind === 'slide' && res != null && <p className="ex-line" id="ex-part-result">{copy.train.slid}</p>}
              {/* Match the note at Beginner: no time limit; Next moves on whenever you like */}
              {p.kind === 'wait' && !partDone && counting == null && (
                <button type="button" className="btn" id="ex-wait-next" onClick={waitNext}>{copy.train.nextOne}</button>
              )}
              {partDone && (
                <>
                  {/* Pause has nothing to pause now: say what to do (13 Nov: no silent taps) */}
                  <p className="hint" id="ex-wait-hint">{copy.train.waitNext}</p>
                  <button type="button" className="btn btn-start" id="ex-next-part" onClick={nextPart}>{copy.train.nextOne}</button>
                </>
              )}
              {!partDone && !withMic && counting == null && (
                <button type="button" className="btn" id="ex-done" onClick={partByHand}>{copy.train.done}</button>
              )}
            </div>
          );
        })()}
        {kind === 'glide' && !resting && <p className="hint">{copy.train.glide}</p>}
        {resting && restLive.length > 0 && (() => {
          const last = restLive[restLive.length - 1];
          return (
            <p className="ex-line" id="ex-rest-now" role="status">
              {last.note != null ? fill(copy.train.restSlide, { k: restLive.length, note: keyName(last.note) }) : copy.train.restNone.join(' ')}
            </p>
          );
        })()}
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
          /* the counts grow a round at a time (Robert, 4 Nov) */
          const k = cycleAt(elapsed, e.engine.from, e.engine.to);
          return (
            <>
              <p className="hint" id="ex-round">{fill(copy.train.cycleRound, { k: k.round, c: k.count })}</p>
              <div className="ex-big" id="ex-count">{Math.ceil(k.left - 1e-9)}</div>
              <p className="ex-line" id="ex-phase">{[copy.train.cycleIn, copy.train.cycleHold, copy.train.cycleOut][k.phase]}</p>
            </>
          );
        })()}
        {kind === 'guided' && (
          <>
            <div className="ex-big" id="ex-clock">{clockText(elapsed)}</div>
            <ol className="ex-steps">{stepsFor(e.id, { cooldown: down, level: e.level }).map((t) => <li key={t}>{t}</li>)}</ol>
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
      {/* the plain one-line description (Robert, 3 Nov) */}
      <p className="ex-desc" id="ex-goal">{copy.ex[e.id].goal}</p>
      <div className="tags" id="ex-tags">
        <span className="tag" data-colour={cat.colour}>{copy.cats[e.category]}</span>
      </div>

      {sheet && view === 'preview' && (
        <SoundSheet {...sheetRows}
          level={kind === 'interval' ? { value: level, set: setLevel, label: copy.train.jumpLevel, options: [1, 2, 3] }
            : levels.length > 1 && !routine ? { value: e.level, set: setExLevel, label: copy.train.level, options: levels.map((x) => x.level) } : undefined} />
      )}

      {view === 'result' && shown && (
        <section className="card ex-result" id="ex-result"
          data-hit={sung && line.t.length ? bubbleScore(plan.notes, line.t, line.m, HOP, anyOctave, within).hit.map((h) => (h ? 1 : 0)).join('') : undefined}>
          {shown.o.kind === 'pitch' && hasLevels(e) && <p className="hint" id="ex-level" data-level={sungLevel}>{fill(copy.train.sungAt, { level: copy.levels[sungLevel] })}</p>}
          {shown.o.kind === 'pitch' && (
            <>
              <p className="ex-score" id="ex-score">{fill(copy.train.notesHit, { hits: shown.o.hits, n: shown.o.n })}</p>
              <p className="hint">{fill(copy.train.onPitch, { pct: Math.round((100 * shown.o.hits) / Math.max(1, shown.o.n)) })}</p>
              {/* rounds you didn't sing don't count (Robert, 4 and 13 Nov) */}
              {shown.o.rounds && <p className="hint" id="ex-rounds">{fill(copy.train.roundsSung, { k: shown.o.rounds.sung, n: shown.o.rounds.of })}</p>}
              {shown.o.landing && shown.o.landing.tries > 0 && <Landed l={shown.o.landing} last={lastLands[0]} />}
            </>
          )}
          {shown.o.kind === 'time' && e.engine.kind === 'timed' && (
            <>
              <p className="ex-score" id="ex-score">{fill(copy.train.held, { s: shown.o.seconds.toFixed(1) })}</p>
              {/* your best so far, not a set target (Robert, 4 Nov) */}
              {bestBefore !== undefined && (
                <p className="hint" id="ex-best">
                  {bestBefore == null ? copy.train.firstBest
                    : fill(copy.train.best, { s: Math.max(bestBefore, shown.o.seconds).toFixed(1) }) + (shown.o.seconds > bestBefore ? ' ' + copy.train.newBest : '')}
                </p>
              )}
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
              {/* the goal from your best hiss, and your longest "ee" day by day (Robert, 4 and 13 Nov) */}
              <p className="hint" id="ex-goal-time">{bestBefore != null ? fill(copy.train.goalIs, { s: bestBefore.toFixed(1) }) : copy.train.noGoal}</p>
              {eeDays.length > 0 && (
                <>
                  <p className="ex-label">{copy.train.byDay}</p>
                  <ul className="ex-days" id="ex-days">{eeDays.map((d) => <li key={d.date}>{fill(copy.train.dayIs, { date: d.date, s: d.s.toFixed(1) })}</li>)}</ul>
                </>
              )}
            </>
          )}
          {shown.range && (
            <p className="ex-score" id="ex-score">{fill(copy.train.rangeFound, { lo: keyName(shown.range.lo), hi: keyName(shown.range.hi) })}</p>
          )}
          {shown.range && shown.was && (
            <p className="hint" id="ex-range-was">{fill(copy.train.rangeWas, { lo: keyName(shown.was.lo), hi: keyName(shown.was.hi) })}</p>
          )}
          {shown.rest && (() => {
            const notes = shown.rest.filter((x) => x.note != null).map((x) => keyName(x.note as number));
            return (
              <p className="ex-score" id="ex-rest" data-notes={JSON.stringify(shown.rest.map((x) => x.note))}>
                {notes.length ? fill(copy.train.restResult, { notes: andList(notes) }) : copy.train.restNone.join(' ')}
              </p>
            );
          })()}
          {shown.o.kind === 'none' && !shown.range && !shown.rest && (
            <p className="hint" id="ex-unscored">
              {shown.noMic ? copy.train.noMicScore : e.lineOnly ? copy.train.lineOnly : measures(e) === 'none' ? copy.train.notScored : copy.train.nothingSung}
            </p>
          )}
          {ticks && (
            <fieldset className="ticks" id="tension-ticks">
              <legend className="ex-label">{copy.train.tensionHead}</legend>
              {SPOTS.map((sp) => (
                <label key={sp} className="tick-row">
                  <input type="checkbox" id={'tick-' + sp} checked={ticks.includes(sp)} onChange={(ev) => tick(sp, ev.target.checked)} />
                  <span>{copy.train.tension[sp]}</span>
                </label>
              ))}
              {ticksWhere && ticks.length > 0 && <p className="hint" id="tension-saved">{copy.train.tensionSaved}</p>}
            </fieldset>
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
          {need && (
            <>
              <p className="ex-label">{copy.train.need}</p>
              <p className="ex-line" id="ex-needs">{need}</p>
            </>
          )}
          {sung && (
            <PatternCard notes={pattern} colour={cat.colour} playing={previewing} now={() => c.position() ?? -1} onPlay={hearPattern} />
          )}
          <p className="ex-label">{copy.train.howTo}</p>
          <ol className="ex-steps" id="ex-how">
            {stepsFor(e.id, { cooldown: down, level: e.level }).map((t) => <li key={t}>{t}</li>)}
          </ol>
          <button type="button" className="btn btn-start" id="ex-start" onClick={start}
            data-round={sung ? JSON.stringify(plan.notes.map((n) => [n.m, n.t, n.d])) : undefined}
            data-rounds={kind === 'ladder' ? JSON.stringify(rungStarts(plan.notes).map((i) => plan.notes[i].m)) : undefined}
            data-played={kind === 'interval' || kind === 'match' ? JSON.stringify(plan.played.map((n) => [n.m, n.t])) : undefined}
            data-piano={kind === 'ladder' || kind === 'hold' ? JSON.stringify(plan.played.map((n) => [n.m, n.t, n.d, n.lead ? 1 : 0])) : undefined}
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
              {/* Robert, 3 Nov: doing it right, then watch out (care points at its end, so nothing is lost), then why */}
              {rightFor(e.id, e.level) && (
                <>
                  <p className="ex-label">{copy.train.right}</p>
                  <p id="ex-right">{rightFor(e.id, e.level)}</p>
                </>
              )}
              {(about.watch || about.care) && (
                <>
                  <p className="ex-label">{copy.train.watchOut}</p>
                  {about.watch && <p>{about.watch}</p>}
                  {about.care && <p>{about.care}</p>}
                </>
              )}
              <p className="ex-label">{copy.train.whyHelps}</p>
              <p>{about.why}</p>
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

/* How Match the note's tries landed (Robert, 4 Nov), in words, beside the
   last time: first tries on the note (within half a half step), how long
   it took to settle, and how close it settled */
function Landed({ l, last }: { l: NonNullable<Extract<Outcome, { kind: 'pitch' }>['landing']>;
  last?: { cents?: number; seconds?: number; settle_cents?: number } }) {
  const word = (c: number) => copy.train.near[nearness(c)];
  const was = (line: string, prev: string | null) => (prev ? fill(copy.train.lastTime, { line, was: prev }) : line);
  return (
    <div className="ex-landed" id="ex-landed">
      <p className="hint" id="ex-first-on">{fill(copy.train.firstTry, { k: l.firstOn, n: l.tries })}</p>
      {l.first != null && (
        <p className="hint" id="ex-first-avg">{was(fill(copy.train.firstAvg, { how: word(l.first) }), last?.cents != null ? word(last.cents) : null)}</p>
      )}
      {l.settleAfter != null && (
        <p className="hint" id="ex-settle">{was(fill(copy.train.settleIn, { s: l.settleAfter.toFixed(1) }), last?.seconds != null ? last.seconds.toFixed(1) + ' s' : null)}</p>
      )}
      {l.settled != null && (
        <p className="hint" id="ex-settled">{was(fill(copy.train.settled, { how: word(l.settled) }), last?.settle_cents != null ? word(last.settle_cents) : null)}</p>
      )}
    </div>
  );
}
