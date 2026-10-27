import { copy } from './copy';
import { keyName, type Range } from './notemap';
import { isRight } from './takes';

/* The Train tab's exercises, as data (RULEBOOK 2.6: the old app is the
   checklist). Every exercise of the old app's library (next.html
   7686-8099), with its group, level, whether it works at hum volume, and
   how it runs; its patterns (8063-8075) and routines (8100-8125). Its
   words live in core/copy (copy.ex), held to the copy lint. */

export type CategoryId = 'warmup' | 'breath' | 'tone' | 'agility' | 'range' | 'words' | 'pitch';
/** one colour means one thing (1b): Range and Pitch share Agility's blue,
    blue meaning pitch (Robert, 23 and 28 Oct); Articulation has its own,
    yellow (Robert, 25 Oct) */
export type Colour = 'warmup' | 'breath' | 'tone' | 'pitch' | 'words';
export const CATEGORIES: ReadonlyArray<{ id: CategoryId; colour: Colour }> = [
  { id: 'warmup', colour: 'warmup' },
  { id: 'breath', colour: 'breath' },
  { id: 'tone', colour: 'tone' },
  { id: 'agility', colour: 'pitch' },
  { id: 'range', colour: 'pitch' },
  { id: 'words', colour: 'words' },
  { id: 'pitch', colour: 'pitch' },
];

export type PatternId = 'five' | 'down5' | 'down3' | 'arp' | 'oct' | 'octrep' | 'nine' | 'oct15' | 'same5' | 'pops' | 'leap' | 'twist7' | 'twist8'
  | 'run5' | 'minor5' | 'penta' | 'chrom' | 'turns' | 'arp19';
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
  /* Articulation (Robert, 25 Oct): one held note sung five times; short repeated notes */
  same5: { deg: [0, 0, 0, 0, 0], dur: [1, 1, 1, 1, 2], span: 0 },
  pops: { deg: [0, 0, 0, 0, 0, 0, 0, 0], dur: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], span: 0 },
  /* Robert, 28 Oct: a true octave leap, 1-8-1 (the old app's own ladder, next.html 3704) */
  leap: { deg: [0, 12, 0], dur: [1.5, 2, 2.5], span: 12 },
  /* a tongue twister fits its pattern exactly, a syllable a note, ending on the last:
     seven syllables 1-2-3-5-3-2-1; eight (a phrase said twice) 1-2-3-5, 5-3-2-1 */
  twist7: { deg: [0, 2, 4, 7, 4, 2, 0], dur: [1, 1, 1, 1, 1, 1, 2], span: 7 },
  twist8: { deg: [0, 2, 4, 7, 7, 4, 2, 0], dur: [1, 1, 1, 2, 1, 1, 1, 2], span: 7 },
  /* the runs (Robert, 28 Oct), a note a beat, the last held */
  run5: { deg: [0, 2, 4, 5, 7, 5, 4, 2, 0], dur: [1, 1, 1, 1, 1, 1, 1, 1, 2], span: 7 },
  minor5: { deg: [0, 2, 3, 5, 7, 5, 3, 2, 0], dur: [1, 1, 1, 1, 1, 1, 1, 1, 2], span: 7 },
  penta: { deg: [0, 2, 4, 7, 9, 7, 4, 2, 0], dur: [1, 1, 1, 1, 1, 1, 1, 1, 2], span: 9 },
  chrom: { deg: [0, 1, 2, 3, 4, 5, 6, 7, 6, 5, 4, 3, 2, 1, 0], dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], span: 7 },
  turns: { deg: [4, 2, 0, 5, 4, 2, 7, 5, 4, 9, 7, 5], dur: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], span: 9 },
  arp19: { deg: [0, 4, 7, 12, 16, 19, 16, 12, 7, 4, 0], dur: [1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 2], span: 19 },
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
  | { kind: 'range' }
  /* Pitch (Robert, 28 Oct): a note plays, then the jump is sung; a note
     plays, then it is sung back (the old app's Match the note); a note held
     steady (its Hold a note); and Stemple's four steps (Long soft notes) */
  | { kind: 'interval' }
  | { kind: 'match' }
  | { kind: 'steady' }
  | { kind: 'vfe' };

