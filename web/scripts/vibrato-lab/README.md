# The vibrato lab (24 Nov)

How the wobble measure (src/core/vibrato.ts) was proved. Recordings stay outside the repo: `RP_VOCALS_DIR` is a folder holding the voice-only `allofme-vocals.mp3` and `ride-vocals.mp3`. Run each with Node 22 from this folder:

- `node known.ts`: voice-like sounds of known speed and width, read by the app's live reader. Prints the error of the app's measure, of the highest-less-lowest single readings, and of the smoothed line.
- `node real.ts`: real voices. A steady sung note given a known wobble; the same note made steady; slow turns between two notes; and the singers' own held notes, a second at a time, against a reference read from a fine track (peaks and troughs, 500 readings a second). The fine tracks are cached beside the recordings.
- `node rate40.ts`: the singers' own held notes read 20, 40 and 100 times a second.
- `node diag.ts`: each second of a few held notes, the app beside the reference.
