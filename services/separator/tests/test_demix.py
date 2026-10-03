"""On the real GPU with the real weights: our chunk-by-chunk splitting gives
exactly what ZFTurbo's own demix() gives with one chunk at a time. Needs the
deployed service (RP_LIVE=1) and a real song (RP_SONG, kept outside the repo).
Only 60 seconds of the song are sent, with the call itself (under 2 MB);
nothing is saved and only numbers come back."""
import os
import subprocess

import pytest

from conftest import ffmpeg

pytestmark = pytest.mark.skipif(os.environ.get('RP_LIVE') != '1', reason='needs the deployed service (RP_LIVE=1)')


def test_ours_is_zfturbos_demix_exactly():
    import modal
    song = os.environ.get('RP_SONG')
    assert song and os.path.exists(song), 'RP_SONG must name a real song'
    clip = subprocess.run([ffmpeg(), '-v', 'error', '-ss', '30', '-t', '60', '-i', song, '-f', 'mp3', 'pipe:1'],
                          capture_output=True, check=True).stdout
    assert len(clip) < 2_000_000
    r = modal.Cls.from_name('repertoire-separator', 'Separator')().reference.remote(clip)
    print(r)
    assert r['batch1']['same_shape'] and r['batch1']['max_diff'] == 0.0
