import { copy } from './copy';
import { keyName, type Range } from './notemap';
import { isRight } from './takes';
import { TONE_LEAD, TONE_NOTES, TONE_SECS } from './pitch';

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
  | 'run5' | 'minor5' | 'penta' | 'chrom' | 'turns' | 'arp19' | 'three' | 'threerun' | 'bend';
/** degrees in semitones from the rung's root, and each note's beats */
export interface Pattern {
  readonly deg: readonly number[];
  readonly dur: readonly number[];
  readonly span: number;
  /** every other round the other way up: its steps away from the root
      turned upside down (Note bends: flicks up, then flicks down) */
  readonly flip?: boolean;
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
  /* Robert, 3 Nov: three notes up and back, 1-2-3-2-1, four even notes and the last held */
  three: { deg: [0, 2, 4, 2, 0], dur: [1, 1, 1, 1, 2], span: 4 },
  /* Robert, 16 Nov: 3-2-1, then 1-2-3, in one round */
  threerun: { deg: [4, 2, 0, 0, 2, 4], dur: [1, 1, 2, 1, 1, 2], span: 4 },
  /* Robert, 20 Nov: a fast twitch, note, neighbour, note, neighbour, note,
     neighbour, note, back to back, each flick about as quick as the
     course's (0.15 to 0.2 s: 0.3 of a beat at 100 is 0.18 s), with no long
     hold between them; up one round, down the next (16 Nov) */
  bend: { deg: [0, 1, 0, 1, 0, 1, 0], dur: [1, 0.3, 0.3, 0.3, 0.3, 0.3, 1], span: 1, flip: true },
};

/** how an exercise runs. ladder: the pattern up your range, sung back over
    piano notes; hold: one long note at a time; timed: a hiss, timed from
    the first sound; cycle: breath counts; glide: a siren, your line shown;
    guided: the how and a clock; range: the range check */
export type Engine =
  | { kind: 'ladder'; pattern: PatternId; bpm: number }
  | { kind: 'hold'; secs: number }
  /* the hiss: timed from the first sound; your best shown, no set target (Robert, 4 Nov) */
  | { kind: 'timed' }
  /* breath counts: in, pause and out, each `from` counts in the first round,
     one more each round up to `to` (Robert, 4 Nov) */
  | { kind: 'cycle'; from: number; to: number }
  /* a slide, your line shown; `rest`: Find your resting note, where each
     slide's resting note is named (Robert, 16 Nov; core/rest) */
  | { kind: 'glide'; rest?: boolean }
  | { kind: 'guided'; mins: number }
  | { kind: 'range' }
  /* Pitch (Robert, 28 Oct): a note plays, then the jump is sung; a note
     plays, then it is sung back (the old app's Match the note); a note held
     steady (its Hold a note); and Stemple's four steps (Long soft notes).
     Match the note has three ways (Robert, 4 Nov): in order with no time
     limit ('wait'), five seconds to land each ('window'), and the line
     hidden until the note plays again ('blind'). Match the tone: a plain
     tone held while it is matched. */
  | { kind: 'interval' }
  | { kind: 'match'; mode: 'wait' | 'window' | 'blind' }
  | { kind: 'steady' }
  /* Match the tone's levels (Robert, 20 Nov; core/pitch toneParts) */
  | { kind: 'tone'; mode: 'order' | 'random' | 'hidden' }
  | { kind: 'vfe' };

/** how an exercise's syllables (copy.ex[id].syls) fall on its notes
    (Robert, 27 and 28 Oct): one a note, starting again each repeat
    ('note': the old app's "la-ga la-ga", and a tongue twister, which fits
    its pattern exactly); or one a repeat ('rung', the old app's
    "mmm / nnn / ng": three hums) */
export type SylsBy = 'note' | 'rung';

