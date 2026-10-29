import type { MicBlock } from './engine';
import { Resampler, TAKE_RATE, toInt16 } from '../core/resample';

/* The one recorder (RULEBOOK 4, Mic: "One mic, one recorder"), held by the
   conductor. It keeps what the mic hears and nothing else - never the
   music - made smaller as it goes, and where in the song its first sample
   was heard. */

/** a take can be at most this long: the takes store holds up to 25 MB */
export const TAKE_MAX_S = 590;

export interface Recording {
  readonly rate: number;
  readonly chunks: readonly Int16Array[];
  readonly seconds: number;
  /** the point in the song its first sample goes with */
  readonly songAt: number;
}

export class Recorder {
  private rs: Resampler | null = null;
  private readonly chunks: Int16Array[] = [];
  private n = 0;
  private start: number | null = null;

  /** a block from the mic; `songTime` places an engine time in the song */
  push(b: MicBlock, songTime: (at: number) => number | null): void {
    if (this.n >= TAKE_MAX_S * TAKE_RATE) return;
    if (this.start == null) {
      const s = songTime(b.end - (b.samples.length - 1) / b.sampleRate);
      if (s == null) return;                 /* heard before the song began */
      this.start = s;
      this.rs = new Resampler(b.sampleRate);
    }
    const out = toInt16((this.rs as Resampler).push(b.samples));
    if (out.length) {
      this.chunks.push(out);
      this.n += out.length;
    }
  }

  finish(): Recording | null {
    if (this.start == null || !this.n) return null;
    return { rate: TAKE_RATE, chunks: this.chunks, seconds: this.n / TAKE_RATE, songAt: this.start };
  }
}

/** Stretches of one exercise, paused and resumed, as one take: each in its
    place in the exercise, a later one sung over an earlier one from where it
    begins, silence in any gap (Robert, 28 Oct). */
export function joinTakes(recs: readonly Recording[]): Recording | null {
  if (!recs.length) return null;
  if (recs.length === 1) return recs[0];
  const rate = recs[0].rate;
  const base = Math.min(...recs.map((r) => r.songAt));
  let out = new Int16Array(0);
  for (const r of recs) {
    const at = Math.round((r.songAt - base) * rate);
    let n = 0;
    r.chunks.forEach((c) => (n += c.length));
    const next = new Int16Array(Math.min(at + n, TAKE_MAX_S * rate));
    next.set(out.subarray(0, Math.min(at, out.length, next.length)));
    let k = at;
    for (const c of r.chunks) {
      if (k >= next.length) break;
      next.set(c.subarray(0, next.length - k), k);
      k += c.length;
    }
    out = next;
  }
  return { rate, chunks: [out], seconds: out.length / rate, songAt: base };
}
