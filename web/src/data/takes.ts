import { inStore } from './db';
import { supabase } from './auth';
import { SUPABASE_URL, SUPABASE_KEY } from './config';

/* Takes: kept on the phone the moment they are saved (RULEBOOK 3: saved
   straight away), then put online in the background, with real progress,
   into the old app's private takes store - a folder per person - and its
   takes table: one row with no coach (the singer's alone: phones can wipe
   a website's data, so a take kept only there is not safe), and one more
   row for each coach it is sent to. A coach can open a recording only if
   it was sent to them (database rule, 5 Oct). Offline, a take waits on the
   phone and goes up when the phone is back online; on a new phone, the
   singer's takes come back down. Nobody waits for any of it. */

export interface Coach {
  readonly id: string;
  readonly name: string;
}

export interface StoredTake {
  readonly id: string;
  readonly songId: string;
  readonly songTitle: string;
  readonly created: number;
  /** the recording, on this phone; null for a take kept online only */
  readonly audio: Blob | null;
  readonly seconds: number;
  /** where in the song it begins */
  readonly songAt: number;
  /** your line, in song time */
  readonly line: { t: Float32Array; m: Float32Array };
  readonly anyOctave: boolean;
  /** right notes, % (null when too little was sung to say) */
  readonly rightPct: number | null;
  /** online: where it is, or how far it has got */
  readonly path?: string;
  /** its own row (no coach) is in the takes table */
  readonly kept?: boolean;
  readonly progress?: number;
  /** coaches it is to be sent to, and those it has been sent to */
  readonly sendTo: readonly Coach[];
  readonly sent: readonly Coach[];
}

