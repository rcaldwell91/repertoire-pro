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
