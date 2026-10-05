# Pitch engine bake-off, 5 Oct

Real voices only: the voice-only All of Me and Ride (RULEBOOK 5), and the separator's voice part for All of Me, Ride and If I Ain't Got You. Recordings kept outside the repo; this is the numbers only. Rerun: `reference.py`, then `bakeoff.mjs` (headers of each say how).

- **Follows the voice**: share of the loud time (the old singer test's Otsu split, 50 ms frames) where the line has a note.
- **Line in the gaps**: share of the line's points that fall in quiet time.
- **Right note / octave errors**: against a reference neither candidate is part of: CREPE "full" (Viterbi) and pYIN, where both hear a voice and agree within half a semitone.
- **Line late by**: the shift that best lines the line up with that reference (positive: drawn after it was sung).
- **Live reaction**: from a note starting to the mic line showing it, simulated as the phone feeds it.
- **Reading**: ms of reading per second of song, on this test machine.

## Decision

No new candidate beats the old app's method on both voice-only tracks (97.0% / 94.0% today): SwiftF0 with smoothing wins on Ride but loses on All of Me and on the separated All of Me; MPM is lower everywhere. **The old method stays** (YIN, CREPE-tiny octave anchor, median of five), with one change: the median of five is centred on each point instead of taken over the last five. The old way drew every change of note about 0.1 s late; centred, the line is within ±10 ms, "right note" rises 8 to 20 points, and "follows the voice" is the same or better on every recording (97.1% / 94.2%). The loudness gate on the file's own loudness (Otsu) was tried and not kept: it lowered "follows the voice" below the old app's on both voice-only tracks.

(RULEBOOK 5 lists 93.2% / 96.5% for the old app; the same method measures 97.0% / 94.0% here, point for point identical to the old app today.)

## Results

| Recording | Method | Follows the voice (% of loud time) | Line in the gaps % | Right note (±½ semitone) % | Octave errors % | Line late by (ms) | Live reaction, median ms (missed %) | Reading ms per s of audio |
|---|---|---|---|---|---|---|---|---|
| All of Me (voice-only) | Old app (YIN + CREPE-tiny anchor + median of 5) | 97.0 | 5.3 | 76.3 | 0.65 | 95 | 130 (0) | 256 |
| All of Me (voice-only) | MPM + the same anchor | 96.8 | 4.9 | 78.2 | 0.70 | 30 | 117 (0) | 312 |
| All of Me (voice-only) | MPM alone | 96.7 | 4.9 | 77.0 | 1.61 | 30 | 117 (0) | 98 |
| All of Me (voice-only) | This app: the old method, median centred | 97.1 | 5.3 | 84.2 | 0.52 | -5 | 125 (0) | 234 |
| All of Me (voice-only) | This app: the old method, median centred, Otsu gate | 96.4 | 1.3 | 84.1 | 0.43 | 5 | 125 (0) | 231 |
| All of Me (voice-only) | This app's core with MPM + the same anchor, Otsu gate | 96.1 | 1.1 | 85.3 | 0.43 | -5 | 115 (0) | 286 |
| All of Me (voice-only) | SwiftF0 (+ median of 5 and bridging) | 96.0 | 2.9 | 78.4 | 0.00 | 30 | 200 (0) | — |
| All of Me (voice-only) | SwiftF0 alone | 92.0 | 1.9 | 98.1 | 0.21 | 0 | — | — |
| Ride (voice-only) | Old app (YIN + CREPE-tiny anchor + median of 5) | 94.0 | 4.0 | 69.4 | 0.31 | 100 | 150 (0) | 252 |
| Ride (voice-only) | MPM + the same anchor | 92.6 | 4.4 | 72.6 | 0.34 | 95 | 127 (0) | 310 |
| Ride (voice-only) | MPM alone | 92.3 | 4.4 | 72.5 | 0.45 | 95 | 127 (0) | 98 |
| Ride (voice-only) | This app: the old method, median centred | 94.2 | 4.0 | 89.0 | 0.27 | 0 | 122 (0) | 235 |
| Ride (voice-only) | This app: the old method, median centred, Otsu gate | 93.8 | 2.5 | 89.2 | 0.24 | 0 | 122 (0) | 235 |
| Ride (voice-only) | This app's core with MPM + the same anchor, Otsu gate | 92.4 | 2.8 | 90.5 | 0.21 | 0 | 106 (0) | 285 |
| Ride (voice-only) | SwiftF0 (+ median of 5 and bridging) | 96.2 | 5.9 | 68.9 | 0.03 | 100 | 243 (0) | — |
| Ride (voice-only) | SwiftF0 alone | 88.3 | 4.3 | 97.4 | 0.17 | 0 | — | — |
| All of Me (separated) | Old app (YIN + CREPE-tiny anchor + median of 5) | 89.5 | 0.0 | 75.9 | 0.88 | 85 | 127 (8) | 251 |
| All of Me (separated) | MPM + the same anchor | 88.4 | 0.0 | 77.3 | 0.91 | 85 | 113 (8) | 306 |
| All of Me (separated) | MPM alone | 88.1 | 0.0 | 76.4 | 1.95 | 85 | 113 (8) | 98 |
| All of Me (separated) | This app: the old method, median centred | 89.5 | 0.0 | 84.3 | 0.85 | 5 | 113 (8) | 227 |
| All of Me (separated) | This app: the old method, median centred, Otsu gate | 89.5 | 0.0 | 84.3 | 0.85 | 5 | 113 (8) | 227 |
| All of Me (separated) | This app's core with MPM + the same anchor, Otsu gate | 88.5 | 0.0 | 85.1 | 0.86 | -5 | 127 (8) | 281 |
| All of Me (separated) | SwiftF0 (+ median of 5 and bridging) | 86.2 | 0.0 | 77.8 | 0.24 | 85 | 203 (8) | — |
| All of Me (separated) | SwiftF0 alone | 81.7 | 0.0 | 97.5 | 0.54 | 0 | — | — |
| Ride (separated) | Old app (YIN + CREPE-tiny anchor + median of 5) | 86.6 | 0.0 | 68.6 | 0.60 | 100 | 93 (6) | 243 |
| Ride (separated) | MPM + the same anchor | 85.3 | 0.0 | 70.6 | 0.39 | 100 | 73 (6) | 294 |
| Ride (separated) | MPM alone | 85.1 | 0.0 | 69.6 | 1.44 | 100 | 73 (6) | 92 |
| Ride (separated) | This app: the old method, median centred | 87.0 | 0.0 | 87.1 | 0.49 | 0 | 105 (6) | 221 |
| Ride (separated) | This app: the old method, median centred, Otsu gate | 87.0 | 0.0 | 87.1 | 0.49 | 0 | 105 (6) | 224 |
| Ride (separated) | This app's core with MPM + the same anchor, Otsu gate | 85.4 | 0.0 | 89.6 | 0.28 | 0 | 103 (6) | 275 |
| Ride (separated) | SwiftF0 (+ median of 5 and bridging) | 90.4 | 0.0 | 67.6 | 0.07 | 100 | 217 (0) | — |
| Ride (separated) | SwiftF0 alone | 82.2 | 0.0 | 97.4 | 0.00 | 0 | — | — |
| If I Ain't Got You (separated) | Old app (YIN + CREPE-tiny anchor + median of 5) | 78.6 | 0.0 | 62.0 | 1.93 | 90 | 150 (0) | 242 |
| If I Ain't Got You (separated) | MPM + the same anchor | 78.2 | 0.0 | 63.5 | 1.90 | 90 | 137 (0) | 290 |
| If I Ain't Got You (separated) | MPM alone | 77.8 | 0.0 | 62.4 | 3.05 | 90 | 137 (0) | 86 |
| If I Ain't Got You (separated) | This app: the old method, median centred | 78.9 | 0.0 | 75.2 | 1.99 | 10 | 126 (3) | 200 |
| If I Ain't Got You (separated) | This app: the old method, median centred, Otsu gate | 78.9 | 0.0 | 75.2 | 1.99 | 10 | 126 (3) | 200 |
| If I Ain't Got You (separated) | This app's core with MPM + the same anchor, Otsu gate | 78.4 | 0.0 | 76.8 | 1.84 | 0 | 101 (0) | 251 |
| If I Ain't Got You (separated) | SwiftF0 (+ median of 5 and bridging) | 78.5 | 0.0 | 61.9 | 4.11 | 90 | 220 (3) | — |
| If I Ain't Got You (separated) | SwiftF0 alone | 72.4 | 0.0 | 93.3 | 4.32 | 0 | — | — |
