"""The one permanent test account (RULEBOOK 1d): rp-test@example.com.

Created once, through the app's public sign-up, and kept. Its password is
never written down: it is worked out from a secret the test machine already
holds (MODAL_TOKEN_SECRET), so every session can sign in and nothing secret
is in the repo. web/tests/test-account.mjs works it out the same way."""
import base64
import hashlib
import hmac
import os

EMAIL = 'rp-test@example.com'


def password() -> str:
    secret = os.environ.get('MODAL_TOKEN_SECRET')
    if not secret:
        raise SystemExit('MODAL_TOKEN_SECRET is needed to sign in as the test account')
    mac = hmac.new(secret.encode(), b'repertoire test account ' + EMAIL.encode(), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(mac).decode()[:24]
