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
/** at Beginner, five seconds a note to land it (Robert, 4 Nov), still
    counted once it is held 1.2 s, as a 2.4 s note always was */
export const SING_SLOW = 5;
export const HOLD_TO_COUNT = 1.2;
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
    const sing = level === 1 ? SING_SLOW : SING;
    degs.forEach((d, i) => {
      const m = start + d;
      notes.push({ m, t: t + JUMP_AT + i * sing, d: sing, syl: i ? keyName(m) : keyName(m) + ' · ' + keyName(m), need: HOLD_TO_COUNT });
    });
    labels.push(shapeName(sh.id, sh.down));
    t += JUMP_AT + degs.length * sing + TRIAL_REST;
  }
  return { notes, played, length: t, beat: 1, shapes, labels };
}

/** Match the note: the note plays 1.4 s, then is sung back. Intermediate
    (Robert, 4 Nov): five seconds to land it, counted once it has been on it
    1.2 s, the rule it always had. Advanced: three seconds sung with your
    line hidden, then the note plays again and your line appears; scored on
    the hidden try. */
export const MATCH_PLAY = 1.4;
export const MATCH_AT = 1.6;
export const MATCH_WINDOW = 5;
export const BLIND_SING = 3;
export const BLIND_REPLAY = 0.4;
export interface MatchRound extends Round {
  /** Advanced: when each turn's line is shown (the note played again) */
  readonly reveal?: readonly number[];
}
export function matchNotes(range: Range, rand: () => number = Math.random): number[] {
  const lo = range.lo + 1, hi = Math.max(range.lo + 1, range.hi - 1);
  const out: number[] = [];
  let last = NaN;
  for (let k = 0; k < ROUND; k++) {
    /* the old app drew again once if the note repeated; here, until it doesn't */
    let m = lo + Math.floor(rand() * (hi - lo + 1));
    for (let i = 0; i < 20 && m === last && hi > lo; i++) m = lo + Math.floor(rand() * (hi - lo + 1));
    if (m === last && hi > lo) m = m === hi ? m - 1 : m + 1;
    last = m;
    out.push(m);
  }
  return out;
}
export function matchRound(range: Range, rand: () => number = Math.random, mode: 'window' | 'blind' = 'window'): MatchRound {
  const played: Note[] = [], notes: Note[] = [], reveal: number[] = [];
  let t = 0;
  for (const m of matchNotes(range, rand)) {
    const name = keyName(m) + ' · ' + keyName(m);
    played.push({ m, t, d: MATCH_PLAY, syl: name });
    if (mode === 'blind') {
      notes.push({ m, t: t + MATCH_AT, d: BLIND_SING, syl: name, need: HOLD_TO_COUNT });
      const again = t + MATCH_AT + BLIND_SING + BLIND_REPLAY;
      played.push({ m, t: again, d: MATCH_PLAY, syl: keyName(m) });
      reveal.push(again);
      t = again + MATCH_PLAY + 1.2;
    } else {
      notes.push({ m, t: t + MATCH_AT, d: MATCH_WINDOW, syl: name, need: HOLD_TO_COUNT });
      t += MATCH_AT + MATCH_WINDOW + TRIAL_REST;
    }
  }
  return { notes, played, length: t, beat: 1, ...(mode === 'blind' ? { reveal } : {}) };
}

/** Match the note at Beginner (Robert, 4 Nov): ten notes in order, a half
    step apart, from one above the bottom of the range; each waits, with no
    time limit, until it is held 1.2 s, or Next is tapped */
export function waitParts(range: Range): Part[] {
  const lo = range.lo + 1, hi = Math.max(range.lo + 1, range.hi - 1);
  return Array.from({ length: ROUND }, (_, k) => ({ kind: 'wait' as const, m: lo + (k % (hi - lo + 1)) }));
}

/** Match the tone (Robert, 4 and 20 Nov): a plain tone on real notes in
    the range, ten of them, each 2 s to find, then held with it TONE_SECS.
    Its levels, like Match the note's: Beginner in order, a whole step
    apart from the lower middle (to get familiar); Intermediate drawn at
    random; Advanced drawn at random, your line hidden until the tone
    stops, so the wobble is all you have to go on.
    The hold (20 Nov: "one long note held for a long time"): long enough to
    hear the wobble and settle it out. Ten hundredths of a half step off,
    near A3, the wobble beats about 1.3 times a second; 4 s holds two or
    three of those, the slide that stills it, and over a second still. */
