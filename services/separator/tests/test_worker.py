"""One job through the worker, on the CPU, with a stand-in for the model
(the real model is checked in test_demix.py): the upload is deleted the
moment it is read, the first 30 seconds come early and are exactly the
start of the whole, progress is real, and music + voice = the song."""
import subprocess

import numpy as np
import pytest

import jobs as J
import sep_core as S
import worker
from conftest import ffmpeg


class HalfModel:
    """returns half of each chunk as 'the voice'; counts the chunks"""
    def __init__(self, files, job):
        self.calls, self.files, self.job, self.upload_seen = 0, files, job, []

    def __call__(self, part):
        self.calls += 1
        self.upload_seen.append(self.files.get(self.job, 'in') is not None)
        return part * 0.5


@pytest.fixture
def song(voice_path):
    p = subprocess.run([ffmpeg(), '-v', 'error', '-stream_loop', '-1', '-i', voice_path, '-t', '75',
                        '-f', 'mp3', 'pipe:1'], capture_output=True, check=True)
    return p.stdout


def test_a_job_from_upload_to_results(store, files, song, monkeypatch):
    monkeypatch.setattr(S, 'decode', _decode_real)
    job = 'job1'
    J.claim(store, 'u', job, 0)
    J.save(store, job, {'user': 'u', 'created': 0, 'stage': 'waiting'})
    files.put(job, 'in', song)
    model = HalfModel(files, job)
    seen = []
    real_update = J.update

    def watch(st, j, **ch):
        seen.append(dict(ch, made=list((st.get('job:' + j) or {}).get('made', []))))
        return real_update(st, j, **ch)
    monkeypatch.setattr(J, 'update', watch)
    monkeypatch.setattr(S, 'encode_mp3', lambda a: np.ascontiguousarray(a.T, dtype=np.float32).tobytes())   # keep the samples exact
    times = worker.run_job(job, store, files, model, 'cpu')

    assert not any(model.upload_seen)                 # gone before the first chunk
    rec = store['job:' + job]
    assert rec['stage'] == 'done' and set(rec['made']) == set(J.NAMES)
    plan = S.Plan(int(75 * S.SR))
    assert model.calls == plan.chunks
    progress = [s['progress'] for s in seen if 'progress' in s and s.get('chunks_done')]
    assert progress == [round(k / plan.chunks, 4) for k in range(1, plan.chunks + 1)]
    # the first 30 seconds arrived while separating, well before the end
    k30 = next(i for i, s in enumerate(seen) if s.get('first30'))
    chunks_by_then = max(s.get('chunks_done', 0) for s in seen[:k30])
    assert chunks_by_then == plan.chunks_for_first(30 * S.SR) < plan.chunks
    voice = np.frombuffer(files.get(job, 'voice'), np.float32).reshape(-1, 2).T
    music = np.frombuffer(files.get(job, 'music'), np.float32).reshape(-1, 2).T
    v30 = np.frombuffer(files.get(job, 'voice30'), np.float32).reshape(-1, 2).T
    assert v30.shape[1] == 30 * S.SR
    assert np.array_equal(v30, voice[:, :30 * S.SR])  # identical to the start of the whole
    mix = _decode(song)
    assert np.allclose(voice, mix * 0.5, atol=1e-6)
    assert np.allclose(voice + music, mix, atol=1e-6)
    assert 'user:u' not in store and 'slot:0' not in store
    assert times['first30_ready'] <= times['done']


def test_a_cancelled_job_stops_and_leaves_nothing(store, files, song, monkeypatch):
    monkeypatch.setattr(S, 'decode', _decode)
    job = 'job2'
    J.claim(store, 'u', job, 0)
    J.save(store, job, {'user': 'u', 'created': 0, 'stage': 'waiting'})
    files.put(job, 'in', song)

    class Cancels(HalfModel):
        def __call__(self, part):
            if self.calls == 3:
                store.put('cancel:' + job, True)
            return super().__call__(part)
    model = Cancels(files, job)
    worker.run_job(job, store, files, model, 'cpu')
    assert model.calls == 4
    assert store['job:' + job]['stage'] == 'cancelled' and files.names(job) == []
    assert 'user:u' not in store


def test_something_that_is_not_audio_fails_cleanly(store, files):
    job = 'job3'
    J.claim(store, 'u', job, 0)
    J.save(store, job, {'user': 'u', 'created': 0, 'stage': 'waiting'})
    files.put(job, 'in', b'not audio at all' * 50)
    monkeypatch_decode = pytest.MonkeyPatch()
    monkeypatch_decode.setattr(S, 'decode', _decode)
    try:
        worker.run_job(job, store, files, lambda p: p, 'cpu')
    finally:
        monkeypatch_decode.undo()
    rec = store['job:' + job]
    assert rec['stage'] == 'failed' and rec['error'] == 'could not split this file'
    assert files.names(job) == [] and 'user:u' not in store


_REAL_DECODE = S.decode


def _decode(b):
    return _REAL_DECODE(b, ffmpeg())


_decode_real = _decode


def test_plan_matches_kims_numbers():
    p = S.Plan(int(270 * S.SR))
    assert (p.step, p.fade, p.border) == (176400, 35280, 176400)
    assert p.chunks == -(-(270 * S.SR + 2 * 176400) // 176400)
    # the first 30 s are final after the chunks reaching 34 s into the padded song
    assert p.chunks_for_first(30 * S.SR) == 9
    short = S.Plan(5 * S.SR)                       # too short to pad, as in Kim's code
    assert not short.padded and short.offset == 0
