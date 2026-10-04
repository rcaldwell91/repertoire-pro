/* The one permanent test account (RULEBOOK 1d). Its password is worked out
   from a secret the test machine already holds, the same way as
   services/separator/test_account.py; it is never written down. */
import { createHmac } from 'node:crypto';

export const EMAIL = 'rp-test@example.com';

export function password() {
  const secret = process.env.MODAL_TOKEN_SECRET;
  if (!secret) throw new Error('MODAL_TOKEN_SECRET is needed to sign in as the test account');
  return createHmac('sha256', secret).update('repertoire test account ' + EMAIL).digest('base64url').slice(0, 24);
}
