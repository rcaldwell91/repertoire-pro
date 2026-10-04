import { createClient, type Session } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

/* Signing in to the existing Repertoire accounts (the same Supabase project
   as the old app, so the same email and password work). Only signing in:
   a magic link is sent only to an account that already exists. */

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
});

export interface User {
  readonly email: string;
}

let current: User | null = null;
let known = false;
const listeners = new Set<(u: User | null) => void>();

function set(session: Session | null): void {
  const next = session?.user?.email ? { email: session.user.email } : null;
  known = true;
  if (next?.email === current?.email) return;
  current = next;
  listeners.forEach((f) => f(current));
}

/** Once at start: picks up a saved sign-in, or the one in a magic link. */
export async function startAuth(): Promise<void> {
  supabase.auth.onAuthStateChange((_e, session) => set(session));
  const { data } = await supabase.auth.getSession();
  set(data.session);
}

export function user(): User | null {
  return current;
}

export function userKnown(): boolean {
  return known;
}

export function onUser(fn: (u: User | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export type SignInResult = 'ok' | 'wrong' | 'offline';

export async function signIn(email: string, password: string): Promise<SignInResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return error.status && error.status < 500 ? 'wrong' : 'offline';
    set(data.session);
    return 'ok';
  } catch {
    return 'offline';
  }
}

export type LinkResult = 'sent' | 'no-account' | 'offline';

export async function sendLink(email: string, backTo: string): Promise<LinkResult> {
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: backTo },
    });
    if (!error) return 'sent';
    return error.status && error.status < 500 ? 'no-account' : 'offline';
  } catch {
    return 'offline';
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  set(null);
}

/** The sign-in token the separator checks; null if signed out. */
export async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