export type Level = 1 | 2 | 3;
export interface Exercise {
  readonly id: keyof typeof copy.ex;
  readonly category: CategoryId;
  /** its level; with `levels`, the lowest of them */
  readonly level: Level;
  /** works at hum or speaking volume */
  readonly quiet: boolean;
  /** how it runs; with `levels`, at the level picked */
  readonly engine: Engine;
  readonly sylsBy: SylsBy;
  /** levels inside one exercise (Robert, 3 Nov): a pattern for each, picked
      in the sound sheet; a routine uses its own level */
  readonly levels?: ReadonlyArray<{ readonly level: Level; readonly engine: Engine }>;
  /** climbs a half step every round, however many rounds (Robert, 3 Nov),
      not the old app's 14 at most */
  readonly everyStep?: boolean;
  /** sung with the piano and your line shown, but not scored: the pitch
      reader has not been tried through a straw or puffed cheeks, and some
      are about feeling, not notes (Robert, 3 Nov) */
  readonly lineOnly?: boolean;
  /** held notes keep at least this many half steps below the top of the
      range (Tongue-out with a crescendo, Robert 13 Nov: five) */
  readonly topGap?: number;
  /** sung short on purpose (Staccato, Consonant pops): a note counts once
      0.1 s of it is heard on the note, not half its length (13 Nov: real
      short sung sounds of 0.1 to 0.2 s, sung right, scored 0 to 6 in 10
      under the half rule) */
  readonly shortNotes?: boolean;
  /** starts in the middle of the range and climbs to the top (Bwoop, Robert 16 Nov) */
  readonly fromMiddle?: boolean;
}

const ex = (id: Exercise['id'], category: CategoryId, level: Level, quiet: boolean, engine: Engine, sylsBy: SylsBy = 'note'): Exercise =>
  ({ id, category, level, quiet, engine, sylsBy });
/** an exercise with a level inside it for each pattern, the lowest first */
const leveled = (id: Exercise['id'], category: CategoryId, quiet: boolean, levels: ReadonlyArray<{ level: Level; engine: Engine }>,
  more: Partial<Exercise> = {}): Exercise => ({ id, category, level: levels[0].level, quiet, engine: levels[0].engine, sylsBy: 'note', levels, ...more });
/** Robert's 3 Nov exercises climb a half step every round */
const climbing = (e: Exercise, more: Partial<Exercise> = {}): Exercise => ({ ...e, everyStep: true, ...more });
const ladder = (pattern: PatternId, bpm: number): Engine => ({ kind: 'ladder', pattern, bpm });
const guided = (mins: number): Engine => ({ kind: 'guided', mins });

const speeds = (bpms: ReadonlyArray<readonly [Level, number]>, pattern: PatternId) =>
  bpms.map(([level, bpm]) => ({ level, engine: ladder(pattern, bpm) }));

/* In each group's order (Robert's 4 Nov review): the list on Train is this
   array, a group at a time. */
