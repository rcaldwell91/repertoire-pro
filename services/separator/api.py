"""The web endpoint the app talks to.

  POST   /jobs              the song file as the request body -> {"job": id}
  GET    /jobs/{id}         how far it has got (see jobs.status)
  GET    /jobs/{id}/{name}  a result: voice, music, voice30 or music30 (MP3).
                            Deleted as soon as it has been handed over.
  DELETE /jobs/{id}         cancel, and delete everything it has

Every request needs "Authorization: Bearer <the person's sign-in token>".
A person only ever sees their own jobs. Nothing about the audio is logged.
"""
from __future__ import annotations

import logging
import time
from typing import Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

import jobs as J
from auth import Refused, Verifier, bearer

log = logging.getLogger('separator')
APP_ORIGINS = ['https://rcaldwell91.github.io']


def no(status: int, why: str) -> JSONResponse:
    return JSONResponse({'error': why}, status_code=status, headers={'Cache-Control': 'no-store'})


def make_api(store: J.Store, files: J.Files, verifier: Verifier, spawn: Callable[[str], None],
             seconds_of: Callable[[bytes], float], now: Callable[[], float] = time.time) -> FastAPI:
    api = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    api.add_middleware(CORSMiddleware, allow_origins=APP_ORIGINS, allow_methods=['GET', 'POST', 'DELETE'],
                       allow_headers=['Authorization', 'Content-Type'], max_age=600)

    def who(request: Request) -> str:
        claims = verifier.verify(bearer(request.headers.get('authorization')))
        return claims['sub']

    def mine(user: str, job: str):
        rec = J.record(store, job)
        if not rec or rec.get('user') != user:
            return None                    # someone else's job looks exactly like no job
        return rec

    @api.post('/jobs')
    async def create(request: Request):
        try:
            user = await run_in_threadpool(who, request)
        except Refused as e:
            log.info('refused: %s', e)
            return no(401, 'sign in')
        size = request.headers.get('content-length')
        if size is not None and (not size.isdigit() or int(size) > J.MAX_BYTES):
            return no(413, 'too big')
        body = bytearray()
        async for part in request.stream():
            body += part
            if len(body) > J.MAX_BYTES:
                return no(413, 'too big')
        if not body:
            return no(400, 'no file')
        data = bytes(body)
        try:
            secs = await run_in_threadpool(seconds_of, data)
        except ValueError:
            return no(415, 'not audio')
        if secs > J.MAX_SECONDS:
            return no(413, 'too long')
        if secs < 1:
            return no(415, 'too short')
        return await run_in_threadpool(start, user, data, secs)

    def start(user: str, data: bytes, secs: float):
        job = J.new_id()
        t = now()
        why = J.claim(store, user, job, t)
        if why == 'yours':
            return no(429, 'one at a time')
        if why == 'full':
            return no(503, 'busy')
        try:
            J.save(store, job, {'user': user, 'created': t, 'stage': 'waiting', 'seconds': round(secs, 2)})
            files.put(job, 'in', data)
            spawn(job)
        except Exception:
            log.exception('could not start %s', job)
            J.finish(store, files, job, 'failed', error='could not start')
            return no(500, 'could not start')
        log.info('job %s started, %.0f s of audio', job, secs)
        return JSONResponse({'job': job, 'expires_in': J.KEEP_S}, status_code=202, headers={'Cache-Control': 'no-store'})

    @api.get('/jobs/{job}')
    def progress(job: str, request: Request):
        try:
            user = who(request)
        except Refused:
            return no(401, 'sign in')
        rec = mine(user, job)
        if not rec:
            return no(404, 'no such job')
        return JSONResponse(J.status(rec, now()), headers={'Cache-Control': 'no-store'})

    @api.get('/jobs/{job}/{name}')
    def result(job: str, name: str, request: Request):
        try:
            user = who(request)
        except Refused:
            return no(401, 'sign in')
        if name not in J.NAMES:
            return no(404, 'no such file')
        rec = mine(user, job)
        if not rec:
            return no(404, 'no such job')
        if now() - rec.get('created', 0) > J.KEEP_S:
            files.remove_job(job)
            return no(410, 'expired')
        if name in rec.get('collected', []):
            return no(410, 'already collected')
        if name not in rec.get('made', []):
            return no(409, 'not ready')
        data = files.get(job, name)
        if data is None:
            return no(410, 'gone')
        log.info('job %s: %s collected', job, name)
        return Response(data, media_type='audio/mpeg', headers={'Cache-Control': 'no-store'},
                        background=BackgroundTask(J.collected, store, files, job, name))

    @api.delete('/jobs/{job}')
    def cancel(job: str, request: Request):
        try:
            user = who(request)
        except Refused:
            return no(401, 'sign in')
        rec = mine(user, job)
        if not rec:
            return no(404, 'no such job')
        store.put('cancel:' + job, True)          # a running worker stops within one chunk
        if rec.get('stage') in J.ACTIVE:
            J.finish(store, files, job, 'cancelled')
        files.remove_job(job)
        log.info('job %s cancelled', job)
        return JSONResponse({'cancelled': True}, headers={'Cache-Control': 'no-store'})

    return api