const listeners = new Set<() => void>();
function changed(): void {
  listeners.forEach((f) => f());
}
export function onTakes(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/* takes being deleted, still undoable: hidden from lists until then */
const going = new Map<string, ReturnType<typeof setTimeout>>();
export const UNDO_MS = 6000;

/** A song's takes, newest first: by the song, or by its title (the same
    song added again, on a new phone). No song: every take. */
export async function takesFor(songId: string | null, title?: string): Promise<StoredTake[]> {
  const all = await inStore<StoredTake[]>('takes', 'readonly', (s) => s.getAll() as IDBRequest<StoredTake[]>);
  return all.filter((t) => !going.has(t.id) && (songId == null || t.songId === songId || (!!title && t.songTitle === title)))
    .sort((a, b) => b.created - a.created);
}

/** somewhere a take can be heard from: its recording on this phone, or a
    signed link to it online that lasts an hour */
export async function takeUrl(t: StoredTake): Promise<string | null> {
  if (t.audio) return URL.createObjectURL(t.audio);
  if (!t.path) return null;
  const r = await supabase.storage.from('takes').createSignedUrl(t.path, 3600);
  return r.error ? null : r.data.signedUrl;
}

function get(id: string): Promise<StoredTake | undefined> {
  return inStore<StoredTake | undefined>('takes', 'readonly', (s) => s.get(id) as IDBRequest<StoredTake | undefined>);
}
async function patch(id: string, p: Partial<StoredTake>): Promise<StoredTake | undefined> {
  const t = await get(id);
  if (!t) return undefined;
  const next = { ...t, ...p };
  await inStore('takes', 'readwrite', (s) => s.put(next));
  changed();
  return next;
}

/** Keep a take: on the phone now, online when it can. */
export async function saveTake(t: Omit<StoredTake, 'sendTo' | 'sent'>, sendTo: readonly Coach[] = []): Promise<void> {
  await inStore('takes', 'readwrite', (s) => s.put({ ...t, sendTo, sent: [] }));
  changed();
  void syncTakes();
}

/** Send a kept take to these coaches as well. */
export async function sendTake(id: string, coaches: readonly Coach[]): Promise<void> {
  const t = await get(id);
  if (!t) return;
  const more = coaches.filter((c) => !t.sendTo.some((x) => x.id === c.id) && !t.sent.some((x) => x.id === c.id));
  await patch(id, { sendTo: [...t.sendTo, ...more] });
  void syncTakes();
}

/** Delete, after a moment in which it can be undone. */
export function deleteTake(id: string): void {
  if (going.has(id)) return;
  going.set(id, setTimeout(() => {
    going.delete(id);
    void removeForGood(id);
  }, UNDO_MS));
  changed();
}

export function undoDelete(id: string): void {
  const timer = going.get(id);
  if (!timer) return;
  clearTimeout(timer);
  going.delete(id);
  changed();
}

async function removeForGood(id: string): Promise<void> {
  const t = await get(id);
  if (!t) return;
  await inStore('takes', 'readwrite', (s) => s.delete(id));
  changed();
  if (!t.path) return;
  /* online too: the rows sent to coaches, and the recording */
  try {
    const me = (await supabase.auth.getSession()).data.session?.user.id;
    if (me) await supabase.from('takes').delete().eq('student_id', me).eq('audio_path', t.path);
    await supabase.storage.from('takes').remove([t.path]);
  } catch {
    /* offline: the phone's copy is gone; the online copy stays private to its owner */
  }
}

/** The coaches this singer is linked to (any number of them). */
export async function myCoaches(): Promise<Coach[] | null> {
  const me = (await supabase.auth.getSession()).data.session?.user.id;
  if (!me) return null;
  const links = await supabase.from('coach_students').select('coach_id').eq('student_id', me);
  if (links.error) throw links.error;
  const ids = (links.data ?? []).map((r) => r.coach_id as string);
  if (!ids.length) return [];
  const people = await supabase.from('profiles').select('id, display_name').in('id', ids);
  if (people.error) throw people.error;
  return (people.data ?? []).map((p) => ({ id: p.id as string, name: (p.display_name as string) || '' }));
}

/* ---------------------------------------------------------------- */

function put(path: string, body: Blob, token: string, onProgress: (f: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', `${SUPABASE_URL}/storage/v1/object/takes/${path}`);
    x.setRequestHeader('Authorization', 'Bearer ' + token);
    x.setRequestHeader('apikey', SUPABASE_KEY);
    x.setRequestHeader('x-upsert', 'true');
    x.setRequestHeader('content-type', body.type || 'audio/wav');
    x.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error('upload ' + x.status)));
    x.onerror = () => reject(new Error('offline'));
    x.send(body);
  });
}

/* the last take sent to every coach chosen for it, for "Sent to …" */
let sentNote: { songId: string; names: string; at: number } | null = null;
export function lastSent(): { songId: string; names: string; at: number } | null {
  return sentNote;
}

let running: Promise<void> | null = null;
let again = false;

/** Put every waiting take online, and send what is to be sent. Safe to
    call any time; runs one at a time. */
export function syncTakes(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = sync().finally(() => {
    running = null;
    if (again) {
      again = false;
      void syncTakes();
    }
  });
  return running;
}

