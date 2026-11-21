import type { ResultRow } from '../core/results';
import { supabase } from './auth';

/* What each exercise left behind, saved straight away (RULEBOOK 3), as the
   old app kept it (rp-cloud.js 870-905): always on the phone, the newest
   200; and online, in the results table, when signed in. Its security
   rules are the old app's, unchanged: you write only your own; a coach
   who teaches you reads them. */

const KEY = 'rp.results';
const KEEP = 200;

export interface KeptResult extends ResultRow {
  readonly created_at: string;
  /** whether it reached the account too */
  readonly online: boolean;
}

export function keptResults(): KeptResult[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function keep(r: KeptResult): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([r, ...keptResults()].slice(0, KEEP)));
  } catch {
    /* nothing to keep it in */
  }
}

/** Save a result: online if signed in, and on the phone either way.
    Says where it went. */
export async function saveResult(row: ResultRow): Promise<'online' | 'phone'> {
  let online = false;
  try {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user?.id;
    if (id) {
      /* the level in its own column (Robert, 22 Nov) */
      const { error } = await supabase.from('results').insert({ student_id: id, ...row });
      online = !error;
    }
  } catch {
    /* offline: kept on the phone */
  }
  keep({ ...row, created_at: new Date().toISOString(), online });
  return online ? 'online' : 'phone';
}

/** Your own saved results for one exercise, newest first: from your account
    when signed in (a singer may read their own: rs_read), with any on this
    phone that never reached it; otherwise this phone's. Read only, to show
    your own numbers back (your best hiss, your goal, how you landed last
    time: Robert, 4 Nov). */
export async function myResults(id: string): Promise<Array<ResultRow & { created_at: string }>> {
  const phone = keptResults().filter((r) => r.app_ex_id === id);
  try {
    const { data: s } = await supabase.auth.getSession();
    const me = s.session?.user?.id;
    if (me) {
      const { data, error } = await supabase.from('results').select('kind,label,app_ex_id,score,out_of,pct,seconds,cents,settle_cents,level,created_at')
        .eq('student_id', me).eq('app_ex_id', id).order('created_at', { ascending: false }).limit(200);
      if (!error && data) {
        const clean = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).filter(([, v]) => v != null));
        const rows = (data as Array<Record<string, unknown>>).map(clean) as unknown as Array<ResultRow & { created_at: string }>;
        return [...phone.filter((r) => !r.online), ...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
      }
    }
  } catch {
    /* offline: this phone's */
  }
  return phone;
}

/** your best Steady hiss so far, in seconds; null if never timed */
export async function bestHiss(): Promise<number | null> {
  const s = (await myResults('hiss')).map((r) => r.seconds).filter((x): x is number => typeof x === 'number' && x > 0);
  return s.length ? Math.max(...s) : null;
}
