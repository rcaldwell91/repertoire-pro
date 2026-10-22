# Report, 23 Oct 2026, commit b26e2aa

Your choice, option 2: the old app's v9.8 loudness stage is built and live. Songs at sliders 100 come out about 3 dB louder, with peaks held under -1 dB. Hear yourself at 100 was raised so it stays over the louder music.

## What works

- **The old app's v9.8 loudness stage, as it was.** Everything goes in at 0.9; a compressor lifts the body of the sound (-12 dB, knee 6, ratio 3, 4 ms, 220 ms); 1.4 raises it all; a limiter holds the peaks (-3 dB, ratio 20, 1 ms, 60 ms). The numbers are copied from the old app; its own tuning tests (loud.js, test_loud.js) are not in the repo, so only the numbers survive.
- **Peaks held under -1 dB.** After the limiter, a ceiling rounds off anything near the top, running at twice the sound's rate so peaks can't slip through between the samples either.
- **Hear yourself at 100 is now six times your mic (about +15.6 dB).** At three times, the louder music swallowed it (2.8 dB under the music). At six it is 2.6 dB over the music; that's what I set. The slider still starts at 70, which is now about what 100 was before. Your voice skips the compressors and goes only through the ceiling, which adds 2.7 ms.
- **The stage's own delay is counted.** The compressors look 6 ms ahead each and the ceiling adds 2.7 ms: 14.7 ms in all, measured. The app now allows for it when it works out where you are in the song and where a take sits. Before this round 6 ms of it went uncounted.
- Quiet songs are still lifted first, never loud ones turned down.

## What was measured

Your split song, played whole on the live site, voice and music at 100, recorded at the speaker and read with the standard loudness meter (EBU R128):

| | Loudness | Peak (true) | Average |
|---|---|---|---|
| Before | -9.7 LUFS | -0.5 dBFS | -12.9 dBFS |
| After | -6.8 LUFS | -1.4 dBFS | -9.8 dBFS |

So it is 2.9 dB louder on the meter and 3.1 dB louder on average, near -7 LUFS as the render said, with its peaks pulled down from -0.5 to -1.4 dB. Rendered the same way, the other All of Me goes from -13.4 to -7.3 LUFS and Ride from -15.5 to -9.3.

In the tests: the first 30 seconds of your song come out 3.9 dB louder than the song's own files (-7.4 LUFS), true peak -1.5 dBFS. With everything at 100 at once (the song, and your voice back at 100), peaks stay at -1.5 dBFS; Ride's loud chorus too. Hear yourself, with a real voice at a raw mic's level: at 70, 2.94 times the mic; at 100, 5.5 times (the ceiling rounds off its loudest moments), 2.6 dB over the music at 100, loudest sample 0.81.

Every check passes: browser 15, Android 28, library 7, note map 13, Learn a song 18, takes 19, loudness 11, 170 core tests, and the old app's 187. Each new check failed on the build before this one first. All 134 deliberately broken versions of the app and 83 of its core are caught. Two broken versions slipped through at first, and I made the checks stronger:
- With the compressor removed, the song was still 2.6 dB louder, and my check allowed 2.5. It now holds your 3 to 6 dB.
- The ceiling at the plain rate: rendered offline it lets Ride's chorus reach -0.7 dB, but in the browser the difference was too small to see. It is now guarded by a core test instead.

Three existing checks changed, each for this round's rules:
- The two "never clips" checks now say under -1 dB, not under full volume.
- The note map check switches Hear yourself off and on again on the next visit, because the switch is remembered now.

## Not tried on a real phone

None of this. Two things to listen for:
- At full phone volume with the headset, this is about 3 dB louder than your last test. If it is too loud, the phone's own volume brings it down.
- Hear yourself at 70 is now about where 100 was. If it is too loud, slide it down; it remembers.

## Your taps

Samsung, Chrome, USB-C headset in, phone at full volume.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. Tap Sing, then Learn a song, then your song. Voice and music at 100. Tap Start: the song should be clearly louder than before, enough to feel, with no crackle.
3. With Hear yourself on, sing. Slide "Hear yourself volume" to 100: your voice should sit clearly over the music, with no crackle.
4. Tell me: is the song loud enough without hurting, and where do you like the Hear yourself slider?
