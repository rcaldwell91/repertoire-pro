/* Every take of the test singer (rp-test@example.com), and only that
   account's, removed through its own sign-in: its rows in the takes table
   and its recordings in the takes store. Run before and after the take
   checks, so nothing a test made is left behind - even by a broken build
   that was meant not to delete. Never touches any other account. */
import { execFileSync } from 'node:child_process';
import { SUPABASE_KEY, SUPABASE_URL } from '../src/data/config.ts';
import { EMAIL, password } from './test-account.mjs';

function call(method, path, token, body) {
  const args = ['-sS', '-X', method, SUPABASE_URL + path, '-H', 'apikey: ' + SUPABASE_KEY, '-H', 'authorization: Bearer ' + (token || SUPABASE_KEY),
    '-H', 'content-type: application/json'];
  if (body) args.push('--data', JSON.stringify(body));
  const out = execFileSync('curl', args, { encoding: 'utf8' });
  try { return JSON.parse(out); } catch { return null; }
}

export function clearTestTakes() {
  const s = call('POST', '/auth/v1/token?grant_type=password', null, { email: EMAIL, password: password(EMAIL) });
  if (!s?.access_token || s.user?.email !== EMAIL) throw new Error('could not sign in as ' + EMAIL);
  const me = s.user.id;
  const rows = call('GET', `/rest/v1/takes?select=id&student_id=eq.${me}`, s.access_token) || [];
  if (rows.length) call('DELETE', `/rest/v1/takes?student_id=eq.${me}`, s.access_token);
  const files = (call('POST', '/storage/v1/object/list/takes', s.access_token, { prefix: me, limit: 1000 }) || []).map((f) => `${me}/${f.name}`);
  if (files.length) call('DELETE', '/storage/v1/object/takes', s.access_token, { prefixes: files });
  return { rows: rows.length, files: files.length };
}

if (import.meta.url === `file://${process.argv[1]}`) console.log('removed', clearTestTakes());
