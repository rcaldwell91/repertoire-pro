"""Repertoire's voice/music splitter, on Modal.

    modal deploy app.py          the service (scales to zero when idle)

measure.py runs songs through it for timing, cost and quality.

Model: Kim's Mel-Band RoFormer weights (KimberleyJSN/melbandroformer, MIT),
run through ZFTurbo's Music-Source-Separation-Training (MIT, release
v1.0.22), model type mel_band_roformer with Kim's vocal config from that
release, and Kim's original settings (overlap 2, 8-second chunks, half
precision, no DC filter). Kim's own GitHub code has no licence and is not
used. The weights are downloaded when the image is built on Modal, checked
against WEIGHTS_SHA256, and never stored anywhere else.
"""
from __future__ import annotations

import os

import modal

APP_NAME = 'repertoire-separator'
GPU = os.environ.get('RP_GPU', 'A10G')     # A10: about twice the L4's speed, and cheaper (4 Oct)

WEIGHTS_REPO = 'KimberleyJSN/melbandroformer'
WEIGHTS_REV = 'ac9b0614ab3cd7f77219e18ba494dfd93956c348'
WEIGHTS_FILE = 'MelBandRoformer.ckpt'
WEIGHTS_SHA256 = '87201f4d31afb5bc79993230fc49446918425574db48c01c405e44f365c7559e'
CODE_REPO = 'https://github.com/ZFTurbo/Music-Source-Separation-Training'   # MIT licence
CODE_TAG = 'v1.0.22'
CODE_COMMIT = '7671faec526b78156f60c94a767fb243a0aaa41e'
WEIGHTS = '/weights/' + WEIGHTS_FILE
CONFIG = '/msst/configs/KimberleyJensen/config_vocals_mel_band_roformer_kj.yaml'

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
    .pip_install('torch==2.8.0', 'numpy==2.2.6', 'librosa==0.11.0', 'einops==0.8.1',
                 'rotary_embedding_torch==0.3.5', 'beartype==0.14.1', 'ml_collections==1.1.0',
                 'pyyaml==6.0.2', 'packaging', 'tqdm', 'huggingface_hub==0.35.3', 'fastapi==0.118.0',
                 'pyjwt[crypto]==2.10.1')
    .run_commands(f'git clone --depth 1 --branch {CODE_TAG} {CODE_REPO} /msst && cd /msst && '
                  f'test "$(git rev-parse HEAD)" = {CODE_COMMIT} && grep -q "MIT License" LICENSE && rm -rf .git')
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
        sys.path.insert(0, '/msst')
        from models.bs_roformer.mel_band_roformer import MelBandRoformer   # ZFTurbo's, MIT
        with open(CONFIG) as f:
            self.config = ConfigDict(yaml.load(f, Loader=yaml.FullLoader))
        c = self.config
        assert c.audio.chunk_size == 352800 and c.inference.num_overlap == 2 and c.training.use_amp
        torch.backends.cudnn.benchmark = True
        # zero_dc arrived in ZFTurbo's code after Kim's release; off, as Kim's model ran
        model = MelBandRoformer(**dict(c.model), zero_dc=False)
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
    def reference(self, clip: bytes) -> dict:
        """For tests/test_demix.py only: ZFTurbo's own demix() on a short clip
        (under 2 MB, sent with the call), one chunk at a time and in his
        default batches of 4, against ours. Returns only numbers; nothing
        is saved."""
        import copy
        import numpy as np
        import sep_core as S
        from utils.model_utils import demix                  # ZFTurbo's, MIT
        mix = S.decode(clip)
        ours = S.demix(self.model, mix, self.device)
        out = {'samples': int(mix.shape[1])}
        for batch in (1, 4):
            cfg = copy.deepcopy(self.config)
            cfg.inference.batch_size = batch
            theirs = demix(cfg, self.model, mix, self.device, 'mel_band_roformer')['vocals']
            d = np.abs(theirs - ours)
            out[f'batch{batch}'] = {'max_diff': float(d.max()), 'same_shape': theirs.shape == ours.shape,
                                    'sdr_vs_ours_db': float(10 * np.log10(np.sum(ours ** 2) / max(np.sum((theirs - ours) ** 2), 1e-30)))}
        return out


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
    return jobs.sweep(DictStore(store_dict), VolumeFiles(files_vol), time.time(), keep_s)
