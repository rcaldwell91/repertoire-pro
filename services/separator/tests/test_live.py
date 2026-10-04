"""Against the deployed service, with real Supabase sign-in tokens.

    RP_LIVE=1 RP_SEP_URL=https://... RP_EMAIL=... RP_PASSWORD=... \
    RP_EXPIRED_TOKEN=... RP_MIC=<a real voice recording> python -m pytest tests/test_live.py

RP_EMAIL/RP_PASSWORD: a throwaway account, made through the app's public
sign-up and deleted afterwards. RP_EXPIRED_TOKEN: a real sign-in token for
it that has run out (Supabase's last longer than an hour, so it is one taken
over an hour earlier). Audio is real voice, never a tone, and stays outside
the repo.
"""
import base64
import json
import os
import subprocess
import time
import urllib.error
import urllib.request

import pytest

from conftest import ffmpeg

pytestmark = pytest.mark.skipif(os.environ.get('RP_LIVE') != '1', reason='needs the deployed service (RP_LIVE=1)')

URL = os.environ.get('RP_SEP_URL', '').rstrip('/')


def call(method, path, token=None, data=None):
    h = {}
    if token is not None:
        h['Authorization'] = 'Bearer ' + token
    if data is not None:
        h['Content-Type'] = 'audio/mpeg'
    req = urllib.request.Request(URL + path, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def claims(token):
    return json.loads(base64.urlsafe_b64decode(token.split('.')[1] + '=='))


@pytest.fixture(scope='module')
def token():
    from measure import sign_in
    return sign_in(os.environ['RP_EMAIL'], os.environ['RP_PASSWORD'])


def clip(voice_path, seconds, *extra):
    return subprocess.run([ffmpeg(), '-v', 'error', '-stream_loop', '-1', '-i', voice_path, '-t', str(seconds),
                           *extra, '-f', 'mp3', 'pipe:1'], capture_output=True, check=True).stdout


@pytest.fixture(scope='module')
def voice40(voice_path):
    return clip(voice_path, 40)


def files_left(job):
    import modal
    from storage import VolumeFiles
    return VolumeFiles(modal.Volume.from_name('repertoire-separator-files', version=2)).names(job)


def test_refuses_no_token(voice40):
    assert call('POST', '/jobs', None, voice40)[0] == 401


def test_refuses_a_bad_token(voice40):
    assert call('POST', '/jobs', 'nonsense', voice40)[0] == 401
    # well formed, right project and audience, but signed by a key of our own
    from test_auth import token as forged
    assert call('POST', '/jobs', forged(), voice40)[0] == 401


def test_refuses_a_real_expired_token(voice40):
    old = os.environ.get('RP_EXPIRED_TOKEN')
    assert old, 'RP_EXPIRED_TOKEN must be a real sign-in token that has run out'
    c = claims(old)
    assert c['iss'].startswith('https://ovafsbloyrlwrolqtcat.supabase.co') and c['exp'] < time.time()
    assert call('POST', '/jobs', old, voice40)[0] == 401


def test_accepts_a_signed_in_user_and_leaves_nothing_behind(token, voice40, voice_path):
    st, body = call('POST', '/jobs', token, voice40)
    assert st == 202, body
    job = json.loads(body)['job']
    # one at a time: a second upload while this one runs is refused
    assert call('POST', '/jobs', token, clip(voice_path, 5))[0] == 429
    first30_at, progress = None, []
    t = time.time()
    while True:
        s = json.loads(call('GET', f'/jobs/{job}', token)[1])
        progress.append(s['progress'])
        if s['first30_ready'] and first30_at is None:
            first30_at = s['progress']
        if s['stage'] in ('done', 'failed', 'cancelled'):
            break
        assert time.time() - t < 600
        time.sleep(0.25)
    assert s['stage'] == 'done', s
    assert progress == sorted(progress) and progress[-1] == 1.0
    assert first30_at is not None and first30_at < 1.0           # the first 30 s came before the end
    got = {}
    for part in ('voice30', 'music30', 'voice', 'music'):
        st, body = call('GET', f'/jobs/{job}/{part}', token)
        assert st == 200 and len(body) > 10_000
        got[part] = body
        seconds = len(subprocess.run([ffmpeg(), '-v', 'error', '-i', 'pipe:0', '-f', 's16le', '-ac', '1', '-ar', '8000',
                                      'pipe:1'], input=body, capture_output=True, check=True).stdout) / 16000
        assert abs(seconds - (30 if part.endswith('30') else 40)) < 0.2
        assert call('GET', f'/jobs/{job}/{part}', token)[0] == 410          # collected means gone
    assert json.loads(call('GET', f'/jobs/{job}', token)[1])['ready'] == []
    assert files_left(job) == []
    # voice + music add back up to the song: in time (no shift) and at its own level (no scaling)
    import numpy as np
    import sep_core as S
    song = S.decode(voice40, ffmpeg())
    total = S.decode(got['voice'], ffmpeg()) + S.decode(got['music'], ffmpeg())
    n = min(song.shape[1], total.shape[1])
    a, b = song[0, 2000:n - 2000], total[0]
    lag = max(range(-1500, 1501), key=lambda k: float(np.dot(a[::4], b[2000 + k:2000 + k + len(a)][::4])))
    assert lag == 0, f'voice + music is shifted by {lag} samples'
    err = song[:, :n] - total[:, :n]
    assert 10 * np.log10(np.sum(song[:, :n] ** 2) / np.sum(err ** 2)) > 20     # only MP3 coding left between them
    assert abs(np.sum(song[:, :n] * total[:, :n]) / np.sum(total[:, :n] ** 2) - 1) < 0.01


def wait_done(job, token):
    t = time.time()
    while True:
        s = json.loads(call('GET', f'/jobs/{job}', token)[1])
        if s['stage'] in ('done', 'failed', 'cancelled'):
            return s
        assert time.time() - t < 600
        time.sleep(0.5)


def test_collecting_both_at_once_leaves_nothing_not_even_the_30_second_files(token, voice40):
    """voice and music fetched at the same moment, the 30-second files never
    fetched: everything is gone afterwards"""
    from concurrent.futures import ThreadPoolExecutor
    st, body = call('POST', '/jobs', token, voice40)
    assert st == 202, body
    job = json.loads(body)['job']
    assert wait_done(job, token)['stage'] == 'done'
    assert sorted(files_left(job)) == ['music', 'music30', 'voice', 'voice30']
    with ThreadPoolExecutor(2) as pool:
        got = list(pool.map(lambda part: call('GET', f'/jobs/{job}/{part}', token), ['voice', 'music']))
    assert [g[0] for g in got] == [200, 200]
    t = time.time()
    while files_left(job) and time.time() - t < 10:      # deleted just after the hand-over
        time.sleep(0.5)
    assert files_left(job) == []
    for part in ('voice', 'music', 'voice30', 'music30'):
        assert call('GET', f'/jobs/{job}/{part}', token)[0] == 410


def test_an_abandoned_job_is_swept(token, voice40):
    """Results nobody collects are deleted by the sweep (here run on demand,
    as if the keep time had passed)."""
    import modal
    st, body = call('POST', '/jobs', token, voice40)
    assert st == 202, body
    job = json.loads(body)['job']
    assert wait_done(job, token)['stage'] == 'done'
    assert sorted(files_left(job)) == ['music', 'music30', 'voice', 'voice30']
    modal.Function.from_name('repertoire-separator', 'sweep_now').remote(keep_s=0)
    assert files_left(job) == []
    assert call('GET', f'/jobs/{job}/voice', token)[0] == 404


def send_whole(token, data, chunked):
    """Send the whole upload, then read the answer. (Modal's front door
    holds a request until all of it has arrived, so the answer comes after
    the last byte.) chunked: without saying the size up front."""
    import http.client
    import urllib.parse
    host = urllib.parse.urlparse(URL).hostname
    proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    if proxy:
        p = urllib.parse.urlparse(proxy)
        conn = http.client.HTTPSConnection(p.hostname, p.port, timeout=180)
        conn.set_tunnel(host, 443)
    else:
        conn = http.client.HTTPSConnection(host, 443, timeout=180)
    conn.putrequest('POST', '/jobs')
    conn.putheader('Authorization', 'Bearer ' + token)
    conn.putheader('Content-Type', 'audio/wav')
    conn.putheader('Transfer-Encoding' if chunked else 'Content-Length', 'chunked' if chunked else str(len(data)))
    conn.endheaders()
    for i in range(0, len(data), 1 << 20):
        part = data[i:i + (1 << 20)]
        conn.send(b'%x\r\n%s\r\n' % (len(part), part) if chunked else part)
    if chunked:
        conn.send(b'0\r\n\r\n')
    r = conn.getresponse()
    out = r.status, json.loads(r.read())
    conn.close()
    return out


def test_refuses_files_over_the_limits(token, voice_path, tmp_path):
    big = tmp_path / 'big.wav'
    subprocess.run([ffmpeg(), '-v', 'error', '-stream_loop', '-1', '-i', voice_path, '-t', '200', '-ac', '2',
                    '-ar', '44100', str(big)], check=True)
    data = big.read_bytes()
    assert len(data) > 30_000_000
    assert send_whole(token, data, chunked=False) == (413, {'error': 'too big'})   # says its size
    assert send_whole(token, data, chunked=True) == (413, {'error': 'too big'})    # does not
    long = clip(voice_path, 660, '-ac', '1', '-b:a', '32k')
    assert len(long) < 30_000_000
    st, body = call('POST', '/jobs', token, long)
    assert (st, json.loads(body)['error']) == (413, 'too long')
