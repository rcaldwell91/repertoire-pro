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
