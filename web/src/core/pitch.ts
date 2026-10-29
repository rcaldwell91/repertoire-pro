import { copy, fill } from './copy';
import { keyName, type Range } from './notemap';
import type { Note } from './exercises';

/* The Pitch group (Robert, 28 Oct) and Long soft notes, as data.
   - Sing the interval: a note plays, the shape is shown ("A fifth up", "Up
     the chord: 1, 3, 5"), the singer sings its notes from it; ten shapes a
     round, every note in the singer's range; scored like every bubble, half
     the note within a semitone, octave exact unless Any octave. The level
     picks the shapes (Robert, 28 Oct).
   - Match the note: the old app's (next.html 3790-3880): a note plays, the
     singer sings it back; ten notes a round, from one above the bottom of
     the range to one below the top, never the same twice running (the old
     app drew again once; here, until it differs); a hit is
     holding it 1.2 s within a semitone (here: half of a 2.4 s bubble).
   - Hold the note: the old app's Hold a note (3906-4010): ten notes, every
     third out at an edge of the range; each plays, then is held five
     seconds; held when 70% of that is within 35 cents. Each waits for Next
     (Robert, 1 Oct).
   - Long soft notes: Stemple's vocal function exercises, each step twice:
     1. "ee" on F4 (higher voices) or F3 (lower), as long as it can be held;
     2. a slide up on "knoll", lowest to highest; 3. down, highest to lowest;
     4. "ol" on C, D, E, F and G from C4 (higher) or C3 (lower), each as long
     as it can be held. Steps 1 and 4 are timed. */

/** a round of notes to sing: what the piano plays, and the bubbles to sing */
export interface Round {
  readonly notes: Note[];
  readonly played: Note[];
  readonly length: number;
  readonly beat: number;
}

/** a repeatable random sequence from a seed (mulberry32), so a round drawn
    once a visit stays the same until the page is left */
