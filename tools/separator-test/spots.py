"""Weak spots in a separated voice when there is no voice-only track.

    python spots.py "Name=voice.wav=music.wav[=voice-only.mp3@offset]" ...

Without a reference, two kinds of stretch are listed, from the separated files
alone, in 0.05 s steps (each file's loud/quiet line by Otsu's method on its
own distribution):
  music left in the voice: the voice file is loud but has no sung pitch (pYIN
                           finds no voice) for at least 0.75 s, while the music
                           file is playing;
  voice cutting out:       inside a phrase - pitched voice within 0.3 s on both
                           sides - the voice file falls below its quiet line for
                           0.15-1.0 s while the music file stays loud.
These are only places to listen. When a voice-only track is given (with the
time it starts in the song), each listed stretch is checked against it, so the
finder itself is measured on a song where the answer is known.
"""
import sys
import numpy as np
import librosa

SR = 22050
HOP = 1102          # ~0.05 s


def otsu(v):
    h, e = np.histogram(v, bins=200)
    m = (e[:-1] + e[1:]) / 2
    w0 = np.cumsum(h); w1 = w0[-1] - w0
    m0 = np.cumsum(h * m) / np.maximum(w0, 1)
    m1 = (np.sum(h * m) - np.cumsum(h * m)) / np.maximum(w1, 1)
    return float(m[int(np.argmax(w0 * w1 * (m0 - m1) ** 2))])


def db(y):
    return 10 * np.log10(librosa.feature.rms(y=y, frame_length=2 * HOP, hop_length=HOP)[0] ** 2 + 1e-12)


def runs(mask, lo, hi=None):
    out, s = [], None
    for i, m in enumerate(list(mask) + [False]):
        if m and s is None:
            s = i
        if not m and s is not None:
            d = (i - s) * HOP / SR
            if d >= lo and (hi is None or d <= hi):
                out.append((s * HOP / SR, i * HOP / SR))
            s = None
    return out


def mmss(t):
    return f'{int(t // 60)}:{t % 60:04.1f}'


for spec in sys.argv[1:]:
    parts = spec.split('=')
    name, vpath, mpath = parts[:3]
    v, _ = librosa.load(vpath, sr=SR, mono=True)
    mu, _ = librosa.load(mpath, sr=SR, mono=True)
    lv, lm = db(v), db(mu)
    n = min(len(lv), len(lm))
    lv, lm = lv[:n], lm[:n]
    cv, cm = otsu(lv), otsu(lm)
    f0, voiced, _ = librosa.pyin(v, fmin=65, fmax=1000, sr=SR, frame_length=4 * HOP, hop_length=HOP)
    voiced = voiced[:n]
    loud_v, loud_m = lv >= cv, lm >= cm
    music_in = runs(loud_v & ~voiced & loud_m, 0.75)
    near = np.convolve(voiced.astype(float), np.ones(7), 'same') > 0      # voice within 0.15 s
    gaps = []
    for a, b in runs(~loud_v & loud_m, 0.15, 1.0):
        i, j = int(a * SR / HOP), int(b * SR / HOP)
        if voiced[max(0, i - 6):i].any() and voiced[j:j + 6].any():
            gaps.append((a, b))
    print(f'{name}: quiet line {cv:.1f} dB in the voice file; {len(music_in)} stretches of loud sound with no sung pitch, '
          f'{len(gaps)} short drops inside phrases')
    ref = None
    if len(parts) > 3:
        rpath, off = parts[3].split('@')
        r, _ = librosa.load(rpath, sr=SR, mono=True)
        r = np.concatenate([np.zeros(int(float(off) * SR)), r])
        lr = db(r)[:n]
        lr = np.pad(lr, (0, max(0, n - len(lr))), constant_values=lr.min())
        cr = otsu(lr)
        ref = lr >= cr
    for label, lst in (('music left in the voice', music_in), ('voice cutting out', gaps)):
        print('   ' + label + ':')
        for a, b in lst:
            i, j = int(a * SR / HOP), int(b * SR / HOP)
            note = f'voice file {lv[i:j].mean():.0f} dB, music file {lm[i:j].mean():.0f} dB'
            if ref is not None:
                sung = ref[i:j].mean()
                note += f'; the voice-only track is singing for {sung * 100:.0f}% of it'
            print(f'      {mmss(a)}-{mmss(b)}  ({note})')
