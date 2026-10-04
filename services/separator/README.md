# Separator service

Splits a song into a voice file and a music file for Repertoire, on a GPU at
Modal. Kim's Mel-Band RoFormer, run with Kim's own code and settings
(overlap 2), pinned by commit and by the weights' SHA-256 (see app.py). The
weights are downloaded on Modal when the image is built; they and all audio
stay out of this repo.

## Code and licences

- Weights: Kim's Mel-Band RoFormer, `KimberleyJSN/melbandroformer` on Hugging
  Face (licence: MIT), revision `ac9b0614ab3cd7f77219e18ba494dfd93956c348`,
  SHA-256 `87201f4d31afb5bc79993230fc49446918425574db48c01c405e44f365c7559e`
  (checked when the image is built).
- Code: ZFTurbo's Music-Source-Separation-Training, **MIT licence**, release
  `v1.0.22` (commit `7671faec526b78156f60c94a767fb243a0aaa41e`, checked when
  the image is built, along with the MIT licence file). Model type
  `mel_band_roformer`, Kim's vocal config from that release
  (`configs/KimberleyJensen/config_vocals_mel_band_roformer_kj.yaml`).
- Kim's original settings: 8-second chunks, overlap 2, half precision, one
  chunk at a time, and no DC filter (`zero_dc=False`: added to ZFTurbo's code
  after Kim's release).
- Kim's own GitHub code has no licence and is not fetched or used.
- `sep_core.demix` gives exactly ZFTurbo's own `demix()` (largest difference
  0.0, on the GPU with the real weights: `tests/test_demix.py`).

## Status (4 Oct 2026)

Live on Modal at `https://rcaldwell91--repertoire-separator.modal.run`
(A10 since 4 Oct, scales to zero). Status reports `ready_s`: how far into the
song the split is final. Live tests sign in as the permanent test account
(`test_account.py`). Results are 320 kbps MP3s at the song's own level, so
voice + music add back up to the song (at 192 kbps the coding lost 3% of the
energy).

Quality, All of Me against its voice-only track (quality.py, the 1 Oct
method): 14.13 dB level-matched (CPU test 14.12 dB), the same on L4 and A10.
Plain SDR is 6.54 dB because the voice keeps the song's real level, where
the CPU test's tool scaled its voice to a 0.9 peak; judged on the
level-matched score (Robert, 4 Oct).

Speed and cost, 4 Oct, through the web endpoint, each song in its own fresh
copy of the service (cold start included), cost from Modal's usage report:

| Song | GPU | First 30 s ready | All done | Modal's cost |
|---|---|---|---|---|
| All of Me (4:30) | L4 | 42.7 s | 114.9 s | $0.0387 |
| Ride (3:51) | L4 | 40.0 s | 102.0 s | $0.0332 |
| If I Ain't Got You (4:39) | L4 | 39.1 s | 114.6 s | $0.0375 |
| All of Me | A10 | 27.1 s | 54.5 s | $0.0266 |
| Ride | A10 | 18.3 s | 39.6 s | $0.0182 |
| If I Ain't Got You | A10 | 25.4 s | 69.3 s | $0.0320 |

Times are from the upload being accepted; 11-20 s of each is a GPU starting.
The same L4 code separated about twice as fast on 3 Oct (37 s a song, total
66-99 s, about $0.02 a song), so L4 speed varies between machines.

## What it does
## What it does

- `POST /jobs` with the song as the body and the person's Supabase sign-in
  token (`Authorization: Bearer …`). Checked against the project's public
  signing keys only; anything else is refused.
- `GET /jobs/{id}`: real progress (chunks done of chunks), and whether the
  first 30 seconds are ready. They are handed back as soon as they are final,
  identical to the start of the whole result.
- `GET /jobs/{id}/voice|music|voice30|music30`: MP3s, each deleted the moment
  it has been collected. `DELETE /jobs/{id}` cancels and deletes.
- Limits: 30 MB, 10 minutes, one job per person, 3 at once overall, scales
  to zero. The upload is deleted as soon as it is read; anything left is
  deleted within 55 minutes. No audio in logs; only the job id ever goes to
  the GPU function.

## Tests

    FFMPEG=… RP_MIC=<a real voice recording> python -m pytest tests
    python tests/mutate.py      # each rule broken on purpose must fail the tests
