/* The permanent test coach (RULEBOOK 1d): rp-coach@example.com, made once
   through the app's own public paths and kept - sign up, switch teaching on,
   add rp-test@example.com as a student. Safe to run again: it signs in if
   the account is there, and the steps after that do nothing twice. It never
   touches any other account. Needs MODAL_TOKEN_SECRET (for the passwords).

     node scripts/coach-account.mjs */
import { execFileSync } from 'node:child_process';
import { SUPABASE_KEY, SUPABASE_URL } from '../src/data/config.ts';
import { COACH_EMAIL, EMAIL, password } from '../tests/test-account.mjs';

/* through curl, so the machine's own network settings apply */
function call(path, body, token) {
  const out = execFileSync('curl', ['-sS', '-X', 'POST', SUPABASE_URL + path,
    '-H', 'apikey: ' + SUPABASE_KEY, '-H', 'content-type: application/json',
    '-H', 'authorization: Bearer ' + (token || SUPABASE_KEY), '--data', JSON.stringify(body)], { encoding: 'utf8' });
  return out ? JSON.parse(out) : null;
}

const pw = password(COACH_EMAIL);
let s = call('/auth/v1/token?grant_type=password', { email: COACH_EMAIL, password: pw });
if (!s.access_token) {
  const up = call('/auth/v1/signup', { email: COACH_EMAIL, password: pw, data: { display_name: 'Test Coach' } });
  if (up.error || up.msg) throw new Error('sign-up: ' + (up.msg || up.error_description || up.error));
  s = call('/auth/v1/token?grant_type=password', { email: COACH_EMAIL, password: pw });
  if (!s.access_token) throw new Error('signed up, but cannot sign in: ' + JSON.stringify(s));
  console.log('made', COACH_EMAIL);
} else console.log('already there:', COACH_EMAIL);
console.log('teaching on, code', call('/rest/v1/rpc/become_coach', {}, s.access_token));
console.log('student added:', call('/rest/v1/rpc/add_student_by_email', { p_email: EMAIL }, s.access_token));
