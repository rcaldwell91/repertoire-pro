import { supabase } from './auth';

/* "Your first take is your Before" (Robert's song feature, approved 16
   Nov). The first take saved of each song is its Before (core/practise
   beforeOf), with nothing kept for it. A different take chosen as the
   Before is kept the way the tension ticks are (data/tension): on the phone
   at once, then on the account, so it follows the singer to a new phone.
   Online it sits in its own table, song_befores, which only the singer can
   read or change (the database's rule: scripts/db/2026-11-27-song-befores.sql).
   A song is known by its title, as takes find their song on a new phone.
   Signed in, the account's choice wins; signed out, or with no signal, the
   phone's. */

const KEY = 'rp.before.';
const listeners = new Set<() => void>();
export function onBefore(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function changed(): void {
  listeners.forEach((f) => f());
}

function local(title: string): string | null {
  try {
    return localStorage.getItem(KEY + title);
  } catch {
    return null;
  }
}
function keepLocal(title: string, takeId: string): void {
  try {
    localStorage.setItem(KEY + title, takeId);
  } catch {
    /* nothing to keep it in */
  }
}

async function me(): Promise<string | null> {
  try {
    return (await supabase.auth.getSession()).data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function send(id: string, title: string, takeId: string): Promise<boolean> {
  try {
    const r = await supabase.from('song_befores')
      .upsert({ student_id: id, song_title: title, take_id: takeId, updated_at: new Date().toISOString() }, { onConflict: 'student_id,song_title' });
    return !r.error;
  } catch {
    return false;
  }
}

/** The take chosen as this song's Before, if one was: the account's when
    signed in (a choice made on this phone while signed out goes up to it),
    else this phone's. Null: the first take saved is the Before. */
export async function chosenBefore(title: string): Promise<string | null> {
  const here = local(title);
  const id = await me();
  if (!id) return here;
  try {
    const { data, error } = await supabase.from('song_befores').select('take_id').eq('student_id', id).eq('song_title', title).maybeSingle();
    if (error) return here;
    const there = (data?.take_id as string | undefined) ?? null;
    if (there) {
      if (there !== here) keepLocal(title, there);
      return there;
    }
    if (here) void send(id, title, here);
    return here;
  } catch {
    return here;
  }
}

/** Choose this take as the song's Before: on the phone now, on the account
    if signed in. Says where it got to. */
export async function chooseBefore(title: string, takeId: string): Promise<'online' | 'phone'> {
  keepLocal(title, takeId);
  changed();
  const id = await me();
  if (!id) return 'phone';
  return (await send(id, title, takeId)) ? 'online' : 'phone';
}