export const EXERCISES: readonly Exercise[] = [
  /* Warm-up: the body first (posture, then the neck and shoulders), then the tension check */
  ex('posture', 'warmup', 1, false, guided(1)),
  ex('neckrelease', 'warmup', 1, true, guided(1)),
  climbing(ex('tensioncheck', 'warmup', 1, true, ladder('three', 110)), { lineOnly: true }),
  /* Robert, 16 Nov: hum and slide down; the note each slide comes to rest on, not scored */
  ex('restnote', 'warmup', 1, true, { kind: 'glide', rest: true }),
  /* Robert, 4 Nov: three levels, all at today's speed */
  leveled('liptrill', 'warmup', true, [{ level: 1, engine: ladder('five', 100) }, { level: 2, engine: ladder('oct', 100) },
    { level: 3, engine: ladder('oct15', 100) }]),
  ex('buzz', 'warmup', 1, true, ladder('five', 110), 'rung'),
  ex('raspberry', 'warmup', 1, true, { kind: 'glide' }),
  /* Robert, 16 Nov: an Advanced level, the trill through puffed cheeks, same pattern and speed */
  leveled('tonguetrill', 'warmup', true, [{ level: 2, engine: ladder('five', 120) }, { level: 3, engine: ladder('five', 120) }]),
  /* Robert, 3 Nov: sung patterns in place of the clock; scored since his
     real-straw test on his phone ("the straw test was good", 13 Nov) */
  leveled('straw', 'warmup', true, [{ level: 1, engine: ladder('three', 110) }, { level: 2, engine: ladder('five', 110) },
    { level: 3, engine: ladder('arp19', 120) }], { everyStep: true }),
  climbing(ex('cheekpuffs', 'warmup', 1, true, ladder('three', 110))),
  climbing(ex('chewhum', 'warmup', 1, true, ladder('five', 110)), { lineOnly: true }),
  ex('hum', 'warmup', 1, true, ladder('five', 110), 'rung'),
  climbing(ex('tonguefwd', 'warmup', 2, true, ladder('five', 110))),
  ex('siren', 'warmup', 1, true, { kind: 'glide' }),
  /* Breath */
  ex('hiss', 'breath', 1, true, { kind: 'timed' }),
  ex('farinelli', 'breath', 1, true, { kind: 'cycle', from: 4, to: 8 }),
  ex('pulses', 'breath', 1, false, guided(1)),
  ex('messa', 'breath', 3, false, { kind: 'hold', secs: 10 }),
  ex('sustain', 'breath', 1, true, { kind: 'hold', secs: 8 }),
  ex('vfe', 'breath', 1, true, { kind: 'vfe' }),
  /* Tone */
  ex('mum', 'tone', 1, true, ladder('five', 120)),
  ex('mee', 'tone', 1, true, ladder('five', 120)),
  ex('noo', 'tone', 1, true, ladder('five', 120)),
  ex('gee', 'tone', 2, false, ladder('five', 120)),
  leveled('nay', 'tone', false, [{ level: 1, engine: ladder('five', 120) }, { level: 2, engine: ladder('oct', 120) }], { everyStep: true }),
  ex('wah', 'tone', 1, true, ladder('down3', 100)),
  ex('tongueout', 'tone', 1, true, ladder('down5', 110)),
  /* Robert, 4 Nov: on held notes with the line, scored, the top five half steps clear */
  { ...ex('tonguecresc', 'tone', 2, false, { kind: 'hold', secs: 8 }), topGap: 5 },
  climbing(ex('brighta', 'tone', 2, false, ladder('five', 110))),
  ex('yawnsigh', 'tone', 1, true, guided(1)),
  ex('goo', 'tone', 1, true, ladder('arp', 120)),
  ex('guh', 'tone', 2, false, ladder('oct', 120)),
  /* Agility */
  ex('loo', 'agility', 1, true, ladder('five', 130)),
  { ...ex('staccato', 'agility', 2, false, ladder('arp', 120)), shortNotes: true },
  leveled('laga', 'agility', true, [{ level: 1, engine: ladder('three', 132) }, { level: 2, engine: ladder('five', 132) },
    { level: 3, engine: ladder('arp19', 132) }], { everyStep: true }),
  /* Robert, 4 Nov: on notes, the line shown, not scored, like Chew and hum */
  { ...ex('blah', 'agility', 1, true, ladder('five', 110)), lineOnly: true },
  leveled('ninetone', 'agility', false, speeds([[2, 130], [3, 160]], 'nine')),
  /* the runs, all on "my": a speed for each level (Robert, 4 Nov); the
     chromatic run and the turns stay advanced, with no 100 (13 Nov) */
  /* Robert, 16 Nov: the smallest run, 3-2-1 then 1-2-3, a half step a round */
  leveled('threerun', 'agility', true, speeds([[1, 100], [2, 130]], 'threerun'), { everyStep: true }),
  leveled('run5', 'agility', true, speeds([[1, 100], [2, 130], [3, 160]], 'run5')),
  leveled('minor5', 'agility', true, speeds([[1, 100], [2, 130], [3, 160]], 'minor5')),
  leveled('penta', 'agility', true, speeds([[1, 100], [2, 130], [3, 160]], 'penta')),
  leveled('chrom', 'agility', true, speeds([[2, 130], [3, 160]], 'chrom')),
  leveled('turns', 'agility', true, speeds([[2, 130], [3, 160]], 'turns')),
  /* Robert, 16 Nov: a flick is about three of the line's readings, so the line is shown, not scored */
  climbing(ex('bends', 'agility', 3, true, ladder('bend', 100)), { lineOnly: true }),
  /* Range */
  ex('octleap', 'range', 3, false, ladder('leap', 100)),
  ex('descend', 'range', 1, true, ladder('down5', 120)),
  /* Robert, 16 Nov: short, light notes from the middle of the range to the top, scored by the short-note rule */
  climbing(ex('bwoop', 'range', 3, false, ladder('five', 120)), { shortNotes: true, fromMiddle: true }),
  ex('octrep', 'range', 3, false, ladder('octrep', 112)),
  ex('arp19', 'range', 3, false, ladder('arp19', 120)),
  /* the old app's range check (3754-3790), as its own exercise */
  ex('rangecheck', 'range', 1, true, { kind: 'range' }),
  /* Articulation: clear words while singing (Robert, 25 Oct), in our own
     words; the four tongue twisters together, each with a slower Beginner
     level at 100 and today's speed as Intermediate (Robert, 4 Nov) */
  ex('vowels', 'words', 1, true, ladder('same5', 100)),
  leveled('redleather', 'words', true, speeds([[1, 100], [2, 120]], 'twist7')),
  leveled('uniqueny', 'words', true, speeds([[1, 100], [2, 110]], 'twist8')),
  leveled('peterpiper', 'words', true, speeds([[1, 100], [2, 120]], 'twist7')),
  leveled('lipstongue', 'words', true, speeds([[1, 100], [2, 112]], 'five')),
  { ...ex('pops', 'words', 1, true, ladder('pops', 100)), shortNotes: true },
  ex('tonguetip', 'words', 1, true, ladder('five', 120)),
  /* Pitch (Robert, 28 Oct; his 4 Nov order): Match the note first, with its three levels */
  leveled('match', 'pitch', true, [{ level: 1, engine: { kind: 'match', mode: 'wait' } }, { level: 2, engine: { kind: 'match', mode: 'window' } },
    { level: 3, engine: { kind: 'match', mode: 'blind' } }]),
  ex('interval', 'pitch', 1, true, { kind: 'interval' }),
  ex('holdnote', 'pitch', 1, true, { kind: 'steady' }),
  climbing(ex('threestep', 'pitch', 1, true, ladder('three', 110))),
  /* scored since Robert's test with headphones (20 Nov: the headphone check
     passed); levels like Match the note's: in order, at random, at random
     with your line hidden */
  leveled('matchtone', 'pitch', true, [{ level: 1, engine: { kind: 'tone', mode: 'order' } }, { level: 2, engine: { kind: 'tone', mode: 'random' } },
    { level: 3, engine: { kind: 'tone', mode: 'hidden' } }]),
];

