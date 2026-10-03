"""The sign-in check, with keys made here: every way a token can be wrong
is refused, and a right one is accepted. (test_live.py does the same against
the real service with real Supabase tokens.)"""
import base64
import json
import time

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from auth import ISSUER, Refused, Verifier, bearer

KID = 'test-key'


def keypair():
    k = ec.generate_private_key(ec.SECP256R1())
    jwk = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(k.public_key()))
    jwk.update({'kid': KID, 'alg': 'ES256', 'use': 'sig'})
    return k, jwk


KEY, JWK = keypair()
OTHER, _ = keypair()


def token(key=KEY, kid=KID, alg='ES256', **over):
    now = int(time.time())
    claims = {'sub': 'user-1', 'aud': 'authenticated', 'iss': ISSUER, 'role': 'authenticated',
              'iat': now, 'exp': now + 3600, 'is_anonymous': False}
    claims.update(over)
    claims = {k: v for k, v in claims.items() if v is not None}
    return jwt.encode(claims, key, algorithm=alg, headers={'kid': kid})


@pytest.fixture
def v():
    return Verifier(fetch=lambda: {'keys': [JWK]})


def test_accepts_a_good_token(v):
    assert v.verify(token())['sub'] == 'user-1'


@pytest.mark.parametrize('why,make', [
    ('no token', lambda: None),
    ('rubbish', lambda: 'not-a-token'),
    ('expired', lambda: token(iat=int(time.time()) - 7200, exp=int(time.time()) - 60)),
    ('signed by another key', lambda: token(key=OTHER)),
    ('unknown key id', lambda: token(kid='someone-else')),
    ('another project', lambda: token(iss='https://other.supabase.co/auth/v1')),
    ('wrong audience', lambda: token(aud='anon')),
    ('anon role', lambda: token(role='anon')),
    ('anonymous sign-in', lambda: token(is_anonymous=True)),
    ('no expiry', lambda: token(exp=None)),
    ('no user', lambda: token(sub=None)),
    ('issued in the future', lambda: token(iat=int(time.time()) + 3600)),
])
def test_refuses(v, why, make):
    with pytest.raises(Refused):
        v.verify(make())


def test_refuses_a_shared_secret_token_made_with_the_public_key(v):
    """the classic trick: sign with HS256 using the public key as the secret"""
    pub = KEY.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    head = base64.urlsafe_b64encode(json.dumps({'alg': 'HS256', 'kid': KID, 'typ': 'JWT'}).encode()).rstrip(b'=')
    import hmac, hashlib
    body = base64.urlsafe_b64encode(json.dumps({'sub': 'x', 'aud': 'authenticated', 'iss': ISSUER, 'role': 'authenticated',
                                                'iat': int(time.time()), 'exp': int(time.time()) + 60}).encode()).rstrip(b'=')
    sig = base64.urlsafe_b64encode(hmac.new(pub, head + b'.' + body, hashlib.sha256).digest()).rstrip(b'=')
    with pytest.raises(Refused):
        v.verify((head + b'.' + body + b'.' + sig).decode())


def test_refuses_an_unsigned_token(v):
    head = base64.urlsafe_b64encode(b'{"alg":"none","kid":"test-key"}').rstrip(b'=').decode()
    body = base64.urlsafe_b64encode(json.dumps({'sub': 'x', 'aud': 'authenticated', 'iss': ISSUER, 'role': 'authenticated',
                                                'iat': int(time.time()), 'exp': int(time.time()) + 60}).encode()).rstrip(b'=').decode()
    with pytest.raises(Refused):
        v.verify(head + '.' + body + '.')


def test_a_tampered_token_is_refused(v):
    t = token()
    head, body, sig = t.split('.')
    claims = json.loads(base64.urlsafe_b64decode(body + '=='))
    claims['sub'] = 'someone-else'
    body2 = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b'=').decode()
    with pytest.raises(Refused):
        v.verify(head + '.' + body2 + '.' + sig)


def test_picks_up_a_rotated_key_without_restarting():
    keys = {'keys': []}
    v = Verifier(fetch=lambda: keys, now=iter(range(0, 10_000, 100)).__next__)
    with pytest.raises(Refused):
        v.verify(token())
    keys['keys'] = [JWK]
    assert v.verify(token())['sub'] == 'user-1'


def test_bearer():
    assert bearer('Bearer abc') == 'abc'
    assert bearer('bearer abc') == 'abc'
    assert bearer('Basic abc') is None
    assert bearer(None) is None
    assert bearer('Bearer ') is None
