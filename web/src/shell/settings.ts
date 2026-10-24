import { MONITOR_DEFAULT } from '../core/song';
import { localStore } from './env';

/* Sound settings remembered on this phone, shared by Learn a song's sound
   card and an exercise's sound sheet (Robert, 24 Oct), so one switch means
   the same thing everywhere. The count-in sound is the conductor's own. */

/** whether Hear yourself is on (the old app's rep_monitor; Robert, 23 Oct) */
export const MONITOR_ON = 'rp.monitor.on';
/** the Hear yourself volume, 0 to 100 (the old app's rep_monitor_vol) */
export const MONITOR_VOL = 'rp.monitor.vol';

export function hearOn(): boolean {
  return localStore().get(MONITOR_ON) === '1';
}
export function setHearOn(on: boolean): void {
  localStore().set(MONITOR_ON, on ? '1' : '0');
}

export function hearVolume(): number {
  const v = Number(localStore().get(MONITOR_VOL) ?? NaN);
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : MONITOR_DEFAULT;
}
export function setHearVolume(v: number): void {
  localStore().set(MONITOR_VOL, String(v));
}

/** Any octave on an exercise: off unless switched on, remembered for that
    exercise alone (Robert, 24 Oct) */
export function anyOctaveFor(id: string): boolean {
  return localStore().get('rp.anyOctave.' + id) === '1';
}
export function setAnyOctaveFor(id: string, on: boolean): void {
  localStore().set('rp.anyOctave.' + id, on ? '1' : '0');
}
