# Report, 21 Nov 2026, commit 63dd31f

All four parts of this round are built and live. Main hadn't moved since 8b3d87f apart from my own 20 Nov report, so this round is built on exactly what went live on 20 Nov.

## What works

1. **Tab labels.** Every tab in the bottom menu now shows its icon with its name underneath: Home, Train, Sing, Coach, Learn, Library, Profile. The selected tab keeps its icon in the coloured pill, and its name is in bold. All seven names fit whole at 360 wide, at 13 px; "Library" is the tightest, at 45 of its 50 px. Nothing is shortened. The singing screen still fits at 360 wide: Pause, Restart, the gear, the cue and the map all sit whole above the menu on every exercise.
2. **The note map.** The map slides up and down as you rise and never zooms. Every exercise and every round uses the same spacing, 30 px a half step. At least 13 half steps now show on every exercise at both widths (numbers below).
3. **The singer's line during the lead note.** It draws while the lead note plays, before the round starts, and nothing is scored then. A real voice singing only the lead notes drew its line before the first round's first note, and again during the second round's lead.
4. **Levels on every scored exercise.**
   - Each level has its own band that counts, and every bubble is drawn as exactly that band, so what you see is what's scored. Beginner's bubbles are taller than today's, Advanced's thinner.
   - Beginner is a notch slower, Intermediate is today's speed, and Advanced is a notch faster.
   - It's one level setting in the gear, remembered for each exercise, as before.
   - Exercises that had one level now have all three. Ones whose levels already change the pattern keep that, with the band added on top: Lip trills, Straw, La-Ga, Bratty Nay, Match the note, Match the tone, Tongue trill and Sing the interval. Ones with speed levels keep their speeds, with the band added.
   - Chromatic run and Three-note turns still have no Beginner. No exercise's sound changed, and the timing pause is the same at every level. Exercises that aren't scored are unchanged.
   - Every result now says the level it was sung at ("Sung at Advanced"). Match the note's "last time" compares only with the same level. In routines, each step keeps the level the routine gives it.

## What was measured

### The bands, from real singing

I took every note held 0.3 s or longer by the two real singers in the test songs: 296 notes. For each band, I counted how many of them would count sung right, and how many would count if they'd been a half step off.

