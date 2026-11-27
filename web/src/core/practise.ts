import { cleanLine } from './notemap.ts';
import { rightPct } from './takes.ts';

/* Practise a line, Speak it then sing it, and the Before take (Robert's
   song features, approved 16 Nov, built 27 Nov), as numbers. No browser,
   no sound: tested in practise.test.ts.

   A song's lines come from the singer's line, as the app read it from the
   song's own voice (nothing is sourced: no lyrics, only what the singer
   added). A line is a stretch of singing between rests: a silence of GAP
   or more ends it. One too short to practise on its own (under MIN_LINE
   from its first note to its last) joins the neighbour it is nearest; one
   too long (over MAX_LINE) is cut at its longest breath. Each is played
   from a moment before its first note (LEAD) to a moment after its last
   (TAIL), never into the line before or after. Measured on two real songs'
   lines as the app read them (tests/lab-lines.mjs, 27 Nov): a silence of
   0.6 s left lines of up to 15 s, two lines of the words in one; 0.45 s,
   with long ones cut at their longest breath, left All of Me 48 lines and
   Ride 41, most 2 to 8 s long (the longest 11 to 14 s, sung without a
   break). The breaths were not checked against the words: there are none
   to check against, only what the singer sang. */

/** a silence this long between notes ends a line, in seconds */
export const GAP = 0.45;
/** a line shorter than this, first note to last, joins its nearest neighbour */
export const MIN_LINE = 1.5;
/** a line longer than this is cut at its longest breath */
export const MAX_LINE = 8;
/** a breath at least this long can cut a line that is too long */
export const MIN_BREATH = 0.1;
/** heard before a line's first note, and after its last */
export const LEAD = 0.5;
export const TAIL = 0.4;
/** never closer than this to the line before or after */
const CLEAR = 0.1;

export interface Stretch {
  readonly start: number;
  readonly end: number;
}

/** The song's lines, in order: each one's notes, first to last, in seconds. */
export function sungLines(singer: ArrayLike<number>, hop: number): Stretch[] {
  const clean = cleanLine(singer);
  const out: Array<{ a: number; b: number }> = [];
  let a = -1, b = -1;
  const gap = Math.round(GAP / hop);
  for (let k = 0; k < clean.length; k++) {
    if (!Number.isFinite(clean[k])) continue;
    if (a < 0) a = k;
    else if (k - b > gap) {
      out.push({ a, b });
      a = k;
    }
    b = k;
  }
  if (a >= 0) out.push({ a, b });
  /* too short: into the nearer neighbour, until none is */
  for (;;) {
    const i = out.findIndex((x) => (x.b - x.a) * hop < MIN_LINE);
    if (i < 0 || out.length < 2) break;
    const before = i > 0 ? out[i].a - out[i - 1].b : Infinity;
    const after = i < out.length - 1 ? out[i + 1].a - out[i].b : Infinity;
    const j = before <= after ? i - 1 : i + 1;
    const lo = Math.min(i, j);
    out.splice(lo, 2, { a: out[lo].a, b: out[lo + 1].b });
  }
  /* too long: cut at the longest breath, until none is */
  const cut = (x: { a: number; b: number }): Array<{ a: number; b: number }> => {
    if ((x.b - x.a) * hop <= MAX_LINE) return [x];
    let best = -1, len = 0;
    let last = x.a;
    for (let k = x.a + 1; k <= x.b; k++) {
      if (!Number.isFinite(clean[k])) continue;
      const g = k - last;
      /* a cut that leaves both sides long enough to practise */
      if (g > len && (last - x.a) * hop >= MIN_LINE && (x.b - k) * hop >= MIN_LINE) {
        len = g;
        best = k;
      }
      last = k;
    }
    if (best < 0 || len * hop < MIN_BREATH) return [x];
    let end = best - 1;
    while (end > x.a && !Number.isFinite(clean[end])) end--;
    return [...cut({ a: x.a, b: end }), ...cut({ a: best, b: x.b })];
  };
  return out.flatMap(cut).map((x) => ({ start: x.a * hop, end: x.b * hop }));
}

/** The lines as they are played: from a moment before the first note to a
    moment after the last, never into the line before or after, nor past
    the song (`total` seconds). */
