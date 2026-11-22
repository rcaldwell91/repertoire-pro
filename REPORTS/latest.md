# Report, 22 Nov 2026, commit a4ce773

Everything you answered on 21 Nov is built and live, and Learn a song's map now follows Train's rule. Main hadn't moved since 63dd31f apart from my own 21 Nov report. One clash on small phones is under "Held, and clashes".

## What works

1. **The spacing.** It stays 30 px a half step, as you said.
2. **A level column for results.** The results table has a level column, and it can be left empty. Who can read or write results is exactly as before. Its definition is in the repo's database scripts, with the others. Results saved before it existed have no level. A result's name is plain again ("Mum", not "Mum · Advanced"), because the level now has its own place. Checked online: a real voice sang Mum at Intermediate on the test account, and the result reached the table as "Mum", level 2.
3. **The missing levels.** Every two-level exercise now has three, a notch slower or faster as everywhere else:
   - Advanced, a notch faster than Intermediate: Red leather 144, Unique New York 132, Peter Piper 144, Lips and tongue 134, Three-note run 156. Bratty Nay's Advanced is its Intermediate octave pattern at 144 (Intermediate is 120).
   - Beginner, a notch slower than Intermediate: Nine-tone scale 104, Tongue trill 96.
   - Chromatic run and Three-note turns still have no Beginner. Every new level passed the real-voice check, so all of them ship.
4. **The difficulty tag.** Each exercise's own difficulty is back beside its level span. Octave leaps reads "Advanced · Levels Beginner to Advanced · Scored on pitch"; Mum reads "Beginner · Levels Beginner to Advanced · Quiet · Scored on pitch". Exercises without levels show their difficulty alone, as before.
5. **Hold the note and Match the tone** keep the levels they had.
6. **Learn a song's map follows the same rule as Train's.**
   - It's 30 px a half step and never zooms.
   - It slides up and down with the song's notes, moving a moment before them: every note of the next 2 seconds is in view, wherever the map can hold it.
   - It stays put while the notes fit and moves only when they won't, gliding over up to 0.6 s.
   - The song's line, your line and the scoring are unchanged; only the view changes.

## What was measured

### Every new level with a real voice

Each new level, and the levels next to it, was sung by a real voice in the built app, arriving 0.09 s after each piano note, as in your takes. At Beginner it was also sung a half step off. The pass mark is the usual one: 85% or more counted when sung right, and 15% or less when sung a half step off.

| Exercise | Beginner | Intermediate | Advanced |
|---|---|---|---|
| Red leather | 100 a minute: 100% right (42 of 42), 0% a half step off | 120 a minute: 100% right (42 of 42) | **144 a minute: 100% right (42 of 42)** (new) |
| Unique New York | 100 a minute: 100% right (48 of 48), 0% a half step off | 110 a minute: 100% right (48 of 48) | **132 a minute: 100% right (48 of 48)** (new) |
| Peter Piper | 100 a minute: 100% right (42 of 42), 0% a half step off | 120 a minute: 100% right (42 of 42) | **144 a minute: 100% right (42 of 42)** (new) |
| Lips and tongue | 100 a minute: 100% right (54 of 54), 0% a half step off | 112 a minute: 100% right (54 of 54) | **134 a minute: 100% right (54 of 54)** (new) |
| Three-note run | 100 a minute: 100% right (54 of 54), 0% a half step off | 130 a minute: 100% right (54 of 54) | **156 a minute: 100% right (54 of 54)** (new) |
| Bratty Nay | 120 a minute: 100% right (54 of 54), 0% a half step off | 120 a minute: 100% right (7 of 7) | **144 a minute: 100% right (7 of 7)** (new) |
| Nine-tone scale | **104 a minute: 100% right (17 of 17), 0% a half step off** (new) | 130 a minute: 100% right (17 of 17) | 160 a minute: 100% right (17 of 17) |
| Tongue trill | **96 a minute: 100% right (54 of 54), 0% a half step off** (new) | 120 a minute: 100% right (54 of 54) | 120 a minute: 100% right (54 of 54) |

Bratty Nay's Intermediate and Advanced were checked on 7 notes each. Its octave pattern fits only one round in the test voice's range, which was the same on 21 Nov.

### Learn a song's map

