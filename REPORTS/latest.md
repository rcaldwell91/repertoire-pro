# Report, 3 Nov 2026, commit 6497b3b

The Train update from your 3 Nov spec is built and live, with your answers to the plan.

## What works

- **The exercise page**, on every exercise: the title, the plain line under it, You'll need, How to do it as numbered steps, then Start. Behind "More about this", in this order: You're doing it right when, Watch out for (the old care points at its end, so nothing is lost), Why it helps.
- **Six rewrites** with your spec's words: Slack-jaw La-Ga, Bratty Nay, Straw, Tongue-out singing, Mum and Messa di voce. Every point of ours the spec didn't list is kept. Straw's "accents" clause is gone and the water warning is in Watch out for. Tongue-out's cloth line and "Overdo the brat, not the volume." are in your words.
- **Six new exercises**, in their places:
  - Warm-up opens with Posture check and "Ah" tension check.
  - Cheek puffs and Chew and hum come after Straw.
  - Tongue-forward hum comes after Humming.
  - Tongue-out bright "a" is in Tone, after Tongue-out with a crescendo.

  Train has 55 exercises now.
- **Levels inside one exercise**, picked in the gear's sheet and remembered for that exercise:
  - La-Ga: Beginner 1-2-3-2-1, Intermediate five-note, Advanced Big climb's arpeggio, all at 132.
  - Bratty Nay: Beginner five-note, Intermediate the octave, both at 120.
  - Straw: the same three, at 110, 110 and 120.

  The list row shows the span ("Beginner to Advanced"). A routine uses its own level, capped at the exercise's top. So the Intermediate warm-up sings La-Ga's five-note scale and Bratty Nay's octave, the Advanced one Straw's arpeggio, and the Cool-down Straw at 1-2-3-2-1.
- **A half step every round** with no 14-round cap, for the spec's climbing exercises only. A two-octave range on La-Ga at Beginner is 20 rounds. The rest of Train is as it was.
- **Line shown, not scored**: Straw, Cheek puffs, Chew and hum and the tension check. The bubbles show and your line draws, but nothing fills and there is no score. The result says "Not scored. The line was there to watch." and the list row says "Not scored". Save take still works.
- **The movement cue**, one line above the map:
  - Mum: "Keep your head loose and your shoulders rolling."
  - Straw: "Keep turning your head slowly."
  - Cheek puffs: "Keep rolling your shoulders."
  - Chew and hum: "Keep chewing."
  - Tongue-forward hum: "Keep your head moving slowly."

  It is there before the count-in, so the map never changes size.
- **The tension check.** After the last round comes "Tick where you felt tension." with the six spots. Each tick is kept the moment it's tapped: on the phone, then on your account. A new check clears the old ticks. Stopping early still shows the list once a round has been sung.
- **Reminders.** Later exercises show one reminder line, rotating through your ticks, one more each time an exercise starts. A reminder that contradicts the exercise never shows (for example, no "Open tall, not wide." on Bratty Nay or with closed lips). There is none on Posture check, the tension check or Sing the interval. On the five cue exercises, the cue wins.
- **Posture check**: its steps and a one-minute clock, no pitch line, not scored. You'll need: a wall.
- **The ticks are private.** They're kept in a small table of their own on your account, which only the singer can read or change. The database itself enforces that, not just the app. They don't go on the profile, because a coach can read their singer's profile.
- **Narrow phones**: Pause, Restart and the gear now share the width on a 360 px phone. Before this, Pause and the gear ran off the edges.

## What was measured

