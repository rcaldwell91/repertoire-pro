# Repertoire — Rebuild brief for Code (updated 4 Oct)

This is the single source for the rebuild. Copy it into the repo as web/RULEBOOK.md and keep it there. When the rulebook and a prompt disagree, ask; don't guess.

## 1. Decisions (settled)

- **Rebuild from scratch, carrying the knowledge.** The current app (base.html + 240 build-time patches + 40 add-ons) stays live and untouched at next.html until the new one covers everything.
- **Web first, upgradeable later.**
  - React + TypeScript + Vite.
  - Later it will be wrapped as a phone app with Capacitor, and only the sound engine is swapped for a native one. So screens must never touch browser audio directly.
- **Where it lives:**
  - Source in web/ in this repo.
  - Built output committed to app/ on main, so GitHub Pages serves it at rcaldwell91.github.io/repertoire-pro/app/.
  - Nothing outside web/ and app/ changes.
- **Seven tabs, all kept:** Home, Train, Sing, Coach, Learn, Library, Profile.
  - Every tab has an icon. Library's icon is a record (disc).
  - The label shows on the active tab only.
  - The app gets a browser-tab icon (favicon) and a home-screen icon.
- **Learn** holds theory, ear work and how the voice works (phonation, resonance, registers, posture). **Train** holds singing exercises.
- **Separator:** live on Modal since 4 Oct (services/separator/).
  - Kim Mel-Band RoFormer weights (MIT, SHA-256 87201f4d…559e), run through ZFTurbo's MIT code pinned at v1.0.22, with Kim's settings (overlap 2).
  - Only signed-in users can use it, and nothing is kept on the server.
  - Output is 320 kbps at the song's own level, so voice + music add back up to the song.
  - Runs on an A10 (decided 4 Oct: about twice as fast as the L4, and cheaper).
  - $10 spend limit on Robert's Modal account.
- **Supabase project** **ovafsbloyrlwrolqtcat** is kept, with all its data and security rules. Only the publishable key goes in the repo.
- **Design:** follow section 1b exactly. Robert approved it in screen mockups (drafts 3–4, 3 Oct).

## 1b. Design decisions (Robert, approved 3 Oct)

- **Font:** Quicksand everywhere. Body text no lighter than 500.
- **Themes:** dark and light, with a switch.
  - Dark: background #0c0b16, cards #16152b.
  - Light: warm cream #f7f2ea, cards #fffdf9.
