# Report, 22 Oct 2026, commit eacfce2

This report covers two rounds: the USB-C headset fix, and this housekeeping round. The housekeeping round changed nothing in how the app behaves.

## What works

The headset fix (in a computer browser that mimics Android):
- Start asks for the mic once, raw: echo, noise and volume processing off, lowest delay. It never tries another mode by itself.
- The mode the old ladder remembered is cleared. Another mode comes only from "Try another mode" in the Sound check, and only that choice is remembered.
- The mic opens first, then the sound. Sound made before the mic opened is made anew on the next Start.
- Recovering from a stall, and Test without mic, both wait for the old sound to close, wait 800 ms, start the new sound, play one silent sample and check the sound clock is moving.
- "Use the phone's own mic" picks the built-in mic by name on the very first mic request, so plugging the headset in can't switch it. The same button then reads "Let the phone choose the mic". A mic that crashed the phone is dropped and never picked again by itself.
- A safety stage after the limiter keeps loud parts together under full volume.

This round:
- Your two Drive docs, android-samsung-headset.md and android-audio-history.md, are copied into the repo unchanged.
- Two new rulebook rules: a report for you with every merge, and knowledge carried as copies, never summaries.
- This report, and a running log of every report.

## What was measured

- All browser checks pass on this build (the app itself is unchanged this round, file for file): 15 general, 26 Android, 7 library, 13 note map, 18 Learn a song, 19 takes.
- The old app's 187 checks pass.
- Every deliberately broken version of the app (113) and of its core (66, six of them new this round) was caught by a test.
- Both copied docs match your Drive files byte for byte: 998 and 11,439 bytes.
- The live site serves exactly the build on main, file for file.
- On the live site: one raw mic request per Start, the old remembered mode cleared, the phone's own mic used by name.
- Two loud parts together peaked below full volume (it was 1.03 before the safety stage).

## Not tried on a real phone

Nothing from the headset fix has been tried on a real phone yet. Whether your Samsung now plays through the USB-C headset only your phone can show.

One difference from the old app, found in the history doc, for you to decide: the old app's rebuild retried once more after 600 ms if the first try didn't start the sound. The new app tries once and then shows Sound trouble. Nothing was changed.

## Your taps

Samsung, Chrome, USB-C headset plugged in.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. Tap Sing, then Learn a song, then your song, then Start. You should see 3, 2, 1, then hear the song in the headset.

If there's still no sound:
1. Tap Sound check, at the bottom of the Sound card.
2. Tap Start and screenshot the "What the phone says" card.
3. Tap Test without mic and screenshot the result.
4. Tap Use the phone's own mic, go back to your song and tap Start.
5. Only if it's still silent: in the Sound check, tap Try another mode once, then try your song again. Screenshot the "Mic mode" line each time.
