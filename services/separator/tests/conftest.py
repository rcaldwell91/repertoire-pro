import os
import shutil
import sys
import time

import pytest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)


class FakeStore(dict):
    """jobs.Store as a plain dict (modal.Dict in service)"""
    def put(self, key, value, skip_if_exists=False):
        if skip_if_exists and key in self:
            return False
        self[key] = value
        return True

    def pop(self, key, default=None):
        return super().pop(key, default)


class FakeFiles:
    """jobs.Files in memory (a modal.Volume in service)"""
    def __init__(self):
        self.f = {}

    def put(self, job, name, data):
        self.f[(job, name)] = (bytes(data), time.time())

    def get(self, job, name):
        v = self.f.get((job, name))
        return v[0] if v else None

    def remove(self, job, name):
        self.f.pop((job, name), None)

    def remove_job(self, job):
        for k in [k for k in self.f if k[0] == job]:
            del self.f[k]

    def names(self, job):
        return [n for (j, n) in self.f if j == job]

    def jobs(self):
        out = {}
        for (j, _), (_, t) in self.f.items():
            out[j] = max(out.get(j, 0), t)
        return list(out.items())


@pytest.fixture
def store():
    return FakeStore()


@pytest.fixture
def files():
    return FakeFiles()


def ffmpeg():
    return os.environ.get('FFMPEG') or shutil.which('ffmpeg') or pytest.skip('needs ffmpeg (set FFMPEG)')


@pytest.fixture(scope='session')
def voice_path():
    """A real voice, never a tone (RULEBOOK, Tests). Kept outside the repo."""
    p = os.environ.get('RP_MIC')
    if not p or not os.path.exists(p):
        pytest.fail('RP_MIC must name a recording of a real voice (kept outside the repo)')
    return p