export function songLines(singer: ArrayLike<number>, hop: number, total: number): Stretch[] {
  const sung = sungLines(singer, hop);
  return sung.map((x, i) => {
    const prev = i > 0 ? sung[i - 1].end + CLEAR : 0;
    const next = i < sung.length - 1 ? sung[i + 1].start - CLEAR : total;
    return { start: round2(Math.max(0, prev, x.start - LEAD)), end: round2(Math.min(total, next, x.end + TAIL)) };
  });
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** The chosen stretch: lines `from` to `to` (a longer stretch is several lines). */
export interface Chosen {
  readonly from: number;
  readonly to: number;
}

/** the line at a point on the song's timeline: the one it is in, else the next, else the last */
export function lineAt(lines: readonly Stretch[], t: number): number {
  if (!lines.length) return -1;
  const i = lines.findIndex((l) => t < l.end);
  return i < 0 ? lines.length - 1 : i;
}

/** what is played for a choice */
export function stretchOf(lines: readonly Stretch[], c: Chosen): Stretch | null {
  const a = lines[c.from], b = lines[c.to];
  return a && b && c.to >= c.from ? { start: a.start, end: b.end } : null;
}

/** a choice kept from an earlier visit, made to fit the lines as they are now */
export function fit(lines: readonly Stretch[], c: Chosen | null): Chosen | null {
  if (!lines.length) return null;
  if (!c || !Number.isInteger(c.from) || !Number.isInteger(c.to) || c.from < 0 || c.to < c.from || c.to >= lines.length) return { from: 0, to: 0 };
  return c;
}

/** the next line on its own; the last stays the last */
export function nextLine(lines: readonly Stretch[], c: Chosen): Chosen {
  const i = Math.min(lines.length - 1, c.to + 1);
  return { from: i, to: i };
}

export function prevLine(c: Chosen): Chosen {
  const i = Math.max(0, c.from - 1);
  return { from: i, to: i };
}

/** a longer stretch: the next line added on */
export function longer(lines: readonly Stretch[], c: Chosen): Chosen {
  return { from: c.from, to: Math.min(lines.length - 1, c.to + 1) };
}

/* ------------------------------------------------------------------ */

/** Practise a line's three steps, in order, each sung twice (Robert). */
export const STEPS = ['notes', 'sound', 'words'] as const;
export type StepId = (typeof STEPS)[number];
export const PASSES = 2;
/** the exercise sounds to pick from: Train's own, as Train has them */
export const SOUNDS = ['liptrill', 'mum', 'straw'] as const;
export type SoundId = (typeof SOUNDS)[number];

export interface Sung {
  readonly t: ArrayLike<number>;
  readonly m: ArrayLike<number>;
}

/** The two passes, from your line as it stands when the run ends. Each
    time the line comes round again, the time round before is kept as a
    round (shell/your-line), so: a round kept since the second pass began
    is the first pass, and what is on the line now is the second. With no
    round kept then (one of the passes had nothing sung), the line is cut
    where the second pass began: `mark` points into it, and `roundsAtMark`
    rounds kept by then. `reached` is how many passes were played. */
export function splitPasses(rounds: readonly Sung[], now: Sung, mark: number | null, roundsAtMark: number, reached: number): Sung[] {
  const slice = (x: Sung, a: number, b: number): Sung => ({ t: Array.from(x.t).slice(a, b), m: Array.from(x.m).slice(a, b) });
  if (reached < 2 || mark == null) return [slice(now, 0, now.t.length)];
  if (rounds.length > roundsAtMark) return [rounds[rounds.length - 1], slice(now, 0, now.t.length)];
  return [slice(now, 0, mark), slice(now, mark, now.t.length)];
}

/** Each pass's right notes, %, the way Learn a song scores a take (core/takes):
    only your notes inside the stretch; null for a pass with too little sung. */
export function passScores(passes: readonly Sung[], s: Stretch,
  singer: ArrayLike<number>, hop: number, anyOctave: boolean): Array<number | null> {
  return passes.map((p) => {
    const keep: number[] = [];
    for (let i = 0; i < p.t.length; i++) if (p.t[i] >= s.start && p.t[i] <= s.end) keep.push(i);
    return rightPct(keep.map((i) => p.t[i]), keep.map((i) => p.m[i]), singer, hop, anyOctave);
  });
}

/* ------------------------------------------------------------------ */

/** The Before of a song's takes: the one the singer chose, if it is still
    there, else the first one saved. Null with no takes. */
export function beforeOf<T extends { id: string; created: number }>(takes: readonly T[], chosen: string | null): T | null {
  if (!takes.length) return null;
  const picked = chosen ? takes.find((t) => t.id === chosen) : undefined;
  if (picked) return picked;
  return takes.reduce((a, b) => (b.created < a.created ? b : a));
}
