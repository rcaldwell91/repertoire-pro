import type { MicSet } from './engine';

/* RULEBOOK 4, Mic, and Sound, Android 11: ask for the mic once, raw.

   The old app's final rule (v9.4, next.html startMic): pitch wants the raw
   mic - its echo, noise and gain processing chew up a sustained note - and
   asking for processed sound makes a Samsung flip into call mode, send the
   sound out the wrong way and stall the clock. So one request, for raw, and
   never another mode by itself (v8.1's automatic ladder is what thrashed
   Robert's phone in September). The other modes are the old app's own, and
   are reached only by a hand tap ("Try another mode" in the Sound check);
   only that hand choice is remembered. */
export const MIC_MODES: readonly MicSet[] = [
  { name: 'raw', echoCancellation: false, noiseSuppression: false, autoGainControl: false, exact: true, lowestLatency: true },
  { name: 'phone' },
  { name: 'processed', echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  { name: 'basic', echoCancellation: false },
];

/** a remembered hand choice; anything else is raw */
export function modeIndex(stored: string | null): number {
  const n = stored == null ? NaN : Number(stored);
  return Number.isInteger(n) && n >= 0 && n < MIC_MODES.length ? n : 0;
}