export function exercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}

/** the exercise after this one in its group's list, round to the first after the last */
export function nextInGroup(id: Exercise['id']): Exercise['id'] {
  const e = exercise(id);
  if (!e) return id;
  const list = EXERCISES.filter((x) => x.category === e.category);
  return list[(list.findIndex((x) => x.id === id) + 1) % list.length].id;
}

/** its levels, lowest first: one, unless it has a level inside it for each pattern */
export function levelsOf(e: Exercise): ReadonlyArray<{ level: Level; engine: Engine }> {
  return e.levels ?? [{ level: e.level, engine: e.engine }];
}

/** the exercise at a level: the highest of its levels not above it, or its
    lowest (a routine's level, capped at the exercise's top: Robert, 3 Nov) */
export function atLevel(e: Exercise, level: Level): Exercise {
  const all = levelsOf(e);
  const pick = [...all].reverse().find((x) => x.level <= level) ?? all[0];
  return { ...e, level: pick.level, engine: pick.engine };
}

/** what the app can measure about it, and so all it will say (7672-7684) */
export function measures(e: Exercise): 'pitch' | 'time' | 'range' | 'none' {
  if (e.lineOnly) return 'none';
  const k = e.engine.kind;
  return k === 'ladder' || k === 'hold' || k === 'interval' || k === 'match' || k === 'steady' || k === 'tone' ? 'pitch'
    : k === 'timed' || k === 'vfe' ? 'time' : k === 'range' ? 'range' : 'none';
}

