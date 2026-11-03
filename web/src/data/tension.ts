import { SPOTS, type Spot } from '../core/tension';
import { supabase } from './auth';

/* The "Ah" tension check's ticks (Robert, 3 Nov), kept the way your range
   is: on the phone the moment one is tapped, then on the account so they
   follow you to a new phone. Online they sit in their own table, which only
   the singer can read or change (the database's rule, not the app's): not
   a coach, not anyone else. A new check replaces the old ticks. */

const KEY = 'rp.tension';

function parse(raw: string | null): Spot[] | null {
  try {
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v?.spots) ? SPOTS.filter((s) => v.spots.includes(s)) : null;
  } catch {
    return null;
  }
}

/** the spots ticked at the last check; none if never */
export function keptSpots(): Spot[] {
  try {
    return parse(localStorage.getItem(KEY)) ?? [];
  } catch {
    return [];
  }
}

async function me(): Promise<string | null> {
  try {
    return (await supabase.auth.getSession()).data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/* one save at a time, each sending what is ticked by then: two quick
   ticks must never land on the account in the wrong order */
let sending: Promise<unknown> = Promise.resolve();

/** Keep the ticks: on the phone at once, on the account if signed in.
    Says where they got to. */
export function saveSpots(spots: readonly Spot[]): Promise<'online' | 'phone'> {
  const v = SPOTS.filter((s) => spots.includes(s));
  try {
    localStorage.setItem(KEY, JSON.stringify({ spots: v, at: new Date().toISOString() }));
  } catch {
    /* nothing to keep it in */
  }
  const next = sending.then(async (): Promise<'online' | 'phone'> => {
    const id = await me();
    if (!id) return 'phone';
    try {
      const r = await supabase.from('tension_spots').upsert({ user_id: id, spots: keptSpots(), updated_at: new Date().toISOString() });
      return r.error ? 'phone' : 'online';
    } catch {
      return 'phone';
    }
  });
  sending = next;
  return next;
}

/** Signed in on a phone that has none: the account's ticks, kept here. */
export async function pullSpots(): Promise<void> {
  try {
    if (parse(localStorage.getItem(KEY))) return;
    const id = await me();
    if (!id) return;
    const { data } = await supabase.from('tension_spots').select('spots, updated_at').eq('user_id', id).maybeSingle();
    if (data && Array.isArray(data.spots)) localStorage.setItem(KEY, JSON.stringify({ spots: data.spots, at: data.updated_at }));
  } catch {
    /* offline: none until next time */
  }
}
