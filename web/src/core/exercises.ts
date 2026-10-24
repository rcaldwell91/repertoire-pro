import { copy } from './copy';
import { keyName, type Range } from './notemap';
import { isRight } from './takes';

/* The Train tab's exercises, as data (RULEBOOK 2.6: the old app is the
   checklist). Every exercise of the old app's library (next.html
   7686-8099), with its group, level, whether it works at hum volume, and
   how it runs; its patterns (8063-8075) and routines (8100-8125). Its
   words live in core/copy (copy.ex), held to the copy lint. */

export type CategoryId = 'warmup' | 'breath' | 'tone' | 'agility' | 'range';
/** one colour means one thing (1b): Range shares Agility's blue (Robert, 23 Oct) */
export type Colour = 'warmup' | 'breath' | 'tone' | 'pitch';
export const CATEGORIES: ReadonlyArray<{ id: CategoryId; colour: Colour }> = [
  { id: 'warmup', colour: 'warmup' },
  { id: 'breath', colour: 'breath' },
  { id: 'tone', colour: 'tone' },
  { id: 'agility', colour: 'pitch' },
  { id: 'range', colour: 'pitch' },
];

export type PatternId = 'five' | 'down5' | 'down3' | 'arp' | 'oct' | 'octrep' | 'nine' | 'oct15';
/** degrees in semitones from the rung's root, and each note's beats */
export interface Pattern {
  readonly deg: readonly number[];
  readonly dur: readonly number[];
  readonly span: number;
}
export const PATTERNS: Record<PatternId, Pattern> = {
  five: { deg: [0, 2, 4, 5, 7, 5, 4, 2, 0], dur: [1, 1, 1, 1, 2, 1, 1, 1, 2], span: 7 },
  down5: { deg: [7, 5, 4, 2, 0], dur: [1, 1, 1, 1, 2], span: 7 },
  down3: { deg: [4, 2, 0], dur: [1, 1, 2], span: 4 },
  arp: { deg: [0, 4, 7, 4, 0], dur: [1, 1, 2, 1, 2], span: 7 },
  oct: { deg: [0, 4, 7, 12, 7, 4, 0], dur: [1, 1, 1, 2, 1, 1, 2], span: 12 },
  octrep: { deg: [0, 4, 7, 12, 12, 12, 12, 7, 4, 0], dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 2], span: 12 },
  nine: { deg: [0, 2, 4, 5, 7, 9, 11, 12, 14, 12, 11, 9, 7, 5, 4, 2, 0],
    dur: [1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2], span: 14 },
  oct15: { deg: [0, 4, 7, 12, 16, 19, 17, 14, 12, 9, 7, 5, 2, 0],
    dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], span: 19 },
};

/** how an exercise runs. ladder: the pattern up your range, sung back over
    piano notes; hold: one long note at a time; timed: a hiss, timed from
    the first sound; cycle: breath counts; glide: a siren, your line shown;
    guided: the how and a clock; range: the range check */
export type Engine =
  | { kind: 'ladder'; pattern: PatternId; bpm: number }
  | { kind: 'hold'; secs: number }
  | { kind: 'timed'; target: number }
  | { kind: 'cycle'; counts: readonly number[] }
  | { kind: 'glide' }
  | { kind: 'guided'; mins: number }
  | { kind: 'range' };

export interface Exercise {
  readonly id: keyof typeof copy.ex;
  readonly category: CategoryId;
  readonly level: 1 | 2 | 3;
  /** works at hum or speaking volume */
  readonly quiet: boolean;
  readonly engine: Engine;
}

const ex = (id: Exercise['id'], category: CategoryId, level: 1 | 2 | 3, quiet: boolean, engine: Engine): Exercise =>
  ({ id, category, level, quiet, engine });
const ladder = (pattern: PatternId, bpm: number): Engine => ({ kind: 'ladder', pattern, bpm });
const guided = (mins: number): Engine => ({ kind: 'guided', mins });

