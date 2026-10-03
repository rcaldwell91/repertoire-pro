"""Splitting a song into voice and music: Kim's Mel-Band RoFormer weights,
run through ZFTurbo's Music-Source-Separation-Training (MIT licence, pinned
in app.py) with Kim's original settings, plus two things the app needs.

The splitting follows the generic path of ZFTurbo's utils/model_utils.py
demix(), one chunk at a time (batch size 1, as Kim's original ran):
  - 8-second chunks (chunk_size 352800 at 44.1 kHz), overlap 2, so each
    chunk starts 4 s after the last;
  - the song padded by reflection at both ends by (chunk - step);
  - each chunk faded in over its first and out over its last 0.8 s
    (chunk / 10), except the first chunk's fade-in and the last chunk's
    fade-out; each sample is the weighted average of the chunks covering it;
  - half precision on the GPU (autocast);
  - the music is the song minus the voice (ZFTurbo's "instrumental").

What is added:
  - progress: after every chunk, how many of the song's chunks are done;
  - the first 30 seconds early: once the chunks covering the first 30
    seconds are done, no later chunk touches those samples (each starts
    after them), so they are final and identical to the first 30 seconds
    of the whole result. They are handed back then.

tests/test_demix.py checks on the GPU, with the real weights, that this
gives exactly what ZFTurbo's own demix() gives.
"""
from __future__ import annotations

import math
import subprocess
from dataclasses import dataclass
from typing import Callable, Optional

import numpy as np

SR = 44100
CHUNK = 352800          # Kim's config: audio.chunk_size
OVERLAP = 2             # Kim's config: inference.num_overlap
FIRST_SECONDS = 30


@dataclass(frozen=True)
class Plan:
    """Where the chunks fall for a song of n samples."""
    n: int
    chunk: int = CHUNK
    overlap: int = OVERLAP

    @property
    def step(self) -> int:
        return self.chunk // self.overlap

    @property
    def fade(self) -> int:
        return self.chunk // 10

    @property
    def border(self) -> int:
        return self.chunk - self.step

    @property
    def padded(self) -> bool:
        return self.n > 2 * self.border and self.border > 0

    @property
    def offset(self) -> int:
        """where the song starts inside the padded signal"""
        return self.border if self.padded else 0

    @property
    def total(self) -> int:
        return self.n + 2 * self.offset

    @property
    def chunks(self) -> int:
        return (self.total + self.step - 1) // self.step

    def chunks_for_first(self, samples: int) -> int:
        """how many chunks must be done before the song's first `samples`
        samples are final: after the k-th chunk everything before k * step
        is final"""
        need = self.offset + min(samples, self.n)
        return min(self.chunks, max(1, math.ceil(need / self.step)))


def window(chunk: int, fade: int):
    """a linear fade in and out (as ZFTurbo's _getWindowingArray)"""
    import torch
    w = torch.ones(chunk)
    w[-fade:] = torch.linspace(1, 0, fade)
    w[:fade] = torch.linspace(0, 1, fade)
    return w


