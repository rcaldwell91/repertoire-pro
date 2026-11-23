"""Robert, 23 Nov: read the waveform of what the app plays - when each piano
note starts, how long it sounds, how it fades, and the gap to the next - and
draw it. Reads the WAVs tests/lab-audio.mjs records from the app's own
output.

    python3 scripts/waveform.py OUT_DIR name [name ...] [--from S] [--to S]

For each name: OUT_DIR/name.png (the waveform, each note marked) and
OUT_DIR/name.notes.json (each note: its start, its pitch, how long it
sounds, how it was let go, and the gap to the next).

How each note is read: a note starts where the sound's spectrum jumps
(spectral flux). Its pitch is the strongest fundamental in the 60 ms after
that. From then on its own level is followed: the energy at that pitch and
its first harmonics, in 10 ms steps. It "sounds" until that level is 40 dB
under its peak. How it was let go: where its level first falls faster than
a struck piano string dies away on its own (4 dB in 30 ms), how far under
its peak it was then (0 dB: let go at full strength), and how long it then
took to fall 40 dB more ("fade"). The gap is from where a note has gone
(40 dB under) to the next note's start; negative when they overlap, as the
course's piano notes do.
"""
import json
import sys

import matplotlib

matplotlib.use('Agg')
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import wave  # noqa: E402

NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']