export const EXERCISES: readonly Exercise[] = [
  ex('hiss', 'breath', 1, true, { kind: 'timed', target: 20 }),
  ex('farinelli', 'breath', 1, true, { kind: 'cycle', counts: [4, 4, 4] }),
  ex('liptrill', 'warmup', 1, true, ladder('oct15', 100)),
  ex('straw', 'warmup', 1, true, guided(3)),
  ex('hum', 'warmup', 1, true, ladder('five', 110)),
  ex('siren', 'warmup', 1, true, { kind: 'glide' }),
  ex('mum', 'tone', 1, true, ladder('five', 120)),
  ex('mee', 'tone', 1, true, ladder('five', 120)),
  ex('noo', 'tone', 1, true, ladder('five', 120)),
  ex('loo', 'agility', 1, true, ladder('five', 130)),
  ex('gee', 'tone', 2, false, ladder('five', 120)),
  ex('staccato', 'agility', 2, false, ladder('arp', 120)),
  ex('nay', 'tone', 2, false, ladder('oct', 120)),
  ex('bay', 'tone', 2, false, ladder('octrep', 118)),
  ex('wah', 'tone', 1, true, ladder('down3', 100)),
  ex('octleap', 'range', 3, false, ladder('oct', 100)),
  ex('laga', 'agility', 1, true, ladder('five', 132)),
  ex('tongueout', 'tone', 1, true, ladder('down5', 110)),
  ex('tonguecresc', 'tone', 2, false, guided(2)),
  ex('blah', 'agility', 1, true, guided(1)),
  ex('yawnsigh', 'tone', 1, true, guided(1)),
  ex('messa', 'breath', 3, false, { kind: 'hold', secs: 10 }),
  ex('sustain', 'breath', 1, true, { kind: 'hold', secs: 8 }),
  ex('ninetone', 'agility', 2, false, ladder('nine', 160)),
  ex('descend', 'range', 1, true, ladder('down5', 120)),
  ex('octrep', 'range', 3, false, ladder('octrep', 112)),
  ex('vfe', 'breath', 1, true, guided(5)),
  /* the old app's range check (3754-3790), as its own exercise */
  ex('rangecheck', 'range', 1, true, { kind: 'range' }),
];

export function exercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

/** what the app can measure about it, and so all it will say (7672-7684) */
export function measures(e: Exercise): 'pitch' | 'time' | 'range' | 'none' {
  const k = e.engine.kind;
  return k === 'ladder' || k === 'hold' ? 'pitch' : k === 'timed' ? 'time' : k === 'range' ? 'range' : 'none';
}

/** the old app's routines (8100-8125): body before voice, breath before
    tone, semi-occluded before open, down before up, slow before fast */
export type RoutineId = 'daily' | 'intermediate' | 'advanced' | 'quiet' | 'cooldown';
export const ROUTINES: Record<RoutineId, { mins: number; steps: readonly Exercise['id'][] }> = {
  daily: { mins: 9, steps: ['hiss', 'liptrill', 'siren', 'mum', 'descend', 'mee', 'yawnsigh'] },
  intermediate: { mins: 16, steps: ['hiss', 'farinelli', 'liptrill', 'descend', 'mum', 'mee', 'tongueout', 'laga', 'nay', 'wah', 'staccato', 'ninetone'] },
  advanced: { mins: 20, steps: ['farinelli', 'straw', 'liptrill', 'descend', 'hum', 'tongueout', 'laga', 'bay', 'ninetone', 'staccato', 'octleap', 'messa'] },
  quiet: { mins: 10, steps: ['hiss', 'farinelli', 'liptrill', 'hum', 'siren', 'mum', 'noo', 'tongueout'] },
  cooldown: { mins: 3, steps: ['straw', 'hum', 'descend'] },
};
/** the short daily routine at the top of Train (1b): the old app's beginner warm-up */
export const DAILY: RoutineId = 'daily';

/** a note to sing: its pitch, when and how long (seconds from the start),
    and what to sing on it */
export interface Note {
  readonly m: number;
  readonly t: number;
  readonly d: number;
  readonly syl: string;
}

export const MAX_RUNGS = 14;
export const REST_BEATS = 2;

/** The old app's ladder (3706-3740): the pattern from one note above the
    bottom of your range, a half step higher each rung, up to where the
    pattern still fits; at most 14 rungs; two beats' rest between them. */
export function ladderNotes(e: Exercise, range: Range): { notes: Note[]; length: number; beat: number } {
  if (e.engine.kind !== 'ladder') return { notes: [], length: 0, beat: 1 };
  const p = PATTERNS[e.engine.pattern];
  const beat = 60 / e.engine.bpm;
  const lo = range.lo + 1;
  const top = range.hi - p.span;
  let roots: number[] = [];
  for (let r = lo; r <= top; r++) roots.push(r);
  if (!roots.length) roots = [lo];
  if (roots.length > MAX_RUNGS) {
    const step = Math.ceil(roots.length / MAX_RUNGS);
    roots = roots.filter((_, i) => i % step === 0);
  }
  const syl = copy.ex[e.id].syl;
  const notes: Note[] = [];
  let b = 0;
  for (const root of roots) {
    p.deg.forEach((dg, i) => {
      notes.push({ m: root + dg, t: b * beat, d: p.dur[i] * beat, syl: i === 0 ? keyName(root) + ' · ' + syl : syl });
      b += p.dur[i];
    });
    b += REST_BEATS;
  }
  return { notes, length: (b - REST_BEATS) * beat, beat };
}

