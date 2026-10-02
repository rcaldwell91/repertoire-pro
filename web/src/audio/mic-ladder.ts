import type { MicSet } from './engine';

/* RULEBOOK 4, Mic: "Never require raw capture. Walk a ladder of constraint
   sets and remember what worked."

   First the cleanest sound a phone will give (its own echo and noise
   processing off), then the phone's usual call sound, then simply "a
   microphone". Each value is asked for, never required, so no set can be
   refused for being impossible on that phone; a set that fails for any
   other reason (the device busy, a driver error) moves on to the next.
   A refusal is the person's answer, and the ladder stops there. */
export const MIC_LADDER: readonly MicSet[] = [
  { name: 'clean', echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  { name: 'phone', echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  { name: 'plain' },
];

/** The order to try: the set that worked last time first, then the rest. */
export function ladderOrder(remembered: number | null, size = MIC_LADDER.length): number[] {
  const all = Array.from({ length: size }, (_, i) => i);
  if (remembered == null || remembered < 0 || remembered >= size) return all;
  return [remembered, ...all.filter((i) => i !== remembered)];
}
