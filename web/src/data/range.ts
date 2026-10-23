import type { Range } from '../core/notemap';
import { DEFAULT_RANGE, type KeptRange } from '../core/range';
import { supabase } from './auth';

/* Your range, the one source of truth (RULEBOOK 4, Screens). Kept as the
   old app kept it (rp-range.js): on the phone, so it survives a reload;
   on the account (profiles: range_lo, range_hi, range_at, range_by), so it
   follows you to a new phone; and with when and how it was found. Read,
   in turn: this app's own, the old app's on this phone (rp_range; read
   only), the account's. Until then the old app's default, "Not measured
   yet". */

const KEY = 'rp.range';
const OLD_KEY = 'rp_range';

function parse(raw: string | null): KeptRange | null {
  try {
    const v = raw ? JSON.parse(raw) : null;
    if (!v || !Number.isFinite(v.lo) || !Number.isFinite(v.hi) || v.hi <= v.lo) return null;
    return { lo: Math.round(v.lo), hi: Math.round(v.hi), at: typeof v.at === 'string' ? v.at : '', by: v.by === 'preset' ? 'preset' : 'test' };
  } catch {
    return null;
  }
}
function read(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
export function onRange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** your range as found, or null if it never has been */
export function keptRange(): KeptRange | null {
  return parse(read(KEY)) ?? parse(read(OLD_KEY));
}

/** the range every exercise sits in */
export function rangeNow(): Range {
  const k = keptRange();
  return k ? { lo: k.lo, hi: k.hi } : DEFAULT_RANGE;
}

async function me(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** Keep a range just found: on the phone at once, and on the account if
    signed in. */
export async function saveRange(r: Range, by: KeptRange['by']): Promise<KeptRange> {
  const v: KeptRange = { lo: r.lo, hi: r.hi, at: new Date().toISOString(), by };
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* nothing to keep it in */
  }
  listeners.forEach((f) => f());
  const id = await me();
  if (id) {
    try {
      await supabase.from('profiles').update({ range_lo: v.lo, range_hi: v.hi, range_at: v.at, range_by: v.by }).eq('id', id);
    } catch {
      /* kept on the phone; the account has the last one sent */
    }
  }
  return v;
}

/** Signed in on a phone that has none: the account's range, kept here. */
export async function pullRange(): Promise<void> {
  if (keptRange()) return;
  const id = await me();
  if (!id) return;
  try {
    const { data } = await supabase.from('profiles').select('range_lo, range_hi, range_at, range_by').eq('id', id).maybeSingle();
    const v = parse(data ? JSON.stringify({ lo: data.range_lo, hi: data.range_hi, at: data.range_at, by: data.range_by }) : null);
    if (v && !keptRange()) {
      localStorage.setItem(KEY, JSON.stringify(v));
      listeners.forEach((f) => f());
    }
  } catch {
    /* offline: the default until next time */
  }
}
