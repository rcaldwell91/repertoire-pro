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

## Status (3 Oct 2026)

Deployed on Modal (L4), not merged: All of Me's plain SDR is below the CPU
test's. Separation quality is the same (level-matched 14.11 dB against
14.12 dB); the plain score differs because last round's tool (audio-separator)
scaled its voice to a 0.9 peak and this keeps the song's own level, about
1.7 dB louder. With that same scaling, 12.15 dB plain against 12.35 dB.

Measured 3 Oct on an L4, each song in its own fresh copy of the service
(cold start included), through the web endpoint:

| Song | Length | First 30 s ready | All done | Modal's cost |
|---|---|---|---|---|
| All of Me | 4:30 | 60.0 s | 98.8 s | $0.0227 |
| Ride | 3:51 | 32.0 s | 66.1 s | $0.0207 |
| If I Ain't Got You | 4:39 | 30.2 s | 70.6 s | $0.0226 |

Times are from the upload being accepted. Of that, waiting for a GPU to
start was 51 s, 21 s and 21 s; once running, the first 30 s took 11-13 s
and the whole song 47-51 s (separating about 37 s, then making the MP3s).

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