/** a held note's pattern: five notes evenly through your range, three in
    from each end, three seconds' rest between */
export const HOLD_NOTES = 5;
export const HOLD_REST = 3;
export function holdNotes(e: Exercise, range: Range): { notes: Note[]; length: number; beat: number } {
  if (e.engine.kind !== 'hold') return { notes: [], length: 0, beat: 1 };
  const secs = e.engine.secs;
  const a = range.lo + 3, b = Math.max(range.lo + 3, range.hi - 3);
  const syl = copy.ex[e.id].syl;
  const notes: Note[] = [];
  for (let i = 0; i < HOLD_NOTES; i++) {
    const m = Math.round(a + ((b - a) * i) / (HOLD_NOTES - 1));
    notes.push({ m, t: i * (secs + HOLD_REST), d: secs, syl: keyName(m) + ' · ' + syl });
  }
  return { notes, length: HOLD_NOTES * secs + (HOLD_NOTES - 1) * HOLD_REST, beat: 1 };
}

/** the notes an exercise sings, in your range */
export function notesFor(e: Exercise, range: Range): { notes: Note[]; length: number; beat: number } {
  return e.engine.kind === 'hold' ? holdNotes(e, range) : ladderNotes(e, range);
}

/** where each rung begins (one run of the pattern, or one held note), as
    indexes into the notes: the notes that carry a note name */
export function rungStarts(notes: readonly Note[]): number[] {
  const out: number[] = [];
  notes.forEach((n, i) => {
    if (n.syl.includes(' · ')) out.push(i);
  });
  return out;
}

/** the notes of the first rung alone: the pattern, for the preview */
export function firstRung(notes: readonly Note[]): Note[] {
  const starts = rungStarts(notes);
  return notes.slice(0, starts.length > 1 ? starts[1] : notes.length);
}

/** which rung is being sung at time t (seconds from the start): the last
    one begun by then; -1 before the first; the count after the last note */
export function rungAt(notes: readonly Note[], t: number): number {
  const starts = rungStarts(notes);
  if (!notes.length || t < notes[0].t) return -1;
  const last = notes[notes.length - 1];
  if (t >= last.t + last.d) return starts.length;
  let r = 0;
  starts.forEach((i, k) => {
    if (t >= notes[i].t) r = k;
  });
  return r;
}

/** the syllable alone, without the rung's note name */
export function sylOf(n: Note): string {
  const at = n.syl.indexOf(' · ');
  return at < 0 ? n.syl : n.syl.slice(at + 3);
}

/** a hit: at least half of the note's time within a semitone of it
    (RULEBOOK 4, Bubbles); the fill shows that same share */
export const HIT_SHARE = 0.5;
const ms = (s: number) => Math.round(s * 1000);

/** How much of each note was sung on it (the fill), which notes were hit,
    and how many. Your points are every `hop` seconds; times are rounded to
    whole milliseconds before they are compared (RULEBOOK 4, Bubbles: a
    float once lost 63 of 488 notes). One rule, isRight, for the fill and
    the score, octave exact unless Any octave is on. */
export function bubbleScore(notes: readonly Note[], t: ArrayLike<number>, m: ArrayLike<number>, hop: number, anyOctave: boolean):
  { fill: number[]; hit: boolean[]; hits: number; n: number; sung: boolean } {
  const fill = notes.map(() => 0);
  let sung = false;
  for (let i = 0; i < t.length; i++) {
    if (!Number.isFinite(m[i])) continue;
    sung = true;
    const at = ms(t[i]);
    for (let k = 0; k < notes.length; k++) {
      const n = notes[k];
      if (at >= ms(n.t) && at < ms(n.t + n.d)) {
        if (isRight(m[i], n.m, anyOctave)) fill[k] += hop / n.d;
        break;
      }
    }
  }
  const capped = fill.map((f) => Math.min(1, f));
  const hit = capped.map((f) => f >= HIT_SHARE - 1e-9);
  return { fill: capped, hit, hits: hit.filter(Boolean).length, n: notes.length, sung };
}
