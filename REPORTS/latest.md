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
