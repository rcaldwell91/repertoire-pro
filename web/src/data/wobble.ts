import { localStore } from '../shell/env';
import { wobbleLast, type WobbleLast } from '../core/results';
import { accountResults } from './results';
import { overall, type Hold } from '../core/vibrato';

/* Vibrato's numbers from last time (24 Nov), kept on this phone; since
   Robert's 25 Nov answer also saved to the account with the result (its
   own columns), and last time comes from the account when signed in, from
   this phone when not. Sessions kept only on this phone stay as they are.
   Only what was measured: the speed and width over every held note that
   wobbled. */
export interface LastWobble {
  readonly at: string;
  readonly rate: number;
  readonly width: number;
}
const key = (id: string) => 'rp.wobble.' + id;

/** the speed and width over these holds (in the core since 25 Nov, for the account's row too) */
export { overall };

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

/** last time, read when the page opens: the account's newest when signed
    in, this phone's when not (Robert, 25 Nov) */
export async function lastWobbleNow(id: string): Promise<WobbleLast | null> {
  return wobbleLast(await accountResults(id), lastWobbleFor(id));
}
