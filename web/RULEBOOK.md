# Repertoire — Rebuild brief for Code (2 Oct)

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
- **Separator:** Kim Mel-Band RoFormer (MIT, weights SHA-256 87201f4d…559e), on a GPU server later.
- **Supabase project** **ovafsbloyrlwrolqtcat** is kept, with all its data and security rules. Only the publishable key goes in the repo.
- **Design** comes from mockups Robert approves. Until then, screens stay plain.

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
- **Live pitch:**
  - follows the voice 93.2% / 96.5% of the loud time
  - singing lands inside a note 87.3% / 91.9% of the time
  - placement within ±30 ms
- **Separator (CPU test, 1 Oct):** All of Me SDR 12.4 dB (14.1 dB level-matched); one half-second of music left in at 1:58.75. Use Kim's original chunk overlap (2) on the server, not audio-separator's 1.
