import type { Problem, SongHas, SongState } from '../core/song';
import { inStore } from './db';

/* Songs live on the phone (IndexedDB): the file the singer picked, and the
   voice and music once split, so reopening a song never splits it again.
   Saved straight away (RULEBOOK 3). */

export interface Song {
  readonly id: string;
  readonly title: string;
  readonly created: number;
  readonly fileName: string;
  readonly file: Blob;
  readonly seconds?: number;
  readonly state: SongState;
  readonly problem?: Problem;
  readonly job?: { id: string; at: number };
  readonly voice?: Blob;
  readonly music?: Blob;
  readonly voice30?: Blob;
  readonly music30?: Blob;
}

export function hasOf(s: Song): SongHas {
  return { state: s.state, full: !!(s.voice && s.music), first30: !!(s.voice30 && s.music30), problem: s.problem };
}

const STORE = 'songs';

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return inStore(STORE, mode, run);
}

const listeners = new Set<() => void>();
function changed(): void {
  listeners.forEach((f) => f());
}

export function onSongs(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export async function listSongs(): Promise<Song[]> {
  const all = await tx<Song[]>('readonly', (s) => s.getAll() as IDBRequest<Song[]>);
  return all.sort((a, b) => b.created - a.created);
}

export async function getSong(id: string): Promise<Song | undefined> {
  return tx<Song | undefined>('readonly', (s) => s.get(id) as IDBRequest<Song | undefined>);
}

export async function addSong(file: File, title: string): Promise<Song> {
  const song: Song = { id: crypto.randomUUID(), title, created: Date.now(), fileName: file.name, file, state: 'new' };
  await tx('readwrite', (s) => s.put(song));
  /* ask the phone to keep it, not clear it when space runs low */
  void navigator.storage?.persist?.().catch(() => false);
  changed();
  return song;
}

export async function updateSong(id: string, patch: Partial<Song>): Promise<Song | undefined> {
  const now = await getSong(id);
  if (!now) return undefined;
  const next = { ...now, ...patch } as Song;
  await tx('readwrite', (s) => s.put(next));
  changed();
  return next;
}

/* The file picked on Add a song, held until the singer confirms it. */
let pending: File | null = null;
export function holdPicked(f: File | null): void {
  pending = f;
}
export function picked(): File | null {
  return pending;
}