/** how an exercise's syllables (copy.ex[id].syls) fall on its notes
    (Robert, 27 and 28 Oct): one a note, starting again each repeat
    ('note': the old app's "la-ga la-ga", and a tongue twister, which fits
    its pattern exactly); or one a repeat ('rung', the old app's
    "mmm / nnn / ng": three hums) */
export type SylsBy = 'note' | 'rung';

export interface Exercise {
  readonly id: keyof typeof copy.ex;
  readonly category: CategoryId;
  readonly level: 1 | 2 | 3;
  /** works at hum or speaking volume */
  readonly quiet: boolean;
  readonly engine: Engine;
  readonly sylsBy: SylsBy;
}

const ex = (id: Exercise['id'], category: CategoryId, level: 1 | 2 | 3, quiet: boolean, engine: Engine, sylsBy: SylsBy = 'note'): Exercise =>
  ({ id, category, level, quiet, engine, sylsBy });
const ladder = (pattern: PatternId, bpm: number): Engine => ({ kind: 'ladder', pattern, bpm });
const guided = (mins: number): Engine => ({ kind: 'guided', mins });

export const EXERCISES: readonly Exercise[] = [
  ex('hiss', 'breath', 1, true, { kind: 'timed', target: 20 }),
  ex('farinelli', 'breath', 1, true, { kind: 'cycle', counts: [4, 4, 4] }),
  ex('pulses', 'breath', 1, false, guided(1)),
  ex('liptrill', 'warmup', 1, true, ladder('oct15', 100)),
  /* Robert, 28 Oct */
  ex('buzz', 'warmup', 1, true, ladder('five', 110), 'rung'),
  ex('raspberry', 'warmup', 1, true, { kind: 'glide' }),
  ex('tonguetrill', 'warmup', 2, true, ladder('five', 120)),
  ex('straw', 'warmup', 1, true, guided(3)),
  ex('hum', 'warmup', 1, true, ladder('five', 110), 'rung'),
  ex('siren', 'warmup', 1, true, { kind: 'glide' }),
  ex('mum', 'tone', 1, true, ladder('five', 120)),
  ex('mee', 'tone', 1, true, ladder('five', 120)),
  ex('noo', 'tone', 1, true, ladder('five', 120)),
  ex('loo', 'agility', 1, true, ladder('five', 130)),
  ex('gee', 'tone', 2, false, ladder('five', 120)),
  ex('staccato', 'agility', 2, false, ladder('arp', 120)),
  ex('nay', 'tone', 2, false, ladder('oct', 120)),
  ex('wah', 'tone', 1, true, ladder('down3', 100)),
  ex('octleap', 'range', 3, false, ladder('leap', 100)),
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
  ex('vfe', 'breath', 1, true, { kind: 'vfe' }),
  ex('goo', 'tone', 1, true, ladder('arp', 120)),
  ex('guh', 'tone', 2, false, ladder('oct', 120)),
  /* the runs, all on "my", faster at higher levels */
  ex('run5', 'agility', 1, true, ladder('run5', 120)),
  ex('minor5', 'agility', 2, true, ladder('minor5', 140)),
  ex('penta', 'agility', 2, true, ladder('penta', 140)),
  ex('chrom', 'agility', 3, true, ladder('chrom', 160)),
  ex('turns', 'agility', 3, true, ladder('turns', 160)),
  ex('arp19', 'range', 3, false, ladder('arp19', 120)),
  /* Articulation: clear words while singing (Robert, 25 Oct), in our own words */
  ex('vowels', 'words', 1, true, ladder('same5', 100)),
  ex('redleather', 'words', 2, true, ladder('twist7', 120)),
  ex('uniqueny', 'words', 2, true, ladder('twist8', 110)),
  ex('peterpiper', 'words', 2, true, ladder('twist7', 120)),
  ex('pops', 'words', 1, true, ladder('pops', 100)),
  ex('tonguetip', 'words', 1, true, ladder('five', 120)),
  ex('lipstongue', 'words', 2, true, ladder('five', 112)),
  /* the old app's range check (3754-3790), as its own exercise */
  ex('rangecheck', 'range', 1, true, { kind: 'range' }),
  /* Pitch (Robert, 28 Oct) */
  ex('interval', 'pitch', 1, true, { kind: 'interval' }),
  ex('match', 'pitch', 1, true, { kind: 'match' }),
  ex('holdnote', 'pitch', 1, true, { kind: 'steady' }),
];

