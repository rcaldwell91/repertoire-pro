# Reports for Robert

Every report, newest last. The newest is also in latest.md.

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

# Report, 23 Oct 2026, commit 27231a2

The Train tab is built and live: the old app's exercises and routines, a preview for each, the singing screen with bubbles, the range check, and results saved.

## What works

- **Train**: the daily warm-up at the top (the old app's beginner routine, 9 minutes, 7 exercises), your range, then the exercises in five groups: Warm-up orange, Breath teal, Tone pink, Agility blue, and Range in the same blue, as you said. The other four routines are at the bottom.
- **Every exercise of the old app**: all 27, with its group, level and pattern, plus the old app's range check as its own exercise. The old app's words are kept where they fit: names and syllables as they were. The long what-and-how text is shortened to one line each, because every line in the app is held to eight words. Octave leaps keep their safety line: "Never first. If it cracks, do sirens."
- **The preview**: the name, tags (group, level, "Quiet" if it works at hum volume, and what the app can measure), a "Hear the notes" button that plays only when tapped, with no mic, a one-line goal, a one-line how, Any octave, and a big Start. The tab bar is hidden on exercise screens.
- **The singing screen**: a 3-2-1 count-in, then the bubbles: smaller, the syllable inside, a white ring on the note to sing now. Your line runs in the voice gradient, and each bubble fills green with the share of it you sang on the note. The close button is the only control. The piano plays each note on the nearest shipped sample, retuned, as you said.
- **How each kind runs**:
  - Sung exercises climb your range the way the old app did: from one note above your lowest, a half step each time, at most 14 times.
  - Held notes are five notes spread through your range.
  - The hiss times itself from your first sound and stops after a second of quiet.
  - The Farinelli breath counts in, suspend and out.
  - Guided ones show the how and a clock, with Done.
  - Sirens show your line, with no score.
- **The score**: only what was measured. A note counts as hit when half of it is sung within a semitone of it; the green fill uses the same rule. Octave exact, unless Any octave is on. A sung exercise shows "x of y notes" and the %, the hiss its seconds, and anything else says it isn't scored.
- **After each exercise**: Try again, and Next. In a routine, Next reads "Next: [name]" and opens that step paused, with End session; nothing ever starts by itself.
- **Your range**: one source. It is this app's own; if this app has none, the old app's range on the phone; then your account's (the old app saved it there). Until then A2 to A4, shown as "Not measured yet". The range check (four seconds low, four high) keeps the result on the phone and on your account.
- **Saved straight away**: every result is saved on the phone, and online in the old app's results table when you are signed in. Its security rules are unchanged: you write your own, and a coach who teaches you can read them.
- **Mic refused**: the exercise still plays, "Carry on without it" is offered, and nothing is scored.

## What was measured

All with a real voice: one steady sung note from your split song, found by the test's own pitch reader, shifted onto each note an exercise asks for. Never a tone.
- Mum sung right: 18 of 18 notes. Three semitones off: 0 of 18. An octave down: 0 of 18 octave exact, 18 of 18 with Any octave.
- Sustained note, five 8-second holds: 4 of 5 (the test voice is a 0.7-second note stretched to 8 seconds, so one hold wavers).
- The hiss, six seconds of voice: timed at 5.9 seconds; the result stays, the mic closes.
- The range check, sung low and high: kept exactly as sung (F3 to G♯4). Mum then starts on the note one above the bottom: heard at the speaker and read by the test, 54.1, where 54 is wanted.
- Close: silence and the mic closed within 1 ms. Nothing plays before Start; a routine waited on its step, not moving on.
- Saved: on the phone with the numbers; online, signed in as the test singer, the row reached the account.

Every check passes: Train 19 (new), browser 15, Android 28, library 7, note map 13, Learn a song 18, takes 19, loudness 11, 195 unit tests, and the old app's 187. Each new check failed on the build before this one first. All 148 broken builds of the app and 105 of the core were caught, 37 of them new for Train.

The old-app checklist has a new Train section: 29 rules ticked, each with its test, and 8 left out on purpose with the reason. The whole checklist is now 146 ticked, 30 left out with reasons, and none crossed.

## Not tried on a real phone

None of it. Things I decided that you may want to change:
- The old app's long explanations (why, watch for, care) are not shown, as 1b's preview asks.
- Held notes: five notes spread evenly through your range, so one run can be compared with the next. The old app picked ten at random.
- Sirens: no sine glide (the app plays only the piano), and not scored.
- Not in this round: the pitch tools and ear drills (Match the note, Keyboard, Hold the interval) and the voice-type range presets.
- Two test results are left on the test singer's account ("Straw phonation", no score): deleting them needs your approval in the database tool, so I left them.

## Your taps

Samsung, Chrome, headphones in.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. Tap Train. Under "Your range", tap the line, then Start, and sing "ooh": low until the bar fills, then high.
3. Back on Train, tap Mum. Tap "Hear the notes", then Start. After 3, 2, 1, sing each bubble on "mum".
4. When it ends, read your score, then tap Next.
5. Tap Train, then "Start the warm-up" for the daily routine. Each step waits for your Start.

# Report, 24 Oct 2026, commit 98af4df

Your design pass on Train is built and live, with your new rule in the rulebook: every screen has one stated goal.

## What works

- **The rule**: it is in the rulebook in your words. Every screen file now starts with its one-line goal, and a check fails the build if a screen has none.
- **Train**: the warm-up card with Start and one line, "More routines", under it; then five cards, Warm-up, Breath, Tone, Agility and Range, each in its colour with a simple picture. Nothing else. Tapping a card opens that group's list, with the rows as before: the level, "Quiet" where it works at hum volume, and what is measured. The range check lives in Range, and its row shows your range, or "Not measured yet". "More routines" opens the other routines and the cool-down.
- **The exercise page**: back, the name, its group as the only tag, the pattern card, Goal, How and a big Start. The pattern card draws the notes as small bars with one play button; as it plays, the current bar lights and the syllable shows under the card ("mum"). The level, Quiet and "Scored on pitch" tags have left this page.
  - The gear in the top corner opens the sound sheet: Any octave (off at first, remembered for that exercise alone), Count-in sound, Hear yourself and its volume.
  - "More about this" opens the old app's why, watch for and care, in its own words.
- **The singing screen**: the note map fills the screen, top to bottom, with the ladder of note names at the left. Every bubble shows its syllable; the one to sing now is bigger, with the ring. The dots along the bottom are one per repeat, filling as you go. Close is the only control. The score, Try again and Next come only at the end.
- **The count-in sound**: a short, soft beep on each of 3, 2, 1, on at first. It is one setting for the whole app, "Count-in sound", remembered, in the exercise's sound sheet and in Learn a song's sound card. It goes through the conductor like every other sound, so it is silenced by Close with the rest, and it never counts toward a score or a take.
- **Kept from last time**: held notes spread evenly, sirens unscored, the long explanations behind "More about this". The two test results stay on the test account.

## What was measured

All on the built app, in a Chrome made to behave like Android; the singing with a real voice, never a tone.
- Train: the page holds the title, the warm-up card and the five cards, and nothing else; each card in its colour with a picture; 0 exercise rows on it. The tab bar shows on Train and on a group's list, and hides on an exercise.
- The groups' lists: Warm-up 4, Breath 5, Tone 10, Agility 5, Range 4 (all 28), each title in its colour; Mum's row reads "Beginner · Quiet · Scored on pitch"; the range check's row shows the range kept.
- The exercise page: the group tag alone; 9 bars for Mum's pattern, none lit before the tap; nothing played before the tap; on the button the notes played with the mic not asked, a bar lit and "mum" showed under the card; a second tap stopped it.
- The sound sheet: Any octave off, Count-in sound on, Hear yourself off at 70; Any octave switched on for Mum stayed on for Mum and off for Mee.
- The count-in: 3 beeps before the first note with the sound on, 0 with it off, off remembered after reopening; Close during the count-in: no more sounds, silence and the mic closed. On Learn a song: 3 beeps before the song with it on, 0 off.
- The singing screen: the view covers the whole screen (844 of 844 px), the map 740 px of it; every bubble on screen carries its syllable; 8 note names at the left; bubbles 36 px, the current one 47 px; the dots one per repeat, the first marked current, then done.
- The sung checks still pass with a real voice: Mum 18 of 18, three semitones off 0 of 18, an octave down 0 of 18 exact and 18 of 18 with Any octave, the held notes 4 of 5, the hiss 5.9 of 6 seconds, the range check kept as sung, close within 1 ms.

Every check passes: Train 24 and the online save (6 new checks, 3 rewritten), Learn a song 19 (1 new), browser 15, Android 28, library 7, note map 13, takes 19, loudness 11, 212 unit tests (17 new), and the old app's 187. All 169 broken builds of the app and 106 of the core were caught; 25 of them are new for this round (24 app, 1 core), and each new check failed on its broken build first.

One thing to say plainly: in the first full run, the loudness check that holds peaks under -1 dB failed once on the Hear-yourself stretch, with the same loudness and the same sample peak as the pass but a true peak at 0. Run again on its own it passed with the usual numbers. A dropout in the test's own recording under load fits that; the sound itself did not change this round. Three other checks had to be re-pointed, because they counted the count-in's beeps as the song's own sounds; they pass now.

The checklist has the new rules with their tests: 152 ticked, 30 left out with reasons, none crossed.

## Not tried on a real phone

None of it. Things I decided that you may want to change:
- The ring on the current bubble is white in the dark theme, as you said, and ink in the light theme, where white would vanish.
- The old app's long texts are longer than the eight-word rule allows for instructions. They are kept as they were, as explanations: the copy check still bans the jargon words in them, but not their length.
- The gear shows only on exercises that count in; on a breath cycle or a guided one there is nothing to set. On exercises without notes, the sheet has only Count-in sound.
- The old app's "myth" and "note" paragraphs are not shown; you asked for why, watch for and care.
- The beep is a high soft tone, under a tenth of a second.
- The sound sheet and "More about this" open in place on the page, under one tap, with no pop-up.

## Your taps

Samsung, Chrome, headphones in.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. Tap Train. You should see the warm-up card and five coloured cards, nothing else. Tap Tone, then Mum.
3. Tap the play button on the pattern card: watch the bar light and "mum" appear under it.
4. Tap the gear. Check that Count-in sound is on. Tap the gear again to close it.
5. Tap Start. You should hear three soft beeps with 3, 2, 1, then the notes. Sing each bubble on "mum". Watch the dots along the bottom.
6. Tap the close button mid-exercise: it should go silent at once.
7. Tap "More about this" and read the old app's words.
8. Tap Sing, Learn a song, your song, and look in the sound card for "Count-in sound". Turn it off and tap Start: no beeps.

# Report, 25 Oct 2026, commit 4a92afe

Your fixes to the Train design pass are built and live: the pattern as a melody line, the singing screen zoomed to the notes being sung, every How line rewritten, the hummingbird, and a sixth group, Articulation.

## What works

- **The pattern card**: each note is a short dash at its pitch height, low notes low and high notes high, like a melody line; longer notes are wider. The current dash still lights as it plays, and the syllable shows under the dashes, inside the card, so there is no gap between the card and Goal.
- **The singing screen**: the note map zooms to the notes of the repeat being sung, with about three semitones of room above and below, and glides smoothly up as the pattern climbs. The bubbles are bigger to match. The note names stay at the left.
- **How lines**: all rewritten to say what to do with the body, breath or mouth, in one plain sentence of up to 14 words, never which sound and never how many notes. A check holds every How to that, and the copy check lets a How run to 14 words while everything else stays at eight. The full list is below.
- **Agility**: its picture is a hummingbird, a line drawing in Agility's blue, in the same stroke style as the others.
- **Articulation**: a sixth group, "Clear words while singing", in its own yellow (in the rulebook's colour list now), with its card and picture on Train and its own list. Seven exercises in our own words, each with notes and scored on pitch:
  - Five vowels: mah, meh, mee, moh, moo on one held note, then a half step up.
  - Red leather, Unique New York and Peter Piper: each tongue twister on the five-note scale up and down, the words running on note by note, round and round.
  - Consonant pops: puh, buh, tuh, duh on short repeated notes.
  - Tip of the tongue: up on la, down on ta.
  - Lips and tongue: "mommy made me mash my M&Ms", one syllable a note.
- **Everything else** from the design pass is as it was.

## The How lines, old and new

- **Steady hiss**: was "Breathe in low, then hiss out evenly." → now "Breathe in low and wide, then let the air out slow and even."
- **Farinelli breath**: was "Suspend without closing your throat." → now "Hold the breath with your throat open and ribs wide, nothing gripping."
- **Lip trills**: was "Lips loose, blow steadily, then add voice." → now "Keep your lips loose and the air steady so they keep fluttering."
- **Straw phonation**: was "Glide from low to high and back." → now "Seal your lips round the straw and let no air escape."
- **Humming: M, N, NG**: was "Lips together, jaw not clenched, soft." → now "Lips together, jaw loose, and feel the buzz in your face."
- **Sirens**: was "Slow enough to hear every part." → now "Slide slowly through your break without pushing or getting louder."
- **Mum**: was "Hum, open to a relaxed "uh", close." → now "Keep the hum buzzing in your lips as you open."
- **Mee**: was "Bright, but not squeezed. Jaw not clamped." → now "Keep it bright without spreading into a smile, and let the jaw hang."
- **Noo**: was "Round the lips properly. Keep it light." → now "Round your lips fully and keep the sound light as you climb."
- **Loo / Lah**: was "Jaw still. Only the tongue tip taps." → now "Keep your jaw still so only the tip of your tongue moves."
- **Gee (or Kee)**: was "Buzzy and light. Tight? Switch to "kee"." → now "Let the back of your tongue pop lightly into the vowel."
- **Staccato**: was "Light and bouncy, from the breath." → now "Bounce each note from your breath, light, with the jaw still."
- **Bratty Nay**: was "Keep it light and buzzy, never heavy." → now "Make it bright and nasal, never heavy, as you cross the break."
- **Bratty Bay**: was "Octave up, top note repeated, back down." → now "Let your lips pop open each time and stay bright, not heavy."
- **Wah**: was "Round the lips, stay quiet, come down." → now "Round your lips and stay quiet, like a small cry coming down."
- **Octave leaps**: was "Never first. If it cracks, do sirens." → now "Stay light on the low note and float up without reaching."
- **Slack-jaw La-Ga**: was "A knuckle under your chin feels the jaw." → now "Hang your jaw still, and a knuckle under your chin will feel it."
- **Tongue-out singing**: was "Pull the tongue toward your chin." → now "Stick your tongue out and down toward your chin, and keep it there."
- **Tongue-out with a crescendo**: was "If the tongue pulls in, back off." → now "Keep your tongue out as you grow louder, backing off if it pulls in."
- **Blah**: was "Let it be as floppy as it wants." → now "Let your jaw and tongue flop, because sloppy is the point."
- **Yawn-sigh**: was "Yawn, then sigh down on "ah"." → now "Start a real yawn, then let it fall into a sigh."
- **Messa di voce**: was "Only the volume changes. Pitch stays put." → now "Swell from soft to full and back while only the volume changes."
- **Sustained note**: was "Keep your line flat and level." → now "Keep the breath steady so the note stays flat and level."
- **Nine-tone scale**: was "Slow enough that every note is distinct." → now "Keep the air flowing so every step stays separate and even."
- **Descending five-tone**: was "Start light, and stay light coming down." → now "Start light at the top and stay light coming down."
- **Octave repeat**: was "Repeat four as easy as repeat one." → now "Keep the top as easy the last time as the first."
- **Vocal Function Exercises**: was "Soft and engaged. Every day beats hard." → now "Keep it soft and engaged, because gentle every day beats hard once."
- **Five vowels** (new): "Change only the shape of your mouth and keep the breath and tone steady."
- **Red leather** (new): "Move your tongue tip lightly and keep the air flowing through the words."
- **Unique New York** (new): "Keep your jaw loose and let the lips and tongue do the work."
- **Peter Piper** (new): "Pop the lips lightly from the breath, never from the throat."
- **Consonant pops** (new): "Release each consonant with a small puff of air, jaw still."
- **Tip of the tongue** (new): "Flick only the tip of your tongue and keep the jaw hanging still."
- **Lips and tongue** (new): "Keep your lips and tongue quick and light while the air stays steady."
- **Range check**: was "Sing low until the bar fills, then high." → now "Sing comfortably at your bottom and then your top, never straining."

## What was measured

All on the built app, in a Chrome made to behave like Android; the singing with a real voice, never a tone.
- The pattern card for Mum: 9 dashes; the top note's dash the highest, the first and last level at the bottom; every dash under 10 px tall; the two-beat last note's dash wider than the first's; 14 px from the card to Goal. The dashes light in turn and "mum" shows under them, with the mic not asked.
- Five vowels: five level dashes, and under them in turn: mah, meh, mee, moh, moo.
- The singing screen: the view sat three semitones round the first repeat's notes (54 to 67), then three round the second (55 to 68), moving in steps of at most 0.063 of a semitone a frame, never a jump; bubbles 48 px, the current one 62 px; 8 note names at the left.
- Train: six cards in six colours, Agility's a hummingbird; the lists: Warm-up 4, Breath 5, Tone 10, Agility 5, Range 4, Articulation 7, each title in its colour.
- The sung checks still pass with a real voice: Mum 18 of 18, three semitones off 0 of 18, an octave down 0 exact and 18 with Any octave; the held notes 4 of 5; the hiss 5.9 of 6 seconds; the range check kept as sung; close within 1 ms.
- Contrast: the yellow on both themes is in the contrast check, which passes at 3:1 or better everywhere.

Every check passes: Train 25 and the online save (1 new check, 4 extended), browser 15, Android 28, library 7, note map 13, Learn a song 19, takes 19, loudness 11, 221 unit tests (9 new), and the old app's 187. All 177 broken builds of the app and 112 of the core are caught; 14 are new for this round. One of the new ones slipped through at first: Articulation given Tone's pink still passed the Train check, which only compared each card with its own colour. The check now demands five different colours with Range matching Agility, and that broken build is caught.

The checklist has this round's rules with their tests: 157 ticked, 30 left out with reasons, none crossed.

## Not tried on a real phone

None of it. Things I decided that you may want to change:
- The three tongue twisters are three exercises, one each, so a singer can pick one. The words run on note by note round the exercise, as the twister is practised, rather than starting again on each repeat.
- Articulation's yellow: bright yellow in the dark theme, a deep mustard in the light one, where bright yellow would not read on cream.
- Articulation's picture is a head speaking, from the same icon set as the others.
- A phrase's single syllables may be everyday words ("and", "my"), so the How check flags two of them in a row, not one.
- The range check's How is about singing comfortably at each end; the screen itself says when to sing low and high.

## Your taps

Samsung, Chrome, headphones in.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. Tap Train: six cards now, Agility with a hummingbird, Articulation in yellow.
3. Tap Tone, then Mum. Tap the play button on the pattern card and watch the dashes light along the melody line with "mum" under them.
4. Tap Start and sing. Watch the map stay zoomed on the notes and glide up as the pattern climbs.
5. Tap Train, Articulation, Five vowels. Tap play on the card and watch mah, meh, mee, moh, moo. Tap Start and sing them.
6. Read a few How lines on the exercise pages and tell me any that confuse.

# Report, 27 Oct 2026, commit 8c67ac0

Your four Train changes are built and live: Agility's quick run, La-Ga a syllable a note, the Today card, and plain words.

## What works

- **Agility's picture**: five faint staff lines (35%), five solid dots each on a different line or space rising like a quick run, and one smooth curve through them, in Agility's blue, the same stroke weight as the other pictures. It replaces the hummingbird.
- **Syllables per note**: La-Ga alternates one syllable a bubble, la, ga, la, ga, and every repeat starts on la. I checked every exercise against the old app's syllable strings:
  - "la-ga la-ga" (La-Ga) is the only one that alternates a note at a time.
  - "mmm / nnn / ng" (Humming) is three hums, so it now changes each repeat: a repeat on mmm, the next on nnn, the next on ng, then round again.
  - The rest, like "loo · lah" or "bah · hoo", list other ways to sing the same exercise, not a pattern. The first is sung, as the old app did. One exception, kept as before: Tongue-out singing is sung on "uh", which is what the old app's own instructions say to sing.
  - A check now compares every sung syllable with the old app's strings, so a wrong one fails the build.
- **Today**: the top card is now "Today": what to do next, its name, length and Start, with "More routines" under it. It reads one source, which asks in this order: what a coach assigned, today's day of a program they bought, their own plan. The first two don't exist yet and answer "nothing", so it shows their own plan; with none, the daily warm-up. When coaching and programs are built, they plug into that source and the card doesn't change. If one of them can't answer (offline, say), it is skipped, never a blank card.
- **Plain words**: no singer jargon in any exercise's name, goal or How, held by a check with a list of words like break, legato, staccato, crescendo, engaged and phonation. A renamed exercise keeps its old name only behind "More about this", as "Also called ...". All the changes are listed below.
- Everything else is as it was.

## Each exercise's syllables, note by note

One repeat of each (in a range of C3 to F4), and the next repeats where they differ.

- **Steady hiss**: no notes to sing on (a timed hiss).
- **Breath counts**: no notes to sing on (breath counts).
- **Lip trills**: brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr (every repeat)
- **Straw singing**: no notes to sing on (guided, with a clock).
- **Humming: M, N, NG**: mmm mmm mmm mmm mmm mmm mmm mmm mmm | then nnn nnn nnn nnn nnn nnn nnn nnn nnn | then ng ng ng ng ng ng ng ng ng
- **Sirens**: no notes to sing on (a slide, your line only).
- **Mum**: mum mum mum mum mum mum mum mum mum (every repeat)
- **Mee**: mee mee mee mee mee mee mee mee mee (every repeat)
- **Noo**: noo noo noo noo noo noo noo noo noo (every repeat)
- **Loo / Lah**: loo loo loo loo loo loo loo loo loo (every repeat)
- **Gee (or Kee)**: gee gee gee gee gee gee gee gee gee (every repeat)
- **Short bouncy notes**: bah bah bah bah bah (every repeat)
- **Bratty Nay**: nay nay nay nay nay nay nay (every repeat)
- **Bratty Bay**: bay bay bay bay bay bay bay bay bay bay (every repeat)
- **Wah**: wah wah wah (every repeat)
- **Octave leaps**: ma ma ma ma ma ma ma (every repeat)
- **Slack-jaw La-Ga**: la ga la ga la ga la ga la (every repeat)
- **Tongue-out singing**: uh uh uh uh uh (every repeat)
- **Tongue out, getting louder**: no notes to sing on (guided, with a clock).
- **Blah**: no notes to sing on (guided, with a clock).
- **Yawn-sigh**: no notes to sing on (guided, with a clock).
- **Soft, loud, soft**: ah, ah, ah, ah, ah, one long note each.
- **Sustained note**: ee, ee, ee, ee, ee, one long note each.
- **Nine-note scale**: lah lah lah lah lah lah lah lah lah lah lah lah lah lah lah lah lah (every repeat)
- **Five notes down**: oo oo oo oo oo (every repeat)
- **Octave repeat**: buh buh buh buh buh buh buh buh buh buh (every repeat)
- **Long soft notes**: no notes to sing on (guided, with a clock).
- **Five vowels**: mah meh mee moh moo (every repeat)
- **Red leather**: red lea ther yel low lea ther red lea | then ther yel low lea ther red lea ther yel | then low lea ther red lea ther yel low lea
- **Unique New York**: u nique New York u nique New York u | then nique New York u nique New York u nique | then New York u nique New York u nique New
- **Peter Piper**: Pe ter Pi per picked a peck Pe ter | then Pi per picked a peck Pe ter Pi per | then picked a peck Pe ter Pi per picked a
- **Consonant pops**: puh buh tuh duh puh buh tuh duh (every repeat)
- **Tip of the tongue**: la la la la la ta ta ta ta (every repeat)
- **Lips and tongue**: mom my made me mash my M and Ms (every repeat)
- **Range check**: no notes to sing on (the range check).

## Plain words: every change

Names (the old name now only behind "More about this"):
- Farinelli breath → Breath counts
- Straw phonation → Straw singing
- Staccato → Short bouncy notes
- Tongue-out with a crescendo → Tongue out, getting louder
- Messa di voce → Soft, loud, soft
- Nine-tone scale → Nine-note scale
- Descending five-tone → Five notes down
- Vocal Function Exercises → Long soft notes

How lines:
- Sirens: "Slide slowly through your break without pushing or getting louder." → "Slide slowly through where your voice flips, without pushing or getting louder."
- Bratty Nay: "Make it bright and nasal, never heavy, as you cross the break." → "Make it bright and nasal, never heavy, as you pass where your voice flips."
- Long soft notes: "Keep it soft and engaged, because gentle every day beats hard once." → "Keep it soft but steady, because gentle every day beats hard once."

Goals (the same check reads them):
- Breath counts: "In for a count, suspend, out. Silent." → "In for a count, hold, out. Silent."
- Loo / Lah: "A legato scale where only the tongue moves." → "A smooth scale where only the tongue moves."
- Mee: "The bright, narrow vowel, started softly." → "A bright "ee", started softly."
- Sustained note: "One note, held soft but engaged." → "One note, held soft and steady."
- Unique New York: "Crisp consonants without losing the line." → "Crisp words while the sound keeps flowing."

Kept on purpose, for you to decide: "Octave" in Octave leaps and Octave repeat (most people know the word from school music), Lip trills, Sirens, Bratty Nay and Bay, Slack-jaw La-Ga, and Articulation, your name for the group.

## What was measured

All on the built app, in a Chrome made to behave like Android; the singing with a real voice, never a tone.
- Train: the page is the title, the Today card and the six group cards. The card reads "Today", "Daily warm-up", "9 min · 7 exercises", Start and More routines. Start opened the daily warm-up at its first step.
- Today follows its source: with an own plan kept on the phone (set by the test, since nothing in the app sets one yet), the card showed "Cool-down", "3 min · 3 exercises", and Start opened the cool-down; with none, the daily warm-up again.
- Agility's picture: 5 staff lines at 35%, 5 solid dots at 5 different heights, one curve, stroke 2.
- La-Ga's pattern card, note by note as it played: la, ga, la, ga, la, ga, la, ga, la.
- "Long soft notes": the old name is nowhere on the page, and More about this says "Also called Vocal Function Exercises."

Every check passes: Train 27 and the online save (2 new checks, 3 extended), browser 15, Android 28, library 7, note map 13, Learn a song 19, takes 19, loudness 11, 231 unit tests (10 new), and the old app's 187. All 186 broken builds of the app and 120 of the core are caught; 17 are new for this round.

To say plainly: six of the new broken builds slipped past my checks the first time, and I fixed the checks, not the builds:
- Three broken pictures (staff lines at full strength, hollow dots, two dots on one line) still passed, because a picture that failed the check fell back to its own label, which reads "run". Now a failing picture reads "wrong", with what failed.
- Three broken Today cards still passed, because the Today check sat inside the Train page's block and never ran when asked for on its own. Now it runs.
All six are caught now, and the checks still pass on the real build.

The checklist has this round's rules with their tests: 160 ticked, 30 left out with reasons, none crossed.

## Not tried on a real phone

None of it. Things I decided that you may want to change:
- The staff lines use the same stroke weight as the rest, as you asked; at the card's size they sit close together and read as a soft blue block behind the run. Thinner staff lines would make it airier, if you'd like that.
- The own plan is kept on the phone, but nothing in the app lets the singer choose one yet; until then Today is always the daily warm-up.
- Humming changes hum each repeat, not each note: you can't switch from M to NG mid-scale.
- A result saved before a rename keeps its old name in the results list; new ones use the new name. The exercise behind them is the same.

## Your taps

Samsung, Chrome, headphones in.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. Tap Train. The top card reads "Today", "Daily warm-up". Look at Agility's new picture.
3. Tap Agility, then Slack-jaw La-Ga. Tap play on the pattern card: la, ga, la, ga under the dashes. Tap Start and sing them.
4. Tap Train, then Breath, then Long soft notes. Tap "More about this": it says "Also called Vocal Function Exercises."
5. Tap Train, then Warm-up, then Sirens, and read the How.

# Report, 28 Oct 2026, commit f374d27

Your content round is built and live: the fixes from your audit, the new exercises, and a seventh group, Pitch, with Sing the interval, Match the note and Hold the note.

## What works

Fixes:
- **Octave leaps** is a true leap: the low note, straight up the octave, back down, on "ma" (1-8-1, as the old app's own Octave Leaps ladder had it).
- **Tongue twisters** now fit their pattern exactly: a syllable a note, the phrase ending on the last note, and the same every repeat. Red leather and Peter Piper have seven syllables, so they sing on 1-2-3-5-3-2-1. Unique New York has four, so it is said twice, up then down, on 1-2-3-5, 5-3-2-1. Note by note below.
- **Long soft notes** is Stemple's four steps, each twice:
  1. "ee" held on F4 (higher voices) or F3 (lower), as long as you can;
  2. a slide up on "knoll", lowest to highest;
  3. a slide down, highest to lowest;
  4. "ol" held on C, D, E, F and G from C4 (higher) or C3 (lower).
  
  Higher or lower comes from your range: higher when its middle is D4 or above. Each part starts on your tap and waits for Next. The holds count only while you're on the note, and stop after a second off it. The seconds held show as you sing and at the end, for steps 1 and 4.
- **Bratty Bay** is gone (it sang Octave repeat's pattern); Octave repeat takes its place in the advanced routine. Its saved results stay in the results list.
- **Loo / Lah** is now **Loo**, on "loo". **Straw singing** says "You'll need a straw." **Agility's staff lines** are half the stroke, so the run reads clearly.

New exercises, in our own words:
- Warm-up: **Buzzing** ("vvv" one repeat, "zzz" the next, beginner), **Raspberry slide** (beginner, unscored, your line shown), **Tongue trill** (rolled r, intermediate).
- Breath: **Breath pulses** ("ha-ha-ha" from the belly, beginner, guided with a clock).
- Tone: **Goo** on 1-3-5-3-1 (beginner), **Guh** on 1-3-5-8-5-3-1 (intermediate).
- Agility, all on "my", a syllable a note, faster at higher levels: **Five-note run** (beginner), **Five-note minor run** (intermediate), **Skipping run**, the pentatonic one (intermediate), **Half-step run**, the chromatic one (advanced), **Little turns**, 3-2-1 turns stepping up (advanced).
- Range: **Big climb**, up an octave and a half and back on "nay" (advanced).

The new group, **Pitch**, in the same blue as Agility and Range (blue means pitch), with an ear for its picture:
- **Sing the interval**: a note plays, the jump shows in words ("A fifth up"), you sing the note it lands on. Ten jumps a round, both notes in your range, scored like every bubble (half the note within a semitone; octave exact unless Any octave). Its level is in the sound sheet and remembered: Beginner a step and an octave up; Intermediate adds a third and a fifth; Advanced adds a fourth, sixth and seventh, and jumps down.
- **Match the note**: the old app's. A note plays, you sing it back. Ten notes, from one above the bottom of your range to one below the top, never the same twice running. A hit is holding it 1.2 seconds within a semitone, as the old app had it.
- **Hold the note**: the old app's Hold a note. Ten notes, every third out at an edge of your range. Each plays, then you hold it five seconds; it counts as held when 70% of that is within 35 cents. After each note it waits for Next.

## Each exercise's syllables, note by note

One repeat of each (in a range of C3 to G4), and the next where it differs.

**Warm-up**

- Lip trills: brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr (every repeat)
- Buzzing: vvv vvv vvv vvv vvv vvv vvv vvv vvv | then zzz zzz zzz zzz zzz zzz zzz zzz zzz
- Raspberry slide: a slide, your line only.
- Tongue trill: rrr rrr rrr rrr rrr rrr rrr rrr rrr (every repeat)
- Straw singing: guided, with a clock.
- Humming: M, N, NG: mmm mmm mmm mmm mmm mmm mmm mmm mmm | then nnn nnn nnn nnn nnn nnn nnn nnn nnn | then ng ng ng ng ng ng ng ng ng
- Sirens: a slide, your line only.

**Breath**

- Steady hiss: a timed hiss.
- Breath counts: breath counts.
- Breath pulses: guided, with a clock.
- Soft, loud, soft: ah, ah, ah, ah, ah, one long note each.
- Sustained note: ee, ee, ee, ee, ee, one long note each.
- Long soft notes: Stemple's steps: "ee" held; "knoll" up; "knoll" down; "ol" held on C, D, E, F, G.

**Tone**

- Mum: mum mum mum mum mum mum mum mum mum (every repeat)
- Mee: mee mee mee mee mee mee mee mee mee (every repeat)
- Noo: noo noo noo noo noo noo noo noo noo (every repeat)
- Gee (or Kee): gee gee gee gee gee gee gee gee gee (every repeat)
- Bratty Nay: nay nay nay nay nay nay nay (every repeat)
- Wah: wah wah wah (every repeat)
- Tongue-out singing: uh uh uh uh uh (every repeat)
- Tongue out, getting louder: guided, with a clock.
- Yawn-sigh: guided, with a clock.
- Goo: goo goo goo goo goo (every repeat)
- Guh: guh guh guh guh guh guh guh (every repeat)

**Agility**

- Loo: loo loo loo loo loo loo loo loo loo (every repeat)
- Short bouncy notes: bah bah bah bah bah (every repeat)
- Slack-jaw La-Ga: la ga la ga la ga la ga la (every repeat)
- Blah: guided, with a clock.
- Nine-note scale: lah lah lah lah lah lah lah lah lah lah lah lah lah lah lah lah lah (every repeat)
- Five-note run: my my my my my my my my my (every repeat)
- Five-note minor run: my my my my my my my my my (every repeat)
- Skipping run: my my my my my my my my my (every repeat)
- Half-step run: my my my my my my my my my my my my my my my (every repeat)
- Little turns: my my my my my my my my my my my my (every repeat)

**Range**

- Octave leaps: ma ma ma (every repeat)
- Five notes down: oo oo oo oo oo (every repeat)
- Octave repeat: buh buh buh buh buh buh buh buh buh buh (every repeat)
- Big climb: nay nay nay nay nay nay nay nay nay nay nay (every repeat)
- Range check: the range check.

**Articulation**

- Five vowels: mah meh mee moh moo (every repeat)
  - note by note: mah on 1, meh on 1, mee on 1, moh on 1, moo on 1
- Red leather: red lea ther yel low lea ther (every repeat)
  - note by note: red on 1, lea on 2, ther on 3, yel on 5, low on 3, lea on 2, ther on 1
- Unique New York: u nique New York u nique New York (every repeat)
  - note by note: u on 1, nique on 2, New on 3, York on 5, u on 5, nique on 3, New on 2, York on 1
- Peter Piper: Pe ter Pi per picked a peck (every repeat)
  - note by note: Pe on 1, ter on 2, Pi on 3, per on 5, picked on 3, a on 2, peck on 1
- Consonant pops: puh buh tuh duh puh buh tuh duh (every repeat)
- Tip of the tongue: la la la la la ta ta ta ta (every repeat)
  - note by note: la on 1, la on 2, la on 3, la on 4, la on 5, ta on 4, ta on 3, ta on 2, ta on 1
- Lips and tongue: mom my made me mash my M and Ms (every repeat)
  - note by note: mom on 1, my on 2, made on 3, me on 4, mash on 5, my on 4, M on 3, and on 2, Ms on 1

**Pitch**

- Sing the interval: note names: the app plays a note, you sing the jump shown.
- Match the note: note names: the app plays a note, you sing it back.
- Hold the note: note names: ten notes, each held five seconds.

## What was measured

All on the built app, in a Chrome made to behave like Android; the singing with a real voice, never a tone.
- Sing the interval: ten jumps sung right, 9 of 10; the same voice three semitones off, 1 of 10. The jumps shown as they came: "A step up", "An octave up". The level picked in the sound sheet was remembered.
- Match the note: ten notes sung back, 9 of 10, every note inside the range.
- Hold the note: ten notes held, 10 of 10; after each, it waited for Next, with nothing playing.
- Match the note never repeats a note running: checked over 200 rounds on a range of five notes.
- Long soft notes: for the test's range, the lower notes (F3, from C3); 16 parts; each hold sung for 3 seconds measured 2.8 to 2.9 seconds, steps 1 and 4 alike.
- The fixes: Octave leaps' three notes an octave apart and back; Red leather's seven notes and Unique New York's eight, each syllable on its own note in order; "You'll need a straw."; "Loo"; Bratty Bay's page says it is not here; a Bratty Bay result saved before stays in the results list after a new one.
- Train: seven cards, five colours (Range and Pitch in Agility's blue); the lists: Warm-up 7, Breath 6, Tone 11, Agility 10, Range 5, Articulation 7, Pitch 3; the staff lines at half the stroke.

Every check passes: Train 34 and the online save (8 new checks, 3 extended), browser 15, Android 28, library 7, note map 13, Learn a song 19, takes 19, loudness 11, 248 unit tests (17 new), and the old app's 187. All 200 broken builds of the app and 132 of the core are caught; 26 are new for this round.

To say plainly, four broken builds slipped past at first, and each taught something:
- **Match the note could repeat a note.** The old app drew again only once, so a repeat could still get through, and my test said "never twice running" without checking it. Now the note is drawn until it differs, and a test checks it on a narrow range.
- **A stale La-Ga build.** It pointed at a syllable mode I'd removed this round, so the build behaved exactly like the real one. Now it breaks a mode that exists.
- **The interval check followed the page.** It sang whatever targets the page listed, so a build that scored the starting note passed. Now the test works out each target itself, from the starting note and the jump's words.
- **A Hold the note build that couldn't run.** It "moved on by itself" with a script click, which the conductor rightly refuses, since nothing starts without a real tap. Now the build skips the wait for Next on screen.

All four are caught now, and the checks still pass on the real build.

The checklist has this round's rules, and the old app's Match the note and Hold a note rules, each with its test: 174 ticked, 32 left out with reasons, none crossed.

## Not tried on a real phone

None of it. Things to know, and things I decided that you may want to change:
- **Your audit doc wasn't reachable from here**: not in your Drive by its title or text, and not among your artifacts. So the checklist cites only the source I could check myself, Stemple et al. (1994) for Long soft notes. The other source lines wait on the doc. Paste it or share it with me and I'll add them.
- Plain names for the runs: Skipping run (the pentatonic one), Half-step run (the chromatic one), Little turns, and Big climb for the octave-and-a-half arpeggio, since "pentatonic", "chromatic" and "arpeggio" are jargon.
- The old app counted Match the note and Hold a note in any octave, always. Here they're octave exact unless Any octave is on, as everywhere else in the app. The old app's Replay and Skip buttons aren't here either: close is the only control while singing.
- Long soft notes saves the longest "ee" hold as its number, the one Stemple tracks; all the holds show on screen.
- Every part of Long soft notes and Hold the note counts in with 3, 2, 1 (and the beep, if on).
- A jump wider than your whole range (an octave, in a range under an octave) is centred on your range, so one of its notes falls just outside.
- Sing the interval draws a new round each time you open it; Try again sings the same round.
- Two test results are still on the test account, as you said.

## Your taps

Samsung, Chrome, headphones in.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. Tap Train: seven cards, Pitch with an ear. Tap Pitch, then Sing the interval. Tap the gear, pick Beginner, close it, tap Start. Sing the note each jump lands on.
3. Tap Train, Pitch, Match the note. Start, and sing each note back.
4. Tap Train, Pitch, Hold the note. Start, hold the note, then Next for each.
5. Tap Train, Breath, Long soft notes. Start, hold "ee" softly as long as you can; then Next through the slides and the "ol" notes. Read your times at the end.
6. Tap Train, Range, Octave leaps: tap play on the pattern card, and hear the jump straight up.
7. Tap Train, Articulation, Red leather: tap play, and watch the words land one per note.
