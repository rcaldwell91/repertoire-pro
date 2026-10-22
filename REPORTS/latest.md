# Report, 23 Oct 2026, commit 92be4df

After your phone test (headset in, Media volume, everything better, nothing crackled). Two of your four changes are built and live. The third, songs louder, is not built: the measurements say the plan as written would not make your song louder, so it waits on your choice below. The fourth (raise quiet songs, never turn loud ones down) was already in.

## What works

- **Hear yourself at 100 is now three times your mic (about +9.5 dB), down from four.** The slider still starts at 70, on the new scale, and the soft limit is kept.
- **Hear yourself remembers whether it was on**, between visits, like the old app. Switch it on once and it is on next time you open a song, heard from the first note; switch it off and it stays off. Its volume was already remembered.

## What was measured

Hear yourself, with a real voice in the mic at a raw mic's level: at 100 your voice comes back at 3.00 times the mic, loudest sample 0.832, never over; still 3.5 dB louder than the music at 100. At 70, 1.47 times; at 50, 0.75; at 0, silent. Switched on, then back to the song: still on, and heard at 1.47 times from the first Start. Switched off, then back: off, silent.

Song loudness. Your split song, played whole on the live site, voice and music at 100, recorded at the speaker and measured with the standard loudness meter (EBU R128): **-9.8 LUFS** integrated, peak -0.5 dBFS, average -12.9 dBFS. Music apps play at about -14 LUFS, so this song already plays about 4 dB louder than they do. Its split parts come from a loud master of the song (the two parts add back up to it exactly, -9.7 LUFS); another master of All of Me plays at -13.4 LUFS, and Ride at -15.5.

The same three songs rendered through the old app's v9.8 stage (from next.html: compressor at -12 dB, ratio 3, a gain of 1.4, limiter at -3 dB): your split song -6.8 LUFS, the other All of Me -7.3, Ride -9.3. That is 3 to 6 dB louder than now, and it pushes the peaks up to full volume (0.0 dBFS).

So "about -14 LUFS" and "louder" pull opposite ways for your song: at -14 it would come out 4 dB quieter (or, never turned down, unchanged). The v9.8 stage makes it louder, but well past -14.

Every check passes: browser 15, Android 28, library 7, note map 13, Learn a song 18, takes 19, loudness 10 (1 new), 170 core tests, and the old app's 187. The new checks failed on the previous build first, and four new deliberately broken builds and one new core one are caught. The note map check was changed: it said the switch starts off on the next visit, and now says it is remembered.

## Not tried on a real phone

None of this. Your choice on loudness, one of:

1. **Lift quiet songs to about -14 LUFS**, peaks held under -1 dBFS, never turn loud ones down. Ride would gain 1.5 dB; your split song would not change.
2. **The old app's v9.8 stage**, with peaks held under -1 dBFS: songs 3 to 6 dB louder than now (about -7 to -9 LUFS), squashed more. Much louder than music apps; the one to pick if it must be louder whatever the song.
3. **In between**: name a number (for example -11 LUFS) and I lift songs to it, never down.

Before you choose, one minute on your phone tells us whether the app or the phone is the quiet part (taps below). If YouTube is also too quiet on the headset, the limit is the phone or headset, not the app.

## Your taps

Samsung, Chrome, USB-C headset in, phone at full volume.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. Tap Sing, then Learn a song, then your song. Hear yourself should be as you left it. Switch it on if it is off.
3. Tap Start and sing. The slider under the switch is "Hear yourself volume": at 100 your voice should be a little less loud than last time.
4. Tap Pause, then go back and open the song again: Hear yourself is still on.
5. The loudness question: play the same song in YouTube on the same headset at full volume, then in the app with voice and music at 100. Which is louder, or are they about the same? Then tell me 1, 2 or 3 above.
