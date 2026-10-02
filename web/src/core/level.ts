/* How full the voice bar is. The mic level is a loudness (RMS, 0 to 1);
   the ear hears in decibels, so the bar runs from -60 dB (empty) to 0 dB
   (full) and a normal speaking voice sits in the middle, not at the floor. */
export const FLOOR_DB = -60;

export function barFill(rms: number): number {
  if (!(rms > 0)) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB));
}
