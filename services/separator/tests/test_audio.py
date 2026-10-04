"""The MP3s the app gets line up with the song to the sample."""
import subprocess

import numpy as np

import sep_core as S
from conftest import ffmpeg


def test_the_mp3_is_not_shifted(voice_path):
    data = subprocess.run([ffmpeg(), '-v', 'error', '-i', voice_path, '-t', '20', '-f', 'wav', 'pipe:1'],
                          capture_output=True, check=True).stdout
    x = S.decode(data, ffmpeg())
    y = S.decode(S.encode_mp3(x, ffmpeg()), ffmpeg())
    a, b = x[0, :10 * S.SR], y[0, :10 * S.SR + 4000]
    lags = range(-2000, 2001)
    best = max(lags, key=lambda k: float(np.dot(a[2000:-2000], b[2000 + k:2000 + k + len(a) - 4000])))
    assert best == 0, f'shifted by {best} samples'
    assert 0 <= y.shape[1] - x.shape[1] <= 1152          # at most one MP3 frame of padding, at the end


def test_the_mp3_keeps_the_level():
    """voice + music must add back up to the song at its own level"""
    song = S.decode(open(_song(), 'rb').read(), ffmpeg())[:, 60 * S.SR:70 * S.SR]
    y = S.decode(S.encode_mp3(song, ffmpeg()), ffmpeg())[:, :song.shape[1]]
    ratio = float(np.sqrt(np.mean(y ** 2)) / np.sqrt(np.mean(song ** 2)))
    assert abs(ratio - 1) < 0.005, f'level changed by {20 * np.log10(ratio):.2f} dB'


def _song():
    import os
    import pytest
    p = os.environ.get('RP_SONG')
    if not p or not os.path.exists(p):
        pytest.fail('RP_SONG must name a real song (kept outside the repo)')
    return p
