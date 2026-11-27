/* Speak it, then sing it (Robert's song feature, approved 16 Nov): the two
   recordings of the line being worked on - the singer speaking the words,
   then singing them the way they spoke them - kept on this phone the moment
   each is made (RULEBOOK 3: anything the user adds is saved straight away),
   so leaving and coming back, or the phone throwing the page away, loses
   neither. One pair a song, for the line it was made on; a new recording
   replaces the one before it. They are not takes: nothing is scored, they
   are not put online or sent, and they are not in Your takes.

   Its own small store, apart from the songs and takes (data/db), so that
   store is never upgraded for it. */
const DB = 'repertoire-speak';
const STORE = 'pairs';

export interface Said {
  readonly rate: number;
  readonly samples: Int16Array;
  readonly seconds: number;
}

export interface Pair {
  readonly songId: string;
  /** the stretch of the song it was made on, in seconds */
  readonly start: number;
  readonly end: number;
  readonly spoken?: Said;
  readonly sung?: Said;
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

/** the pair kept for this song, if it was made on this stretch */
export function pairFor(songId: string, start: number, end: number): Promise<Pair | null> {
  return run('readonly', (s) => s.get(songId) as IDBRequest<Pair | undefined>)
    .then((p) => (p && Math.abs(p.start - start) < 0.01 && Math.abs(p.end - end) < 0.01 ? p : null), () => null);
}

/** keep one recording of the pair; one made on another stretch starts a new pair */
export async function keepSaid(songId: string, start: number, end: number, which: 'spoken' | 'sung', said: Said): Promise<Pair> {
  const was = await pairFor(songId, start, end);
  const p: Pair = { ...(was ?? { songId, start, end }), [which]: said };
  await run('readwrite', (s) => s.put(p)).catch(() => undefined);
  return p;
}

/** a recording from the conductor's chunks, as one run of samples */
export function said(chunks: readonly Int16Array[], rate: number, seconds: number): Said {
  let n = 0;
  chunks.forEach((c) => (n += c.length));
  const samples = new Int16Array(n);
  let k = 0;
  for (const c of chunks) {
    samples.set(c, k);
    k += c.length;
  }
  return { rate, samples, seconds };
}
