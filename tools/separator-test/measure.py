"""How good is the separated voice? Measured against a real voice-only track.

    python measure.py "All of Me=sep-voice.wav=voice-only.mp3" ...

1. VERSIONS. The voice-only track is lined up with the separated voice by
   cross-correlation, then the same is done again in every 10-second stretch
   on its own. One recording trimmed differently gives the same offset
   everywhere, to the sample; a different edit, tempo or cut does not. If the
   stretches disagree, the score is not computed - a score across mismatched
   versions would measure the mismatch, not the separator.
2. SDR. Over the whole of the voice-only track, stereo:
     plain SDR  = 10 log10( sum(ref^2) / sum((ref - est)^2) )
     level-matched SDR: the same after the separated voice is scaled by the
       one gain that fits it best, since the two releases need not be
       mastered at the same level.
3. WEAK SPOTS, in 0.25 s steps. Each track's own loudness is split into quiet
   and loud by Otsu's method on its own distribution (no chosen threshold):
     music in the voice = the voice-only track is quiet, the separated voice
                          is loud;
     voice dropping out = the voice-only track is loud, the separated voice
                          is quiet.
   Stretches of at least 0.5 s are listed, in the full song's own time (the
   time you hear in the separated file). And the weakest 2-second stretches
   while singing, by local SDR.
Writes measure.json beside the first file.
"""
import json
import os
import sys
import numpy as np
import librosa

SR = 44100


def load(path):
    y, _ = librosa.load(path, sr=SR, mono=False)
    if y.ndim == 1:
        y = np.stack([y, y])
    return y


def xcorr(a, b):
    """lag of b inside a (a[lag + i] ~ b[i]) and the normalised peak"""
    n = len(a) + len(b)
    nf = 1 << (n - 1).bit_length()
    c = np.fft.irfft(np.fft.rfft(a, nf) * np.conj(np.fft.rfft(b, nf)), nf)
    c = np.concatenate([c[-(len(b) - 1):], c[:len(a)]]) if len(b) > 1 else c[:len(a)]
    k = int(np.argmax(c))
    den = np.sqrt(np.sum(a * a) * np.sum(b * b)) + 1e-12
    return k - (len(b) - 1), float(c[k] / den)


def otsu(v):
    v = np.asarray(v)
    lo, hi = v.min(), v.max()
    h, edges = np.histogram(v, bins=200, range=(lo, hi))
    mids = (edges[:-1] + edges[1:]) / 2
    w0 = np.cumsum(h); w1 = w0[-1] - w0
    m0 = np.cumsum(h * mids) / np.maximum(w0, 1)
    m1 = (np.sum(h * mids) - np.cumsum(h * mids)) / np.maximum(w1, 1)
    return float(mids[int(np.argmax(w0 * w1 * (m0 - m1) ** 2))])


def spans(mask, step, t0, min_len=0.5):
    out, s = [], None
    for i, m in enumerate(list(mask) + [False]):
        if m and s is None:
            s = i
        if not m and s is not None:
            if (i - s) * step >= min_len:
                out.append([round(t0 + s * step, 2), round(t0 + i * step, 2)])
            s = None
    return out


def mmss(t):
    return f'{int(t // 60)}:{t % 60:05.2f}'


