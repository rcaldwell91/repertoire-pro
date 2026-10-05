/* Turning pitch readings into a line, the old app's way (rp-filemap.js):
   an octave anchor from the pitch model, and gaps of 0.15 s or less bridged
   when both sides are within six semitones. (The median of five is in
   core.ts.) */

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

export const GAP_MAX = 3;       /* 0.15 s at twenty points a second */
export const GAP_STEP = 6;      /* the leap the drawing breaks the line on */

/** Gaps of 0.15 s or less bridged, when both sides are within six
    semitones (the old app's rule), on a line (NaN where nobody sings), in
    place, over its first `upTo` points. */
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
