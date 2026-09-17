# Reference-note piano samples

Sixteen anchors, every four semitones from C2 (MIDI 36) to C7 (MIDI 96),
named by MIDI number. `notes.json` holds the frequency each file actually
sounds, measured offline; `src/rp-piano.js` uses it to correct every note
to equal temperament with `playbackRate`.

**Source** — the Steinway B sustain samples (velocity layer 3) from the
Versilian Community Sample Library, https://github.com/sgossner/VCSL

**Licence** — CC0 1.0 Universal (public domain). No credit required, no
royalties, safe in a commercial app. VCSL's own words: "Essentially it's
Public Domain — you can do whatever you want with these sounds (even make
commercial software), no royalties, no credit, no special terms."

**What was done to them** — trimmed to three seconds from the onset,
350 ms fade at the end, mixed to mono, peak-normalised, encoded at
96 kbps. 584 KB for the set.

If a file does not load, `playPiano` falls back to the synthesised note
that is built into the page, so there is never silence.
