"""The web endpoint, in-process, with the store and files in memory and a
real voice recording for the audio. test_live.py repeats the important ones
against the real service."""
import os
import subprocess
import time

import pytest
from fastapi.testclient import TestClient

import jobs as J
import sep_core as S
from api import make_api
from auth import Verifier
from conftest import ffmpeg
from test_auth import JWK, token


def clip(voice_path, tmp_path, seconds, name, extra=()):
    out = tmp_path / name
    subprocess.run([ffmpeg(), '-v', 'error', '-y', '-stream_loop', '-1', '-i', voice_path, '-t', str(seconds),
                    *extra, str(out)], check=True)
    return out.read_bytes()


@pytest.fixture(scope='module')
def songs(voice_path, tmp_path_factory):
    t = tmp_path_factory.mktemp('songs')
    return {
        'short': clip(voice_path, t, 20, 'short.mp3'),
        # eleven minutes of real voice, small enough to pass the size limit
        'long': clip(voice_path, t, 660, 'long.mp3', ('-ac', '1', '-b:a', '32k')),
        # over 30 MB of real voice (uncompressed)
        'big': clip(voice_path, t, 200, 'big.wav', ('-ac', '2', '-ar', '44100')),
    }


@pytest.fixture
def world(store, files):
    spawned = []
    api = make_api(store, files, Verifier(fetch=lambda: {'keys': [JWK]}), spawned.append,
                   lambda b: S.seconds_of(b, ffmpeg()))
    return TestClient(api), spawned


def auth(user='user-1', **over):
    return {'Authorization': 'Bearer ' + token(sub=user, **over)}


def up(client, data, headers):
    return client.post('/jobs', content=data, headers={**headers, 'Content-Type': 'audio/mpeg'})


def test_refuses_no_token_a_bad_token_and_an_expired_token(world, songs, files):
    c, spawned = world
    assert up(c, songs['short'], {}).status_code == 401
    assert up(c, songs['short'], {'Authorization': 'Bearer nonsense'}).status_code == 401
    old = int(time.time()) - 7200
    assert up(c, songs['short'], auth(iat=old, exp=old + 3600)).status_code == 401
    assert spawned == [] and files.f == {}


def test_accepts_a_signed_in_user_and_hands_only_the_job_id_on(world, songs, store, files):
    c, spawned = world
    r = up(c, songs['short'], auth())
    assert r.status_code == 202, r.text
    job = r.json()['job']
    assert spawned == [job]
    assert files.get(job, 'in') == songs['short']
    rec = store['job:' + job]
    assert rec['user'] == 'user-1' and rec['stage'] == 'waiting' and 19.5 < rec['seconds'] < 20.5
    s = c.get(f'/jobs/{job}', headers=auth()).json()
    assert s['stage'] == 'waiting' and s['progress'] == 0 and s['first30_ready'] is False


def test_refuses_files_over_the_limits(world, songs):
    c, spawned = world
    assert len(songs['big']) > J.MAX_BYTES
    r = up(c, songs['big'], auth())
    assert (r.status_code, r.json()['error']) == (413, 'too big')
    # and without saying its size up front (sent in pieces)
    def pieces(b=songs['big']):
        for i in range(0, len(b), 1 << 20):
            yield b[i:i + 1 << 20]
    r = c.post('/jobs', content=pieces(), headers={**auth(), 'Content-Type': 'audio/wav'})
    assert (r.status_code, r.json()['error']) == (413, 'too big')
    assert len(songs['long']) < J.MAX_BYTES
    r = up(c, songs['long'], auth())
    assert (r.status_code, r.json()['error']) == (413, 'too long')
    r = up(c, b'this is not a song' * 100, auth())
    assert r.status_code == 415
    assert spawned == []


