# Report, 14 Nov 2026, commit b22aea8

The Train review is built and live: your 4 Nov review with your 13 Nov answers, the three things you found on your phone, and the two scoring checks from the plan.

## What works

**The three things you found**

- **A. The button that did nothing.** Since 3 Nov, Next looked for the exercise in the wrong way. It always went to the first exercise in the group, which is Posture check. On Posture check itself, Next tried to go to the screen you were already on, so nothing happened. Next now finds the exercise by name: the tension check goes on to Lip trills, Posture check to Neck and shoulder release. A new check failed on the old build and passes now. I then tapped every button on every Train screen: none does nothing. A button that can't act yet is greyed out with a line saying what to do.
- **B. The menu at the bottom is on every screen**, exercises included. Tapping it while an exercise runs stops the piano and the mic at once. The rounds you sang are kept as a result, without showing the result screen. In a routine, leaving is the same as Close. The Train tab always opens the Train list. At 360 px wide, Pause, Restart, the gear, the cue and the map all fit, the map keeps its size, and nothing under a finger moves.
- **C. The note timing** is explained under "What was measured". The tool to measure it from your takes is built. Bubbles and scoring are unchanged.

**What Back does from an exercise today:** it goes to the screen you were on before, one step at a time. So after Next, Back goes to the previous exercise, not the list.

**The review**

- **Every exercise has the review's words**: steps, doing it right, watch out and why. Today's words stay where the review says so. Your accepted fixes are in: Buzzing, "Pause, throat open", Sustained note, Octave repeat, and Neck release with no hand.
- **Three new exercises:** Neck and shoulder release after Posture check, Three-note steps, and Match the tone. Train has 58 exercises.
- **Climbing exercises end** "Stop when it stops feeling easy; you don't have to finish the climb." In the Cool-down: "Stop whenever you like."
- **Rounds you didn't sing don't count.** A silent note inside a sung round is still a miss. The result says how many rounds it counted.
- **Close gives a result** once a round is sung, for the rounds sung.
- **Levels:**
  - Lip trills: five-note, octave, octave-and-a-half, all at 100.
  - The five-note, minor and pentatonic runs: 100, 130, 160.
  - The chromatic run and the three-note turns: 130 and 160 only.
  - Nine-tone scale: 130 and 160.
  - The four tongue twisters: 100 and today's speed.
  - Match the note: Beginner, Intermediate, Advanced.
- **Routines:** each step has its own level. The Daily warm-up has Match the note before Yawn-sigh, and starts with the tension check for anyone who has never done it. The Cool-down steps down from the middle of your range. Listed lengths are worked out from the exercises for your range.
- **Match the note:**
  - Beginner goes in order with no time limit. It counts once you've held the note 1.2 s, then waits for you to tap Next.
  - Intermediate gives five seconds a note.
  - Advanced hides your line until the note plays again.
  - Each try shows your first try, the time to settle and how close it settled.
- **Sing the interval:** five seconds a note at Beginner. Your song cues show under the shape the first three times.
- **Hold the note** shows the note's bubble and your line.
- **Match the tone:** a plain tone, made by the phone at the piano's loudness. Your line shows but isn't scored. If your line is the tone itself, it says "I can hear the tone. Put your headphones in."
- **Numbers that grow:**
  - Steady hiss shows your best, not a set target.
  - Farinelli's counts grow from 4 to 8.
  - The range check shows your old range beside the new one.
  - Vocal Function Exercises: the goal is your best hiss, and your longest "ee" shows day by day.
- **Tongue-out with a crescendo** stays at least five half steps below your top. Blah is on notes, with your line shown.
- **Straw and Cheek puffs are scored**, after your straw test.
- **Staccato and Consonant pops:** a short note counts once 0.1 s of it is on the note and most of what's heard is on it. This is the fix in the plan, after the lab found the old rule failed.

## What was measured

All on the built app, in a Chrome made to behave like Android, with a real voice wherever something was sung.

**The two scoring checks in the plan**, with real sung sounds cut from a real song recording (never a tone):
- **Staccato and Consonant pops, before the fix.** Staccato notes sung right for 0.1, 0.15, 0.2 and 0.3 s counted 0, 2, 6 and 5 times in 10. Consonant pops counted 82% at 0.1 s. That's a fail, as the plan expected.
- **After the fix,** at 0.1, 0.15, 0.2 and 0.3 s:
  - Staccato sung right: 30, 30, 30 and 29 of 30.
  - Consonant pops sung right: 72 of 72 at every length.
  - Both sung three half steps off: none counted.
  - The pass mark was 9 in 10 or better, and 1 in 10 or fewer off. Both pass.
- **The runs and the Nine-tone scale, at every level they have (100, 130, 160):** every note counted when sung right, when sung 80 ms late, and when sliding into each note with a real slide from the same recording. Sung three half steps off, sliding or not, none counted. The pass mark was 85% and 15%.
- These are lab results. Whether real singers' runs and short notes score fairly needs your takes (question 1).

The full lab results are in the repo's REPORTS folder, dated 14 Nov.