def demix(model, mix: np.ndarray, device, plan: Optional[Plan] = None,
          on_chunk: Optional[Callable[[int, int], None]] = None,
          on_first: Optional[Callable[[np.ndarray], None]] = None,
          first_seconds: int = FIRST_SECONDS,
          should_stop: Callable[[], bool] = lambda: False,
          use_amp: bool = True) -> Optional[np.ndarray]:
    """mix: float32 (2, n) at 44.1 kHz. Returns the voice, float32 (2, n),
    or None if should_stop() said to stop. on_chunk(done, of) after every
    chunk; on_first(voice of the first `first_seconds`) once those are final
    (only if the song is longer than that)."""
    import torch
    import torch.nn as nn

    plan = plan or Plan(mix.shape[1])
    C, step, fade, border = plan.chunk, plan.step, plan.fade, plan.border
    x_mix = torch.tensor(mix, dtype=torch.float32)
    if plan.padded:
        x_mix = nn.functional.pad(x_mix, (border, border), mode='reflect')
    w0 = window(C, fade)
    first_n = first_seconds * SR
    first_after = plan.chunks_for_first(first_n) if (on_first and plan.n > first_n) else None

    with torch.cuda.amp.autocast(enabled=use_amp):
        with torch.inference_mode():
            result = torch.zeros((1,) + tuple(x_mix.shape), dtype=torch.float32)   # one target: vocals
            counter = torch.zeros((1,) + tuple(x_mix.shape), dtype=torch.float32)
            total = x_mix.shape[1]
            i, done = 0, 0
            while i < total:
                if should_stop():
                    return None
                part = x_mix[:, i:i + C].to(device)
                length = part.shape[-1]
                pad_mode = 'reflect' if length > C // 2 else 'constant'
                part = nn.functional.pad(part, (0, C - length), mode=pad_mode, value=0)
                start = i
                i += step
                x = model(torch.stack([part], dim=0))
                w = w0.clone()
                if i - step == 0:           # the first chunk: no fade-in
                    w[:fade] = 1
                elif i >= total:            # the last chunk: no fade-out
                    w[-fade:] = 1
                result[..., start:start + length] += x[0, ..., :length].cpu() * w[..., :length]
                counter[..., start:start + length] += w[..., :length]
                done += 1
                if on_chunk:
                    on_chunk(done, plan.chunks)
                if first_after is not None and done == first_after:
                    a = plan.offset
                    head = (result[..., a:a + first_n] / counter[..., a:a + first_n]).numpy()
                    np.nan_to_num(head, copy=False, nan=0.0)
                    on_first(head[0])
            voice = (result / counter).numpy()
            np.nan_to_num(voice, copy=False, nan=0.0)
            if plan.padded:
                voice = voice[..., border:-border]
    return voice[0]


# ---------------------------------------------------------------- audio io

def decode(data: bytes, ffmpeg: str = 'ffmpeg') -> np.ndarray:
    """Any audio file to float32 stereo (2, n) at 44.1 kHz."""
    p = subprocess.run([ffmpeg, '-v', 'error', '-nostdin', '-i', 'pipe:0', '-map', '0:a:0',
                        '-f', 'f32le', '-ac', '2', '-ar', str(SR), 'pipe:1'],
                       input=data, capture_output=True)
    if p.returncode != 0 or not p.stdout:
        raise ValueError('not audio')
    return np.frombuffer(p.stdout, dtype=np.float32).reshape(-1, 2).T.copy()


def encode_mp3(audio: np.ndarray, ffmpeg: str = 'ffmpeg', kbps: int = 192) -> bytes:
    """float32 (2, n) at 44.1 kHz to an MP3. Written to a real file, not a
    pipe: only then can the encoder record its own start-up delay in the
    file's header, so players trim it and the voice and music stay exactly
    in time with the song (through a pipe they came out 25 ms late)."""
    import os
    import tempfile
    raw = np.ascontiguousarray(audio.T, dtype=np.float32).tobytes()
    fd, path = tempfile.mkstemp(suffix='.mp3')
    os.close(fd)
    try:
        p = subprocess.run([ffmpeg, '-v', 'error', '-nostdin', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2',
                            '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', path],
                           input=raw, capture_output=True)
        if p.returncode != 0:
            raise RuntimeError('could not encode')
        with open(path, 'rb') as f:
            return f.read()
    finally:
        os.remove(path)


def seconds_of(data: bytes, ffmpeg: str = 'ffmpeg') -> float:
    """How long a file really plays, by decoding it (a header can lie).
    Raises ValueError if it is not audio."""
    p = subprocess.run([ffmpeg, '-v', 'error', '-nostdin', '-i', 'pipe:0', '-map', '0:a:0',
                        '-f', 's16le', '-ac', '1', '-ar', '8000', 'pipe:1'],
                       input=data, capture_output=True)
    if p.returncode != 0 or not p.stdout:
        raise ValueError('not audio')
    return len(p.stdout) / 2 / 8000