/** the old app's routines (8100-8125): body before voice, breath before
    tone, semi-occluded before open, down before up, slow before fast. Each
    step at its own level (Robert, 4 Nov), capped at the exercise's top:
    the routine's own level (Beginner for the daily, quiet and cool-down
    ones), except the Advanced warm-up's straw and lip trills, at Beginner,
    so it starts easy and builds. */
export type RoutineId = 'daily' | 'intermediate' | 'advanced' | 'quiet' | 'cooldown';
export interface RoutineStep {
  readonly id: Exercise['id'];
  readonly level: Level;
}
const at = (level: Level, ...ids: Array<Exercise['id']>): RoutineStep[] => ids.map((id) => ({ id, level }));
export const ROUTINES: Record<RoutineId, { readonly steps: readonly RoutineStep[]; readonly down?: boolean }> = {
  /* Robert, 3 Nov: Match the note (Beginner) before Yawn-sigh */
  daily: { steps: at(1, 'hiss', 'liptrill', 'siren', 'mum', 'descend', 'mee', 'match', 'yawnsigh') },
  intermediate: { steps: at(2, 'hiss', 'farinelli', 'liptrill', 'descend', 'mum', 'mee', 'tongueout', 'laga', 'nay', 'wah', 'staccato', 'ninetone') },
  /* Bratty Bay was dropped (Robert, 28 Oct): Octave repeat sings its pattern */
  advanced: { steps: [...at(3, 'farinelli'), ...at(1, 'straw', 'liptrill'), ...at(3, 'descend', 'hum', 'tongueout', 'laga', 'octrep', 'ninetone', 'staccato', 'octleap', 'messa')] },
  quiet: { steps: at(1, 'hiss', 'farinelli', 'liptrill', 'hum', 'siren', 'mum', 'noo', 'tongueout') },
  /* the cool-down steps down from the middle of your range (Robert, 4 Nov) */
  cooldown: { steps: at(1, 'straw', 'hum', 'descend'), down: true },
};
/** the short daily routine at the top of Train (1b): the old app's beginner warm-up */
export const DAILY: RoutineId = 'daily';

/** a routine's steps as they run: the daily one opens with the "Ah" tension
    check for anyone who has never done it (Robert, 4 Nov) */
export function routineSteps(key: RoutineId, tensionDone = true): RoutineStep[] {
  const steps = [...ROUTINES[key].steps];
  return key === DAILY && !tensionDone ? [{ id: 'tensioncheck', level: 1 }, ...steps] : steps;
}

/** a note to sing: its pitch, when and how long (seconds from the start),
    and what to sing on it */
export interface Note {
  readonly m: number;
  readonly t: number;
  readonly d: number;
  readonly syl: string;
  /** seconds on the note it takes to count, when not half its length: a
      note to land in a longer time (Match the note, 5 s; Robert 4 Nov)
      still counts after 1.2 s on it, as it always has */
  readonly need?: number;
  /** the round's first note played alone before it (Robert, 20 Nov): never sung, never scored */
  readonly lead?: boolean;
}