async function sync(): Promise<void> {
  if (!navigator.onLine) return;                   /* kept on the phone until it is back online */
  const session = (await supabase.auth.getSession()).data.session;
  if (!session) return;                            /* kept on the phone until someone signs in */
  const me = session.user.id;
  const all = await inStore<StoredTake[]>('takes', 'readonly', (s) => s.getAll() as IDBRequest<StoredTake[]>);
  for (const t of all.sort((a, b) => a.created - b.created)) {
    if (going.has(t.id)) continue;
    try {
      let path = t.path;
      if (!path && t.audio) {
        const p = `${me}/${t.id}.wav`;
        let shown = -1;
        await put(p, t.audio, session.access_token, (f) => {
          if (f - shown < 0.02) return;              /* real progress, without a write per byte */
          shown = f;
          void patch(t.id, { progress: f });
        });
        await patch(t.id, { path: p, progress: 1 });
        path = p;
      }
      if (!path) continue;
      const details = { app: 'learn', songId: t.songId, songTitle: t.songTitle, songAt: t.songAt, created: t.created,
        rightPct: t.rightPct, anyOctave: t.anyOctave, t: Array.from(t.line.t, round2), m: Array.from(t.line.m, round2) };
      const row = (coach: string | null) => ({ student_id: me, coach_id: coach, title: t.songTitle, note: '', audio_path: path,
        duration: Math.round(t.seconds * 10) / 10, kind: 'song', notes: details });
      if (!t.kept) {
        /* its own row: the singer's alone, so it is safe online and comes back on a new phone */
        const r = await supabase.from('takes').insert(row(null));
        if (r.error) throw r.error;
        await patch(t.id, { kept: true });
      }
      for (const c of t.sendTo) {
        /* the same recording, now shared with this coach: nothing uploaded again */
        const r = await supabase.from('takes').insert(row(c.id));
        if (r.error) throw r.error;
        const now = await get(t.id);
        if (!now) continue;
        const left = now.sendTo.filter((x) => x.id !== c.id), sent = [...now.sent, c];
        if (!left.length) sentNote = { songId: t.songId, names: sent.map((x) => x.name).join(', '), at: Date.now() };
        await patch(t.id, { sendTo: left, sent });
      }
    } catch {
      await patch(t.id, { progress: undefined });
      return;                                      /* offline or refused: try again later */
    }
  }
  await pull(me, all);
}

const round2 = (v: number) => (Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const num = (v: number | null) => (v == null ? NaN : v);

/* the singer's takes kept online that this phone does not have (a new
   phone, or one that lost its data): brought back, ready to hear */
async function pull(me: string, local: StoredTake[]): Promise<void> {
  const r = await supabase.from('takes').select('audio_path, coach_id, created_at, duration, notes')
    .eq('student_id', me).not('audio_path', 'is', null);
  if (r.error || !r.data) return;
  const rows = r.data.filter((x) => (x.notes as { app?: string } | null)?.app === 'learn');
  const coachIds = [...new Set(rows.map((x) => x.coach_id as string | null).filter((x): x is string => !!x))];
  const names = new Map<string, string>();
  if (coachIds.length) {
    const p = await supabase.from('profiles').select('id, display_name').in('id', coachIds);
    (p.data ?? []).forEach((x) => names.set(x.id as string, (x.display_name as string) || ''));
  }
  const have = new Set(local.map((t) => t.path));
  const added = new Set<string>();
  for (const x of rows) {
    const path = x.audio_path as string;
    if (have.has(path) || added.has(path) || x.coach_id) continue;
    added.add(path);
    const d = x.notes as { songId: string; songTitle: string; songAt: number; created: number; rightPct: number | null;
      anyOctave: boolean; t: (number | null)[]; m: (number | null)[] };
    const id = path.split('/').pop()!.replace(/\.wav$/, '');
    const sent = rows.filter((y) => y.audio_path === path && y.coach_id)
      .map((y) => ({ id: y.coach_id as string, name: names.get(y.coach_id as string) ?? '' }));
    const take: StoredTake = { id, songId: d.songId, songTitle: d.songTitle, created: d.created, audio: null,
      seconds: Number(x.duration) || 0, songAt: d.songAt, line: { t: Float32Array.from(d.t, num), m: Float32Array.from(d.m, num) },
      anyOctave: d.anyOctave, rightPct: d.rightPct, path, kept: true, sendTo: [], sent };
    await inStore('takes', 'readwrite', (s) => s.put(take));
  }
  if (added.size) changed();
}

let started = false;
/** Once at start: retry when the phone is back online, and now and then. */
export function startTakeSync(): void {
  if (started) return;
  started = true;
  window.addEventListener('online', () => void syncTakes());
  supabase.auth.onAuthStateChange(() => void syncTakes());
  setInterval(() => void syncTakes(), 20000);
  void syncTakes();
}
