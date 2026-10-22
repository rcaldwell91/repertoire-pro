# Report, 22 Oct 2026, commit 5d26ce8

The loudness round, after your phone test with the USB-C headset. Four changes to how the app sounds; nothing else changed. This report replaces the one written earlier today for this round, which turned out to be wrong about one thing (below, under "What was measured").

## What works

- **The second try.** When a tap rebuilds the sound and the new sound won't start, the app closes it, waits 600 ms and makes one more. Only on that tap, never a third, never by itself.
- **Hear yourself, fixed.** Three things were wrong, and all three are fixed:
  - Switched on during the 3-2-1, or while the mic was still opening, it was lost when the song started. Now it takes whenever you switch it, and is kept while the song starts.
  - When the phone takes the mic and gives it back (plugging a headset in can do this), the old app wired the mic again a moment later; the new app didn't, so the mic could stay live and silent. Now it does the same as the old app.
  - It came back at four fifths of a raw mic's level, which is too quiet to hear at all. See the slider.
  - After a rebuild your voice was already wired onto the new sound; I checked it with a real voice and it is heard at the same level before and after.
- **A Hear yourself volume slider,** in the sound card under the switch, 0 to 100, remembered on the phone, 70 at first. At 100 your voice comes back at four times the mic's level (+12 dB). It is rounded off before it can crackle, and it joins the sound after the limiter, so it adds no delay.
- **Every song brought up to a proper level, once.** The first time a song plays, the app measures its loudest moment (voice and music together) and lifts both parts by the same amount so that moment sits just under full volume (-1 dBFS). The number is kept with the song and never measured again. Sliders at 100 play at that level. One thing I did differently from your words, and it is yours to confirm: a song is brought up, never down. Your test song's voice and music together already peak a little above full volume, and turning it down to -1 dBFS made it 2.4 dB quieter than before, the opposite of what you asked for. So a song already at full volume plays as it is, and the limiter holds its peaks. Even so, measured on the live site after the merge, your song comes out 1.1 dB quieter on average than before this round (below). That is the honest result of the rules chosen: the old limiter squashed this song's peaks and lifted the rest, and "nothing changed below 0.9" takes that away. Making a full-volume song louder means squashing it on purpose, which is the old app's v9.8 compressor, and your decision.
- **The way out changes nothing below 0.9.** The limiter now starts at 0.9, its own lift is taken off, and the last safety only touches peaks above 0.9.

## What was measured

On the live site before this round, your split song at sliders 100: voice peak -0.5 dBFS, average -16.7; music peak -3.4, average -18.6; together peak -0.4, average -14.6. The two files added together peak at +0.4 dB, above full volume. What the way out did to them: a half-volume tone came out at 0.81 of itself (cut by a fifth, 1.9 dB). On the new build the same tone comes out at exactly 1.000 of itself at sliders 100, 70 and 30.

The earlier report today said this song gained half a decibel from the level fix. That was wrong: measured on the live site, it had lost 2.4 dB, because its peak is above full volume and it was being turned down. With "up, never down" it is measured on the live site again, sliders at 100: together peak -0.7 dBFS, average -15.7; before this round, peak -0.4, average -14.6. So this song is 1.1 dB quieter on average than before, because the old limiter squashed its peaks and lifted the rest, and the new way out does neither below 0.9.

A song made five times too quiet comes out with its loudest moment at 0.891 (-1.0 dBFS, the target), voice and music lifted alike (4.37 times). Halving the kept number halves the sound, so the level is read from the song, not measured again. A song already at full volume plays at exactly 1.000 of itself.

Hear yourself, with a real voice in the mic at a raw mic's level (-24 dBFS): at 70 your voice comes back at 1.95 times the mic; at 50, 1.0 times; at 0, silent; at 100, 3.97 times (+12 dB), loudest sample 0.890, never over. The music alone at 100 averages -18.9 dBFS; your voice at 100 averages -11.6, so it is 7.3 dB louder than the music. The slider is still at 100 after leaving the song and coming back. After a stall and a rebuild, your voice comes back at the same 1.95 times on the new sound. When the phone gives the mic back, it is wired again once.

The second try: the first new sound was closed, and 602 ms later another was made, which played. When both tries fail, three sounds were made and still three four seconds later, and Start is shown with the sound trouble steps.

Every check passes: browser 15, Android 28 (2 new), library 7, note map 13, Learn a song 18, takes 19, loudness 9 (a new suite), 170 core tests (16 new), and the old app's 187. Every deliberately broken version is caught: 129 of the app (16 new) and 79 of its core (13 new). Each new check failed on the build before this one first. One run of the broken builds hung once for no reason I could find and was stopped; run again, both builds were caught.

## Not tried on a real phone

None of this has been tried on a real phone. Two things I can't settle from here:

- Whether the song itself is loud enough on your phone at full volume. Your test song already peaks at full volume, so the level fix can't lift it, and it is 1.1 dB quieter on average than before this round. Quiet songs gain a lot. If you want full-volume songs louder, the next step is the old app's v9.8 compressor, which lifts the body of the sound and squashes its peaks. That's your decision; I have not built it.
- The second try can't be made to happen on purpose on a phone.

Two differences from the old app, for you to decide: the old app remembered whether the Hear yourself switch was on between visits; the new app remembers only its volume. And "up, never down", above.

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
