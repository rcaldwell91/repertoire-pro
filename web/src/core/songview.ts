import { cleanLine } from './notemap';

/* Learn a song's view (Robert, 22 Nov: "one map everywhere, so singers
   learn where their voice sits"): the same spacing as Train's map, never
   zooming, sliding up and down with the song's notes. It moves a moment
   before the song does, so the next phrase is already in view when it
   starts, and never so that a note about to be sung is off screen.

   The whole path is worked out once from the singer's line, as a function
   of song time: the view stays put while every note in the next LOOK
   seconds sits inside it, EDGE half steps clear of its top and bottom.
   When one wouldn't, it glides over GLIDE seconds to a place that holds as
   much of the song from there on as fits, so it moves as seldom as it can.
   During the glide, the notes being sung are inside both where it was and
   where it goes, so they stay in view throughout. Nothing else changes:
   the lines, the bubbles and the scoring are the song's, as before. */

/** seconds ahead whose notes must already be in view */
export const LOOK = 2;
/** seconds a move takes */
export const GLIDE = 0.6;
/** half steps kept clear above and below the notes in view */
export const EDGE = 1;
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
export function songView(line: ArrayLike<number>, hop: number, span: number): SongView {
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
  const room = Math.max(0, span - 2 * EDGE);
  /* the notes from step i to step j (inclusive), or null if none */
  const reach = (i: number, j: number): [number, number] | null => {
    let a = Infinity, b = -Infinity;
    for (let k = Math.max(0, i); k <= Math.min(n - 1, j); k++) {
      if (lo[k] < a) a = lo[k];
      if (hi[k] > b) b = hi[k];
    }
    return a <= b ? [a, b] : null;
  };
  /* from step i on, as far as fits in the room: the middle that holds it */
  const fitFrom = (i: number): number | null => {
    let a = Infinity, b = -Infinity, seen = false;
    for (let k = Math.max(0, i); k < n; k++) {
      if (!Number.isFinite(lo[k])) continue;
      const na = Math.min(a, lo[k]), nb = Math.max(b, hi[k]);
      if (seen && nb - na > room) break;
      a = na;
      b = nb;
      seen = true;
    }
    return seen ? (a + b) / 2 : null;
  };
  /* what must be in view at step i: the next LOOK seconds, as much of them
     as fits (a leap wider than the view: the nearer notes first) */
  const ahead = Math.round(LOOK / dt), back = Math.round(GLIDE / dt);
  const need = (i: number): [number, number] | null => {
    let j = i + ahead;
    let r = reach(i, j);
    while (r && r[1] - r[0] > room && j > i) r = reach(i, --j);
    return r;
  };
  const inside = (mid: number, r: [number, number]) => r[0] >= mid - span / 2 + EDGE - 1e-6 && r[1] <= mid + span / 2 - EDGE + 1e-6;

  const first = fitFrom(0);
  const start = first ?? 60;
  const moves: Move[] = [];
  let mid = start;
  let free = -Infinity;
  for (let i = 0; i < n; i++) {
    const r = need(i);
    if (!r || inside(mid, r)) continue;
    /* where it goes: what is sung from GLIDE before step i on, as far as
       fits, when that holds what's needed; else from step i on */
    const g = Math.max(0, i - back);
    const early = fitFrom(g);
    const to = (early != null && inside(early, r) ? early : fitFrom(i)) ?? mid;
    /* the glide: GLIDE long, ending by step i (LOOK before the notes it is
       for), but never while a note it would push off screen is still sung,
       and always done by the first note that needs it */
    const off = (k: number, m0: number) => Number.isFinite(lo[k]) && (lo[k] < m0 - span / 2 || hi[k] > m0 + span / 2);
    let due = i;
    while (due < n && !(Number.isFinite(lo[due]) && !inside(mid, [lo[due], hi[due]]))) due++;
    let last = -1;
    for (let k = Math.min(due, n) - 1; k >= Math.max(0, Math.ceil(free / dt)); k--) if (off(k, to)) { last = k; break; }
    const a = Math.min(due * dt, Math.max(g * dt, free, (last + 1) * dt));
    const b = Math.min(due * dt, Math.max(i * dt, a + GLIDE));
    moves.push({ a, b, from: mid, to });
    mid = to;
    free = b;
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