def measure(name, sep_path, ref_path):
    est_full = load(sep_path)
    ref = load(ref_path)
    # whole-song offset, coarse then exact
    d = 8
    lag_c, _ = xcorr(est_full.mean(0)[::d], ref.mean(0)[::d])
    lag_c *= d
    lo = max(0, lag_c - 4 * d)
    seg = est_full.mean(0)[lo: lag_c + ref.shape[1] + 4 * d]
    l2, peak = xcorr(seg, ref.mean(0))
    off = lo + l2
    # the same, stretch by stretch
    W = 10 * SR
    rows = []
    for s in range(0, ref.shape[1] - W + 1, W):
        r = ref.mean(0)[s:s + W]
        if np.sqrt(np.mean(r * r)) < 1e-3:
            continue                                   # nothing sung here to line up
        a0 = max(0, off + s - SR // 2)
        a = est_full.mean(0)[a0: off + s + W + SR // 2]
        l3, p3 = xcorr(a, r)
        rows.append({'at': round((off + s) / SR, 1), 'offset_ms': round((a0 + l3 - s - off) / SR * 1000, 2), 'peak': round(p3, 3)})
    devs = [abs(r['offset_ms']) for r in rows]
    same = max(devs) <= 1.0 if devs else False
    res = {'song': name, 'offset_s': round(off / SR, 4), 'peak': round(peak, 3), 'stretches': rows,
           'versions_match': same, 'worst_stretch_offset_ms': max(devs) if devs else None}
    print(f'{name}: voice-only starts {off / SR:.4f}s into the song (peak {peak:.3f}); '
          f'{len(rows)} stretches, worst disagreement {res["worst_stretch_offset_ms"]} ms')
    if not same:
        bad = [r for r in rows if abs(r['offset_ms']) > 1.0]
        print('   VERSIONS DO NOT MATCH at: ' + ', '.join(f'{mmss(r["at"])} ({r["offset_ms"]:+.1f} ms)' for r in bad))
        return res
    n = ref.shape[1]
    est = est_full[:, off:off + n]
    if est.shape[1] < n:
        est = np.pad(est, ((0, 0), (0, n - est.shape[1])))
    plain = 10 * np.log10(np.sum(ref ** 2) / np.sum((ref - est) ** 2))
    g = np.sum(est * ref) / np.sum(est * est)
    matched = 10 * np.log10(np.sum(ref ** 2) / np.sum((ref - g * est) ** 2))
    res.update({'sdr_db': round(float(plain), 2), 'sdr_level_matched_db': round(float(matched), 2), 'gain': round(float(g), 3)})
    print(f'   SDR {plain:.2f} dB plain, {matched:.2f} dB level-matched (gain {g:.3f})')

    # weak spots, 0.25 s steps
    st = SR // 4
    k = n // st
    R = np.array([np.mean(ref[:, i * st:(i + 1) * st] ** 2) for i in range(k)])
    E = np.array([np.mean((g * est[:, i * st:(i + 1) * st]) ** 2) for i in range(k)])
    lR, lE = 10 * np.log10(R + 1e-12), 10 * np.log10(E + 1e-12)
    cR, cE = otsu(lR), otsu(lE)
    t0 = off / SR
    bleed = spans((lR < cR) & (lE >= cE), 0.25, t0)
    drop = spans((lR >= cR) & (lE < cE), 0.25, t0)
    res['quiet_line_db'] = {'voice_only': round(cR, 1), 'separated': round(cE, 1)}
    res['music_in_voice'] = [{'from': a, 'to': b, 'separated_db': round(float(lE[int((a - t0) * 4):int((b - t0) * 4)].mean()), 1)} for a, b in bleed]
    res['voice_drops_out'] = [{'from': a, 'to': b, 'voice_only_db': round(float(lR[int((a - t0) * 4):int((b - t0) * 4)].mean()), 1),
                               'separated_db': round(float(lE[int((a - t0) * 4):int((b - t0) * 4)].mean()), 1)} for a, b in drop]
    # weakest 2-second stretches while singing
    w2 = 2 * SR
    loc = []
    for s in range(0, n - w2 + 1, SR):
        r = ref[:, s:s + w2]; e = g * est[:, s:s + w2]
        if 10 * np.log10(np.mean(r ** 2) + 1e-12) < cR:
            continue
        loc.append((round(t0 + s / SR, 1), round(float(10 * np.log10(np.sum(r ** 2) / (np.sum((r - e) ** 2) + 1e-12))), 1)))
    loc.sort(key=lambda x: x[1])
    res['weakest_while_singing'] = [{'at': a, 'local_sdr_db': b} for a, b in loc[:6]]
    vals = np.array([b for _, b in loc])
    res['local_sdr_while_singing'] = {'median': round(float(np.median(vals)), 1), 'p10': round(float(np.percentile(vals, 10)), 1),
                                      'p90': round(float(np.percentile(vals, 90)), 1)}
    print(f'   music left in the voice where the voice-only track is quiet: ' + (', '.join(f'{mmss(a)}-{mmss(b)}' for a, b in bleed) or 'none'))
    print(f'   voice dropping out where the voice-only track sings: ' + (', '.join(f'{mmss(a)}-{mmss(b)}' for a, b in drop) or 'none'))
    print(f'   local SDR while singing: median {res["local_sdr_while_singing"]["median"]} dB; weakest: ' +
          ', '.join(f'{mmss(a)} ({b} dB)' for a, b in loc[:6]))
    return res


if __name__ == '__main__':
    out = []
    for spec in sys.argv[1:]:
        name, sep, ref = spec.split('=')
        out.append(measure(name, sep, ref))
    with open(os.path.join(os.path.dirname(sys.argv[1].split('=')[1]) or '.', 'measure.json'), 'w') as f:
        json.dump(out, f, indent=1)
