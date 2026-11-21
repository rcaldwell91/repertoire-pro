import { cleanLine } from './notemap.ts';

/* Learn a song's view (Robert, 22 Nov: "one map everywhere, so singers
   learn where their voice sits"): the same spacing as Train's map, never
   zooming, sliding up and down with the song's notes. It moves a moment
   before the song does, so the next phrase is already in view when it
   starts, and never so that a note about to be sung is off screen.

   The whole path is worked out once from the singer's line, as a function
   of song time. At every moment there is a range of places for the view
   that keeps every note of the next LOOK seconds inside it (EDGE half steps
   clear of its top and bottom where there's room; with a leap wider than
   the view, the nearer notes first). The view stays put while it is in
   that range. When it would leave it, it goes to the place that stays in
   range the longest, so it moves as seldom as it can, gliding over up to
   GLIDE seconds through moments where both where it was and where it goes
   are in range, so everything in view stays in view along the way (the
   notes being sung included). With no room to glide (the note just sung
   and the next ones won't share the view) it moves at once, so those come
   into view as early as they can. Nothing else changes: the lines, the
   bubbles and the scoring are the song's, as before. */

/** seconds ahead whose notes must already be in view */
export const LOOK = 2;
/** seconds a move takes */
export const GLIDE = 0.6;
/** half steps kept clear above and below the notes in view, where there
    is room (the line's own half thickness is a sixth of a half step) */
export const EDGE = 0.5;
/** the time step the path is worked out on */
const STEP = 0.05;

export interface Move {
  /** song time the glide starts and ends */
  readonly a: number;
  readonly b: number;
  /** the view's middle before and after, in half steps */
  readonly from: number;
  readonly to: number;
}

export interface SongView {
  /** the view's middle at a song time */
  mid(t: number): number;
  readonly moves: readonly Move[];
  /** how many half steps the view holds */
  readonly span: number;
}

/** the path of the view's middle for a singer's line, `span` half steps tall */
export function songView(line: ArrayLike<number>, hop: number, span: number,
  /* for measuring other settings only (tests/lab-songmap) */
  opts: { look?: number; edge?: number } = {}): SongView {
  const LOOK_S = opts.look ?? LOOK, EDGE_H = opts.edge ?? EDGE;
  const clean = cleanLine(line);
  /* each time step's lowest and highest note, NaN where nobody sings */
  const per = Math.max(1, Math.round(STEP / hop));
  const n = Math.ceil(clean.length / per);
  const lo = new Float32Array(n).fill(NaN), hi = new Float32Array(n).fill(NaN);
  for (let i = 0; i < clean.length; i++) {
    const m = clean[i];
    if (!Number.isFinite(m)) continue;
    const k = Math.floor(i / per);
    if (!(m >= lo[k])) lo[k] = m;
    if (!(m <= hi[k])) hi[k] = m;
  }
  const dt = per * hop;
  /* the notes from step i to step j (inclusive), or null if none */
  const reach = (i: number, j: number): [number, number] | null => {
    let a = Infinity, b = -Infinity;
    for (let k = Math.max(0, i); k <= Math.min(n - 1, j); k++) {
      if (lo[k] < a) a = lo[k];
      if (hi[k] > b) b = hi[k];
    }
    return a <= b ? [a, b] : null;
  };
  /* what must be in view at step i: the next LOOK seconds, as much of them
     as the view holds (a leap wider than the view: the nearer notes first) */
  const ahead = Math.round(LOOK_S / dt), back = Math.round(GLIDE / dt);
  const need = (i: number): [number, number] | null => {
    let j = i + ahead;
    let r = reach(i, j);
    while (r && r[1] - r[0] > span && j > i) r = reach(i, --j);
    return r;
  };
  /* where the view's middle may be at each step so that holds: EDGE clear of
     its top and bottom where there is room for that, else just inside */
  const okLo = new Float64Array(n).fill(-Infinity), okHi = new Float64Array(n).fill(Infinity);
  for (let i = 0; i < n; i++) {
    const r = need(i);
    if (!r) continue;
    const e = Math.max(0, Math.min(EDGE_H, (span - (r[1] - r[0])) / 2));
    okLo[i] = r[1] + e - span / 2;
    okHi[i] = r[0] - e + span / 2;
  }
  const ok = (k: number, m: number) => m >= okLo[k] - 1e-6 && m <= okHi[k] + 1e-6;
  /* a place that is right from step s to step i and stays right for as
     long as one can after: the middle of what every one of those steps
     allows, until they no longer meet; NaN if s to i don't meet */
  const placeFrom = (s: number, i: number): number => {
    let a = -Infinity, b = Infinity;
    for (let k = s; k < n; k++) {
      const na = Math.max(a, okLo[k]), nb = Math.min(b, okHi[k]);
      /* (when the notes just fill the view there is one place, so a
         rounding hair either way is still that place) */
      if (na > nb + 1e-6) {
        if (k <= i) return NaN;
        break;
      }
      a = Math.min(na, nb);
      b = Math.max(na, nb);
    }
    if (a === -Infinity && b === Infinity) return NaN;
    if (a === -Infinity) return b - span / 2 + EDGE_H;
    if (b === Infinity) return a + span / 2 - EDGE_H;
    return (a + b) / 2;
  };

  const first = placeFrom(0, 0);
  const start = Number.isFinite(first) ? first : 60;
  const moves: Move[] = [];
  let mid = start;
  let freeK = 0;
  for (let i = 0; i < n; i++) {
    if (ok(i, mid)) continue;
    /* where it goes is right over the glide too, the notes sung during it
       included, so everything in view along the way stays in view: the
       longest glide, up to GLIDE, that allows that, ending at step i */
    let s = Math.max(freeK, i - back), to = NaN;
    for (; s <= i; s++) if (Number.isFinite((to = placeFrom(s, i)))) break;
    if (!Number.isFinite(to)) continue;
    /* no room to glide before it (the note just sung and the far one won't
       share the view): it moves at once, so the far note is in view as
       early as it can be (Robert, 22 Nov: never so that a note about to be
       sung is off screen) */
    moves.push({ a: s * dt, b: i * dt, from: mid, to });
    mid = to;
    freeK = i;
  }
  return {
    span,
    moves,
    mid(t: number): number {
      let m = start;
      for (const v of moves) {
        if (t >= v.b) m = v.to;
        else if (t > v.a) {
          const x = (t - v.a) / (v.b - v.a);
          return v.from + (v.to - v.from) * x * x * (3 - 2 * x);
        } else break;
      }
      return m;
    },
  };
}
