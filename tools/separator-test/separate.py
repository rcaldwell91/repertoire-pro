"""Split a song into voice and music with Kim's Mel-Band RoFormer.

Robert, 1 Oct: hear what splitting a song into voice and music sounds like,
and measure how good it is. Nothing here touches the app.

The model is KimberleyJSN/melbandroformer on Hugging Face (MIT), run through
python-audio-separator on the CPU. Neither the weights nor any audio ever
enter this repo: the weights are downloaded beside the work, and checked
against the SHA-256 below before anything runs.

    python separate.py --models DIR --out DIR "All of Me=path/to/full.mp3" ...

DIR for --models holds MelBandRoformer.ckpt from Hugging Face and
audio-separator's own config for it (vocals_mel_band_roformer.yaml); the
weights are linked in under the name audio-separator knows them by.
For each song this writes "<name> — voice.wav/.mp3" and "<name> — music.wav/
.mp3" to --out, and times.json with how long each song took.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import time

MODEL_SHA256 = '87201f4d31afb5bc79993230fc49446918425574db48c01c405e44f365c7559e'
MODEL_NAME = 'vocals_mel_band_roformer.ckpt'      # audio-separator's name for Kim's model


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def seconds(path):
    out = subprocess.run(['ffmpeg', '-i', path], capture_output=True, text=True).stderr
    hms = out.split('Duration: ')[1].split(',')[0].split(':')
    return int(hms[0]) * 3600 + int(hms[1]) * 60 + float(hms[2])


def finish(out, name, files):
    """Name the two stems the way Robert will see them, and make the mp3s.
    audio-separator 0.47.0 writes "(vocals)" and "(other)" in lower case; the
    first run looked for capitals and left them unnamed, so match any case."""
    stems = {}
    for f in files:
        f = os.path.join(out, os.path.basename(f))
        low = os.path.basename(f).lower()
        kind = 'voice' if '(vocals)' in low else 'music' if '(other)' in low or '(instrumental)' in low else None
        if not kind:
            continue
        wav = os.path.join(out, f'{name} — {kind}.wav')
        os.replace(f, wav)
        mp3 = wav[:-4] + '.mp3'
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '192k', mp3], check=True)
        stems[kind] = mp3
    return stems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--models', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('songs', nargs='+', help='"Name=path/to/full-song.mp3"')
    a = ap.parse_args()

    src = os.path.join(a.models, 'MelBandRoformer.ckpt')
    got = sha256(src)
    if got != MODEL_SHA256:
        sys.exit('The model file is not the one this test is for: ' + got)
    link = os.path.join(a.models, MODEL_NAME)
    if not os.path.exists(link):
        os.symlink(os.path.abspath(src), link)
    os.makedirs(a.out, exist_ok=True)

    from audio_separator.separator import Separator
    import torch
    t0 = time.time()
    sep = Separator(model_file_dir=a.models, output_dir=a.out, output_format='WAV')
    sep.load_model(model_filename=MODEL_NAME)
    load = time.time() - t0
    print(f'model loaded in {load:.1f}s; torch {torch.__version__}, {torch.get_num_threads()} CPU threads')

    times = {'model': MODEL_NAME, 'sha256': got, 'load_seconds': round(load, 1),
             'cpu_threads': torch.get_num_threads(), 'songs': {}}
    for spec in a.songs:
        name, path = spec.split('=', 1)
        length = seconds(path)
        t = time.time()
        files = sep.separate(path)
        took = time.time() - t
        stems = finish(a.out, name, files)
        times['songs'][name] = {'song_seconds': round(length, 2), 'separate_seconds': round(took, 1),
                                'x_real_time': round(length / took, 2), 'files': stems}
        print(f'{name}: {length:.1f}s of song separated in {took:.1f}s ({length / took:.2f}x real time)')
    with open(os.path.join(a.out, 'times.json'), 'w') as f:
        json.dump(times, f, indent=1)


if __name__ == '__main__':
    main()
