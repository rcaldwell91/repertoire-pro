import { FIRST_SECONDS, JOB_KEEP_MS, MAX_BYTES, MAX_SECONDS } from '../core/limits';
import type { Problem, SplitPhase } from '../core/song';
import { accessToken, onUser } from './auth';
import { durationOf } from './media';
import { collect, SplitError, status, upload } from './separator';
import { getSong, listSongs, updateSong, type Song } from './songs';

/* Splitting a song, in the background: it carries on while the singer moves
   around the app. Every step shown is a real one (RULEBOOK 3): the bytes
   sent, then how far into the song the split is final. The first 30
   seconds are collected and saved as soon as they are ready; then the
   whole of both parts, and the 30-second parts are dropped. */

const phases = new Map<string, SplitPhase>();
const running = new Set<string>();
const listeners = new Set<(id: string) => void>();
const POLL_MS = 500;

function set(id: string, p: SplitPhase): void {
  phases.set(id, p);
  listeners.forEach((f) => f(id));
}

export function splitPhase(id: string): SplitPhase | null {
  return phases.get(id) ?? null;
}

export function onSplit(fn: (id: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function fail(id: string, problem: Problem): Promise<void> {
  set(id, { phase: 'problem', problem });
  /* any parts already on the phone stay playable */
  await updateSong(id, { state: 'problem', problem });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Split a stored song (or carry on with a split already under way). */
export async function startSplit(id: string): Promise<void> {
  if (running.has(id)) return;
  running.add(id);
  set(id, { phase: 'sending', fraction: 0 });             /* shown at once, never a stale message */
  try {
    const song = await getSong(id);
    if (!song || (song.voice && song.music)) {
      set(id, { phase: 'done' });
      return;
    }
    const token = await accessToken();
    if (!token) return await fail(id, 'signed-out');
    if (song.job && Date.now() - song.job.at < JOB_KEEP_MS && song.state === 'splitting') {
      return await follow(id, song.job.id);
    }
    if (song.file.size > MAX_BYTES) return await fail(id, 'too-big');
    const secs = song.seconds ?? (await durationOf(song.file));
    if (secs != null && song.seconds == null) await updateSong(id, { seconds: secs });
    if (secs != null && secs > MAX_SECONDS + 0.5) return await fail(id, 'too-long');
    set(id, { phase: 'sending', fraction: 0 });
    const job = await upload(song.file, token, (f) => set(id, { phase: 'sending', fraction: f }));
    await updateSong(id, { job: { id: job, at: Date.now() }, state: 'splitting', problem: undefined });
    await follow(id, job);
  } catch (e) {
    await fail(id, e instanceof SplitError ? e.problem : 'failed');
  } finally {
    running.delete(id);
  }
}

async function follow(id: string, job: string): Promise<void> {
  const start = await getSong(id);
  let have30 = !!start?.voice30;
  let knowLength = start?.seconds != null;
  for (;;) {
    const token = await accessToken();
    if (!token) return fail(id, 'signed-out');
    const s = await status(job, token);
    if (s.stage === 'failed' || s.stage === 'cancelled') {
      return fail(id, s.error === 'could not split this file' ? 'not-audio' : 'failed');
    }
    if (!knowLength && s.seconds) {
      await updateSong(id, { seconds: s.seconds });           /* the server decoded it: its length is exact */
      knowLength = true;
    }
    if (s.stage === 'waiting' || s.stage === 'reading') set(id, { phase: 'waiting' });
    if (s.stage === 'separating') set(id, { phase: 'splitting', readyS: s.ready_s, totalS: s.seconds ?? 0 });
    if (s.stage === 'saving') set(id, { phase: 'saving' });
    if (!have30 && s.first30_ready && (s.seconds ?? 0) > FIRST_SECONDS) {
      const [voice30, music30] = [await collect(job, 'voice30', token), await collect(job, 'music30', token)];
      await updateSong(id, { voice30, music30, state: 'first30' });
      have30 = true;
    }
    if (s.stage === 'done') {
      set(id, { phase: 'saving' });
      const voice = await collect(job, 'voice', token);
      const music = await collect(job, 'music', token);
      await updateSong(id, { voice, music, voice30: undefined, music30: undefined, state: 'ready', problem: undefined, job: undefined });
      set(id, { phase: 'done' });
      return;
    }
    await wait(POLL_MS);
  }
}

/** At start, and whenever someone signs in: carry on with any split that
    was under way, and retry ones that stopped for want of a sign-in. */
export async function resumeSplits(): Promise<void> {
  let songs: Song[] = [];
  try {
    songs = await listSongs();
  } catch {
    return;
  }
  for (const s of songs) {
    if (s.voice && s.music) continue;
    if (s.state === 'splitting' || s.problem === 'signed-out') void startSplit(s.id);
  }
}

export function watchSignIns(): void {
  onUser((u) => {
    if (u) void resumeSplits();
  });
}