export const TONE_LEAD = 2;
export const TONE_SECS = 4;
export const TONE_NOTES = 10;
export type ToneMode = 'order' | 'random' | 'hidden';
export function toneParts(range: Range, rand: () => number = Math.random, mode: ToneMode = 'order'): Part[] {
  const lo = Math.round(range.lo) + 2, hi = Math.max(lo, Math.round(range.hi) - 2);
  const out: Part[] = [];
  if (mode === 'order') {
    const start = Math.min(Math.round(range.lo + (range.hi - range.lo) / 3), Math.max(lo, hi - 8));
    /* up a whole step a note, back to the start when the top is passed */
    let m = start;
    for (let k = 0; k < TONE_NOTES; k++) {
      if (m > hi) m = start;
      out.push({ kind: 'tone', m, secs: TONE_SECS });
      m += 2;
    }
    return out;
  }
  let last = NaN;
  for (let k = 0; k < TONE_NOTES; k++) {
    let m = lo + Math.floor(rand() * (hi - lo + 1));
    for (let i = 0; i < 20 && m === last && hi > lo; i++) m = lo + Math.floor(rand() * (hi - lo + 1));
    last = m;
    out.push({ kind: 'tone', m, secs: TONE_SECS });
  }
  return out;
}

/** How a sung try landed (Robert, 4 Nov), from your line's points between
    `from` and `to`: where the first 0.3 s of voice sat, how long from the
    first sound until it stayed within 35 hundredths of a half step for
    0.6 s, and how close it sat from then on. In hundredths of a half step
    (cents), the octave folded with Any octave; null where it never did. */
export const FIRST_TRY = 0.3;
export const SETTLE_CENTS = 35;
export const SETTLE_HOLD = 0.6;
export interface Landing {
  readonly first: number | null;
  readonly settleAfter: number | null;
  readonly settled: number | null;
}
const centsOff = (m: number, note: number, anyOctave: boolean) => {
  let d = m - note;
  if (anyOctave) d = ((((d % 12) + 18) % 12) + 12) % 12 - 6;
  return Math.abs(d) * 100;
};
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};
export function landing(t: ArrayLike<number>, m: ArrayLike<number>, note: number, from: number, to: number, anyOctave: boolean): Landing {
  const pts: Array<{ t: number; c: number }> = [];
  for (let i = 0; i < t.length; i++) if (t[i] >= from && t[i] < to && Number.isFinite(m[i])) pts.push({ t: t[i], c: centsOff(m[i], note, anyOctave) });
  if (!pts.length) return { first: null, settleAfter: null, settled: null };
  const t0 = pts[0].t;
  const first = median(pts.filter((p) => p.t < t0 + FIRST_TRY).map((p) => p.c));
  let settleAt: number | null = null;
  for (let i = 0; i < pts.length && settleAt == null; i++) {
    if (pts[i].c > SETTLE_CENTS) continue;
    let j = i;
    while (j + 1 < pts.length && pts[j + 1].c <= SETTLE_CENTS && pts[j + 1].t - pts[j].t < 0.11) j++;
    if (pts[j].t - pts[i].t >= SETTLE_HOLD - 1e-6) settleAt = pts[i].t;
  }
  const after = settleAt == null ? [] : pts.filter((p) => p.t >= (settleAt as number)).map((p) => p.c);
  return { first, settleAfter: settleAt == null ? null : settleAt - t0, settled: after.length ? median(after) : null };
}
/** a distance in words: very close (15 or less), close (35), a bit off (100), far off */
export function nearness(cents: number): 'veryClose' | 'close' | 'bitOff' | 'farOff' {
  return cents <= 15 ? 'veryClose' : cents <= 35 ? 'close' : cents <= 100 ? 'bitOff' : 'farOff';
}
/** "on the note": within half a half step, as Long soft notes' readout */
export const ON_CENTS = 50;

/** one part of an exercise that goes a part at a time, each started by a tap */
export type Part =
  /** Hold the note: the note plays, then is held `secs`; held if steady enough */
  | { readonly kind: 'steady'; readonly m: number; readonly secs: number }
  /** Long soft notes, steps 1 and 4: the note plays, then is held as long as it can be */
  | { readonly kind: 'long'; readonly step: 1 | 4; readonly round: 1 | 2; readonly m: number; readonly syl: string }
  /** Long soft notes, steps 2 and 3: a slide, untimed */
  | { readonly kind: 'slide'; readonly step: 2 | 3; readonly round: 1 | 2; readonly syl: string }
  /** Match the note at Beginner: the note plays, then waits until held */
  | { readonly kind: 'wait'; readonly m: number }
  /** Match the tone: a plain tone, found, then held with it `secs` */
  | { readonly kind: 'tone'; readonly m: number; readonly secs: number };

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