- **Brand gradient** (#8b5cf6 → #6366f1 → #ec4899) only on the main Start buttons and the active tab.
- **Your voice line** has its own gradient:
  - dark mode: #22e0ff → #b07cff → #ff4fa3
  - light mode: #0891b2 → #7c3aed → #db2777
- **Accent purple:**
  - dark mode: bright lavender #b07cff
  - light mode: #7c3aed
- **One colour means one thing:**
  - Warm-up: orange
  - Breath: teal
  - Tone: pink
  - Agility/pitch: blue
  - Your songs: purple
  - Green: only a note you hit
  - In Learn: Theory blue, Your voice pink, Ear teal
- **Tab bar:** 7 rounded-stroke icons. The active tab is a gradient pill with its name; the others are icon only. Library = a record.
- **Exercise screens hide the tab bar.** The preview page has the name, tags, a note preview that plays only on tap, a one-line goal, a one-line how, and a big Start. The singing screen has smaller bubbles, a white ring on the current note, the gradient voice line, and ✕ as the only control.
- **Learn a song is ONE screen.**
  - The note map shows the singer's line (thick, soft) and your line (thin, gradient) on top. No bubbles, because they never matched the words.
  - Bubbles on long held notes only, to measure sustain, may be tested later. They ship only if they measure accurately.
  - Play bar, back 10 s, Start, repeat this part.
  - Under the note map, ONE sound card holds the Voice slider, the Music slider, and a "Hear yourself" switch with your level, so everything is in one place.
  - Robert's learning path (5 Oct):
    1. Sing with the singer's voice up and the music down, to learn the notes.
    2. Turn the voice down and sing over the music, karaoke style.
    3. Save the take, or send it to a coach.
  - The singer's line is ALWAYS shown, whatever the Voice slider says, because it's read from the separated voice file, not from what's playing.
- **Intervals are two features:**
  - Train → "Sing the interval": sing the jump.
  - Learn → Ear → "Hear the interval": two notes play; pick step, third, fifth or octave.

## 1c. Coaching model (Robert, 3 Oct): many coaches per singer, coaches by specialty

- **A singer can have several coaches at once,** each for what they do best, and a coach has many students. Never assume one coach per singer anywhere: not in screens, data, scoring or messages.
  - Checked 3 Oct: the database already allows this. The coach–student link is unique per coach+student pair, not per student.
  - What the old app's code and security rules assume still needs checking when Coach is rebuilt.
- **Coaches are listed by specialty, not as all-rounders.**
  - Examples: high notes, low notes, runs and riffs, breathing, performance and presentation, plus "all-round" for those who are.
  - Coach onboarding steers each coach to name what they're best at.
  - Find a coach has specialty filters.
- **Why:** specialised help for every need, and competition in a marketplace that brings vocal coaching prices down and lets coaches take on more students at lower prices.
- **When:** this shapes the Coach tab, coach onboarding and the marketplace. Design and build it in those steps, not now. Money options are still open.

## 1d. Test accounts

- Use ONE permanent test account for all live tests, rp-test@example.com, created once and reused. Never create throwaway accounts.
  - Deleting accounts needs an approval Robert can't reliably give from his phone.
- One permanent test COACH account, rp-coach@example.com, created once, linked as coach to rp-test@example.com, and reused for every test of sending to a coach.
- Never create any other accounts.
- Never touch Robert's (lyonxdewitt@gmail.com) or Briar's (briarmlocke@gmail.com) accounts.

## 2. Architecture rules

```
web/src/
  core/      pure TypeScript: music maths, timeline, scoring, exercises & lessons as data, copy (all user-facing text)
  audio/     AudioEngine interface; conductor/ (the only owner of sound); engine-web/; engine-fake/ (tests); pitch/
  data/      Supabase access only
  ui/        design system: tokens, icons, components
  screens/   thin; no logic that belongs in core
```

1. **The conductor owns all sound and the mic.**
   - It's a state machine: idle → armed → counting-in → running → finished | stopped.
   - Anything that plays or listens needs a start token created by a user tap.
   - One source at a time.
   - Leaving the screen, switching tab, the back button, hiding the app, or a call or interruption means silence and the mic closed.
   - Nothing resumes by itself.
   - Finished releases everything.
   - A lint rule bans screens/ and ui/ from importing engine-\* or touching AudioContext or getUserMedia.
2. **One clock.** Every event is stamped in the audio engine's time. Input and output latency are kept separately, and each line is corrected at its own source.
3. **Content is data** (exercises, routines, lessons, games), validated by a schema.
4. **All user-facing text comes from** **core/copy****.** A copy-lint test:
   - bans the words "acapella" and "a cappella", and jargon such as "stem", "separator", "latency" and "f0" in user-facing text
   - caps instruction lines at 8 words
5. **No fix without a failing test first.** Every test runs against the built app.

## 3. Product must-haves

- Nothing plays, times or listens until the person taps Start. Ending means ending.
- Nothing plays after the person leaves a screen or hides the app.
- One message per situation. App text says what to do in a few words.
- Every screen is reachable by tapping and has a way back.
- Nobody waits behind background work. Slow steps show real progress, never an invented time estimate.
- Every screen still works when the mic is refused, with "Carry on without it".
- Anything the user adds is saved straight away.
- Text that changes length never moves what's under a finger.
- One colour means one thing.
- Contrast is at least 3:1, and every button has its colour set.
- The app never finds, scrapes or downloads lyrics or audio. Singers bring their own files.
- Recordings and model weights are never committed. Tests read recordings from an environment-variable path.

## 4. Lessons ledger (from the old app's history; each was a real bug)

### Mic

- Never require raw capture. Walk a ladder of constraint sets and remember what worked.
- Always offer "Carry on without it". The mic dialog never covers the tabs.
- Timed exercises: start the clock at the first sound and stop after 1 s of silence.
- Warn when headphones can't be confirmed.
- The monitor only sounds on singing screens.
- One mic, one recorder.

### Pitch

- Lift the pen across big jumps, and centre the view on a median, not the newest sample.
- Use one shared drawing function.
- Pin the view; don't recentre.
- One pitch core for files and mic.
- Loudness gate: use Otsu on the file's own loudness, not a guessed threshold. Bridge gaps of 0.15 s or less, and don't loosen the gate.
- Keep median-of-five (unsmoothed was measured worse).
- Know which part of the window the estimator reads, and version stored traces.
- Octave is exact by default, with an "Any octave" switch.

### Files

- Never start without a map.
- Read in a worker, progressively, 8 s ahead.
- The opened song jumps the queue.

### Bubbles

- One shape check for maps versus takes.
- Cut at 1 semitone and 0.15 s.
- A hit is half the note within a semitone; the score and the fill use the same rule.
- Round time steps before comparing (a float bug once lost 63 of 488 notes).
- Bubbles start where the voice starts.

### Timing

- Correct each line at its own source.
- Use real elapsed time, never a per-frame constant.
- One ordered entry point with an explicit "ready", never a guessed delay.
- Placement gate ±30 ms.

### Sound

- One playback engine and one sound owner.
- Record stops only its own playback.
- Ignore a repeat press mid-note.
- Measure the sample file that ships.

### Screens

- One screen registry.
- One source of truth for the vocal range, recording where it came from ("Not measured yet").
- Unique ids.
- A missing target must say so, never fail silently.
- Lists follow their data source.
- Check after every rework that no feature was lost.
- Pages, not pop-up sheets.
- Fix a screen rather than explain it.
- The back button walks the app's own screens.

### Wording

- Plain words, written to the singer.
- One name per feature.
- No claims the app doesn't do.
- Cut sentences that don't change what the singer does next.
- Check the built page.

### Tests

- Test on a real voice, never a tone.
- A hidden canvas doesn't draw, so assert the screen is showing.
- An unmeasured claim is not a pass.
- Reset any state a previous check left behind.
- A swallowed failure followed by a confident message fails the build.
- Prove a new test fails on the broken case before trusting it.

### Build

- Check the built page before adding a global.
- Delete dead code.
- Keep unmeasured work on a branch.

### Cloud

- Coach writes require the coach–student link and the coach role.
- Pairing codes: 6 characters, no O/0 or I/1.
- Private bucket with 1 h signed URLs.
- find_coaches returns public fields only.
- Scorecards show only numbers the app measured.
- Paid features are decided on the server, never by display name or local storage.

### Settled product decisions

- Repertoire's own colours; students opt in to their coach's colours.
- Everyone signs up as a singer; teaching is switched on later.
- Free Sing and the Pitch Tracker are separate.
- Onboarding questions come after sign-up.
- The reference note is a real piano (16 measured Steinway samples, CC0).
- The Pitch Tracker lives on the Sing tab; its line is thin and exact. Exercises use a flowing gradient line with syllable bubbles.
- Learn a song is one screen: hear the voice alone, sing along matching pitch, then sing over the music alone.
- Free Sing effects are named Compressor/EQ/Echo/Reverb, with a plain line behind the (i).
- Rejected after measuring: unsmoothed pitch, and the per-syllable cutter.

## 5. Baselines the new engine must meet or beat

- **Test tracks:** voice-only All of Me and Ride, supplied by Robert (professional singers, not Robert).
  - Ride's voice-only track is NOT the same audio as the full song (correlation 0.35), so don't use it to score separation.
- **Live pitch** (bake-off, 5 Oct; voice-only All of Me / Ride):
  - The old method, as measured today: follows the voice 97.0% / 94.0% of the loud time.
  - This app (the old method, median centred): follows the voice 97.1% / 94.2%; right note 84.2% / 89.0%; the line within ±10 ms; live reaction about 125 ms.
  - The old 93.2% / 96.5% were measured another way and are superseded.
  - singing lands inside a note 87.3% / 91.9% of the time
  - placement within ±30 ms
- **Separator:** judge quality on the level-matched score.
  - All of Me: 14.13 dB on the live server (14.12 on the CPU test), with one half-second of music left in at 1:58.75.
  - Speed from cold on the A10: first 30 s ready in 18–27 s, whole song in 40–69 s, about 2–3¢ a song.
