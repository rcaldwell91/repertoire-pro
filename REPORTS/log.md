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
