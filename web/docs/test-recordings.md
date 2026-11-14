# The recordings the checks need (kept outside the repo)

Recordings are never committed (RULEBOOK). Each suite reads them from
environment variables. Which file each one needs, worked out on 14 Nov when
a fresh container gave six false failures from the wrong files:

| Variable | What it must be | Used by |
|---|---|---|
| `RP_RECORDINGS` | `Name:path,Name:path`, the two full songs (All of Me, Ride) | web/tests/song.test.mjs, loudness (Ride) |
| `RP_RECORDINGS` (old app) | the same two songs as **vocals only** (the `-vocals` files) | tests/run.sh: singer, learnsong, score, placement, reading |
| `RP_SPLIT` | prefix of the separator's split of one song: `<prefix>-voice.mp3`, `-voice30.mp3`, `-music.mp3`, `-music30.mp3` | train, lab-scoring, loudness, shots-360 |
| `RP_MIC` | a WAV of a real voice | web/tests/browser.test.mjs and the others that feed the mic |
| `RP_MIC` (loudness) | at least 90 s of real voice (it reads 60 s from 30 s in): the separated voice works | web/tests/loudness.test.mjs |
| `RP_MIC` (old app flow) | three seconds of real voice, then digital silence, 30 s in all | tests/flow.test.js |
| `CHROME` | `/opt/pw-browsers/chromium` in the cloud container | tests/run.sh (its default path is an older Chrome) |

Where they come from: Robert's Drive (the songs and their vocals); the
split is made by services/separator from All of Me. The flow file is cut
from the mic WAV: `ffmpeg -i mic.wav -af "atrim=0:3,apad=whole_dur=30" -ac 1 -ar 48000 -c:a pcm_s16le mic-stops.wav`.
