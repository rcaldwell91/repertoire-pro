import { localStore } from '../shell/env';
import type { Hold } from '../core/vibrato';

/* Vibrato's numbers from last time (24 Nov), kept on this phone. Not
   online: the results table has no place for a speed, and its tables
   aren't changed without Robert. Only what was measured: the speed and
   width over every held note that wobbled. */
export interface LastWobble {
  readonly at: string;
  readonly rate: number;
  readonly width: number;
}
const key = (id: string) => 'rp.wobble.' + id;

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** the speed and width over these holds, where any wobbled; null if none did */
export function overall(holds: readonly Hold[]): { rate: number; width: number } | null {
  const w = holds.filter((h) => h.rate != null && h.width != null);
  return w.length ? { rate: median(w.map((h) => h.rate as number)), width: median(w.map((h) => h.width as number)) } : null;
}

export function lastWobbleFor(id: string): LastWobble | null {
  try {
    const v = JSON.parse(localStore().get(key(id)) ?? 'null');
    return v && typeof v.rate === 'number' && typeof v.width === 'number' ? v : null;
  } catch {
    return null;
  }
}

/** kept straight away; a session with no wobble leaves last time as it was */
export function keepWobble(id: string, holds: readonly Hold[]): void {
  const o = overall(holds);
  if (!o) return;
  localStore().set(key(id), JSON.stringify({ at: new Date().toISOString(), rate: o.rate, width: o.width } satisfies LastWobble));
}
