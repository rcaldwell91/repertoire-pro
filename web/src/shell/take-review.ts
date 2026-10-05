import type { Take } from '../audio/conductor/conductor';
import { wav } from '../core/resample';
import { rightPct } from '../core/takes';
import type { StoredTake } from '../data/takes';
import { yourLine } from './your-line';

/* A take just made, before the singer says what to do with it: the
   recording (from the conductor), your line as it was drawn, and its
   right-note % - worked out once. */

/** a take shorter than this is a slip of the finger, not a take */
export const MIN_TAKE_S = 1;

export interface Review {
  readonly take: Take;
  readonly audio: Blob;
  readonly url: string;
  readonly t: Float32Array;
  readonly m: Float32Array;
  readonly anyOctave: boolean;
  readonly rightPct: number | null;
}

const cache = new WeakMap<Take, Review>();

export function review(take: Take | null, singer: ArrayLike<number> | null, hop: number, anyOctave: boolean): Review | null {
  if (!take || take.seconds < MIN_TAKE_S) return null;
  let r = cache.get(take);
  if (!r) {
    const line = yourLine(take.owner);
    /* your line, only where the take has sound */
    const keep = line.t.map((t, i) => (t >= take.songAt && t <= take.songAt + take.seconds ? i : -1)).filter((i) => i >= 0);
    const t = Float32Array.from(keep, (i) => line.t[i]);
    const m = Float32Array.from(keep, (i) => line.m[i]);
    const audio = new Blob([wav(take.chunks, take.rate)], { type: 'audio/wav' });
    r = { take, audio, url: URL.createObjectURL(audio), t, m, anyOctave,
      rightPct: singer ? rightPct(t, m, singer, hop, anyOctave) : null };
    cache.set(take, r);
  }
  return r;
}

/** the review, as a take to keep */
export function toStored(r: Review, songId: string, songTitle: string): Omit<StoredTake, 'sendTo' | 'sent'> {
  return { id: crypto.randomUUID(), songId, songTitle, created: Date.now(), audio: r.audio, seconds: r.take.seconds,
    songAt: r.take.songAt, line: { t: r.t, m: r.m }, anyOctave: r.anyOctave, rightPct: r.rightPct };
}
