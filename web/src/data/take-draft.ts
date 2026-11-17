import type { Take } from '../audio/conductor/conductor';

/* A take waiting to be decided on (Robert, 17 Nov: "I went to save a take
   and there was no save"). A take lived only in memory until Save or Try
   again, so it was lost when the phone's Chrome threw the page away while
   locked, when the app was closed and opened again, or when something else
   was sung in between. Now the take waiting on each song is kept on the
   phone too, with your line for it, until it is saved or thrown away, and
   comes back when the song opens. One a song: a newer take replaces it.

   Its own small store, apart from the songs and takes (data/db), so that
   store is never upgraded for it. */
const DB = 'repertoire-drafts';
const STORE = 'drafts';

export interface Draft {
  readonly songId: string;
  readonly owner: string;
  readonly rate: number;
  readonly samples: Int16Array;
  readonly seconds: number;
  readonly songAt: number;
  /** your line for it: time in the song and note, a reading at a time */
  readonly t: Float32Array;
  readonly m: Float32Array;
  readonly created: number;
}

let opening: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise<IDBDatabase>((ok, no) => {
      const late = setTimeout(() => no(new Error('storage did not answer')), 3000);
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE, { keyPath: 'songId' });
      };
      r.onsuccess = () => {
        clearTimeout(late);
        ok(r.result);
      };
      r.onerror = () => {
        clearTimeout(late);
        no(r.error);
      };
    });
    opening.catch(() => {
      opening = null;
    });
  }
  return opening;
}
function run<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then((d) => new Promise<T>((ok, no) => {
    const tx = d.transaction(STORE, mode);
    const q = f(tx.objectStore(STORE));
    tx.oncomplete = () => ok(q.result);
    tx.onerror = () => no(tx.error);
  }));
}

/** keep the take waiting on this song, with your line over it */
export function keepDraft(songId: string, take: Take, line: { t: ArrayLike<number>; m: ArrayLike<number> }): Promise<void> {
  let n = 0;
  take.chunks.forEach((c) => (n += c.length));
  const samples = new Int16Array(n);
  let k = 0;
  for (const c of take.chunks) {
    samples.set(c, k);
    k += c.length;
  }
  const keep: number[] = [];
  for (let i = 0; i < line.t.length; i++) if (line.t[i] >= take.songAt && line.t[i] <= take.songAt + take.seconds) keep.push(i);
  const d: Draft = { songId, owner: take.owner, rate: take.rate, samples, seconds: take.seconds, songAt: take.songAt,
    t: Float32Array.from(keep, (i) => line.t[i]), m: Float32Array.from(keep, (i) => line.m[i]), created: Date.now() };
  return run('readwrite', (s) => s.put(d)).then(() => undefined, () => undefined);
}

/** the take waiting on this song, if one is */
export function draftFor(songId: string): Promise<Draft | null> {
  return run('readonly', (s) => s.get(songId) as IDBRequest<Draft | undefined>).then((d) => d ?? null, () => null);
}

/** it was saved or thrown away: not waiting any more */
export function dropDraft(songId: string): Promise<void> {
  return run('readwrite', (s) => s.delete(songId)).then(() => undefined, () => undefined);
}

/** the draft as a take again, for the conductor */
export function takeOf(d: Draft): Take {
  return { owner: d.owner, rate: d.rate, chunks: [d.samples], seconds: d.seconds, songAt: d.songAt };
}
