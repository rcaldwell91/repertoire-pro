"""Speed and cost on Modal, through the real web endpoint, as the app will
use it.

    RP_EMAIL=... RP_PASSWORD=... python measure.py --gpu L4 --out DIR "All of Me=path/to/song.mp3" ...

Each song runs in its own short-lived copy of the service (an ephemeral
Modal app, tagged with the song and the GPU), so Modal's own usage report
gives each song's real cost, cold start included; nothing else runs in that
app. The person signs in through the app's public sign-in (the test account
is a throwaway, deleted afterwards).

Times are taken by polling the job, as the app would, every 0.25 s:
  accepted     the upload was received and checked
  first30      the first 30 seconds of voice and music can be collected
  done         the whole of both can be collected
and the GPU's own record of where the time went (waiting for a GPU, reading,
separating, saving). Writes DIR/<gpu>-<song>-{voice,music,voice30,music30}.mp3
and DIR/times-<gpu>.json. Audio stays outside the repo.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request

SUPABASE = 'https://ovafsbloyrlwrolqtcat.supabase.co'
PUBLISHABLE_KEY = 'sb_publishable_WmDlaoUkUMerztbTXdMCuA_chfdxXsw'   # public, as in the app


def sign_in(email: str, password: str) -> str:
    req = urllib.request.Request(f'{SUPABASE}/auth/v1/token?grant_type=password',
                                 data=json.dumps({'email': email, 'password': password}).encode(),
                                 headers={'apikey': PUBLISHABLE_KEY, 'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=20).read())['access_token']


def call(method: str, url: str, token: str, data: bytes | None = None, ctype: str = 'audio/mpeg'):
    h = {'Authorization': 'Bearer ' + token}
    if data is not None:
        h['Content-Type'] = ctype
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()


def one_song(base: str, token: str, name: str, path: str, out: str, gpu: str, store) -> dict:
    data = open(path, 'rb').read()
    t0 = time.time()
    st, body = call('POST', base + '/jobs', token, data)
    if st != 202:
        raise SystemExit(f'{name}: upload refused {st} {body[:200]!r}')
    job = json.loads(body)['job']
    t_acc = time.time()
    first30 = done = None
    stages = {}
    while True:
        st, body = call('GET', f'{base}/jobs/{job}', token)
        s = json.loads(body)
        now = time.time()
        stages.setdefault(s['stage'], round(now - t_acc, 2))
        if first30 is None and s['first30_ready']:
            first30 = round(now - t_acc, 2)
        if s['stage'] == 'done':
            done = round(now - t_acc, 2)
            break
        if s['stage'] in ('failed', 'cancelled'):
            raise SystemExit(f'{name}: {s}')
        time.sleep(0.25)
    rec = store.get('job:' + job) or {}
    slug = re.sub(r'[^a-z0-9]+', '', name.lower())
    for part in ('voice30', 'music30', 'voice', 'music'):
        st, body = call('GET', f'{base}/jobs/{job}/{part}', token)
        if st != 200:
            raise SystemExit(f'{name}: {part} {st}')
        with open(os.path.join(out, f'{gpu}-{slug}-{part}.mp3'), 'wb') as f:
            f.write(body)
    st, body = call('GET', f'{base}/jobs/{job}', token)
    left = json.loads(body)
    return {'song': name, 'gpu': gpu, 'job': job, 'seconds_of_audio': rec.get('seconds'),
            'upload_s': round(t_acc - t0, 2), 'first30_s': first30, 'done_s': done, 'stages_seen_at': stages,
            'gpu_times': rec.get('times'), 'waited_for_gpu_s': rec.get('waited'),
            'after_collecting': left['ready']}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--gpu', default='L4')
    ap.add_argument('--out', required=True)
    ap.add_argument('songs', nargs='+')
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    rows = []
    for spec in a.songs:
        name, path = spec.split('=', 1)
        slug = re.sub(r'[^a-z0-9]+', '', name.lower())
        os.environ['RP_GPU'] = a.gpu
        os.environ['RP_RUN'] = f'measure-{a.gpu.lower()}-{slug}'
        import importlib
        import modal
        import app as service
        service = importlib.reload(service)               # pick up this song's tag and GPU
        token = sign_in(os.environ['RP_EMAIL'], os.environ['RP_PASSWORD'])
        from storage import DictStore
        store = DictStore(modal.Dict.from_name('repertoire-separator-jobs'))
        t = time.time()
        with service.app.run():
            base = service.web.get_web_url()
            row = one_song(base, token, name, path, a.out, a.gpu, store)
            row['app_id'] = service.app.app_id
        row['app_wall_s'] = round(time.time() - t, 1)
        row['started_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(t))
        print(json.dumps(row))
        rows.append(row)
    with open(os.path.join(a.out, f'times-{a.gpu}.json'), 'w') as f:
        json.dump(rows, f, indent=1)


if __name__ == '__main__':
    main()
