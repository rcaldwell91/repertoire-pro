"""Jobs: who is running what, the limits, and throwing everything away.

Kept in a small key-value store (a modal.Dict in service; a plain dict in
tests). No audio is ever in it: only the job's owner (their user id), when
it started, how far it has got, and which files it has made.

  job:<id>     the job's record
  user:<uid>   the one job this person has running (one at a time)
  slot:<n>     the simultaneous-jobs cap: a job holds one slot while running
  cancel:<id>  set when the person cancels

The audio itself is in Files (a modal.Volume in service), under the job id:
  in            the upload, deleted as soon as the worker has read it
  voice, music  the results
  voice30, music30   the first 30 seconds, ready early
Each result is deleted as soon as it has been collected. Whatever is left is
deleted by the sweep once it is older than KEEP_S, and the sweep runs every
SWEEP_S, so nothing outlives KEEP_S + SWEEP_S, under an hour.
"""
from __future__ import annotations

import secrets
import time
from typing import Iterable, Optional, Protocol

MAX_BYTES = 30_000_000          # 30 MB
MAX_SECONDS = 600               # 10 minutes
MAX_JOBS = 3                    # running at once, across everyone
KEEP_S = 45 * 60                # results are kept at most this long...
SWEEP_S = 10 * 60               # ...plus the sweep's interval: < 1 hour
STUCK_S = 20 * 60               # a job not finished by now has died

RESULTS = ('voice', 'music')
FIRST = ('voice30', 'music30')
NAMES = RESULTS + FIRST
ACTIVE = ('waiting', 'reading', 'separating', 'saving')


class Store(Protocol):
    def get(self, key: str, default=None): ...
    def put(self, key: str, value, skip_if_exists: bool = False) -> bool: ...
    def pop(self, key: str, default=None): ...
    def keys(self) -> Iterable[str]: ...


class Files(Protocol):
    def put(self, job: str, name: str, data: bytes) -> None: ...
    def get(self, job: str, name: str) -> Optional[bytes]: ...
    def remove(self, job: str, name: str) -> None: ...
    def remove_job(self, job: str) -> None: ...
    def names(self, job: str) -> list[str]: ...
    def jobs(self) -> list[tuple[str, float]]: ...      # (job id, newest file time)


def new_id() -> str:
    return secrets.token_urlsafe(16)


def record(store: Store, job: str) -> Optional[dict]:
    return store.get('job:' + job)


def save(store: Store, job: str, rec: dict) -> None:
    store.put('job:' + job, rec)


def update(store: Store, job: str, **change) -> dict:
    rec = dict(record(store, job) or {})
    rec.update(change)
    save(store, job, rec)
    return rec


def active(rec: Optional[dict], now: float) -> bool:
    return bool(rec) and rec.get('stage') in ACTIVE and now - rec.get('created', 0) < STUCK_S


def claim(store: Store, user: str, job: str, now: float) -> Optional[str]:
    """Take this person's one turn and one of the shared slots for a new job.
    None if taken; otherwise why not: 'yours' (they already have one
    running) or 'full' (every slot is busy)."""
    key = 'user:' + user
    if not store.put(key, job, skip_if_exists=True):
        held = store.get(key)
        if held and active(record(store, held), now):
            return 'yours'
        store.pop(key)                                   # left by a job that has ended
        if not store.put(key, job, skip_if_exists=True):
            return 'yours'
    for n in range(MAX_JOBS):
        s = f'slot:{n}'
        if store.put(s, job, skip_if_exists=True):
            return None
        held = store.get(s)
        if not (held and active(record(store, held), now)):
            store.pop(s)
            if store.put(s, job, skip_if_exists=True):
                return None
    store.pop(key)
    return 'full'


def let_go(store: Store, user: Optional[str], job: str) -> None:
    """Give back the person's turn and the slot, if this job holds them."""
    if user and store.get('user:' + user) == job:
        store.pop('user:' + user)
    for n in range(MAX_JOBS):
        if store.get(f'slot:{n}') == job:
            store.pop(f'slot:{n}')


def finish(store: Store, files: Files, job: str, stage: str, **change) -> None:
    """The job has ended (done, failed or cancelled): free its turn and slot.
    A failed or cancelled job leaves nothing behind."""
    rec = update(store, job, stage=stage, ended=time.time(), **change)
    let_go(store, rec.get('user'), job)
    if stage != 'done':
        files.remove_job(job)


def collected(store: Store, files: Files, job: str, name: str) -> None:
    """A result has been handed over: delete it. Once both whole results
    are gone, delete everything else the job has too."""
    files.remove(job, name)
    rec = record(store, job) or {}
    got = sorted(set(rec.get('collected', [])) | {name})
    update(store, job, collected=got)
    if rec.get('stage') == 'done' and all(r in got for r in RESULTS):
        files.remove_job(job)


def sweep(store: Store, files: Files, now: float) -> dict:
    """Run every SWEEP_S: delete anything older than KEEP_S, and end jobs
    that died without ending themselves."""
    gone = {'files': 0, 'records': 0, 'stuck': 0, 'locks': 0}
    for job, newest in files.jobs():
        rec = record(store, job)
        born = rec.get('created', newest) if rec else newest
        if now - born > KEEP_S or rec is None:
            files.remove_job(job)
            gone['files'] += 1
    for key in list(store.keys()):
        if key.startswith('job:'):
            job, rec = key[4:], store.get(key) or {}
            age = now - rec.get('created', 0)
            if rec.get('stage') in ACTIVE and age >= STUCK_S:
                finish(store, files, job, 'failed', error='took too long')
                gone['stuck'] += 1
            if age > KEEP_S:
                files.remove_job(job)
                store.pop(key)
                store.pop('cancel:' + job)
                gone['records'] += 1
        elif key.startswith(('user:', 'slot:')):
            held = store.get(key)
            if not (held and active(record(store, held), now)):
                store.pop(key)
                gone['locks'] += 1
        elif key.startswith('cancel:') and record(store, key[7:]) is None:
            store.pop(key)
    return gone


def status(rec: dict, now: float) -> dict:
    """What the app is told about a job: real progress, never a guess."""
    out = {
        'stage': rec.get('stage'),
        'progress': rec.get('progress', 0.0),
        'chunks_done': rec.get('chunks_done', 0),
        'chunks': rec.get('chunks'),
        'seconds': rec.get('seconds'),
        'first30_ready': bool(rec.get('first30')),
        'ready': [n for n in rec.get('made', []) if n not in rec.get('collected', [])],
        'expires_in': max(0, int(rec.get('created', now) + KEEP_S - now)),
    }
    if rec.get('error'):
        out['error'] = rec['error']
    return out