All on the built app, in a Chrome made to behave like Android, with a real voice where something was sung.
- La-Ga's page in order: title, plain line, You'll need, five numbered steps, Start. Behind More about this: doing it right, watch out, why.
- Levels: La-Ga 5 notes at first, 11 at Advanced and remembered. Bratty Nay 9 notes with two levels. In the Intermediate warm-up La-Ga sings 9 notes, with no picker there.
- Climb: a two-octave range gives La-Ga 20 rounds, a half step each. Mum stays within 14.
- Cheek puffs sung by a real voice: the line drawn (31 points), no bubble filled, no score, Save take offered.
- The cue line on all five, the map the same size before and during the count-in.
- Tension check: the six spots, none ticked at first, the old ticks cleared; Jaw and Face kept on the phone at once.
- Reminders with Jaw and Face ticked:
  - Mee showed "Let your jaw hang loose.", then "Keep your face still.", then the jaw line again.
  - Chew and hum showed its cue instead.
  - Sing the interval showed nothing.
  - Bratty Nay showed nothing when only its two contradicting spots were ticked.
- Signed in as the test singer:
  - The ticks reached the account as Chin and Neck.
  - As the singer's linked coach (the second test account), I tried three things. Reading them returned nothing. Changing them changed nothing. Adding a row for the singer was refused (403).
  - Signed out, the request was refused (401).
  - On a new phone the ticks came back.
  - The test row was deleted afterwards.
- At 360 px wide every control along the bottom is inside the screen.

Every check passes: Train 51 and the signed-in 5, browser 15, Android 28, library 7, note map 13, Learn a song 19, takes 19, loudness 11, 267 unit tests, and the old app's 187. All 249 broken builds of the app and 155 of the core are caught; 35 are new for this round.

To say plainly:
- **The ticks could land out of order.** Two quick ticks were sent at once, and the older one could arrive last. The signed-in check caught the account holding only "chin" after "chin" and "neck" were ticked. Saves now go one at a time.
- **Pause and the gear ran off a 360 px screen.** This came from the last round and was missed because the checks ran at 390 px. A new check at 360 px failed on the old build and passes now.
- **One old broken build stopped testing anything.** It broke Mum's How line, which is numbered steps now. It's moved to an exercise that still has one How line, and it's caught.

The checklist has this round's rules, including the old app's body warm-up rules (nothing on the throat, no head rolled back, nothing held long): 202 ticked, 35 left out with reasons, none crossed.

Screenshots at 360 px wide, the narrowest phone width tested, are in the repo's REPORTS folder, dated 3 Nov: La-Ga's page, Cheek puffs' page, the tension tick list, and Mum's singing screen with its cue. Lines that wrapped there: Mum's cue (two lines). On La-Ga's and Cheek puffs' pages, You'll need, the plain line and most steps run to two to four lines, as long sentences do on a narrow screen.

## Not tried on a real phone

None of it. Things I decided, and things left open:
- **Straw and Cheek puffs stay unscored** until your real-phone test with a straw, as you said.
- **The plain line and You'll need** may run to 14 words, as How did. Several of the spec's descriptions are longer than the old eight-word cap.
- **Cheek puffs' bubbles say "oo"**, as Straw's do; the spec gave no syllable.
- **Posture check** isn't marked Quiet: it makes no sound, and the plan didn't list it as Quiet.
- **Mum's cue wraps to two lines** at 360 px. No other cue, reminder or tick label wraps there.
- **The Cool-down is still listed as 3 minutes.** Straw is sung now, so it may run a little longer on a wide range.
- **Database change.** The table is the one change, as the plan said. Its definition is kept in the repo, under the web folder's database scripts, dated 3 Nov.
- **Leaked password protection** is off. Supabase's security check lists this, and it isn't from this round.

## Your taps

Samsung, Chrome.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. Tap Train, Warm-up: Posture check and "Ah" tension check are at the top. Open "Ah" tension check, tap Start, sing the "ah" rounds. At the end, tick where you felt tension.
3. Tap Train, Tone, Mee, Start: one reminder from your ticks shows above the map. Close, and Start again: the next one shows.
4. Tap Train, Agility, Slack-jaw La-Ga. Read the page, tap the gear, pick Advanced, close it, tap Start.
5. Tap Train, Warm-up, Cheek puffs, Start: the cue line, your line, no score at the end.
6. When you have a straw: Train, Warm-up, Straw phonation, Start. The line shows but isn't scored yet. Tell me how the line follows you, and I'll switch scoring on.