| Band (either side of the note) | Sung right, counted | A half step off, counted |
|---|---|---|
| 0.30 of a half step | 93% | 0% |
| 0.35 (Advanced) | 97% | 0% |
| 0.50 (Intermediate, today's) | 99.7% | 0% |
| 0.65 (Beginner) | 100% | 0% |
| 0.70 | 100% | 0% |
| 0.75 | 100% | 1.7% |
| 0.80 | 100% | 4.4% |

- **Beginner: 0.65.** No note sung a half step off counts at 0.70 or below; at 0.75 some start to. I took one step inside that for safety.
- **Advanced: 0.35.** 97% of real held notes still count, and all 53 held 0.8 s or longer do. At 0.30 it drops to 93%, and at 0.25 to 81%.

**Hold the note and Match the tone** need 70% of the hold in the band, not half, and today's band is 0.35. Beginner is 0.5: every real note held 0.8 s or longer counts, and none sung a half step off. Nothing narrower than 0.35 works for Advanced: at 0.35 only 64% of those real long notes count already, because of their natural vibrato. So Advanced keeps 0.35 on those two, and Hold the note, which had one level, gets Beginner and Intermediate only.

### The speeds

A notch is a fifth of the speed (why under "What I decided"). Beats a minute, Beginner / Intermediate / Advanced:
- 80 / 100 / 120: Wah, Octave leaps, Five vowels, Consonant pops
- 88 / 110 / 132: Humming, Tongue-out singing, Tongue-out bright "a", Three-note steps, Buzzing, Cheek puffs, Tongue-forward hum
- 90 / 112 / 134: Octave repeat
- 96 / 120 / 144: Mum, Mee, Noo, Gee, Goo, Guh, Staccato, Descending five-tone, Bwoop, Octave-and-a-half arpeggio, Tip of the tongue
- 104 / 130 / 156: Loo

Held notes (Sustained note, Messa di voce, Tongue-out with a crescendo) keep their length at every level.

### Every level with a real voice

Every level of every scored exercise was sung by a real voice in the built app, with the voice arriving 0.09 s after each piano note, as in your takes. That's 48 exercises and 131 levels. At Beginner, each was also sung a half step off. The pass mark is the usual one: 85% or more counted when sung right, and 15% or less when a half step off.

- **Every level passes, so every level ships.**
- Sung right: every level counted 100%, except Bwoop at Advanced, at 94% (34 of 36 notes). Its notes are short, so the narrower band costs a little there.
- A half step off at Beginner: no note counted on every exercise, except Bwoop (1 of 36), Consonant pops (1 of 104) and Sing the interval (1 of 9). All are well under 15%.
- Match the note, Hold the note and Match the tone are sung one note at a time, so they had their own check: every level 100% right, and 0% at Beginner a half step off.

### The note map

Half steps in view on every exercise, at 390 x 844 and at 360 x 740:
- All the exercises sung over the piano: 18.5 to 20.3 at 390, and 15.0 to 16.9 at 360.
- Sing the interval: 18.3 at 390, 14.9 at 360.
- Hold the note, Match the tone, and Match the note at Beginner: 16.7 at 390 and 13.3 at 360, after the fix below. Before it they showed 8 to 16 at 360, and their view changed height while you sang.

The map's spacing never changes anywhere. What varied on those three screens was the map's height: the count-in sat under the map instead of over it, and the panel under the map grew and shrank as its words changed. Now the count-in is over the map, as on every other exercise, and the panel is compact and always the same height. The note's name sits on the same row as "Note 1 of 10" and is smaller than before. Sing the interval's prompt lines now keep their room from the start, so its map doesn't change size either.

**Learn a song and the Pitch Tracker.** Learn a song doesn't follow this rule today: its map fits the whole song's range at once, so its spacing changes from song to song and it never slides. The Pitch Tracker isn't built in the new app yet; its door on Sing is greyed out.

## What I decided

- **A notch is a fifth of the speed.** I couldn't find your 28 Oct note in the repo or the session's history, so I took the middle of the steps Train's own speed levels already use: the runs go 100, 130, 160 (23 to 30%), and the tongue twisters' Beginner is 9 to 17% below today's.
- **Held notes keep their length.** A longer hold is harder, not easier, so on Sustained note, Messa di voce and Tongue-out with a crescendo the level changes only the band.
- **Each exercise starts at its lowest level until you pick another,** as levels do today. So Mum, for one, now starts at Beginner: slower, with taller bubbles.
- **Routines:** each step keeps the level the routine gives it. So the Daily warm-up's Mum, Mee and Descending five-tone are now at Beginner (slower and wider), and the Advanced warm-up's steps at Advanced (faster and narrower). Listed lengths changed: Daily 10 minutes (was 9), Quiet 11 (was 10), Cool-down 4 (was 3), Advanced 15 (was 16); Intermediate stays 15.
- **Sing the interval** keeps its own level (which jumps it uses), and the band goes with it.
- **The level is saved in the result's name online** ("Mum · Advanced"), because the results table has no level column and I didn't change the database without asking. On the phone it's kept as its own field.
- **Match the note results saved before today** don't have a level, so "last time" doesn't compare with them.

## Held, and clashes

- **The spacing.** You said to fix the spacing for everything if fewer than 13 half steps showed anywhere. Fewer did show, but only on three screens, and the cause was their map's height, not the spacing. To fit 13 into those maps as they were, the spacing would have had to drop to about 19 px a half step everywhere, making every bubble about a third smaller. That would go against 20 Nov's "bubbles easy to see at 360 wide". So I kept 30 px and gave those three maps their room instead. **Suggestion:** keep it this way; say if you want the spacing smaller anyway.
- **"A little over an octave."** At 30 px the map shows 15 to 17 half steps at 360 wide and 18 to 20 at 390, more than a little over an octave. Showing about 13 at 390 would need about 40 px a half step, but then a 360-wide phone would show only 11 or 12. **Suggestion:** keep 30 px.
- **A level column for results.** **Suggestion:** with your OK, I'll add a level column to the results table, so your coach can sort by level without reading it out of the name.
- **Exercises with two levels keep two:** the four tongue twisters and Three-note run (no Advanced), Nine-tone scale (no Beginner), Bratty Nay (no Advanced) and Tongue trill (no Beginner). You said existing levels keep theirs. **Suggestion:** give each its missing level, a notch slower or faster as everywhere else.
- **Hold the note has no Advanced, and Match the tone's Advanced has the same band as its Intermediate,** because nothing narrower passes real held notes (above).
- **The exercise list now says "Beginner to Advanced" on every scored exercise,** so it no longer shows how hard each one is on its own. For example, Octave leaps was tagged Advanced. **Suggestion:** say if you want that difficulty tag back beside the level span.

## Not tried on a real phone

Everything was measured in Chrome made to behave like an Android phone, not on your Samsung. On the phone I haven't seen or heard:
- the tab names;
- the bubbles at each level;
- Beginner's and Advanced's speeds;
- the new layout of Hold the note, Match the tone and Match the note at Beginner.

Screenshots at 360 wide are in the repo: the tabs, Mum at Beginner and at Advanced, and Hold the note.

## Checks

- The unit tests: 338 of 338 pass.
- Every browser suite passes: Train 83, browser 15, Android 28, library 7, note map 13, song 19, takes 20, loudness 13.
- The old app: 187 of 187.
- The real-voice level check: 131 of 131 levels pass (above).
- Broken builds:
  - I broke the app's core rules 237 ways, and the checks caught all 237.
  - I broke the app itself 323 ways, and the checks caught all 323.
  - New this round: tab names on the selected tab only, names too small or cut off at 360, the selected tab not marked, no line during the lead note, Advanced no narrower than today, Beginner so wide a half step off counts, a score or bubble that ignores the level's band, Beginner no slower, Advanced no faster, one-level exercises left with one level, an unscored exercise given levels, Hold the note given an Advanced that real held notes fail, the level not remembered, and a result without its level or a "last time" from another level.

## Mistakes of mine

- After I renamed the exercise list in the code, my map measurer silently measured nothing, because it looked for the list by its old name. I caught it from its empty output and fixed it before taking any numbers.
- On my first run of the app's broken builds, I gave the loudness ones the wrong voice recording again (the same slip as 20 Nov), because I counted where they sit in the list wrongly. Seven older ones also no longer fitted the lines I'd changed. I fixed both and ran them all again. One new broken build also named a second check that can't tell the difference at Intermediate; the levels check catches it, so I took the second one off it.
- My first real-voice check of every level skipped Match the note, Hold the note and Match the tone without saying so, because they're sung one note at a time rather than over the piano. I caught it reading the list of what it covered, and wrote a second check for those three.

## Your taps

1. Look at the bottom menu: every tab should show its name under its icon, with Train highlighted. Tap each tab once.
2. Train, Five-note run, gear, Advanced, Start. Before each round you'll hear its first note on its own, then the round. Sing each round from its first note, on time. Its first bubble should fill green.
3. While that runs, look at the map: thin bubbles with a line through the middle, and the view sliding up as the rounds climb.
4. Mum, gear, Beginner, Start. Sing it for a round or two and note the taller bubbles and the slower speed. Close. Then gear, Advanced, Start: thinner bubbles and faster. At the end the result should say "Sung at Advanced".
5. Bwoop, Start: the piano notes should sound short and clipped, and the bubbles short. Sing it through and look at the score.
6. Note bends, Start: a quick flick between note and neighbour, three times, ending on the note, with short piano notes. Your line is shown and there's no score.
7. Match the tone, Beginner, Start. Each tone lasts 6 s and the notes go up in order. At the end you get a score and how it landed.
8. Match the tone, Advanced: your line stays hidden while the tone plays, and appears once it stops.
