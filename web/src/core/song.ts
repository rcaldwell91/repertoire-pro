import { copy, fill } from './copy';
import { clock } from './time';

/* Learn a song, as data: where a song's split has got to, what the song
   screen says about it, which parts can play, and the small sums behind the
   controls. No browser, no sound: tested in song.test.ts. */

export type Problem = 'signed-out' | 'offline' | 'too-big' | 'too-long' | 'not-audio' | 'busy' | 'one-at-a-time' | 'failed' | 'expired';

export type SplitPhase =
  | { phase: 'sending'; fraction: number }
  | { phase: 'waiting' }
  | { phase: 'splitting'; readyS: number; totalS: number }
  | { phase: 'saving' }
  | { phase: 'done' }
  | { phase: 'problem'; problem: Problem };

export type SongState = 'new' | 'splitting' | 'first30' | 'ready' | 'problem';

/** what a stored song has on the phone */
export interface SongHas {
  readonly state: SongState;
  readonly full: boolean;
  readonly first30: boolean;
  readonly problem?: Problem;
}

export type Action = 'sign-in' | 'try-again' | 'split' | null;

export interface Line {
  readonly text: string;
  readonly action: Action;
}

const PROBLEM_TEXT: Record<Problem, string> = {
  'signed-out': copy.song.signIn,
  offline: copy.song.offline,
  'too-big': copy.song.tooBig,
  'too-long': copy.song.tooLong,
  'not-audio': copy.song.notAudio,
  busy: copy.song.busy,
  'one-at-a-time': copy.song.busy,
  failed: copy.song.failed,
  expired: copy.song.expired,
};

/** Problems the person can do something about by trying again. A file that
    is too big, too long or not a song needs a different file. */
const RETRY: ReadonlySet<Problem> = new Set(['offline', 'busy', 'one-at-a-time', 'failed', 'expired']);

/** The one line under the title: what is happening, and what to do. */
export function songLine(has: SongHas, split: SplitPhase | null): Line {
  const p = split?.phase === 'problem' ? split.problem : has.state === 'problem' ? has.problem : undefined;
  if (p && !(split && split.phase !== 'problem')) {
    return { text: PROBLEM_TEXT[p], action: p === 'signed-out' ? 'sign-in' : RETRY.has(p) ? 'try-again' : null };
  }
  if (split) {
    switch (split.phase) {
      case 'sending':
        return { text: fill(copy.song.sending, { n: Math.floor(split.fraction * 100) }), action: null };
      case 'waiting':
        return { text: copy.song.waiting, action: null };
      case 'splitting':
        return { text: fill(copy.song.splitting, { at: clock(split.readyS), of: clock(split.totalS) }), action: null };
      case 'saving':
        return { text: copy.song.saving, action: null };
      default:
        break;
    }
  }
  if (has.full) return { text: copy.song.ready, action: null };
  if (has.first30) return { text: copy.song.first30, action: null };
  if (has.state === 'new') return { text: copy.songs.needsSplit, action: 'split' };
  if (has.state === 'splitting') return { text: copy.song.waiting, action: null };
  return { text: copy.song.failed, action: 'try-again' };
}

/** What the list says under each song. */
export function listLine(has: SongHas, split: SplitPhase | null): string {
  if (has.full) return copy.songs.ready;
  if (split && split.phase !== 'problem' && split.phase !== 'done') return copy.songs.splitting;
  if (!split && has.state === 'splitting') return copy.songs.splitting;
  if (has.first30) return copy.songs.first30;
  return copy.songs.needsSplit;
}

/** Slider (0-100) to volume: by ear, not by number. 100 is the song's own level. */
export function gainOf(slider: number): number {
  const v = Math.min(100, Math.max(0, slider)) / 100;
  return v * v;
}

/** "Repeat this part": the ten seconds just heard, ending where you are. */
export function repeatPart(at: number, total: number): { start: number; end: number } {
  const end = Math.min(total, Math.max(at, Math.min(10, total)));
  return { start: Math.max(0, end - 10), end };
}

/** A song title from a file name: no extension, underscores as spaces. */
export function titleFrom(fileName: string): string {
  const t = fileName.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t || fileName;
}
