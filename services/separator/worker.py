"""One job on the GPU: read the upload (and delete it), split it, save the
first 30 seconds as soon as they are final, then the whole of both."""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

import numpy as np

import jobs as J
import sep_core as S

log = logging.getLogger('separator')


def run_job(job: str, store: J.Store, files: J.Files, model, device, plan_overlap: int = S.OVERLAP,
            clock: Callable[[], float] = time.time) -> dict:
    """Returns timings (seconds, no audio) for the log and the measurements."""
    t0 = clock()
    times: dict = {}
    rec = J.record(store, job)
    if not rec or rec.get('stage') != 'waiting' or store.get('cancel:' + job):
        files.remove_job(job)
        return {'skipped': True}
    user = rec.get('user')

    def cancelled() -> bool:
        return bool(store.get('cancel:' + job))

    try:
        J.update(store, job, stage='reading', started=t0, waited=round(t0 - rec['created'], 2))
        data = files.get(job, 'in')
        files.remove(job, 'in')                         # the upload is gone the moment it is read
        if data is None:
            raise ValueError('upload missing')
        mix = S.decode(data)
        del data
        if mix.shape[1] > (J.MAX_SECONDS + 1) * S.SR:
            raise ValueError('too long')
        plan = S.Plan(mix.shape[1], overlap=plan_overlap)
        times['read'] = round(clock() - t0, 2)
        J.update(store, job, stage='separating', progress=0.0, chunks_done=0, chunks=plan.chunks)
        pool = ThreadPoolExecutor(2)

        def chunk(done: int, of: int) -> None:
            J.update(store, job, progress=round(done / of, 4), chunks_done=done)

        def first(voice30: np.ndarray) -> None:
            times['first30_separated'] = round(clock() - t0, 2)
            n = voice30.shape[1]
            music30 = mix[:, :n] - voice30
            a, b = pool.submit(S.encode_mp3, voice30), pool.submit(S.encode_mp3, music30)
            files.put(job, 'voice30', a.result())
            files.put(job, 'music30', b.result())
            if not cancelled():
                J.update(store, job, first30=True, made=list(J.FIRST))
            times['first30_ready'] = round(clock() - t0, 2)

        voice = S.demix(model, mix, device, plan, on_chunk=chunk, on_first=first, should_stop=cancelled)
        if voice is None or cancelled():
            J.finish(store, files, job, 'cancelled')
            return times
        times['separated'] = round(clock() - t0, 2)
        J.update(store, job, stage='saving', progress=1.0)
        music = mix - voice
        a, b = pool.submit(S.encode_mp3, voice), pool.submit(S.encode_mp3, music)
        files.put(job, 'voice', a.result())
        files.put(job, 'music', b.result())
        made = sorted(set((J.record(store, job) or {}).get('made', [])) | set(J.RESULTS))
        times['done'] = round(clock() - t0, 2)
        if cancelled():
            J.finish(store, files, job, 'cancelled')
            return times
        J.finish(store, files, job, 'done', made=made, times=times)
        log.info('job %s done: %s', job, times)
        return times
    except Exception as e:                              # never the audio, only what went wrong
        log.warning('job %s failed: %s', job, type(e).__name__)
        J.finish(store, files, job, 'failed', error='could not split this file' if isinstance(e, ValueError) else 'server error')
        return {'failed': type(e).__name__}
    finally:
        J.let_go(store, user, job)
