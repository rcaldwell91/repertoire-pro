# Report, 29 Oct 2026, commit fde8bfa

Your phone-testing round is built and live: Pause, Restart and the gear while singing, takes on exercises, the proper names back as titles, shapes in Sing the interval, and a note readout in Vocal Function Exercises.

## What works

- **While singing, every exercise has the same controls along the bottom**: Pause, Restart and the gear, with Close at the top.
  - **Pause** stops the sound and the mic at once. The button then says **Resume**.
  - **Resume** counts in again (3, 2, 1) and carries on from the start of the repeat you were in. What you sang before it still counts.
  - **Restart** goes back to the first repeat, with the score cleared.
  - **The gear** opens the same sound sheet as the exercise page: Hear yourself and its volume, Any octave, Count-in sound. It works while paused, and what you set there holds when you resume.
  - For the exercises that go a part at a time (Hold the note, Vocal Function Exercises), Resume plays that part again from its start. The hiss and the range check start their step again. Breath counts and the guided ones just hold their clock and carry on.
  - The controls are built once, and where they sit is set in one place, so the path map can move them later without touching any exercise.
  - The note map is smaller, by the height of the controls. The dots stay under it.
  - RULEBOOK 1b now says this, in your words, in place of "✕ as the only control".
- **Takes on exercises.** Every exercise sung over piano notes records your voice while you sing: your voice only, the same recorder as Learn a song. If you pause and resume, the stretches join into one take, each in its place.
  - At the end, next to the score: **Save take**, Try again, Next. A saved take is kept on the phone at once, then goes online, private to you. With no signal it waits on the phone and goes up when you're back online.
  - It goes into the same takes table as your song takes, marked as an exercise, with the exercise in it. It doesn't show in the Sing tab's list of song takes.
  - On the exercise page, one line, **Your takes**, opens that exercise's takes. Tapping one plays your voice over the exercise's piano notes, in time. Only play for now: no send, no delete.
- **Names**: the proper name is the title again, with the plain name as a small line right under it, on the exercise page and in the group's list. The "Also called" lines are gone. The jargon check now leaves titles alone, but still holds the plain name, Goal and How to plain words.
  - Vocal Function Exercises / Long soft notes
  - Messa di voce / Soft, loud, soft
  - Pentatonic run / Skipping run
  - Chromatic run / Half-step run
  - Three-note turns / Little turns
  - Octave-and-a-half arpeggio / Big climb
  - Staccato / Short bouncy notes
  - Farinelli breath / Breath counts
  - Straw phonation / Straw singing
  - Nine-tone scale / Nine-note scale
  - Descending five-tone / Five notes down
  - Tongue-out with a crescendo / Tongue out, getting louder
- **Sing the interval** sings shapes now. A note plays; the shape shows in words ("A fifth up", "Up the chord: 1, 3, 5"); you sing its notes from it.
  - Beginner: a step, 1-5, an octave.
  - Intermediate adds a third and 1-3-5.
  - Advanced adds a fourth, sixth and seventh, and the shapes going down (a step, third, 1-5, 5-3-1 and an octave down).
  - The note map shows the whole turn at once: the note you hear, drawn hollow, and every note you'll sing. You see the next note before it comes, and the map moves on to the next turn as it starts.
- **Vocal Function Exercises**: while you hold a note, a small readout shows the note you're singing and how close you are: On the note, A bit high, or A bit low. "On" is within half a semitone, as on the old app's interval card.

## What was measured

All on the built app, in a Chrome made to behave like Android, sung by a real voice, never a tone.
- Pause in the second repeat of Mum: silence and the mic closed within a millisecond, and nothing at the speaker for the 1.5 seconds checked after. Resume counted in, then carried on at 6.50 s, where the second repeat starts. The end score was 18 of 18: the first repeat, sung before the pause, still counted.
- The take from that run: 12.1 seconds from the very start, the whole 12-second exercise in one take, both stretches joined. It plays back as your voice over all 18 piano notes.
- Restart: 10 notes hit before it, 0 straight after, back to the first repeat, then 18 of 18 sung through.
- The gear while paused: the sheet with its four settings; Count-in sound switched off there, and Resume counted in without a beep.
- Hold the note paused on note 1: Resume played note 1 again. Breath counts paused on 3 stayed on 3 for two seconds, then carried on.
- Sing the interval at Intermediate (10 shapes, 12 notes): 11 of 12 sung right; the same voice three semitones off, 1 of 12. All five Intermediate shapes were shown in words. In 226 of 227 looks while singing, the map showed the whole turn. Advanced drew shapes going down.
- Vocal Function Exercises: the readout said the note and "On the note" on 12 of 12 holds. Sung 0.8 of a semitone high it said "F♯3 A bit high"; sung low, "E3 A bit low". The holds still timed at 2.8 to 2.9 seconds for 3 seconds sung.
- Signed in as the test singer: a take saved with no signal stayed on the phone, listed as "On this phone. Saves online when connected.". Back online it went up, as one row marked "exercise" with no coach. Without signing in the recording couldn't be opened (400); signed in as the singer it could (200). The test take was deleted afterwards.
- Every page: the proper names as titles, the plain names under them, in the list too, and no "Also called".

Every check passes: Train 42 and the signed-in 4 (11 new checks, 4 extended), browser 15, Android 28, library 7, note map 13, Learn a song 19, takes 19, loudness 11, 255 unit tests (7 new), and the old app's 187. All 227 broken builds of the app and 142 of the core are caught; 43 are new for this round.

To say plainly, one broken build slipped past at first. It changed how a resumed stretch is joined into the take, and every test still passed. On a closer look it couldn't fail: it gave exactly the same take, because the resumed stretch writes over the same place either way. I replaced it with one that really breaks the rule, keeping the earlier stretch past where the resumed one ends. I added a test for that case, and it's caught.

The interval check works out every shape's notes itself, from the note heard and its own table of shapes, so it doesn't just follow what the page lists.

The checklist has this round's rules, including the old exercise bar's (read from the old app): 187 ticked, 34 left out with reasons, none crossed.

## Not tried on a real phone

None of it. Things I decided that you may want to change:
- Takes are only for the exercises sung over piano notes. The hiss, sirens, breath counts, Hold the note and Vocal Function Exercises don't record a take yet.
- The old exercise bar resumed from the exact moment you paused. Here it's the start of the repeat, as you asked. Its Record button, "Pause take" and Listen aren't here: your voice is recorded through every sung exercise instead.
- Learn a song's singing screen keeps its own play bar; the new controls are on the exercise screens.
- If the phone takes the sound away mid-exercise (a call, hiding the app), it still goes back to the exercise page, as before, rather than to Paused.
- Each signed-in test run saves one more test Straw result on the test account, as before.

## Your taps

Samsung, Chrome, headphones in.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. Tap Train, Tone, Mum, Start. In the second repeat tap Pause: the notes stop. Tap the gear, look, tap it again. Tap Resume: 3, 2, 1, and it carries on from the start of that repeat. Sing to the end.
3. At the end tap Save take. Tap back, then Your takes on Mum's page, and tap the take: your voice over the piano.
4. Start Mum again, and part way through tap Restart: back to the first repeat, score cleared.
5. Tap Train, Pitch, Sing the interval. Tap the gear, pick Intermediate, close it, tap Start. Watch the words above the map, and sing each shape from the note you hear.
6. Tap Train, Breath, Vocal Function Exercises: the name on top, "Long soft notes" under it. Start, hold "ee" softly, and watch the note and "On the note" under the seconds.
