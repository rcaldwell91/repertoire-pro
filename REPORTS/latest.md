# Report, 16 Nov 2026, commit 64c91cc

Your 16 Nov additions are built and live: four new exercises, Tongue trill's Advanced level, the added lines on seven exercises, and bubbles back to 40 px. Main hadn't moved since 14 Nov except for my two report commits, so this round was built on exactly what went live then.

Still on hold, as you said: none of your takes have been read; bubbles and scoring timing are as they were; Match the tone is still unscored.

## What works

**Bubbles back to 40 px, with the menu showing.** On a 390 x 844 phone they're 40 px and still fit inside their rows. The room came from the map's own margin: it had 14 px of empty space above the top note and below the bottom one, now 6 px, and those 16 px went to the rows. The menu, Pause, Restart, the gear and the cue are all unchanged. On a 360-wide phone the map is shorter (463 px tall on a 360 x 740 phone), so no margin could reach 40 there. Instead, bubbles never go under 40 px, so on that phone a bubble stands a little taller than its row. That never hides another bubble, since no two notes sound at once. Back is unchanged.

**Four new exercises, Train 58 to 62, none in a routine.**
- **Find your resting note** (Warm-up, Beginner, Quiet), straight after the "Ah" tension check. It runs like Sirens: your line on the map, Done to finish, not scored. After each slide the screen says, for example, "Slide 1: came to rest on A2." At Done: "Your slides came to rest on A2, A2 and G♯2." A slide that never settled gets your line: "That slide didn't come to rest on a note. Try again and let it settle." It names a note and nothing else.
- **Three-note run** (Agility, Beginner 100, Intermediate 130), before Five-note run. Its row says "Beginner to Intermediate". 3-2-1 then 1-2-3 each round, a half step higher each round. Scored, with the runs' steps and "my", plus its own doing-right line.
- **Note bends** (Agility, Advanced, on "ah", at 100), after Three-note turns. The note, four flicks, then the note held. Up one round, down the next. Your line is shown, not scored.
- **Bwoop** (Range, Advanced, not Quiet, at 120), straight after Descending five-tone. "Bwoop" in the title, on every bubble and in every line. It starts in the middle of your range and climbs a half step a round to your top. Scored with the short-note rule.
- All three that climb end with "Stop when it stops feeling easy; you don't have to finish the climb."

**Tongue trill: Intermediate to Advanced.** Advanced is the same pattern and speed, through puffed cheeks. At Advanced, step 3 and the doing-right line are yours. At Intermediate everything reads as before.

**Added lines** on Humming, the three tongue-out exercises, Cheek puffs, Mum and Breath pulses, as written. Sounds and movement cues are unchanged.

**Reminders.** No reminder contradicts a new one:
- No "Open tall, not wide." on Find your resting note (closed lips) or Bwoop (rounded and closed lips).
- No "Keep your face still." on Tongue trill at Advanced, where the cheeks puff, just as on Cheek puffs.

## What was measured

All on the built app, in a Chrome made to behave like Android, with a real voice wherever something was sung.

**Bubbles**, measured while Mum was being sung, menu showing:
- 390 x 844: 40 px bubbles on 42.5 px rows (39 px before).
- 360 x 740: 40 px on 34.5 px rows (32 px before).
- 360 x 800: 40 px on 39.2 px rows (36 px before).
- Everything else on the screen is where it was: the cue, the map's top and bottom, the dots, Pause, Restart, the gear and the menu.

**Find your resting note, with a real voice.** I took real sung sound from the song recording and bent it down by a set amount until it settled on a note I chose, with the voice's own wobble kept.
- 12 slides, three per go, settling on notes from G♯2 to G♯3: all 12 were named right.
- 3 slides that kept sliding and never settled: none was named.
- In the singing-screen check, two slides were named C3 and B2 as each ended, then the third got your line. At Done the result read "Your slides came to rest on C3 and B2."

**Bwoop, with a real voice.** I used real short sung sounds from the recording, over that singer's own range (C♯3 to G♯4), so Bwoop ran from the middle of the range to the top: 7 rounds, 63 notes.
- Sung right at 0.1, 0.15, 0.2 and 0.3 s a note: 63 of 63 every time, twice over with different sounds.
- Sung three half steps off: 0 of 63.
- That passes the mark set for Staccato and Consonant pops (9 in 10 or better, 1 in 10 or fewer off). So Bwoop is scored.
- The lab's sounds are real sung syllables from the song, not the word "bwoop" itself. Your phone is the first time it hears a real "bwoop".

**On the built app:**
- Tongue trill's row reads "Intermediate to Advanced". Step 3 and the doing-right line change with the level picked in the gear.
- The four new rows sit in their places with their levels: "Beginner · Quiet · Not scored", "Beginner to Intermediate · Quiet · Scored on pitch", "Advanced · Quiet · Not scored", "Advanced · Scored on pitch".
- Note bends goes up, then down, by rounds.
- Next from the "Ah" tension check now opens Find your resting note, since it comes straight after it.

**Every check passes on the final build:**
- Train 77, including the signed-in ones.
- Browser 15, Android 28, library 7, note map 13, Learn a song 19, takes 19, loudness 11.
- 312 unit tests, and the old app's 187.
- All 290 broken builds of the app and 204 of the core are caught; 30 are new this round.
- The test takes those checks saved on the test account were deleted afterwards.

**The checklist** has this round's rules: 238 ticked, 38 left out with reasons, none crossed.

**Screenshots** are in the repo's REPORTS folder, dated 16 Nov: Mum while singing at 390 x 844 and at 360 x 740, Bwoop while singing, and Find your resting note after a slide and at its result.

