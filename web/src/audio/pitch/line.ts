/* Turning pitch readings into a line, the old app's way (rp-filemap.js):
   an octave anchor from the pitch model, a median of five that starts again
   after every gap, and gaps of 0.15 s or less bridged when both sides are
   within six semitones. Shared by every pitch method, file and mic. */

export interface Point {
  t: number;
  m: number | null;
}

export interface Anchors {
  /** seconds between anchors */
  readonly step: number;
  readonly midi: Float32Array;
  readonly conf: Float32Array;
}

/** Move m by whole octaves onto the model's anchor, when the anchor is sure
    and m is more than four semitones from it. */
export function anchored(m: number, t: number, anc: Anchors | null): number {
  if (!anc) return m;
  const ai = Math.round(t / anc.step);
  if (ai < 0 || ai >= anc.midi.length || anc.conf[ai] < 0.5) return m;
  const am = anc.midi[ai];
  for (const k of [-24, -12, 12, 24]) {
    if (Math.abs(m + k - am) < 1.5 && Math.abs(m - am) > 4) return m + k;
  }
  return m;
}

/** The median of the last five readings; a gap starts it again. */
export class Median5 {
  private hist: number[] = [];
  push(m: number | null): number | null {
    if (m == null) {
      this.hist.length = 0;
      return null;
    }
    this.hist.push(m);
    if (this.hist.length > 5) this.hist.shift();
    const s = [...this.hist].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  }
}

export const GAP_MAX = 3;       /* 0.15 s at twenty points a second */
export const GAP_STEP = 6;      /* the leap the drawing breaks the line on */

export function bridge(points: Point[], gapMax = GAP_MAX): Point[] {
  const n = points.length;
  for (let i = 0; i < n; i++) {
    if (points[i].m != null) continue;
    const a = i - 1;
    if (a < 0 || points[a].m == null) continue;
    let j = i;
    while (j < n && points[j].m == null) j++;
    if (j >= n) break;
    if (j - i > gapMax || Math.abs((points[j].m as number) - (points[a].m as number)) > GAP_STEP) {
      i = j - 1;
      continue;
    }
    const m0 = points[a].m as number, m1 = points[j].m as number;
    for (let k = i; k < j; k++) points[k].m = +(m0 + ((m1 - m0) * (k - a)) / (j - a)).toFixed(2);
    i = j - 1;
  }
  return points;
}

/** The same bridging on a stored line (NaN where nobody sings), in place,
    over its first `upTo` points. */
export function bridgeLine(m: Float32Array, upTo = m.length, gapMax = GAP_MAX): Float32Array {
  for (let i = 1; i < upTo; i++) {
    if (Number.isFinite(m[i]) || !Number.isFinite(m[i - 1])) continue;
    let j = i;
    while (j < upTo && !Number.isFinite(m[j])) j++;
    if (j >= upTo) break;
    const a = i - 1, m0 = m[a], m1 = m[j];
    if (j - i <= gapMax && Math.abs(m1 - m0) <= GAP_STEP) {
      for (let k = i; k < j; k++) m[k] = m0 + ((m1 - m0) * (k - a)) / (j - a);
    }
    i = j - 1;
  }
  return m;
}
