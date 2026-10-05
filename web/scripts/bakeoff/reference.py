"""The pitch bake-off's reference, and SwiftF0's own answers.

    FFMPEG=... python reference.py OUT_DIR "Name=path/to/voice.mp3" ...

For each recording (real voices only; kept outside the repo) this writes
OUT_DIR/<name>.json with:

  ref    the reference pitch every 10 ms: where two strong offline trackers
         that are NOT in the bake-off (CREPE "full" with Viterbi decoding,
         and pYIN) both hear a voice and agree within half a semitone, their
         mean; otherwise none. Only these moments judge octave errors and
         accuracy, so neither tracker's own mistakes count against anyone.
  swift  SwiftF0 0.3.0 (MIT), through its own library and model, every 16 ms:
         pitch and confidence (voiced at 0.5 and over, as its authors say).
"""
import json
import os
import subprocess
import sys

import numpy as np

FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')


def decode(path, sr):
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(sr), 'pipe:1'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def midi(f):
    return 69 + 12 * np.log2(np.maximum(f, 1e-9) / 440)


def main():
    import librosa
    import torch
    import torchcrepe
    from swift_f0 import SwiftF0
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for spec in sys.argv[2:]:
        name, path = spec.split('=', 1)
        a16 = decode(path, 16000)
        # CREPE full, Viterbi, 10 ms, frames centred on their times (slow on
        # a CPU, so kept beside the output and reused)
        keep = os.path.join(out, name + '.crepe-full.npz')
        if os.path.exists(keep):
            z = np.load(keep)
            cf, per = z['f'], z['per']
        else:
            with torch.no_grad():
                p, per = torchcrepe.predict(torch.tensor(a16)[None], 16000, hop_length=160, fmin=50, fmax=1400,
                                            model='full', decoder=torchcrepe.decode.viterbi, return_periodicity=True,
                                            batch_size=1024, device='cpu')
            per = torchcrepe.filter.median(per, 3)[0].numpy()
            cf = p[0].numpy()
            np.savez(keep, f=cf, per=per)
        c_voiced = per >= 0.5
        # pYIN on the same 10 ms grid, centred (at 22.05 kHz a hop of 220
        # samples is 9.98 ms, and drifts off the grid over a song)
        f0, vflag, _ = librosa.pyin(a16, fmin=60, fmax=1400, sr=16000, frame_length=1024, hop_length=160)
        n = min(len(cf), len(f0))
        cm, pm = midi(cf[:n]), midi(np.nan_to_num(f0[:n]))
        agree = c_voiced[:n] & vflag[:n] & (np.abs(cm - pm) < 0.5)
        ref = [round(float((cm[i] + pm[i]) / 2), 3) if agree[i] else None for i in range(n)]
        sw = SwiftF0(threads=4).detect(a16, 16000)
        res = {
            'name': name, 'seconds': len(a16) / 16000,
            'ref': {'hop': 0.01, 'midi': ref},
            'crepe_full_voiced': round(float(c_voiced.mean()), 4), 'pyin_voiced': round(float(vflag.mean()), 4),
            'agreed': round(float(agree.mean()), 4),
            'swift': {'hop': 0.016, 'pitch': [round(float(x), 3) for x in sw.pitch_hz],
                      'conf': [round(float(x), 4) for x in sw.confidence]},
        }
        with open(os.path.join(out, name + '.json'), 'w') as f:
            json.dump(res, f)
        print(f'{name}: {res["seconds"]:.0f} s; CREPE-full voiced {res["crepe_full_voiced"]:.0%}, '
              f'pYIN voiced {res["pyin_voiced"]:.0%}, both agree {res["agreed"]:.0%} of frames', flush=True)


if __name__ == '__main__':
    main()
