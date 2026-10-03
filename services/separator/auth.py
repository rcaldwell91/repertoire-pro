"""Only signed-in Repertoire users.

A request carries the person's Supabase sign-in token (the access token the
app already holds). It is checked against the Repertoire project's PUBLIC
signing keys, fetched from Supabase's published key list: nothing secret is
needed or held anywhere. Anything that is not a current sign-in token for a
real (not anonymous) Repertoire user, signed by one of those keys, is
refused.
"""
from __future__ import annotations

import json
import time
import urllib.request
from typing import Callable, Optional

import jwt

PROJECT = 'ovafsbloyrlwrolqtcat'
ISSUER = f'https://{PROJECT}.supabase.co/auth/v1'
JWKS_URL = f'{ISSUER}/.well-known/jwks.json'
AUDIENCE = 'authenticated'
# Asymmetric only: a token "signed" with a shared secret (HS256), or with
# no signature at all, is never accepted.
ALLOWED_ALGS = ('ES256', 'RS256')
KEYS_FRESH_S = 600
REFETCH_GAP_S = 60


class Refused(Exception):
    """Why a token was refused (for the test and the log; never the token)."""


def fetch_jwks(url: str = JWKS_URL) -> dict:
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read())


class Verifier:
    def __init__(self, fetch: Callable[[], dict] = fetch_jwks, now: Callable[[], float] = time.time,
                 issuer: str = ISSUER):
        self._fetch = fetch
        self._now = now
        self._issuer = issuer
        self._keys: dict[str, jwt.PyJWK] = {}
        self._got_at = 0.0
        self._tried_at = -1e9

    def _load(self) -> None:
        self._tried_at = self._now()
        keys = {}
        for k in self._fetch().get('keys', []):
            if k.get('alg') in ALLOWED_ALGS and k.get('kid') and k.get('use', 'sig') == 'sig':
                keys[k['kid']] = jwt.PyJWK(k)
        self._keys = keys
        self._got_at = self._now()

    def _key(self, kid: str) -> jwt.PyJWK:
        if not self._keys or self._now() - self._got_at > KEYS_FRESH_S:
            self._load()
        if kid not in self._keys and self._now() - self._tried_at > REFETCH_GAP_S:
            self._load()                       # a newly rotated key
        if kid not in self._keys:
            raise Refused('unknown signing key')
        return self._keys[kid]

    def verify(self, token: Optional[str]) -> dict:
        """The token's claims if it is good; Refused if not."""
        if not token:
            raise Refused('no token')
        try:
            head = jwt.get_unverified_header(token)
        except jwt.PyJWTError:
            raise Refused('not a token')
        alg = head.get('alg')
        if alg not in ALLOWED_ALGS:
            raise Refused('wrong kind of signature')
        key = self._key(head.get('kid') or '')
        if key.algorithm_name != alg:
            raise Refused('wrong kind of signature')
        try:
            claims = jwt.decode(
                token, key.key, algorithms=[alg], audience=AUDIENCE, issuer=self._issuer, leeway=0,
                options={'require': ['exp', 'iat', 'sub', 'aud', 'iss'], 'verify_iat': True},
            )
        except jwt.ExpiredSignatureError:
            raise Refused('expired')
        except jwt.PyJWTError as e:
            raise Refused('bad token: ' + type(e).__name__)
        if claims.get('role') != 'authenticated':
            raise Refused('not a signed-in user')
        if claims.get('is_anonymous') is True:
            raise Refused('anonymous')
        return claims


def bearer(header: Optional[str]) -> Optional[str]:
    if not header:
        return None
    parts = header.split(' ', 1)
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return None
    return parts[1].strip() or None
