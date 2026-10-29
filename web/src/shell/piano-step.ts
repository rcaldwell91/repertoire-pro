import type { Plan } from '../audio/conductor/conductor';
import { pianoFor } from '../core/piano';

/** the reference piano's volume */
export const PIANO_GAIN = 0.8;

type Timed = { readonly m: number; readonly t: number; readonly d: number };

/** An exercise's piano notes as one step the conductor plays together,
    from `from` seconds in; with `take`, a recording heard over them from
    where it was sung (an exercise's take, Robert 28 Oct). */
export function pianoStep(notes: readonly Timed[], opts: { listen?: boolean; monitor?: number; record?: boolean; from?: number;
  take?: { url: string; songAt: number } } = {}): Plan['steps'][number] {
  const keys = notes.map((n) => pianoFor(n.m));
  const take = opts.take;
  return { kind: 'song', urls: [...keys.map((k) => k.file), ...(take ? [take.url] : [])], from: opts.from ?? 0,
    gains: [...notes.map(() => PIANO_GAIN), ...(take ? [1] : [])], starts: [...notes.map((n) => n.t), ...(take ? [take.songAt] : [])],
    rates: [...keys.map((k) => k.rate), ...(take ? [1] : [])], lengths: notes.map((n) => n.d), untilLast: true,
    listen: !!opts.listen, record: !!opts.record, level: 1, monitor: opts.monitor ?? 0 };
}
