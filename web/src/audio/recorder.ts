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
