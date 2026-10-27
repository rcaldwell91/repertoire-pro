# Report, 27 Oct 2026, commit 8c67ac0

Your four Train changes are built and live: Agility's quick run, La-Ga a syllable a note, the Today card, and plain words.

## What works

- **Agility's picture**: five faint staff lines (35%), five solid dots each on a different line or space rising like a quick run, and one smooth curve through them, in Agility's blue, the same stroke weight as the other pictures. It replaces the hummingbird.
- **Syllables per note**: La-Ga alternates one syllable a bubble, la, ga, la, ga, and every repeat starts on la. I checked every exercise against the old app's syllable strings:
  - "la-ga la-ga" (La-Ga) is the only one that alternates a note at a time.
  - "mmm / nnn / ng" (Humming) is three hums, so it now changes each repeat: a repeat on mmm, the next on nnn, the next on ng, then round again.
  - The rest, like "loo · lah" or "bah · hoo", list other ways to sing the same exercise, not a pattern. The first is sung, as the old app did. One exception, kept as before: Tongue-out singing is sung on "uh", which is what the old app's own instructions say to sing.
  - A check now compares every sung syllable with the old app's strings, so a wrong one fails the build.
- **Today**: the top card is now "Today": what to do next, its name, length and Start, with "More routines" under it. It reads one source, which asks in this order: what a coach assigned, today's day of a program they bought, their own plan. The first two don't exist yet and answer "nothing", so it shows their own plan; with none, the daily warm-up. When coaching and programs are built, they plug into that source and the card doesn't change. If one of them can't answer (offline, say), it is skipped, never a blank card.
- **Plain words**: no singer jargon in any exercise's name, goal or How, held by a check with a list of words like break, legato, staccato, crescendo, engaged and phonation. A renamed exercise keeps its old name only behind "More about this", as "Also called ...". All the changes are listed below.
- Everything else is as it was.

## Each exercise's syllables, note by note

One repeat of each (in a range of C3 to F4), and the next repeats where they differ.

- **Steady hiss**: no notes to sing on (a timed hiss).
- **Breath counts**: no notes to sing on (breath counts).
- **Lip trills**: brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr brrr (every repeat)
- **Straw singing**: no notes to sing on (guided, with a clock).
- **Humming: M, N, NG**: mmm mmm mmm mmm mmm mmm mmm mmm mmm | then nnn nnn nnn nnn nnn nnn nnn nnn nnn | then ng ng ng ng ng ng ng ng ng
- **Sirens**: no notes to sing on (a slide, your line only).
- **Mum**: mum mum mum mum mum mum mum mum mum (every repeat)
- **Mee**: mee mee mee mee mee mee mee mee mee (every repeat)
- **Noo**: noo noo noo noo noo noo noo noo noo (every repeat)
- **Loo / Lah**: loo loo loo loo loo loo loo loo loo (every repeat)
- **Gee (or Kee)**: gee gee gee gee gee gee gee gee gee (every repeat)
- **Short bouncy notes**: bah bah bah bah bah (every repeat)
- **Bratty Nay**: nay nay nay nay nay nay nay (every repeat)
- **Bratty Bay**: bay bay bay bay bay bay bay bay bay bay (every repeat)
- **Wah**: wah wah wah (every repeat)
- **Octave leaps**: ma ma ma ma ma ma ma (every repeat)
- **Slack-jaw La-Ga**: la ga la ga la ga la ga la (every repeat)
- **Tongue-out singing**: uh uh uh uh uh (every repeat)
- **Tongue out, getting louder**: no notes to sing on (guided, with a clock).
- **Blah**: no notes to sing on (guided, with a clock).
- **Yawn-sigh**: no notes to sing on (guided, with a clock).
- **Soft, loud, soft**: ah, ah, ah, ah, ah, one long note each.
- **Sustained note**: ee, ee, ee, ee, ee, one long note each.
- **Nine-note scale**: lah lah lah lah lah lah lah lah lah lah lah lah lah lah lah lah lah (every repeat)
- **Five notes down**: oo oo oo oo oo (every repeat)
- **Octave repeat**: buh buh buh buh buh buh buh buh buh buh (every repeat)
- **Long soft notes**: no notes to sing on (guided, with a clock).
- **Five vowels**: mah meh mee moh moo (every repeat)
- **Red leather**: red lea ther yel low lea ther red lea | then ther yel low lea ther red lea ther yel | then low lea ther red lea ther yel low lea
- **Unique New York**: u nique New York u nique New York u | then nique New York u nique New York u nique | then New York u nique New York u nique New
- **Peter Piper**: Pe ter Pi per picked a peck Pe ter | then Pi per picked a peck Pe ter Pi per | then picked a peck Pe ter Pi per picked a
- **Consonant pops**: puh buh tuh duh puh buh tuh duh (every repeat)
- **Tip of the tongue**: la la la la la ta ta ta ta (every repeat)
- **Lips and tongue**: mom my made me mash my M and Ms (every repeat)
- **Range check**: no notes to sing on (the range check).

