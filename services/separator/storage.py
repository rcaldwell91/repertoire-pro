"""jobs.Store and jobs.Files on Modal: a modal.Dict and a modal.Volume,
used through Modal's own API (no mounted folder), so every container sees
the same thing at once and nothing needs syncing."""
from __future__ import annotations

import io
from typing import Optional

import modal
from modal.exception import NotFoundError

_MISSING = (NotFoundError, FileNotFoundError, KeyError)


class DictStore:
    def __init__(self, d: modal.Dict):
        self.d = d

    def get(self, key, default=None):
        return self.d.get(key, default)

    def put(self, key, value, skip_if_exists: bool = False) -> bool:
        return self.d.put(key, value, skip_if_exists=skip_if_exists)

    def pop(self, key, default=None):
        return self.d.pop(key, default)

    def keys(self):
        return list(self.d.keys())


class VolumeFiles:
    def __init__(self, vol: modal.Volume):
        self.v = vol

    def put(self, job: str, name: str, data: bytes) -> None:
        with self.v.batch_upload(force=True) as b:
            b.put_file(io.BytesIO(data), f'/{job}/{name}')

    def get(self, job: str, name: str) -> Optional[bytes]:
        buf = io.BytesIO()
        try:
            self.v.read_file_into_fileobj(f'/{job}/{name}', buf)
        except _MISSING:
            return None
        return buf.getvalue()

    def remove(self, job: str, name: str) -> None:
        try:
            self.v.remove_file(f'/{job}/{name}')
        except _MISSING:
            pass

    def remove_job(self, job: str) -> None:
        try:
            self.v.remove_file(f'/{job}', recursive=True)
        except _MISSING:
            pass

    def names(self, job: str) -> list[str]:
        try:
            return [e.path.rsplit('/', 1)[-1] for e in self.v.listdir(f'/{job}')]
        except _MISSING:
            return []

    def jobs(self) -> list[tuple[str, float]]:
        newest: dict[str, float] = {}
        for e in self.v.listdir('/', recursive=True):
            job = e.path.strip('/').split('/')[0]
            if job:
                newest[job] = max(newest.get(job, 0.0), float(e.mtime))
        return list(newest.items())