Three songs, each read by the app itself:
- All of Me and Ride, the two test songs;
- a wide-range song made from All of Me's real voice and music, cut into ten passages each moved up or down by up to an octave without changing its speed. It spans 44 half steps, over three and a half octaves, with shifts of up to 8 half steps between passages.

Every 0.05 s of each song, I checked whether each note of the next 2 seconds was in view. While each played, I also checked that the view on screen was where it should be (it never differed by more than a hundredth of a half step).

| Song | Screen | Half steps shown | Moves | Instant moves | Notes it could have shown but didn't | Jumps from one note straight to the next, wider than the map |
|---|---|---|---|---|---|---|
| All of Me | 390 x 844 | 13.3 | 36 (8.0 a minute) | 13 | 0 | 1 (0.08% of upcoming notes), in view 0.05 to 0.05 s before sung |
| All of Me | 360 x 740 | 9.8 | 157 (34.9 a minute) | 123 | 0 | 7 (2.30% of upcoming notes), in view 0.00 to 0.40 s before sung |
| Ride | 390 x 844 | 13.3 | 45 (12.2 a minute) | 24 | 0 | 3 (0.66% of upcoming notes), in view 0.05 to 0.30 s before sung |
| Ride | 360 x 740 | 9.8 | 143 (38.8 a minute) | 119 | 0 | 11 (3.44% of upcoming notes), in view 0.00 to 0.55 s before sung |
| Wide range | 390 x 844 | 13.3 | 58 (13.4 a minute) | 25 | 0 | 2 (0.80% of upcoming notes), in view 0.05 to 0.70 s before sung |
| Wide range | 360 x 740 | 9.8 | 170 (39.2 a minute) | 133 | 0 | 14 (3.31% of upcoming notes), in view 0.00 to 0.90 s before sung |

- **Upcoming notes the map could have shown, but didn't: none, on every song, at both widths.**
- **Instant moves.** Sometimes the note just sung and a note in the next 2 seconds are further apart than the map is tall, so they can't share the screen. Then the view moves the instant that note ends, so the next ones show up as early as they possibly can. That's the only time it moves without gliding. The last column counts the sharpest of these: a jump from one note straight to the next that's wider than the map, and how early the far note was in view.
- **The moves.** Most are small, and a move comes about 2 s before the notes it's for (the median).

### How tall the map is

At 30 px a half step, the map's height decides how much it shows. Until now it was a fixed 260 px on every phone: 8 half steps. That's too few: with the new movement, 6 to 8% of the next 2 seconds' notes still couldn't be shown, because so many leaps were wider than the map. So it now takes the height the screen allows while Start stays above the menu:
- 13.3 half steps at 390 x 844;
- 9.8 at 360 x 740.

To make room, "Any octave" moved from under the map into the sound card, next to Hear yourself, as in Train's gear.

## What I decided

- **The tag's wording:** "Advanced · Levels Beginner to Advanced". "Levels" keeps the two from reading as one. Say if you want other words.
- **Nine-tone scale and Tongue trill** now start at their new Beginner, but their own difficulty stays Intermediate, as it was.
- **Bratty Nay's Advanced** is its octave pattern, a notch faster, since its Intermediate already moved up to the octave.
- **How the song map moves:** it keeps the next 2 seconds in view and stays at least half a half step clear of its top and bottom where there's room. Of the settings I measured on the real songs, these moved the least without leaving an upcoming note out (a margin of a whole half step moved 1.6 to 2.7 times as often).
- **Any octave** moved into the sound card to give the map room (above).

## Held, and clashes

- **The song map on a 360 x 740 phone.** There, the song screen has room for 9.8 half steps. Every upcoming note the map can hold stays in view, but the view moves often: 35 to 39 times a minute, mostly small instant steps. At 390 x 844 (13.3 half steps) it's 8 to 13 times a minute. On the real songs, moves drop sharply from about 13 half steps up (5 to 10 a minute at 15). **Suggestion:** on Learn a song, drop "Ready. Tap Start." once the song is ready (Start says it) and show the reading progress in that same line. That gives a 360 x 740 phone about 12 half steps. I haven't done it, because you said only the view changes.
- **Found while doing this:** "Ready. Tap Start." stays on screen while the song plays. It was like this before this round. **Suggestion:** hide it while the song plays.

## Not tried on a real phone

Everything was measured in Chrome made to behave like an Android phone, not on your Samsung. On the phone I haven't seen or heard:
- the new levels' speeds;
- the difficulty tags;
- Learn a song's map moving with a song;
- Any octave in its new place.

