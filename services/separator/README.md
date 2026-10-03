# Separator service

Splits a song into a voice file and a music file for Repertoire, on a GPU at
Modal. Kim's Mel-Band RoFormer, run with Kim's own code and settings
(overlap 2), pinned by commit and by the weights' SHA-256 (see app.py). The
weights are downloaded on Modal when the image is built; they and all audio
stay out of this repo.

## Status (3 Oct 2026)

Not live. `modal deploy app.py` built the image (weights downloaded and
checked: SHA-256 matches) and then stopped with Modal's message:

> Please add a payment method to use L4 GPU functions.

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