def name(midi):
    m = int(round(midi))
    return NAMES[m % 12] + str(m // 12 - 1)


def read(path):
    with wave.open(path) as w:
        rate = w.getframerate()
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return x, rate


def onsets(x, rate):
    n, hop = 2048, 256
    win = np.hanning(n)
    frames = 1 + (len(x) - n) // hop
    mags = np.array([np.abs(np.fft.rfft(win * x[i * hop:i * hop + n])) for i in range(frames)])
    logm = np.log1p(100 * mags)
    flux = np.maximum(0, np.diff(logm, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    t = (np.arange(frames) * hop + n / 2) / rate
    loud = np.sqrt((mags ** 2).sum(axis=1))
    thr = np.median(flux) + 0.35 * (np.percentile(flux, 99.5) - np.median(flux))
    out = []
    for i in range(1, frames - 1):
        if flux[i] > thr and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1] and loud[i] > 1e-3 * loud.max():
            if not out or t[i] - out[-1] > 0.08:
                out.append(t[i])
    return out


def pitch_at(x, rate, t0):
    a, b = int((t0 + 0.01) * rate), int((t0 + 0.07) * rate)
    seg = x[a:b] * np.hanning(b - a)
    spec = np.abs(np.fft.rfft(seg, 1 << 16))
    f = np.fft.rfftfreq(1 << 16, 1 / rate)
    band = (f > 55) & (f < 1400)
    # harmonic sum: the fundamental whose first harmonics are strongest
    best, bf = 0, 0
    for f0 in np.arange(60, 1100, 0.5):
        s = sum(spec[int(round(k * f0 * (1 << 16) / rate))] / k for k in (1, 2, 3, 4))
        if s > best:
            best, bf = s, f0
    return 69 + 12 * np.log2(bf / 440)


def level(x, rate, midi, t0, t1):
    """the note's own level (dB) every 10 ms from t0 to t1"""
    f0 = 440 * 2 ** ((midi - 69) / 12)
    n = 4096
    win = np.hanning(n)
    f = np.fft.rfftfreq(n, 1 / rate)
    mask = np.zeros_like(f, dtype=bool)
    for k in (1, 2, 3):
        mask |= np.abs(f - k * f0) < k * f0 * 0.03
    ts, ls = [], []
    t = t0
    while t < t1:
        a = int(t * rate) - n // 2
        seg = x[max(0, a):a + n]
        if len(seg) < n:
            seg = np.pad(seg, (0, n - len(seg)))
        e = (np.abs(np.fft.rfft(seg * win))[mask] ** 2).sum()
        ts.append(t)
        ls.append(10 * np.log10(e + 1e-12))
        t += 0.01
    return np.array(ts), np.array(ls)


def measure(x, rate, sched):
    """each note the app played: from the app, when it started, its pitch,
    when it was let go and how fast; from the recording, how loud the note
    itself still was at that moment (dB under its own peak: 0 is let go at
    full strength) and how loud the whole sound is 40 ms later"""
    notes = []
    for i, n in enumerate(sched):
        t0, m = n['at'], n['midi']
        nxt = sched[i + 1]['at'] if i + 1 < len(sched) else None
        ts, ls = level(x, rate, m, t0, min(len(x) / rate, t0 + 3.5))
        peak = float(ls[:12].max())
        note = {'start': round(t0, 3), 'note': name(m), 'midi': round(float(m), 2), 'spacing': round(nxt - t0, 3) if nxt else None}
        if n.get('letGo') is not None:
            held = n['letGo'] - t0
            fade = n['tau'] * np.log(100)          # 40 dB down
            k = int(round(held / 0.01))
            under = peak - float(ls[min(k, len(ls) - 1)]) if k < len(ls) else None
            note.update({'held': round(held, 3), 'fade_40db': round(float(fade), 3),
                         'let_go_under_peak_db': round(under, 1) if under is not None else None,
                         'silence_before_next': round(nxt - (n['letGo'] + fade), 3) if nxt else None})
        notes.append(note)
    return notes


def draw(x, rate, notes, path, title, frm, to):
    a, b = int(frm * rate), int(min(len(x) / rate, to) * rate)
    t = np.arange(a, b) / rate
    fig, (ax, ax2) = plt.subplots(2, 1, figsize=(13, 5.2), sharex=True, gridspec_kw={'height_ratios': [3, 2]})
    ax.plot(t, x[a:b], lw=0.4, color='#5b4bd6')
    ax.set_ylim(-1, 1)
    ax.set_ylabel('the sound')
    ax.set_title(title, loc='left', fontsize=11)
    for k, n in enumerate(notes):
        if not (frm <= n['start'] <= to):
            continue
        lane = 0.02 + 0.05 * (k % 2)
        ax.axvline(n['start'], color='#d6336c', lw=0.8)
        ax.text(n['start'] + 0.01, 0.88, n['note'], fontsize=7, color='#d6336c')
        if n.get('held') is not None:
            ax.axvspan(n['start'], n['start'] + n['held'], ymin=lane, ymax=lane + 0.035, color='#2b8a3e', alpha=0.7)
            ax.axvline(n['start'] + n['held'], color='#e67700', lw=0.6, ls='--')
    # the loudness, dB, every 5 ms
    w = int(0.005 * rate)
    env = [20 * np.log10(np.sqrt(np.mean(x[i:i + w] ** 2)) + 1e-6) for i in range(a, b - w, w)]
    ax2.plot(np.arange(len(env)) * w / rate + frm, env, lw=0.8, color='#1c7ed6')
    ax2.set_ylim(-80, 0)
    ax2.set_ylabel('loudness, dB')
    ax2.set_xlabel('seconds (red: a piano note starts; green bar: the key held down; orange dashes: let go)')
    fig.tight_layout()
    fig.savefig(path, dpi=110)
    plt.close(fig)


def main():
    args = sys.argv[1:]
    frm, to = 0.0, 1e9
    if '--from' in args:
        i = args.index('--from')
        frm = float(args[i + 1])
        del args[i:i + 2]
    if '--to' in args:
        i = args.index('--to')
        to = float(args[i + 1])
        del args[i:i + 2]
    out = args[0]
    for nm in args[1:]:
        x, rate = read(f'{out}/{nm}.wav')
        meta = json.load(open(f'{out}/{nm}.json'))
        sched = [n for n in meta.get('scheduled', []) if n['kind'] == 'piano' and n['at'] < len(x) / rate - 0.1]
        heard = onsets(x, rate)
        # the recording is on the app's clock: each scheduled start against
        # the nearest start heard
        offs = [min((h - n['at'] for h in heard), key=abs) for n in sched] if heard else []
        meta['clock_check_ms'] = round(1000 * float(np.median(offs)), 1) if offs else None
        notes = measure(x, rate, sched)
        json.dump(meta, open(f'{out}/{nm}.json', 'w'))
        json.dump(notes, open(f'{out}/{nm}.notes.json', 'w'), indent=1)
        draw(x, rate, notes, f'{out}/{nm}.png', meta.get('title', nm), frm, to)
        print(nm, len(notes), 'notes; clock check', meta.get('clock_check_ms'), 'ms')


if __name__ == '__main__':
    main()
