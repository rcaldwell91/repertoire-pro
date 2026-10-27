import { copy, fill } from './copy';
import { keyName, type Range } from './notemap';
import type { Note } from './exercises';

/* The Pitch group (Robert, 28 Oct) and Long soft notes, as data.
   - Sing the interval: a note plays, the jump is shown ("A fifth up"), the
     singer sings the note it lands on; ten jumps a round, the starting notes
     in the singer's range; scored like every bubble, half the note within a
     semitone, octave exact unless Any octave. The level picks the jumps.
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
/** the jumps at each level, in semitones: a step and an octave; then a third
    and a fifth; then a fourth, sixth and seventh, and downward jumps too */
export const JUMPS: Record<JumpLevel, { readonly semis: readonly number[]; readonly down: boolean }> = {
  1: { semis: [2, 12], down: false },
  2: { semis: [2, 4, 7, 12], down: false },
  3: { semis: [2, 4, 5, 7, 9, 11, 12], down: true },
};
export const ROUND = 10;
/** an interval: the first note a second, a short gap, then the jump held 2.4 s */
export const JUMP_PLAY = 1;
export const JUMP_AT = 1.2;
export const SING = 2.4;
export const TRIAL = 5;

/** the words for a jump: "A fifth up" */
export function jumpName(semis: number, down: boolean): string {
  const jump = copy.train.jumps[semis as keyof typeof copy.train.jumps];
  return fill(down ? copy.train.jumpDown : copy.train.jumpUp, { jump });
}

/** ten jumps: every jump of the level in turn, shuffled, each from a
    starting note that keeps both notes in the singer's range */
export function intervalRound(level: JumpLevel, range: Range, rand: () => number = Math.random): Round {
  const { semis, down } = JUMPS[level];
  const order: number[] = [];
  while (order.length < ROUND) {
    const deck = [...semis];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    order.push(...deck);
  }
  const played: Note[] = [], notes: Note[] = [];
  order.slice(0, ROUND).forEach((jump, k) => {
    const dn = down && rand() < 0.5;
    const lo = dn ? range.lo + jump : range.lo, hi = dn ? range.hi : range.hi - jump;
    /* a jump wider than the range is centred on it */
    const mid = (range.lo + range.hi) / 2;
    const start = hi >= lo ? lo + Math.floor(rand() * (hi - lo + 1)) : Math.round(dn ? mid + jump / 2 : mid - jump / 2);
    const target = dn ? start - jump : start + jump;
    const t = k * TRIAL;
    const name = jumpName(jump, dn);
    played.push({ m: start, t, d: JUMP_PLAY, syl: keyName(start) + ' · ' + keyName(start) });
    notes.push({ m: target, t: t + JUMP_AT, d: SING, syl: keyName(target) + ' · ' + name });
  });
  return { notes, played, length: ROUND * TRIAL, beat: 1 };
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
