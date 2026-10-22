# Report, 22 Oct 2026, commit c514001

The loudness round, after your phone test with the USB-C headset. Four changes to how the app sounds; nothing else changed.

## What works

- **The second try.** When a tap rebuilds the sound and the new sound won't start, the app closes it, waits 600 ms and makes one more. Only on that tap, never a third, never by itself.
- **Hear yourself, fixed.** Three things were wrong, and all three are fixed:
  - Switched on during the 3-2-1, or while the mic was still opening, it was lost when the song started. Now it takes whenever you switch it, and is kept while the song starts.
  - When the phone takes the mic and gives it back (plugging a headset in can do this), the old app wired the mic again a moment later; the new app didn't, so the mic could stay live and silent. Now it does the same as the old app.
  - It came back at four fifths of a raw mic's level, which is too quiet to hear at all. See the slider.
  - After a rebuild your voice was already wired onto the new sound; I checked it with a real voice and it is heard at the same level before and after.
- **A Hear yourself volume slider,** in the sound card under the switch, 0 to 100, remembered on the phone, 70 at first. At 100 your voice comes back at four times the mic's level (+12 dB). It is rounded off before it can crackle, and it joins the sound after the limiter, so it adds no delay.
- **Every song at a proper level.** The first time a song plays, the app measures its loudest moment (voice and music together) and lifts both parts by the same amount so that moment sits just under full volume (-1 dBFS). The number is kept with the song and never measured again. Sliders at 100 play at that level.
- **The way out changes nothing below 0.9.** The limiter now starts at 0.9, its own lift is taken off, and the last safety only touches peaks above 0.9.

## What was measured

On the live site before this round, a split song at sliders 100: voice peak -0.5 dBFS, average -16.7; music peak -3.4, average -18.6; together peak -0.4, average -14.6. So this song's files were already at full volume at their peaks. What the way out did to them: a half-volume tone came out at 0.81 of itself (cut by a fifth, 1.9 dB). On the new build the same tone comes out at exactly 1.000 of itself at sliders 100, 70 and 30.

A song made five times too quiet now comes out with its loudest moment at 0.891 (-1.0 dBFS, the target), voice and music lifted alike (4.37 times). Halving the kept number halves the sound, so the level is read from the song, not measured again.

Hear yourself, with a real voice in the mic at a raw mic's level (-24 dBFS): at 70 your voice comes back at 1.95 times the mic; at 50, 1.0 times; at 0, silent; at 100, 3.97 times (+12 dB), loudest sample 0.890, never over. The music alone at 100 averages -18.9 dBFS; your voice at 100 averages -11.6, so it is 7.3 dB louder than the music. The slider is still at 100 after leaving the song and coming back. After a stall and a rebuild, your voice comes back at the same 1.95 times on the new sound. When the phone gives the mic back, it is wired again once.

The second try: the first new sound was closed, and 602 ms later another was made, which played. When both tries fail, three sounds were made and still three four seconds later, and Start is shown with the sound trouble steps.

Every check passes: browser 15, Android 28 (2 new), library 7, note map 13, Learn a song 18, takes 19, loudness 8 (a new suite), 170 core tests (16 new), and the old app's 187. Every deliberately broken version is caught: 128 of the app (15 new) and 78 of its core (12 new). Each new check failed on the build before this one first.

## Not tried on a real phone

None of this has been tried on a real phone. Two things I can't settle from here:

- Whether the song itself is now loud enough on your phone at full volume. This song's files already peaked near full volume, so the level fix adds only half a decibel to it; the way out adds 1.9 dB. Quiet songs gain much more. If the song is still too quiet, the next step is the old app's v9.8 compressor, which lifts the body of the sound rather than its peaks. That's your decision.
- The second try can't be made to happen on purpose on a phone.

One difference from the old app, for you to decide: the old app remembered whether the Hear yourself switch was on between visits; the new app remembers only its volume.

## Your taps

Samsung, Chrome, USB-C headset in, phone at full volume.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. Tap Sing, then Learn a song, then your song. In the Sound card, switch Hear yourself on, then tap Start. You should hear yourself from the first note.
3. Under the switch is the new "Hear yourself volume" slider, at 70. Slide it to 100 while singing: your voice should be clearly louder than the music, with no crackle.
4. Tap Start again, and switch Hear yourself on during the 3, 2, 1. You should hear yourself as soon as the song starts.
5. Tell me three things: is your voice loud enough at 100; is the song loud enough at both sliders 100; and is either different with the headset out.
