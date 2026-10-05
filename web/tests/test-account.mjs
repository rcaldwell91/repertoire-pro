/* The permanent test accounts (RULEBOOK 1d): the singer, rp-test, and the
   coach linked to it, rp-coach. Their passwords are worked out from a
   secret the test machine already holds, the same way as
   services/separator/test_account.py; they are never written down. */
import { createHmac } from 'node:crypto';

export const EMAIL = 'rp-test@example.com';

export const COACH_EMAIL = 'rp-coach@example.com';

export function password(email = EMAIL) {
  const secret = process.env.MODAL_TOKEN_SECRET;
  if (!secret) throw new Error('MODAL_TOKEN_SECRET is needed to sign in as a test account');
  return createHmac('sha256', secret).update('repertoire test account ' + email).digest('base64url').slice(0, 24);
}
