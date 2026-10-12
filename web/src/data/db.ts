/* The app's store on the phone (IndexedDB): songs (the files and their
   parts), lines (the singer's line read from each song's voice) and takes
   (what the singer recorded).

   Its own name: the old app (next.html) lives at the same web address and
   keeps its library in a store called "repertoire". Until 5 Oct this app
   used that name too, and the two could break each other's storage. Now
   they never share: this app's own songs, lines and takes are copied out of
   the shared store once, by reading it only - nothing in it is changed or
   deleted. */
export const DB = 'repertoire-app';
const SHARED = 'repertoire';
const VERSION = 1;
const MOVED = 'rp.db.moved';
let opening: Promise<IDBDatabase> | null = null;

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((ok, no) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => no(r.error);
  });
}

/** a song this app made (the old app's songs carry no file name or split state) */
function ours(store: string, v: Record<string, unknown>): boolean {
  if (store !== 'songs') return true;
  return 'fileName' in v && 'file' in v && 'state' in v;
}

/* once: this app's records out of the store it used to share */
async function copyOnce(d: IDBDatabase): Promise<void> {
  try {
    if (localStorage.getItem(MOVED)) return;
  } catch {
    return;
  }
  try {
    const list = indexedDB.databases ? await indexedDB.databases() : [];
    if (list.some((x) => x.name === SHARED)) {
      /* opened as it is: no version asked for, so it is never upgraded */
      const old = await new Promise<IDBDatabase | null>((ok) => {
        const r = indexedDB.open(SHARED);
        r.onupgradeneeded = () => r.transaction?.abort();
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ok(null);
      });
      if (old) {
        for (const store of ['songs', 'lines', 'takes']) {
          if (!old.objectStoreNames.contains(store)) continue;
          const all = (await req(old.transaction(store, 'readonly').objectStore(store).getAll())) as Record<string, unknown>[];
          const mine = all.filter((v) => v && typeof v === 'object' && ours(store, v));
          if (!mine.length) continue;
          const have = new Set(await req(d.transaction(store, 'readonly').objectStore(store).getAllKeys()));
          const t = d.transaction(store, 'readwrite');
          const s = t.objectStore(store);
          for (const v of mine) if (!have.has(v.id as IDBValidKey)) s.put(v);
          await new Promise((ok, no) => {
            t.oncomplete = ok;
            t.onerror = () => no(t.error);
          });
        }
        old.close();
      }
    }
    localStorage.setItem(MOVED, '1');
  } catch {
    /* tried again next time */
  }
}

/** A song this app made, left in the old app's store from when the two
    shared it: a file name, the file and a split state, and none of what
    every old-app song carries (an artist, a time it was added). */
export function stray(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.fileName === 'string' && o.file instanceof Blob && typeof o.state === 'string' &&
    !('artist' in o) && !('added' in o) && !('addedAt' in o);
}

const STRAYS = 'rp.db.strays';

/* Once per phone, quietly: the old app's Library listed this app's songs as
   "undefined · –:––". Remove those from the old app's store, each only once
   the same song is safe in this app's own store. Nothing shaped like an
   old-app song is ever touched, and a stray with no copy here is left. */
async function clearStrays(d: IDBDatabase): Promise<void> {
  try {
    if (localStorage.getItem(STRAYS) || !localStorage.getItem(MOVED)) return;
  } catch {
    return;
  }
  try {
    const list = indexedDB.databases ? await indexedDB.databases() : [];
    if (list.some((x) => x.name === SHARED)) {
      const old = await new Promise<IDBDatabase | null>((ok) => {
        const r = indexedDB.open(SHARED);
        r.onupgradeneeded = () => r.transaction?.abort();   /* never made or changed here */
        r.onsuccess = () => ok(r.result);
        r.onerror = () => ok(null);
      });
      if (old) {
        if (old.objectStoreNames.contains('songs')) {
          const all = (await req(old.transaction('songs', 'readonly').objectStore('songs').getAll())) as Record<string, unknown>[];
          const go: IDBValidKey[] = [];
          for (const v of all.filter(stray)) {
            const here = (await req(d.transaction('songs', 'readonly').objectStore('songs').get(v.id as IDBValidKey))) as
              Record<string, unknown> | undefined;
            if (here && here.fileName === v.fileName) go.push(v.id as IDBValidKey);
          }
          if (go.length) {
            const t = old.transaction('songs', 'readwrite');
            go.forEach((id) => t.objectStore('songs').delete(id));
            await new Promise((ok, no) => {
              t.oncomplete = ok;
              t.onerror = () => no(t.error);
            });
          }
        }
        old.close();
      }
    }
    localStorage.setItem(STRAYS, '1');
  } catch {
    /* tried again next time */
  }
}

/** On start: open the store (and tidy the old app's Library, once). */
export function startStore(): void {
  void db().catch(() => undefined);
}

function db(): Promise<IDBDatabase> {
  if (!opening) {
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      /* storage that is missing, blocked or silent for 3 s is not there
         (the old app's rule): say so rather than wait for ever */
      const late = setTimeout(() => reject(new Error('storage did not answer')), 3000);
      let r: IDBOpenDBRequest;
      try {
        r = indexedDB.open(DB, VERSION);
      } catch (e) {
        clearTimeout(late);
        reject(e);
        return;
      }
      r.onupgradeneeded = () => {
        const d = r.result;
        for (const s of ['songs', 'lines', 'takes']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
      };
      r.onsuccess = () => {
        clearTimeout(late);
        resolve(r.result);
      };
      r.onerror = () => {
        clearTimeout(late);
        reject(r.error);
      };
    }).then(async (d) => {
      await copyOnce(d);
      await clearStrays(d);
      return d;
    });
    /* a failed open is tried again next time it is needed */
    opening.catch(() => {
      opening = null;
    });
  }
  return opening;
}

export function inStore<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(store, mode);
        const req = run(t.objectStore(store));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error);
      }),
  );
}