export const MAX_RUNGS = 14;
/** a short note counts once this long on it (seconds) */
export const SHORT_NEED = 0.1;
export const REST_BEATS = 2;
/** How long after its piano note a note is checked, its bubble starts and
    the white line meets it (Robert, 13 and 20 Nov: "not a whole second"):
    the voice's arrival as measured from his saved takes (20 Nov, the
    Five-note run at 160 and Bwoop, 117 notes reached after the first of
    each round): on the note a median 0.14 s after the piano by the app's
    own line, which reads the voice about 0.05 s late, so the voice itself
    is there about 0.09 s after it. Every note's whole window moves by it,
    so it keeps its length. */
export const SING_LAG = 0.14;
/** the lead note (Robert, 20 Nov): before every round, the first one
    included, the round's first note played alone so it can be found before
    it is checked; a beat long, never under this (s); a beat's quiet before it */
export const LEAD_MIN = 0.5;
/** a short note (Staccato, Consonant pops, Bwoop) plays and is drawn this
    long at most, clipped, however long its beat (Robert, 20 Nov: "the
    piano notes ring on"; "the bubbles should be as short as the notes") */
export const SHORT_LEN = 0.25;

/** what an exercise sings: the notes sung and checked (each SING_LAG after
    its piano note), what the piano plays (the lead notes and the pattern),
    the first round's pattern as the piano plays it from 0 (the pattern
    card), the length to the last piano note's end, and the beat */
export interface Sung {
  notes: Note[];
  played: Note[];
  pattern: Note[];
  length: number;
  beat: number;
}

/** The old app's ladder (3706-3740): the pattern from one note above the
    bottom of your range, a half step higher each rung, up to where the
    pattern still fits; at most 14 rungs; two beats' rest between them.
    Robert's 3 Nov exercises climb a half step every round, however many.
    `down` (the Cool-down, Robert 4 Nov): the pattern starts in the middle
    of the range and moves down a half step a round, to one note above the
    bottom.
    Robert, 20 Nov: the rest before each round, the first included, is a
    beat's quiet and then the round's first note played alone (the lead);
    each note is sung and checked SING_LAG after the piano plays it. */