Screenshots at 390 and 360 wide are in the repo: the three songs on Learn a song, and the list's tags.

## Checks

- The unit tests: 348 of 348 pass.
- Every browser suite passes: browser 15, Android 28, library 7, note map 13, song 19, takes 20, loudness 13, Train 85 (with the online checks).
- One Train online check failed once and then passed: a take saved with no signal hadn't reached your account within 60 seconds of the signal coming back. On the rerun it went up and was private to the singer. Nothing that uploads takes changed this round.
- The old app: 186 of 187 (its checks stop at the first failure, so I ran the part after it on its own: 52 of 52). One check fails in both runs today: when a song he opens interrupts the Library's background reading, the background reading should wait where it stopped, but it carried on about 5 seconds further. It passed on 21 Nov, and the old app and its checks are exactly as they were then; nothing this round touches them. I haven't found why it behaves differently today, and the old app is frozen, so I've left it.
- The real-voice level check: all 24 levels of the 8 changed exercises pass (above).
- The real-song map check: all 3 songs at both widths pass (above).
- Broken builds:
  - I broke the app's core rules 253 ways, and the checks caught all 253.
  - I broke the app itself 328 ways, and the checks caught all 328.
  - New this round: the level not reaching the results table, the level back in the name, an unscored exercise keeping a level; each missing level left out, or no faster or slower than the level next to it; Chromatic run given a Beginner; Bratty Nay's Advanced on the wrong pattern; the starting level shown as the difficulty, or the difficulty left out; and the song map pinned, squeezing the song in again, not looking ahead, jumping instead of gliding, gliding while a note it would push off is sung, chasing brief slips, moving for every phrase, and letting a note it could show fall out.

## Mistakes of mine

- My first version of the song map's movement left some upcoming notes out of view that it could have shown, and moved in many tiny steps. Two causes: it kept a whole half step clear of the edges even when the notes only fitted without that, and when the notes ahead exactly filled the map, a rounding hair made it think nowhere fitted, so it didn't move at all. The real-song check caught both; I rewrote the movement and measured it again.
- The map worked out its movement from the song's line while the line was still being read, and never again, because the line fills in place. The note map suite caught it (the view was up to 7 half steps from where it should be); it now works it out again as the line grows.
- I first wrote the song map's height without measuring the song screen: at 260 px the map held only 8 half steps on every phone. I caught it from the first numbers, before going further.
- I started the app's broken builds without first checking that each still fitted the code. Two older ones were aimed at lines I'd changed, and the run stopped part-way. I re-aimed them, checked all 328 fit, and ran the rest.
- One of the new broken builds (the map chasing brief octave slips) wasn't caught at first, because my check counted moves but not where the view sat. I tightened the check.

## Your taps

From 21 Nov:

1. Look at the bottom menu: every tab should show its name under its icon, with Train highlighted. Tap each tab once.
2. Train, Agility, Five-note run, gear, Advanced, Start. Before each round you'll hear its first note on its own, then the round. Sing each round from its first note, on time. Its first bubble should fill green.
3. While that runs, look at the map: thin bubbles with a line through the middle, and the view sliding up as the rounds climb.
4. Tone, Mum, gear, Beginner, Start. Sing a round or two and note the taller bubbles and slower speed. Close. Then gear, Advanced, Start: thinner bubbles and faster. At the end the result should say "Sung at Advanced".
5. Range, Bwoop, Start: the piano notes should sound short and clipped, and the bubbles short. Sing it through and look at the score.
6. Agility, Note bends, Start: a quick flick between note and neighbour, three times, ending on the note, with short piano notes. Your line is shown and there's no score.
7. Pitch, Match the tone, Beginner, Start. Each tone lasts 6 s and the notes go up in order. At the end you get a score and how it landed.
8. Match the tone, Advanced: your line stays hidden while the tone plays, and appears once it stops.

New this round:

9. Range: the Octave leaps row should read "Advanced · Levels Beginner to Advanced · Scored on pitch".
10. Agility, Three-note run, gear, Advanced, Start: a notch faster than Intermediate. Sing it through.
11. Sing, Learn a song, open one of your songs, Start. The map's rows are as far apart as on Train. Before each phrase the view slides to show it, and it never shrinks. "Any octave" is now in the sound card below.