export function seeded(seed: number): () => number {
  let a = Math.floor(seed * 2 ** 32) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type JumpLevel = 1 | 2 | 3;
/** the shapes, as semitones above the note that plays: a step, a third ...
    an octave; the chord is 1, 3, 5 (Robert, 28 Oct). Down, each is the
    same notes below it; the chord down is 5, 3, 1 from the note played. */
export const SHAPES = {
  step: [2], third: [4], fourth: [5], fifth: [7], chord: [4, 7], sixth: [9], seventh: [11], octave: [12],
} as const;
export type ShapeId = keyof typeof SHAPES;
/** the shapes at each level: a step, 1-5 and an octave; then a third and
    1-3-5; then a fourth, sixth and seventh, and shapes down too */
export const LEVEL_SHAPES: Record<JumpLevel, { readonly up: readonly ShapeId[]; readonly down: readonly ShapeId[] }> = {
  1: { up: ['step', 'fifth', 'octave'], down: [] },
  2: { up: ['step', 'third', 'fifth', 'chord', 'octave'], down: [] },
  3: { up: ['step', 'third', 'fourth', 'fifth', 'chord', 'sixth', 'seventh', 'octave'], down: ['step', 'third', 'fifth', 'chord', 'octave'] },
};
export const ROUND = 10;
/** a shape: the first note a second, a short gap, then each note of the
    shape held 2.4 s, then a breath before the next */
export const JUMP_PLAY = 1;
export const JUMP_AT = 1.2;
export const SING = 2.4;
export const TRIAL_REST = 0.8;
/** Match the note's turn: a note played, sung back, a breath */
export const TRIAL = 5;

/** the notes of a shape, in semitones from the note played */
export function shapeDegrees(id: ShapeId, down: boolean): number[] {
  if (id === 'chord' && down) return [-3, -7];
  return SHAPES[id].map((d) => (down ? -d : d));
}

/** the words for a shape: "A fifth up", "Up the chord: 1, 3, 5" */
export function shapeName(id: ShapeId, down: boolean): string {
  const s = copy.train.shapes;
  if (id === 'chord') return down ? s.chordDown : s.chordUp;
  return fill(down ? s.down : s.up, { jump: s[id] });
}

export interface ShapeRound extends Round {
  /** each turn's shape, and its words */
  readonly shapes: ReadonlyArray<{ readonly id: ShapeId; readonly down: boolean }>;
  readonly labels: readonly string[];
}

/** ten shapes: every shape of the level in turn, shuffled, each from a
    note that keeps all its notes in the singer's range */
export function intervalRound(level: JumpLevel, range: Range, rand: () => number = Math.random): ShapeRound {
  const { up, down } = LEVEL_SHAPES[level];
  const all = [...up.map((id) => ({ id, down: false })), ...down.map((id) => ({ id, down: true }))];
  const order: Array<{ id: ShapeId; down: boolean }> = [];
  while (order.length < ROUND) {
    const deck = [...all];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    order.push(...deck);
  }
  const shapes = order.slice(0, ROUND);
  const played: Note[] = [], notes: Note[] = [], labels: string[] = [];
  let t = 0;
  for (const sh of shapes) {
    const degs = shapeDegrees(sh.id, sh.down);
    const below = Math.min(0, ...degs), above = Math.max(0, ...degs);
    const lo = range.lo - below, hi = range.hi - above;
    /* a shape wider than the range is centred on it */
    const start = hi >= lo ? lo + Math.floor(rand() * (hi - lo + 1)) : Math.round((range.lo + range.hi - below - above) / 2);
    played.push({ m: start, t, d: JUMP_PLAY, syl: keyName(start) + ' · ' + keyName(start) });
    degs.forEach((d, i) => {
      const m = start + d;
      notes.push({ m, t: t + JUMP_AT + i * SING, d: SING, syl: i ? keyName(m) : keyName(m) + ' · ' + keyName(m) });
    });
    labels.push(shapeName(sh.id, sh.down));
    t += JUMP_AT + degs.length * SING + TRIAL_REST;
  }
  return { notes, played, length: t, beat: 1, shapes, labels };
}

/** Match the note: the note plays 1.4 s, then is sung back */
export const MATCH_PLAY = 1.4;
export const MATCH_AT = 1.6;
export function matchRound(range: Range, rand: () => number = Math.random): Round {
  const lo = range.lo + 1, hi = Math.max(range.lo + 1, range.hi - 1);
  const played: Note[] = [], notes: Note[] = [];
  let last = NaN;
  for (let k = 0; k < ROUND; k++) {
    /* the old app drew again once if the note repeated; here, until it doesn't */
    let m = lo + Math.floor(rand() * (hi - lo + 1));
    for (let i = 0; i < 20 && m === last && hi > lo; i++) m = lo + Math.floor(rand() * (hi - lo + 1));
    if (m === last && hi > lo) m = m === hi ? m - 1 : m + 1;
    last = m;
    const t = k * TRIAL;
    played.push({ m, t, d: MATCH_PLAY, syl: keyName(m) + ' · ' + keyName(m) });
    notes.push({ m, t: t + MATCH_AT, d: SING, syl: keyName(m) + ' · ' + keyName(m) });
  }
  return { notes, played, length: ROUND * TRIAL, beat: 1 };
}

/** one part of an exercise that goes a part at a time, each started by a tap */
export type Part =
  /** Hold the note: the note plays, then is held `secs`; held if steady enough */
  | { readonly kind: 'steady'; readonly m: number; readonly secs: number }
  /** Long soft notes, steps 1 and 4: the note plays, then is held as long as it can be */
  | { readonly kind: 'long'; readonly step: 1 | 4; readonly round: 1 | 2; readonly m: number; readonly syl: string }
  /** Long soft notes, steps 2 and 3: a slide, untimed */
  | { readonly kind: 'slide'; readonly step: 2 | 3; readonly round: 1 | 2; readonly syl: string };

/** Hold the note: how long the note plays first, how long it is held, and the rule */
export const STEADY_LEAD = 1.2;
export const STEADY_SECS = 5;
export const STEADY_CENTS = 35;
export const STEADY_SHARE = 0.7;

/** ten notes in the range, every third out at an edge (the old app's susPickNote) */
export function steadyParts(range: Range, rand: () => number = Math.random): Part[] {
  const lo = Math.round(range.lo), hi = Math.round(range.hi);
  const out: Part[] = [];
  let last = NaN;
  for (let round = 1; round <= ROUND; round++) {
    const pick = () => {
      const edge = round % 3 === 0 && hi - lo > 10;
      if (edge) {
        const top = rand() < 0.5;
        const from = top ? hi - 3 : lo, to = top ? hi : lo + 3;
        return from + Math.floor(rand() * (to - from + 1));
      }
      const a = Math.min(lo + 3, hi), b = Math.max(hi - 3, lo);
      return a + Math.floor(rand() * Math.max(1, b - a + 1));
    };
    let m = pick();
    for (let i = 0; i < 6 && m === last; i++) m = pick();
    last = m;
    out.push({ kind: 'steady', m, secs: STEADY_SECS });
  }
  return out;
}

/** the share of a hold that was within `cents` of the note, from the
    points of your line (every `hop` seconds) between `from` and `from + secs` */
export function steadyShare(t: ArrayLike<number>, m: ArrayLike<number>, hop: number, note: number, from: number, secs: number,
  anyOctave: boolean, cents = STEADY_CENTS): number {
  let ok = 0;
  for (let i = 0; i < t.length; i++) {
    if (t[i] < from || t[i] >= from + secs || !Number.isFinite(m[i])) continue;
    let d = m[i] - note;
    if (anyOctave) d = ((((d % 12) + 18) % 12) + 12) % 12 - 6;
    if (Math.abs(d) * 100 <= cents) ok++;
  }
  return Math.min(1, (ok * hop) / secs);
}

/** higher voices hold "ee" on F4 and step 4 from C4; lower voices on F3 and
    from C3. Higher when the middle of the range is D4 or above. */
export const HIGHER_FROM = 62;
export function higherVoice(range: Range): boolean {
  return (range.lo + range.hi) / 2 >= HIGHER_FROM;
}

/** Stemple's four steps, each twice, for this singer's range */
export function vfeParts(range: Range): Part[] {
  const hi = higherVoice(range);
  const f = hi ? 65 : 53, c = hi ? 60 : 48;
  const out: Part[] = [];
  for (const round of [1, 2] as const) out.push({ kind: 'long', step: 1, round, m: f, syl: 'ee' });
  for (const round of [1, 2] as const) out.push({ kind: 'slide', step: 2, round, syl: 'knoll' });
  for (const round of [1, 2] as const) out.push({ kind: 'slide', step: 3, round, syl: 'knoll' });
  for (const round of [1, 2] as const) for (const d of [0, 2, 4, 5, 7]) out.push({ kind: 'long', step: 4, round, m: c + d, syl: 'ol' });
  return out;
}

/** what a part asks, in words */
export function partLine(p: Part): string {
  if (p.kind === 'long') return fill(p.step === 1 ? copy.train.vfe1 : copy.train.vfe4, { note: keyName(p.m) });
  if (p.kind === 'slide') return p.step === 2 ? copy.train.vfe2 : copy.train.vfe3;
  return keyName(p.m);
}
