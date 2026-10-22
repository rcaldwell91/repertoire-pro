# The Android audio failures — diagnosis and fixes (v8 → v9.6)

(Copied in whole from the Repertoire project doc "The Android audio-suspend bug (v8)", written 9 Sep 2026. This is the source; the rulebook's Android rules are drawn from it. Read newest-first: a later entry that withdraws an earlier one wins.)

**Read the debugging order at the bottom before touching anything.**

---

# 9 Sep 2026 — "suspended, and it stays suspended" (v9.6)

## What Robert saw on v9.5

> "nope nothing and I pressed retest sound and still nothing"

Screenshot: **"The app made NO sound — signal at the output: 0.000. Sound clock: FROZEN (it says "suspended" but time is not passing) · guide volume: 100% · master: 90%."**

The new word is **suspended**. Every earlier frozen report said *running*. This is a third flavour of dead clock, and the one that follows a USB-C headset going into the S24: the context comes back suspended and will not resume, and it survives unplugging the headset and reloading the page.

## My bug — Restart sound reported success over a dead engine

`ensureCtx()` fires `ctx.resume()` and walks away without awaiting it. `audioRebuild()` never awaited a resume either, and never checked the result. The Restart sound handler then printed **"Sound engine rebuilt. Press Test sound."** unconditionally. So the app told him it had fixed itself while leaving him exactly where he was. `test_sound.js` froze a *running* context, so the suspended-and-won't-resume path had no test at all.

## v9.6 — what changed

`audio_rebuild_patch.js`
- `audioRace(p, ms)` — every audio promise is raced against a timeout, because `resume()` and `close()` both hang forever on a wedged Android audio system.
- `audioWake(ms)` — resume, **awaited**.
- `audioClockMoves(ms)` — the verdict comes from `currentTime`, never from `ctx.state`. The flag lies; the clock does not.
- `audioKick()` — one silent 1-sample buffer through the fresh context. Chrome on Android sometimes will not open the output stream until something is actually played.
- `audioRebuild()` now **awaits `old.close()` before creating the replacement** (previously it fired close and built the new one in the same breath — on Android the output stream had not been handed back yet, which is a plausible way to be born suspended and never wake), then verifies, then retries once with a 600 ms breath, then **returns `{ok, running, moved, state}`**.
- `audioDeadHelp()` — the escalation ladder, in one place: reload the app → unplug and reload → close Chrome completely → restart the phone. It says plainly that the page cannot fix a jammed phone audio system.

`layout_v9.js`
- One `soundProbe()` used by every button, so they cannot disagree about what "working" means.
- Restart sound now says **"Sound engine restarted and running"** only when the clock proves it, and otherwise **"The restart did not take — the phone is still refusing… (it says "suspended")"** plus the ladder, and reveals a **Reload the app** button.
- **New: "Test without mic"** — releases the microphone, waits 800 ms, rebuilds the engine, and measures. This is the test that says *which* thing is broken: if the piano comes back with the mic released, opening the microphone is what kills the output on this phone (fix: pick the phone's own mic in the input list, or take the headset out to warm up). If it does not come back, the mic is not the cause and it is the phone's audio system.
- Test sound reports the microphone state alongside signal and clock, and returns immediately when guide volume is near zero instead of playing a 1.6 s test into a muted channel.

`audio_fix_patch.js` — `audioBannerTap()` is async, awaits the resume, checks the clock, and when nothing worked leaves an honest banner instead of quietly clearing.

## Tests

`test_sound.js` gained the missing case: every context the page makes is born suspended with `resume()` that never resolves. Asserts it does **not** claim success, repeats the phone's own word, admits the page cannot fix it, gives the ladder, reveals the Reload button, and tries exactly twice. Plus the Test-without-mic path end to end. `test_stall.js` waits longer now — the tap genuinely takes ~1 s more because it verifies. All 23 suites green.

**Also caught in the process:** `test_sound.js`'s "silent guide volume" check was reading the *previous* click's message — the earlier Test sound handler was still measuring and overwrote it 200 ms later. It had been passing by luck. Fixed with a settle wait. **Rule: when a test asserts on a message, make sure no earlier async handler is still holding the pen.**

---

# 3 Sep 2026 — "Sound stalled" (v9.3.1) — CONFIRMED from screenshots

## What Robert saw

Three screenshots minutes apart on v9.3, headphones in, **"Hearing you" on**:

1. 5-Note Scale Ladder, count-in frozen on **5** (= frame one, see v8 below), banner **"Sound stalled — tap here to restart it."**
2. & 3. Keyboard trainer, banner **"Sound is paused on this phone — tap here to start it."** — while the Sound panel's Test sound line read *"Sound clock: running"*, i.e. it was running a moment earlier and went down again.

His words: *"it keeps freezing now and having these errors at the top about the sound and mic."*

## The two flavours of dead clock — and why v8 only fixed one

- **Paused** = `ctx.state !== 'running'`. `resume()` on a tap brings it back. v8 handled this. *(v9.6: on his phone there is a third case where it does not come back at all — see above.)*
- **Stalled** = `ctx.state === 'running'` **but `currentTime` has stopped.** `resume()` is a no-op on a "running" context. v8's stall branch called `resume()` + `micRewire()` — i.e. nothing that could help — and showed the banner. **The tap did the same nothing.** So on his phone the exercise sat on the count-in forever and the banner kept coming back.

Android stalls a running context when the **audio route changes underneath Chrome**: a headset going in/out, Bluetooth earbuds flipping into call (SCO) mode the instant `getUserMedia` opens the mic, another app taking audio focus. Chrome's output stream dies and it never opens a new one. Note that every exercise and the Keyboard call `enableMic()` first — so if the mic opening is what flips the route, the freeze lands exactly at the count-in. That matches screenshot 1 perfectly. **Confirmed since: wired USB-C headset with an inline mic on a Samsung S24; it froze at the moment of plugging in.**

## Fix — `audio_rebuild_patch.js` + reworked `audio_fix_patch.js`

`audioRebuild(reason)`: pause the run at the beat it reached (on the old clock), detach the mic graph, drop the monitor gain and noise buffer, `close()` the old context, `ensureCtx()` a fresh one, restore the guide/backing volumes, `micAttach(MIC.stream)` (which re-wires "Hear me"), then `resumeSong()` so `T.startTime` is re-anchored on the new clock and the exercise carries on from where it froze — no restart, no lost score.

**Watchdog policy — REVISED in v9.4, read this instead of what v9.3.1 said:** the watchdog **watches and reports, and never acts on its own**. v9.3.1's automatic rebuilds, stacked on top of an automatic mic ladder, are what thrashed Robert's phone. A tap is the only trigger for anything heavy, and the tap is also the gesture Android requires.

## Test — `test_stall.js`

Freezes `currentTime` via `Object.defineProperty` on the instance (state stays 'running', exactly Android's symptom) mid-ladder with Hear me on. Proves: new context, old one `closed`, clock moving, exercise still running from the frozen beat (not restarted), mic analyser / monitor / guide gain all on the new context, mic still hears. Then a stuck suspend with `resume` stubbed to never resolve → the tap replaces the context.

---

# 5 Sep 2026 — the one that nearly ended the project (v9.4)

Robert's phone froze for minutes at a time, screenshots would not take, System UI reported errors, and he asked whether to abandon this route. **It was my bug.** `audioWatch` treated 3.5 s of microphone silence as a broken input and re-ran a four-rung `getUserMedia` ladder every 6 s; every request made Android reconfigure the audio hardware. v9.3.1's automatic rebuild piled on top.

Root cause of the blind spot: **every test fed a constant tone. The app had never been tested against silence** — and a singer who is listening is silent.

Fixed by subtraction: one mic request, no automatic recovery, watch-only watchdog. Proven by `test_quiet.js`, which fails on the old build (6 requests) and passes on the new (1). Also fixed: `soundWire()` was calling `ensureCtx()` when the Train screen opened, so the engine was born before the mic, on the pre-headset route (`test_quiet.js` now asserts the order is `mic → engine`).

---

# 18–19 Aug 2026 — v8 → v8.2

**RESOLUTION (19 Aug):** Robert reported afterwards that **he did not have the microphone/headset plugged in — he was using the phone speaker** and only realised later. So the live failure was largely a hardware-setup issue, not the app.

**Lesson: confirm the physical setup (mic plugged in? headphones or speaker? which input?) BEFORE building software fixes for a hardware symptom.**

## Cause 1 — the suspended audio clock (v8) — CONFIRMED

**The tell:** the count-in frozen on "5". `T.countInBeats = song.beatsPerBar` (4) at bps 2, plus the 0.15 s lead, makes the first rendered frame exactly `Math.ceil(4.3) = 5`. The run was stuck on frame one: `ctx.currentTime` was not advancing. One dead clock explains both symptoms: `songBeat()` derives from `ctx.currentTime`, and the mic analyser hangs off that same context.

**Testing note: desktop Chrome keeps feeding the analyser while suspended and allows `resume()` without a gesture — Android does neither.** Tests must emulate the gesture rule or they pass on a broken build. This is why v7 shipped green.

## Cause 2 — the silent raw microphone (v8.1) — WITHDRAWN in v9.4

The probing ladder it added is what thrashed the phone. Do not bring it back.

## Cause 3 — another app stealing the mic (v8.2) — kept, passive only

`micAttach()` wires `track.onmute/onunmute/onended`; banner naming voice search / assistant; real sound arriving 500 ms after the mute event clears `MIC.stolen`.

---

## Debugging order for any future "it's not working"

1. **Is the mic physically connected, and is it headphones or speaker? Wired or Bluetooth?** (Wired USB-C headset with an inline mic is his setup, and plugging it in is what starts the trouble.)
2. **Which banner?** "paused" = suspended context; "stalled" = running but frozen; "suspended and won't resume" = the phone's audio system is jammed and the page cannot fix it.
3. **Press Test without mic.** It splits the problem in one press: microphone opening vs the phone's audio system. Do this before theorising.
4. Screenshot of the **Mic check panel** and the **Sound panel** — together they distinguish dead clock, held-by-another-app, genuinely silent input, and whether output works at all.
5. Only then start theorising about the code.

## Standing rules earned the hard way

- Never report success on an audio operation you did not verify with the clock.
- Never "fix" a flaky test by moving its threshold — find which term is noisy.
- Never let the app take heavy audio action on its own. A tap, or nothing.
- Test against silence, not just against a tone.
