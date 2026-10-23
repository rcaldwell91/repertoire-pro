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
      const { error } = await supabase.from('results').insert({ student_id: id, ...row });
      online = !error;
    }
  } catch {
    /* offline: kept on the phone */
  }
  keep({ ...row, created_at: new Date().toISOString(), online });
  return online ? 'online' : 'phone';
}