def test_one_job_per_person_and_a_cap_on_everyone(world, songs, store, files):
    c, spawned = world
    first = up(c, songs['short'], auth('a')).json()['job']
    r = up(c, songs['short'], auth('a'))
    assert (r.status_code, r.json()['error']) == (429, 'one at a time')
    assert up(c, songs['short'], auth('b')).status_code == 202
    assert up(c, songs['short'], auth('c')).status_code == 202
    r = up(c, songs['short'], auth('d'))
    assert (r.status_code, r.json()['error']) == (503, 'busy')
    # when a's job ends, a and d can go again
    J.finish(store, files, first, 'done', made=list(J.RESULTS))
    assert up(c, songs['short'], auth('a')).status_code == 202
    J.finish(store, files, spawned[1], 'failed')
    assert up(c, songs['short'], auth('d')).status_code == 202


def test_results_are_deleted_once_collected_and_only_the_owner_sees_them(world, songs, store, files):
    c, _ = world
    job = up(c, songs['short'], auth()).json()['job']
    assert c.get(f'/jobs/{job}/voice', headers=auth()).status_code == 409          # not ready yet
    files.remove(job, 'in')
    for n in J.NAMES:
        files.put(job, n, b'mp3 of ' + n.encode())
    J.finish(store, files, job, 'done', made=list(J.NAMES))
    assert c.get(f'/jobs/{job}', headers=auth('someone-else')).status_code == 404
    assert c.get(f'/jobs/{job}/voice', headers=auth('someone-else')).status_code == 404
    r = c.get(f'/jobs/{job}/voice30', headers=auth())
    assert r.status_code == 200 and r.content == b'mp3 of voice30'
    assert files.get(job, 'voice30') is None
    assert c.get(f'/jobs/{job}/voice30', headers=auth()).status_code == 410
    assert c.get(f'/jobs/{job}/voice', headers=auth()).content == b'mp3 of voice'
    assert c.get(f'/jobs/{job}/music', headers=auth()).content == b'mp3 of music'
    # both whole results collected: nothing at all is left, not even the unclaimed 30 s file
    assert files.names(job) == []
    assert c.get(f'/jobs/{job}/music30', headers=auth()).status_code == 410


def test_cancel_deletes_everything_and_frees_the_turn(world, songs, store, files):
    c, _ = world
    job = up(c, songs['short'], auth()).json()['job']
    assert c.delete(f'/jobs/{job}', headers=auth('someone-else')).status_code == 404
    assert c.delete(f'/jobs/{job}', headers=auth()).status_code == 200
    assert files.names(job) == [] and store['cancel:' + job] is True
    assert up(c, songs['short'], auth()).status_code == 202


def test_the_sweep_deletes_anything_over_the_limit(world, songs, store, files):
    c, _ = world
    old = up(c, songs['short'], auth('a')).json()['job']
    J.finish(store, files, old, 'done', made=list(J.RESULTS))
    files.put(old, 'voice', b'x')
    stuck = up(c, songs['short'], auth('b')).json()['job']
    fresh = up(c, songs['short'], auth('c')).json()['job']
    J.update(store, old, created=time.time() - J.KEEP_S - 1)
    J.update(store, stuck, created=time.time() - J.STUCK_S - 1)
    gone = J.sweep(store, files, time.time())
    assert files.names(old) == [] and 'job:' + old not in store
    assert store['job:' + stuck]['stage'] == 'failed' and files.names(stuck) == []
    assert 'user:b' not in store
    assert files.names(fresh) == ['in'] and store['job:' + fresh]['stage'] == 'waiting'
    assert gone['files'] >= 1 and gone['stuck'] == 1
    # and an expired result is refused even before the sweep gets to it
    J.update(store, fresh, created=time.time() - J.KEEP_S - 1, stage='done', made=list(J.RESULTS))
    files.put(fresh, 'voice', b'x')
    assert c.get(f'/jobs/{fresh}/voice', headers=auth('c')).status_code == 410
    assert files.names(fresh) == []


def test_the_keep_limit_is_under_an_hour():
    assert J.KEEP_S + J.SWEEP_S < 3600