## Plain words: every change

Names (the old name now only behind "More about this"):
- Farinelli breath → Breath counts
- Straw phonation → Straw singing
- Staccato → Short bouncy notes
- Tongue-out with a crescendo → Tongue out, getting louder
- Messa di voce → Soft, loud, soft
- Nine-tone scale → Nine-note scale
- Descending five-tone → Five notes down
- Vocal Function Exercises → Long soft notes

How lines:
- Sirens: "Slide slowly through your break without pushing or getting louder." → "Slide slowly through where your voice flips, without pushing or getting louder."
- Bratty Nay: "Make it bright and nasal, never heavy, as you cross the break." → "Make it bright and nasal, never heavy, as you pass where your voice flips."
- Long soft notes: "Keep it soft and engaged, because gentle every day beats hard once." → "Keep it soft but steady, because gentle every day beats hard once."

Goals (the same check reads them):
- Breath counts: "In for a count, suspend, out. Silent." → "In for a count, hold, out. Silent."
- Loo / Lah: "A legato scale where only the tongue moves." → "A smooth scale where only the tongue moves."
- Mee: "The bright, narrow vowel, started softly." → "A bright "ee", started softly."
- Sustained note: "One note, held soft but engaged." → "One note, held soft and steady."
- Unique New York: "Crisp consonants without losing the line." → "Crisp words while the sound keeps flowing."

Kept on purpose, for you to decide: "Octave" in Octave leaps and Octave repeat (most people know the word from school music), Lip trills, Sirens, Bratty Nay and Bay, Slack-jaw La-Ga, and Articulation, your name for the group.

## What was measured

All on the built app, in a Chrome made to behave like Android; the singing with a real voice, never a tone.
- Train: the page is the title, the Today card and the six group cards. The card reads "Today", "Daily warm-up", "9 min · 7 exercises", Start and More routines. Start opened the daily warm-up at its first step.
- Today follows its source: with an own plan kept on the phone (set by the test, since nothing in the app sets one yet), the card showed "Cool-down", "3 min · 3 exercises", and Start opened the cool-down; with none, the daily warm-up again.
- Agility's picture: 5 staff lines at 35%, 5 solid dots at 5 different heights, one curve, stroke 2.
- La-Ga's pattern card, note by note as it played: la, ga, la, ga, la, ga, la, ga, la.
- "Long soft notes": the old name is nowhere on the page, and More about this says "Also called Vocal Function Exercises."

Every check passes: Train 27 and the online save (2 new checks, 3 extended), browser 15, Android 28, library 7, note map 13, Learn a song 19, takes 19, loudness 11, 231 unit tests (10 new), and the old app's 187. All 186 broken builds of the app and 120 of the core are caught; 17 are new for this round.

To say plainly: six of the new broken builds slipped past my checks the first time, and I fixed the checks, not the builds:
- Three broken pictures (staff lines at full strength, hollow dots, two dots on one line) still passed, because a picture that failed the check fell back to its own label, which reads "run". Now a failing picture reads "wrong", with what failed.
- Three broken Today cards still passed, because the Today check sat inside the Train page's block and never ran when asked for on its own. Now it runs.
All six are caught now, and the checks still pass on the real build.

The checklist has this round's rules with their tests: 160 ticked, 30 left out with reasons, none crossed.

## Not tried on a real phone

None of it. Things I decided that you may want to change:
- The staff lines use the same stroke weight as the rest, as you asked; at the card's size they sit close together and read as a soft blue block behind the run. Thinner staff lines would make it airier, if you'd like that.
- The own plan is kept on the phone, but nothing in the app lets the singer choose one yet; until then Today is always the daily warm-up.
- Humming changes hum each repeat, not each note: you can't switch from M to NG mid-scale.
- A result saved before a rename keeps its old name in the results list; new ones use the new name. The exercise behind them is the same.

## Your taps

Samsung, Chrome, headphones in.

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. Tap Train. The top card reads "Today", "Daily warm-up". Look at Agility's new picture.
3. Tap Agility, then Slack-jaw La-Ga. Tap play on the pattern card: la, ga, la, ga under the dashes. Tap Start and sing them.
4. Tap Train, then Breath, then Long soft notes. Tap "More about this": it says "Also called Vocal Function Exercises."
5. Tap Train, then Warm-up, then Sirens, and read the How.