export function exercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

/** what the app can measure about it, and so all it will say (7672-7684) */
export function measures(e: Exercise): 'pitch' | 'time' | 'range' | 'none' {
  const k = e.engine.kind;
  return k === 'ladder' || k === 'hold' || k === 'interval' || k === 'match' || k === 'steady' ? 'pitch'
    : k === 'timed' || k === 'vfe' ? 'time' : k === 'range' ? 'range' : 'none';
}

/** the old app's routines (8100-8125): body before voice, breath before
    tone, semi-occluded before open, down before up, slow before fast */
export type RoutineId = 'daily' | 'intermediate' | 'advanced' | 'quiet' | 'cooldown';
export const ROUTINES: Record<RoutineId, { mins: number; steps: readonly Exercise['id'][] }> = {
  daily: { mins: 9, steps: ['hiss', 'liptrill', 'siren', 'mum', 'descend', 'mee', 'yawnsigh'] },
  intermediate: { mins: 16, steps: ['hiss', 'farinelli', 'liptrill', 'descend', 'mum', 'mee', 'tongueout', 'laga', 'nay', 'wah', 'staccato', 'ninetone'] },
  /* Bratty Bay was dropped (Robert, 28 Oct): Octave repeat sings its pattern */
  advanced: { mins: 20, steps: ['farinelli', 'straw', 'liptrill', 'descend', 'hum', 'tongueout', 'laga', 'octrep', 'ninetone', 'staccato', 'octleap', 'messa'] },
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
  const notes: Note[] = [];
  let b = 0;
  roots.forEach((root, r) => {
    p.deg.forEach((dg, i) => {
      const syl = sylFor(e, i, r);
      notes.push({ m: root + dg, t: b * beat, d: p.dur[i] * beat, syl: i === 0 ? keyName(root) + ' · ' + syl : syl });
      b += p.dur[i];
    });
    b += REST_BEATS;
  });
  return { notes, length: (b - REST_BEATS) * beat, beat };
}

/** the syllable for a note: the exercise's one syllable, or one of its
    list, a note at a time from each repeat's start, or a repeat at a time.
    i counts the notes of this repeat, r the repeats. */
export function sylFor(e: Exercise, i: number, r: number): string {
  const words = copy.ex[e.id] as { syl: string; syls?: readonly string[] };
  const list = words.syls;
  if (!list?.length) return words.syl;
  const at = e.sylsBy === 'rung' ? r : i;
  return list[at % list.length];
}

/** a held note's pattern: five notes evenly through your range, three in
    from each end, three seconds' rest between */
export const HOLD_NOTES = 5;
export const HOLD_REST = 3;
export function holdNotes(e: Exercise, range: Range): { notes: Note[]; length: number; beat: number } {
  if (e.engine.kind !== 'hold') return { notes: [], length: 0, beat: 1 };
  const secs = e.engine.secs;
  const a = range.lo + 3, b = Math.max(range.lo + 3, range.hi - 3);
  const notes: Note[] = [];
  for (let i = 0; i < HOLD_NOTES; i++) {
    const m = Math.round(a + ((b - a) * i) / (HOLD_NOTES - 1));
    notes.push({ m, t: i * (secs + HOLD_REST), d: secs, syl: keyName(m) + ' · ' + sylFor(e, 0, i) });
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
