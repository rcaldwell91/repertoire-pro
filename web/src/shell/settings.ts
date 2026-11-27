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

/* Match the tone (Robert, 4 Nov): Hear yourself on by default, the wobble
   being easiest to hear with your voice and the tone both in your ears;
   remembered for it alone once changed there */
const TONE_HEAR = 'rp.hear.matchtone';
export function hearOnFor(id: string): boolean {
  if (id !== 'matchtone') return hearOn();
  const v = localStore().get(TONE_HEAR);
  return v == null ? true : v === '1';
}
export function setHearOnFor(id: string, on: boolean): void {
  if (id !== 'matchtone') return setHearOn(on);
  localStore().set(TONE_HEAR, on ? '1' : '0');
}

/* Sing the interval's song cues (Robert, 13 Nov): each shape's cue shows the
   first three times that shape comes, counted on this phone */
const CUES = 'rp.cue.';
export const CUE_TIMES = 3;
export function cueSeen(shape: string): number {
  const v = Number(localStore().get(CUES + shape) ?? 0);
  return Number.isFinite(v) ? v : 0;
}
export function seeCue(shape: string): void {
  localStore().set(CUES + shape, String(cueSeen(shape) + 1));
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

/** the vowel an exercise is sung on, for one that offers a choice
    (Vibrato, 24 Nov), remembered for that exercise; its first if none */
export function vowelFor(id: string, vowels: readonly string[]): string {
  const v = localStore().get('rp.vowel.' + id);
  return v && vowels.includes(v) ? v : vowels[0];
}
export function setVowelFor(id: string, v: string): void {
  localStore().set('rp.vowel.' + id, v);
}

/** Sing the interval's level (which jumps), remembered (Robert, 28 Oct) */
export function jumpLevel(): 1 | 2 | 3 {
  const v = Number(localStore().get('rp.interval.level'));
  return v === 2 || v === 3 ? v : 1;
}
export function setJumpLevel(v: 1 | 2 | 3): void {
  localStore().set('rp.interval.level', String(v));
}

/** an exercise's level, for one with levels inside it (Robert, 3 Nov),
    remembered for that exercise alone; its lowest until one is picked */
export function levelFor(id: string): 1 | 2 | 3 | null {
  const v = Number(localStore().get('rp.level.' + id));
  return v === 1 || v === 2 || v === 3 ? v : null;
}
export function setLevelFor(id: string, v: 1 | 2 | 3): void {
  localStore().set('rp.level.' + id, String(v));
}

/** which tension reminder comes next: one more each time an exercise starts */
export function reminderTurn(): number {
  const v = Number(localStore().get('rp.tension.turn'));
  return Number.isFinite(v) && v >= 0 ? v : 0;
}
export function nextReminderTurn(): void {
  localStore().set('rp.tension.turn', String(reminderTurn() + 1));
}

/** Practise a line (27 Nov): the line being worked on in each song, kept
    on this phone so Practise a line and Speak it, then sing it share it,
    and it is still picked next time */
export function lineFor(songId: string): { from: number; to: number } | null {
  try {
    const v = JSON.parse(localStore().get('rp.line.' + songId) ?? 'null') as { from?: unknown; to?: unknown } | null;
    return v && typeof v.from === 'number' && typeof v.to === 'number' ? { from: v.from, to: v.to } : null;
  } catch {
    return null;
  }
}
export function setLineFor(songId: string, c: { from: number; to: number }): void {
  localStore().set('rp.line.' + songId, JSON.stringify({ from: c.from, to: c.to }));
}

/** the exercise sound picked for Practise a line's second step; Lip trills until one is */
export function lineSound<T extends string>(sounds: readonly T[]): T {
  const v = localStore().get('rp.line.sound');
  return (sounds as readonly string[]).includes(v ?? '') ? (v as T) : sounds[0];
}
export function setLineSound(v: string): void {
  localStore().set('rp.line.sound', v);
}