export function ladderNotes(e: Exercise, range: Range, opts: { down?: boolean } = {}): Sung {
  if (e.engine.kind !== 'ladder') return { notes: [], played: [], pattern: [], length: 0, beat: 1 };
  const p = PATTERNS[e.engine.pattern];
  const beat = 60 / e.engine.bpm;
  const lo = range.lo + 1;
  const top = range.hi - p.span;
  let roots: number[] = [];
  const mid = Math.max(lo, Math.min(top, Math.round((range.lo + range.hi) / 2 - p.span / 2)));
  if (opts.down) {
    for (let r = mid; r >= lo; r--) roots.push(r);
  } else for (let r = e.fromMiddle ? mid : lo; r <= top; r++) roots.push(r);
  if (!roots.length) roots = [lo];
  if (roots.length > MAX_RUNGS && !e.everyStep) {
    const step = Math.ceil(roots.length / MAX_RUNGS);
    roots = roots.filter((_, i) => i % step === 0);
  }
  const notes: Note[] = [], played: Note[] = [], pattern: Note[] = [];
  const lead = Math.max(beat, LEAD_MIN);
  let t = 0;
  roots.forEach((root, r) => {
    const way = p.flip && r % 2 ? -1 : 1;
    if (r > 0) t += beat;
    played.push({ m: root + way * p.deg[0], t, d: lead, syl: '', lead: true });
    t += lead;
    const from = t;
    p.deg.forEach((dg, i) => {
      const syl = sylFor(e, i, r);
      const len = p.dur[i] * beat;
      const d = e.shortNotes ? Math.min(len, SHORT_LEN) : len;
      const n: Note = { m: root + way * dg, t, d, syl: i === 0 ? keyName(root) + ' · ' + syl : syl, ...(e.shortNotes ? { need: SHORT_NEED } : {}) };
      played.push(n);
      notes.push({ ...n, t: t + SING_LAG });
      if (r === 0) pattern.push({ ...n, t: t - from });
      t += len;
    });
  });
  return { notes, played, pattern, length: t, beat };
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
/** a held note's lead (Robert, 20 Nov): the note played alone for this
    long at the end of the rest before it, the first included */
export const HOLD_LEAD = 1;
export function holdNotes(e: Exercise, range: Range): Sung {
  if (e.engine.kind !== 'hold') return { notes: [], played: [], pattern: [], length: 0, beat: 1 };
  const secs = e.engine.secs;
  const a = range.lo + 3, b = Math.max(range.lo + 3, range.hi - Math.max(3, e.topGap ?? 0));
  const notes: Note[] = [], played: Note[] = [], pattern: Note[] = [];
  let t = 0;
  for (let i = 0; i < HOLD_NOTES; i++) {
    const m = Math.round(a + ((b - a) * i) / (HOLD_NOTES - 1));
    if (i > 0) t += HOLD_REST - HOLD_LEAD;
    played.push({ m, t, d: HOLD_LEAD, syl: '', lead: true });
    t += HOLD_LEAD;
    const n: Note = { m, t, d: secs, syl: keyName(m) + ' · ' + sylFor(e, 0, i) };
    played.push(n);
    notes.push({ ...n, t: t + SING_LAG });
    if (i === 0) pattern.push({ ...n, t: 0 });
    t += secs;
  }
  return { notes, played, pattern, length: t, beat: 1 };
}

/** the notes an exercise sings, in your range (stepping down in the Cool-down) */
export function notesFor(e: Exercise, range: Range, opts: { down?: boolean } = {}): Sung {
  return e.engine.kind === 'hold' ? holdNotes(e, range) : ladderNotes(e, range, opts);
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
    the score, octave exact unless Any octave is on.
    Rounds you didn't sing don't count (Robert, 4 and 13 Nov): a round (a
    run of the pattern, a held note, a turn) counts once your voice was
    heard on any of its notes, and then a silent note in it is a miss. A
    round with no voice on any note is left out of the score. */
export function bubbleScore(notes: readonly Note[], t: ArrayLike<number>, m: ArrayLike<number>, hop: number, anyOctave: boolean):
  { fill: number[]; hit: boolean[]; hits: number; n: number; sung: boolean; counted: boolean[]; rounds: { sung: number; of: number } } {
  const fill = notes.map(() => 0);
  const heard = notes.map(() => false);
  const heardFor = notes.map(() => 0), onFor = notes.map(() => 0);
  let sung = false;
  for (let i = 0; i < t.length; i++) {
    if (!Number.isFinite(m[i])) continue;
    sung = true;
    const at = ms(t[i]);
    for (let k = 0; k < notes.length; k++) {
      const n = notes[k];
      if (at >= ms(n.t) && at < ms(n.t + n.d)) {
        heard[k] = true;
        heardFor[k] += hop;
        if (isRight(m[i], n.m, anyOctave)) {
          onFor[k] += hop;
          fill[k] += hop / (n.need ?? n.d * HIT_SHARE) * HIT_SHARE;
        }
        break;
      }
    }
  }
  /* a very short note (one with its own `need`) also needs most of what was
     heard in it on the note (the 4 Nov plan): the bubble stops just short */
  const capped = fill.map((f, k) =>
    notes[k].need != null && onFor[k] < heardFor[k] / 2 - 1e-9 ? Math.min(f, HIT_SHARE * 0.98) : Math.min(1, f));
  const hit = capped.map((f) => f >= HIT_SHARE - 1e-9);
  /* each note's round, and whether any note of it was heard */
  const starts = rungStarts(notes);
  const roundOf = notes.map((_, i) => {
    let r = 0;
    starts.forEach((s0, k) => {
      if (i >= s0) r = k;
    });
    return r;
  });
  const roundSung = starts.map((_, r) => notes.some((_, i) => roundOf[i] === r && heard[i]));
  const counted = notes.map((_, i) => !starts.length || roundSung[roundOf[i]]);
  const n = counted.filter(Boolean).length;
  const hits = hit.filter((h, i) => h && counted[i]).length;
  return { fill: capped, hit, hits, n, sung, counted, rounds: { sung: roundSung.filter(Boolean).length, of: starts.length } };
}

/** "How to do it": an exercise's numbered steps (Robert, 3 Nov), or its one
    How line. One that climbs ends "Stop when it stops feeling easy; you
    don't have to finish the climb." unless its steps already say so; in the
    Cool-down, which steps down, "Stop whenever you like." (Robert, 4 and 13 Nov) */
/** a level's own words (Robert, 16 Nov: Tongue trill at Advanced): a step
    (numbered from 1) and the doing-right line, in place of the exercise's */
export interface ByLevel {
  readonly steps?: Readonly<Record<number, string>>;
  readonly right?: string;
}
type AboutWords = { steps?: readonly string[]; right?: string; byLevel?: Partial<Record<Level, ByLevel>> };
const aboutOf = (id: Exercise['id']) => (copy.about as Record<string, AboutWords>)[id];
/** the doing-right line at a level: the level's own, or the exercise's */
export function rightFor(id: Exercise['id'], level?: Level): string | undefined {
  const a = aboutOf(id);
  return (level && a?.byLevel?.[level]?.right) ?? a?.right;
}
export function stepsFor(id: Exercise['id'], opts: { cooldown?: boolean; level?: Level } = {}): readonly string[] {
  const a = aboutOf(id);
  const own = opts.level ? a?.byLevel?.[opts.level]?.steps : undefined;
  const steps = (a?.steps ?? [copy.ex[id].how]).map((t, i) => own?.[i + 1] ?? t);
  const e = exercise(id);
  if (!e || !levelsOf(e).every((l) => l.engine.kind === 'ladder')) return steps;
  if (opts.cooldown) return [...steps, copy.stepLines.stopAny];
  return steps.some((x) => /^stop (climbing|before|when)/i.test(x)) ? steps : [...steps, copy.stepLines.stopEasy];
}

/** About how long a routine takes, in seconds, for this range: its sung
    parts timed from their notes, with the count-in; a clock its clock; and
    what has no clock an allowance (the hiss 25 s, breath counts 90 s, a
    slide 45 s, Match the note at Beginner 70 s ...); and 15 s a step for
    reading and tapping (Robert, 4 Nov: listed lengths from real timings). */
export const STEP_SECS = 15;
const ALLOW: Partial<Record<Engine['kind'], number>> = { timed: 25, cycle: 90, glide: 45, range: 20, interval: 90, steady: 85, vfe: 240 };
/** Match the tone: ten notes, each its count-in, 2 s to find and 4 s held, and a tap (Robert, 20 Nov: shorter holds) */
const TONE_PART_SECS = 3 + TONE_LEAD + TONE_SECS + 3;
export function exerciseSecs(e: Exercise, range: Range, opts: { down?: boolean } = {}): number {
  const k = e.engine.kind;
  if (k === 'ladder' || k === 'hold') {
    const n = notesFor(e, range, opts);
    return n.length + 3 * n.beat;
  }
  if (k === 'guided') return e.engine.mins * 60;
  if (k === 'match') return e.engine.mode === 'wait' ? 70 : 78;
  if (k === 'tone') return TONE_NOTES * TONE_PART_SECS;
  return ALLOW[k] ?? 60;
}
export function routineSecs(steps: readonly RoutineStep[], range: Range, down = false): number {
  let s = 0;
  for (const st of steps) {
    const e = exercise(st.id);
    if (e) s += exerciseSecs(atLevel(e, st.level), range, { down }) + STEP_SECS;
  }
  return s;
}
/** as shown: whole minutes, at least one */
export function routineMins(steps: readonly RoutineStep[], range: Range, down = false): number {
  return Math.max(1, Math.round(routineSecs(steps, range, down) / 60));
}
