"""Repertoire's voice/music splitter, on Modal.

    modal deploy app.py          the service (scales to zero when idle)

measure.py runs songs through it for timing, cost and quality.

Model: Kim's Mel-Band RoFormer (KimberleyJSN/melbandroformer, MIT), run with
Kim's own code from her repository, both pinned below. The weights are
downloaded when the image is built on Modal, checked against WEIGHTS_SHA256,
and never stored anywhere else.
"""
from __future__ import annotations

import os

import modal

APP_NAME = 'repertoire-separator'
GPU = os.environ.get('RP_GPU', 'L4')

WEIGHTS_REPO = 'KimberleyJSN/melbandroformer'
WEIGHTS_REV = 'ac9b0614ab3cd7f77219e18ba494dfd93956c348'
WEIGHTS_FILE = 'MelBandRoformer.ckpt'
WEIGHTS_SHA256 = '87201f4d31afb5bc79993230fc49446918425574db48c01c405e44f365c7559e'
KIM_REPO = 'https://github.com/KimberleyJensen/Mel-Band-Roformer-Vocal-Model'
KIM_COMMIT = '25f44ffb55ee3c301281bba21b2d6d311cb69ae2'
WEIGHTS = '/weights/' + WEIGHTS_FILE
CONFIG = '/kim/configs/config_vocals_mel_band_roformer.yaml'

app = modal.App(APP_NAME, tags={'run': os.environ.get('RP_RUN', 'service')})
store_dict = modal.Dict.from_name('repertoire-separator-jobs', create_if_missing=True)
files_vol = modal.Volume.from_name('repertoire-separator-files', create_if_missing=True, version=2)

OUR_CODE = ('sep_core', 'jobs', 'worker', 'storage', 'auth', 'api')


def fetch_weights():
    import hashlib
    from huggingface_hub import hf_hub_download
    path = hf_hub_download(WEIGHTS_REPO, WEIGHTS_FILE, revision=WEIGHTS_REV, local_dir='/weights')
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    if h.hexdigest() != WEIGHTS_SHA256:
        raise SystemExit('the weights are not the pinned file: ' + h.hexdigest())
    print('weights ok', h.hexdigest())


gpu_image = (
    modal.Image.debian_slim(python_version='3.11')
    .apt_install('ffmpeg', 'git')
    .pip_install('torch==2.8.0', 'numpy==2.2.6', 'librosa==0.11.0', 'einops==0.6.1',
                 'rotary_embedding_torch==0.3.5', 'beartype==0.14.1', 'ml_collections==1.1.0',
                 'pyyaml==6.0.2', 'packaging', 'huggingface_hub==0.35.3', 'fastapi==0.118.0', 'pyjwt[crypto]==2.10.1')
    .run_commands(f'git clone {KIM_REPO} /kim && cd /kim && git checkout {KIM_COMMIT} && rm -rf .git')
    .run_function(fetch_weights)
    .add_local_python_source(*OUR_CODE)
)

web_image = (
    modal.Image.debian_slim(python_version='3.11')
    .apt_install('ffmpeg')
    .pip_install('numpy==2.2.6', 'fastapi==0.118.0', 'pyjwt[crypto]==2.10.1')
    .add_local_python_source(*OUR_CODE)
)


@app.cls(gpu=GPU, image=gpu_image, cpu=4, memory=8192, max_containers=3, scaledown_window=60,
         timeout=900)
class Separator:
    @modal.enter()
    def load(self):
        import sys
        import time
        import torch
        import yaml
        from ml_collections import ConfigDict
        t = time.time()
        sys.path.insert(0, '/kim')
        from utils import get_model_from_config             # Kim's own
        with open(CONFIG) as f:
            self.config = ConfigDict(yaml.load(f, Loader=yaml.FullLoader))
        assert self.config.inference.num_overlap == 2 and self.config.inference.chunk_size == 352800
        torch.backends.cudnn.benchmark = True
        model = get_model_from_config('mel_band_roformer', self.config)
        model.load_state_dict(torch.load(WEIGHTS, map_location='cpu'))
        self.device = torch.device('cuda:0')
        self.model = model.to(self.device).eval()
        self.load_s = round(time.time() - t, 2)
        print('model ready in', self.load_s, 's on', torch.cuda.get_device_name(0))

    @modal.method()
    def separate(self, job: str) -> dict:
        import worker
        from storage import DictStore, VolumeFiles
        times = worker.run_job(job, DictStore(store_dict), VolumeFiles(files_vol), self.model, self.device)
        times['model_load'] = self.load_s
        return times

    @modal.method()
    def kim_reference(self, job: str, name: str) -> None:
        """For tests/test_demix.py only: Kim's own demix_track on an
        uploaded file, saved beside it as float32, to compare against."""
        import numpy as np
        import torch
        from storage import VolumeFiles
        import sep_core as S
        from utils import demix_track
        files = VolumeFiles(files_vol)
        mix = S.decode(files.get(job, name))
        res, _ = demix_track(self.config, self.model, torch.tensor(mix), self.device)
        ours = S.demix(self.model, mix, self.device)
        files.put(job, 'kim.f32', np.ascontiguousarray(res['vocals'], dtype=np.float32).tobytes())
        files.put(job, 'ours.f32', np.ascontiguousarray(ours, dtype=np.float32).tobytes())


@app.function(image=web_image, max_containers=2, scaledown_window=60, timeout=300)
@modal.concurrent(max_inputs=20)
@modal.asgi_app(label=APP_NAME)
def web():
    import logging
    import api
    import sep_core
    from auth import Verifier
    from storage import DictStore, VolumeFiles
    logging.basicConfig(level=logging.INFO)

    def spawn(job: str) -> None:
        Separator().separate.spawn(job)                  # only the job id goes to the GPU, never audio

    return api.make_api(DictStore(store_dict), VolumeFiles(files_vol), Verifier(), spawn, sep_core.seconds_of)


@app.function(image=web_image, schedule=modal.Period(minutes=10), timeout=120)
def sweep():
    import time
    import jobs
    from storage import DictStore, VolumeFiles
    print('sweep', jobs.sweep(DictStore(store_dict), VolumeFiles(files_vol), time.time()))


@app.function(image=web_image, timeout=120)
def sweep_now(keep_s: int | None = None) -> dict:
    """The sweep on demand, for the tests (keep_s overrides how long is kept)."""
    import time
    import jobs
    from storage import DictStore, VolumeFiles
    if keep_s is not None:
        jobs.KEEP_S = keep_s
    return jobs.sweep(DictStore(store_dict), VolumeFiles(files_vol), time.time())