**To say plainly:**
- **One take check failed once in a full run, and I couldn't make it happen again.** It saves a take with no signal, then checks it goes up once the signal is back. It has failed twice, each time in a full run (13 Nov and today), and passed in every other run. Today it passed with the checks before it, and in the next full run. I haven't found the cause, so I haven't changed the app. The check now records what the phone held if it fails again.
- **One loudness check failed once, then passed.** With a song and your voice both at 100, the loudest point between samples reached -0.4 dB, where the limit is -1. On the re-run it was -1.4 dB. Ride's chorus alone was -1.1 dB both times, only just inside. Nothing in the sound changed this round. I think the safety stage that rounds off the loudest peaks is too close to the limit, and it's worth its own small round. I haven't touched it.
- **Mistakes of mine, caught before anything went live:**
  - Two of my own unit tests couldn't fail. One built its test sound from the very number the broken build changes, so the sound vanished. One never had a slide that settles twice. The broken builds caught both, and both are fixed.
  - Six old broken builds aimed at lines I changed this round. One of them stopped testing anything once bubbles had a 40 px floor. All are re-aimed, and a new check (Straw's bigger bubbles at 360 wide) now catches the bubble one.
  - The live line in my Find your resting note check could never fail. The page's wait says "no" on a timeout instead of stopping, and I'd written it so every answer read as "yes". A broken build that hides the line caught it. It's fixed, and the check passes on the real app.

## What I decided, and wording I changed

- **Bubbles on a 360-wide phone stand a little taller than their rows.** No margin could reach 40 px there without hiding the menu, shrinking a control or changing the zoom you set on 25 Oct (three notes of room above and below). A taller bubble never hides another, because no two notes sound at once. If you'd rather keep them inside their rows and accept smaller bubbles on narrow phones, say so.
- **Every "hmm" is read, including the first easy sigh in step 1.** The app can't tell a sigh from a slide. So if you do step 1 and then three slides, the result names four notes. The steps are as you wrote them.
- **Note names** are written as the app writes them everywhere else: G♯2, not G#2.
- **Humming's new step** is the last of its own steps. The climbing line ("Stop when it stops feeling easy…") still comes after it, as on every exercise that climbs.
- **Note bends and Three-note run are Quiet**, like the other runs. You didn't say for Note bends, and its steps say "Keep it quiet".
- **Three-note run climbs a half step every round**, as you wrote. The other runs at a wide range can step up more than a half step, to keep to 14 rounds.
- **Bwoop starts in the middle** the way the Cool-down does: halfway up your range, less half the pattern's span. It then climbs a half step a round until the top of the pattern reaches your top.
- **Your "didn't come to rest" sentence** is nine words, and the app's limit for a screen line is eight. I kept your words exactly, and the word check allows that one sentence by name.
- **No wording was changed.** Every step and line went in as written.

## Held

Nothing. The new Humming step, a fingertip resting under the chin, matches the old app's own body warm-up, which has the same check: "Rest a thumb gently in the soft place under your chin — no pressure, just resting". No line in this round is on the jargon list. No sound was changed.

## Not tried on a real phone

None of it.

## Your taps

Samsung, Chrome. This covers the 14 Nov steps (you haven't confirmed doing them) and this round's. Before each sung step, tell me in a word how you sang it (for example "all on pitch", or "missed the top notes"), so I can set your line against it.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. **The button.** Tap Train, Warm-up, "Ah" tension check, Start. Sing a round, then tap Close (tick a spot if you like). The button at the bottom should read "Next: Find your resting note" (it read Lip trills on 14 Nov; the new exercise comes in between). Tap it: Find your resting note opens. Then go back to Warm-up, open Posture check, Start, tap Done, then Next: Neck and shoulder release opens.
3. **The menu, and the bubble size.** Tap Train, Tone, Mum, Start. While it plays, look at the bubbles: they should look a touch bigger than last time. After a round or two, tap Home at the bottom: the piano and the mic should stop at once. Tap Train: you should get the Train list.
4. **Staccato.** Tap Train, Agility, Staccato, Start. Sing the notes short and bouncy. At the end, tap Save take.
5. **Consonant pops.** Tap Train, Articulation, Consonant pops, Start. At the end, tap Save take.
6. **Five-note run at 160.** Tap Train, Agility, Five-note run. Tap the gear, pick Advanced, close it, tap Start. At the end, tap Save take.
7. **Timing.** Tap Train, Tone, Mum, Start, sing it through, and tap Save take. With the Staccato, Consonant pops and Five-note run takes, that gives me slow, short and fast notes to measure.
8. **Match the tone, without headphones.** Tap Train, Pitch, Match the tone, Start, and sing along through the phone's speaker. Tell me whether "I can hear the tone. Put your headphones in." showed.
9. **Match the tone, with headphones.** The same again with headphones in. That line should not show, and your line should follow your voice.
10. **Find your resting note.** Tap Train, Warm-up, Find your resting note, Start. Do the three slides, then Done. Tell me the notes it named, and whether that's where your voice felt it came to rest.
11. **Bwoop.** Tap Train, Range, Bwoop, Start. Sing it as the steps say. Tell me the score, and whether that matches how you sang it.
12. **Note bends.** Tap Train, Agility, Note bends, Start. Tell me whether your line showed the flicks, and whether the piano's flicks were clear enough to copy.

## Two questions, again

1. May I read the takes you save in the steps above (Staccato, Consonant pops, the Five-note run at 160, and Mum), read only, and nothing else on your account? Only those saved after the 14 Nov build.
2. When you noticed the timing, were you listening through the phone's speaker, wired headphones, or Bluetooth?