**C, the note timing, from the code:**
- The bubble and the scoring window start exactly when the piano note is heard. So you're right: part of each note goes by before a singer can react.
- This app doesn't assume a fixed delay. The old app assumed 100 ms for the whole trip. This one asks the phone how late its sound is and how late its mic is, and allows for both.
- If the phone doesn't report the mic's delay (common on Android Chrome), the app allows none. With Bluetooth, the reported delay is often too small. In both cases your line would be drawn later than you sang.
- The measurement: for every note sung with the piano, how long after the note your voice was on it, as the whole spread, not one average. A saved take now keeps the delays the phone reported, so the two can be told apart.
- Checked with a real voice: sung exactly on time, the measure reads a typical note 0.05 s after the piano; sung 0.25 s late, 0.31 s. So the measure itself reads about 0.05 s late, and I'll allow for that when I read your takes.

**A and B, on the built app:**
- Next from the tension check opens Lip trills, and from Posture check, Neck and shoulder release. The new check failed on the 13 Nov build and passes now.
- Every button on every exercise page, and every control while singing in one exercise of each kind, was tapped. None did nothing. Each greyed-out button had its line saying why.
- Singing Mum, after a round, the Train tab was tapped. Sound and mic were off within 150 ms and still off 1.5 s later, the Train list opened, and the round sung was kept as a result.
- At 360 px wide, while singing, the controls and the cue sit above the menu, and the map is the same height before the count-in and while singing (489 px).

**Every check passes on the final build:**
- Train 74, including the signed-in ones.
- Browser 15, Android 28, library 7, note map 13, Learn a song 19, takes 19, loudness 11.
- 292 unit tests, and the old app's 187.
- All 282 broken builds of the app and 182 of the core are caught; 60 are new this round.
- The test takes those checks saved on the test account were deleted afterwards.

**The checklist** has this round's rules: 229 ticked, 38 left out with reasons, none crossed.

**Screenshots at 360 px wide** are in the repo's REPORTS folder, dated 14 Nov: Straw's page, and Straw while singing, with the menu. On the page, You'll need and most steps run to two lines. While singing, the cue fits on one line.

## What I decided, and things to say plainly

- **Beginner Match the note waits for you to tap Next** after each held note, in the Daily warm-up too. The app never starts a sound without a tap.
- **Octave-and-a-half arpeggio, step 2,** says "Sing "nay" up the big climb and back, bright and light." The review's "arpeggio" is on the jargon list.
- **The bubbles are smaller with the menu showing:** 39 px on a 390 x 844 phone, 44 px before. The rule is at least 40 px. The map is 61 px shorter to make room.
- **Straw and Cheek puffs are scored.** Any lag (C) affects every scored exercise the same way, so it doesn't make these two less fair than the rest.
- **The lab voice had a flaw.** It sometimes moved a real sung sound up an octave and a half, which garbles it. That cost two right Staccato notes. It now uses sounds sung near each note. The app wasn't the cause.
- **Short notes:** the first fix counted 0.1 s on the note. I added the plan's second half: most of what's heard must be on the note.
- **Database change:** the one new column you approved, for how close Match the note settled. It can be left empty, and who can read or write results is unchanged. Its definition is in the repo's database scripts, dated 13 Nov.
- **No take of yours has been read.**
- **The broken builds found three gaps in the checks**, now closed:
  - A cap on bubble size could slip through.
  - Match the note could score a different note from the one it played.
  - One moment wasn't covered: Beginner Match the note waiting for Next, with Pause greyed out.

  Each is caught now.
- **Two setup mistakes of mine, both caught before anything went live:**
  - A restart cut a check off mid-way, and I saved a deliberately broken line into the work. The checks caught it, and it never reached main.
  - I ran some checks with the wrong recordings, which made them look failed. They pass with the right ones, and the repo now says which recording each check needs.
- **Your Fix 1 message** (On my way, start with fewer crew) is for the moving app. It isn't in this chat's code, so I didn't start it.

## Not tried on a real phone

None of it.

## Your taps

Samsung, Chrome. Before each sung step, tell me in a word how you sang it (for example "all on pitch", or "missed the top notes"), so I can set your line against it.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. **A, the button.** Tap Train, Warm-up, "Ah" tension check, Start. Sing a round, then tap Close (tick a spot if you like). The button at the bottom should read "Next: Lip trills", and tapping it should open Lip trills. Then go back to Warm-up, open Posture check, Start, tap Done, then Next: it should open Neck and shoulder release.
3. **B, the menu.** Tap Train, Tone, Mum, Start. After a round or two, tap Home at the bottom while it's still playing: the piano and the mic should stop at once. Tap Train: you should get the Train list.
4. **Staccato.** Tap Train, Agility, Staccato, Start. Sing the notes short and bouncy. At the end, tap Save take.
5. **Consonant pops.** Tap Train, Articulation, Consonant pops, Start. At the end, tap Save take.
6. **Five-note run at 160.** Tap Train, Agility, Five-note run. Tap the gear, pick Advanced, close it, tap Start. At the end, tap Save take.
7. **Timing.** Tap Train, Tone, Mum, Start, sing it through, and tap Save take. With steps 4 to 6, that gives me slow, short and fast notes to measure, so no other exercise is needed.
8. **Match the tone, without headphones.** Tap Train, Pitch, Match the tone, Start, and sing along through the phone's speaker. Tell me whether "I can hear the tone. Put your headphones in." showed.
9. **Match the tone, with headphones.** The same again with headphones in. That line should not show, and your line should follow your voice.


## Two questions

1. May I read the takes you save in the steps above (Staccato, Consonant pops, the Five-note run at 160, and Mum), read only, and nothing else on your account? Only those saved after this build.
2. What were you listening through when you found the timing: the phone's speaker, wired headphones, or Bluetooth?
