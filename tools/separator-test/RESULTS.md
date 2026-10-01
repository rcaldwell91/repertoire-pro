# Separator test — 1 Oct 2026

Nothing here touches the app. No audio and no model weights are in this repo.

## What ran

- Model: Kim's Mel-Band RoFormer, `KimberleyJSN/melbandroformer` on Hugging Face,
  revision `ac9b0614ab3cd7f77219e18ba494dfd93956c348`.
  - Weights: `MelBandRoformer.ckpt`, 913,106,900 bytes,
    SHA-256 `87201f4d31afb5bc79993230fc49446918425574db48c01c405e44f365c7559e`.
  - Licence line, the whole of the repo's README: `license: mit`.
- Run through python-audio-separator 0.47.0 (as its `vocals_mel_band_roformer.ckpt`),
  with audio-separator's own config for that model, `vocals_mel_band_roformer.yaml`,
  SHA-256 `b958b29c8f7195f0d86bee6759a33980db675c4ecaf2fcaa80fa125828e6cd38`.
  Its model section is identical to Kim's original config; its inference overlap
  is 1 where Kim's original says 2.
- PyTorch 2.14.1, CPU only, 4 threads, in the cloud sandbox. Model load: 7.0 s.
- Outputs: 44.1 kHz 16-bit WAV, then MP3 at 192 kbps.
- `separate.py` splits the songs and times them. `measure.py` scores against a
  voice-only track. `spots.py` is the no-reference spot finder, which failed its own test (see below).

## Speed (time to separate, model already loaded)

| Song | Length | Took | Speed |
|---|---|---|---|
| All of Me | 4:29.7 | 1050.0 s (17:30) | 0.26 × real time |
| Ride | 3:51.2 | 836.7 s (13:57) | 0.28 × real time |
| If I Ain't Got You (slowed + reverb) | 4:39.2 | 965.5 s (16:05) | 0.29 × real time |

So on this CPU a song takes about 3.6 times its own length.

## Quality, against the voice-only tracks

### All of Me

- **Versions match.** The voice-only track starts 8.5008 s into the full song.
  - In all 26 ten-second stretches checked on their own, it lines up at the same
    offset to the sample (0.0 ms).
  - Waveform match is 0.90–0.98 in every stretch, 0.984 over the whole track.
- **SDR:** 12.35 dB plain, 14.12 dB level-matched.
  - The separated voice is about 1.2 dB louder than the voice-only release; the
    best-fit gain is 0.876.
- **Local SDR while singing**, 2-second stretches: median 14.7 dB.
- **Music left in the voice**, where the voice-only track is quiet: one stretch,
  1:58.75–1:59.25.
- **Voice dropping out**, where the voice-only track sings: none.
- **Weakest stretches while singing** (local SDR):

  | At | Local SDR |
  |---|---|
  | 4:00.5 | 7.9 dB |
  | 2:09.5 | 9.3 dB |
  | 3:59.5 | 9.4 dB |
  | 4:08.5 | 9.4 dB |
  | 2:48.5 | 9.8 dB |
  | 2:32.5 | 10.0 dB |

All times are in the full song, which is the time heard in the separated file.

### Ride: the versions do not match, so it is not scored

The voice-only track ("SoMo Ride acapella 115 bpm") lines up in time with the
song: it starts 0.760 s in, and every ten-second stretch agrees to within 1.5 ms.
But it is not the same audio.

- Waveform match is 0.27–0.58 per stretch and 0.345 overall, where All of Me
  gives 0.90–0.98 with the same method.
- Several stretches disagree by 1.2–1.4 ms (at 0:00.8, 0:30.8, 1:40.8 and 2:50.8),
  where All of Me disagrees by 0.0 ms.

A score against it would measure the difference between the two tracks, not the
separator. What is different about it is not known; an official stem, or both
tracks from the same source, would settle it.

## If I Ain't Got You (no voice-only track)

Voice and music files were made. Weak spots are not listed.

- The only way to find them without a reference was `spots.py`, which looks for
  loud sound with no sung pitch, and short drops inside phrases.
- Tested on All of Me, where the answer is known, it got all four of its picks
  wrong:
  - its one "music left in the voice" (3:51.0) is a stretch where the singer
    sings throughout;
  - its three "voice cutting out" (1:39.5, 4:02.1, 4:09.8) are real gaps where
    nobody sings;
  - it missed the one real bleed, at 1:58.75.
- Its picks for this song would mean nothing, and listening to it was not
  possible here.

## Not done

- **Drive upload.** The Drive connector only uploads a file whose whole contents
  are written into one request. The MP3s are 5.5–6.7 MB each, too large for that,
  and there is no way to send them in parts. Not worked around.
- **First run's file names.** The stems came out of the run unnamed:
  audio-separator writes `(vocals)` and `(other)` in lower case, and the script
  looked for capitals. They were named and encoded afterwards by the same
  `finish()` the script now uses, unchanged audio.
