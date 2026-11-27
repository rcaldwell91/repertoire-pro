# The old app as the checklist (RULEBOOK 2.6)

For each part the new app has built, every rule the old app's code (next.html) enforces, and every failure it guards against, read from the code and the comments around it on 12 Oct. Numbers in brackets are next.html lines.

**✓** means the new app has a test for it, named after "test:". A name like android:clock-crawls is a browser check in tests/android.test.mjs. A name starting unit: is a unit test file under src, and words from the test's name.

**✗** means not tested and not built, because it waits on Robert's decision.

**—** means not part of the new app: the old feature it belongs to was not built, or was replaced by a decision in the RULEBOOK (named).

`unit:core/checklist.test.ts` checks that every test named here exists. Rules marked "fixed 12 Oct" were real gaps found by this list. Each got its test first, then the fix.

## 1. The sound engine

### Making and waking the sound

- ✓ One sound at a time, made on the way from a tap, never before (982-989, 6837-6842) — test: `browser:nothing-before-start`, `android:mic-first`
- ✓ The microphone first, then the sound, so it is born on the route the phone ends up using (1421-1428, 1477, 3829-3830) — test: `android:mic-first`, `unit:audio/conductor/conductor.test.ts:opens the mic first, then wakes the sound`
- ✓ Resume only from a tap; browsers allow nothing else (2979-2981, 12) — test: `android:gesture-only`
- ✓ "Running" is proved by the clock moving, never by the state flag (3084, 3109-3118, 3133) — test: `android:start-hangs`, `android:stall-rebuild`
- ✓ One silent sample opens Android's way out (3120-3131, 38-39) — test: `android:ten-starts`
- ✓ Every promise that can hang is raced against a timeout: resume (3100-3106) — test: `android:start-hangs`
- ✓ ...and close (3191, 3201) — test: `android:close-hangs`
- ✓ ...and the microphone (Robert's Android rule 2) — test: `android:mic-hangs`
- ✓ ...and decoding a file (Robert's Android rule 2) — test: `android:load-fails`
- ✓ A failure in sound never throws into the screen; it is said (2873-2877, 37) — test: `android:load-fails`, `unit:audio/conductor/conductor.test.ts:a song that will not load stops, and says so` (fixed 12 Oct: a song that would not load went back to Start without a word)
- ✓ Never suspend the sound ourselves (Robert's Android rule 1; the old app's lesson from Robert's S24) — test: `android:never-suspends`
- ✓ A sound that will not start says so, with what to do, in order; never a silent Pause (3139-3153, 6708-6713) — test: `android:start-hangs`
- — Resume on every gesture, focus and pageshow (2979-2981, 3045-3047). Replaced by Robert's Android rule 3: Start awaits resume and proves it with the clock.
- — Status chips for "sound not started" (1543, 3398). The new app has no status chips. The Sound check says it instead.

### Stalls and the watchdog

- ✓ A clock that says "running" but stands still is a stall (2858-2862, 2923-2931) — test: `android:stall-rebuild`
- ✓ A clock that moves too slowly is a stall too: the old app wanted 40% of real time (3110-3117, 6661-6664) — test: `android:clock-crawls` (fixed 12 Oct: only a clock standing quite still was caught)
- ✓ The watchdog runs only while something plays (2907-2910) — test: `unit:audio/conductor/conductor.test.ts:a stall when nothing plays is not this session`
- ✓ A stall shows one message and does nothing heavy by itself; only a tap rebuilds (2864-2869, 3087-3088) — test: `unit:audio/conductor/conductor.test.ts:a clock that stops while playing is a stall`
- ✓ The rebuild awaits the old sound's close, then waits 800 ms, then makes the new one, kicks it with one silent sample and proves it by the clock (3186-3192; Robert, 21 Oct) — test: `android:rebuild-awaits-close`, `android:stall-rebuild`
- ✓ A sound made before the mic opened (Test without mic, a take heard alone) is made anew on the next Start once the mic is open, so it is born on the headset's route (1421-1428; Robert, 21 Oct) — test: `android:born-before-mic`
- ✓ ...and carries on from where it froze, on the new clock (3171-3178, 3215-3222) — test: `android:stall-rebuild`
- ✓ ...with the volumes put back (3206-3210) — test: `android:stall-rebuild`
- ✓ ...and the microphone re-attached to the new sound (3211-3214) — test: `android:hear-yourself-rebuilt`
- ✓ Never stack microphone graphs; the phone slows until the clock stalls (1338-1346, 2888) — test: `android:ten-starts`
- ✓ A change of state while the sound is being woken is left to the clock — test: `unit:audio/conductor/conductor.test.ts:a change of state while the sound wakes is left to the clock`
- ✓ A call or interruption stops it (2875, 2879) — test: `unit:audio/conductor/conductor.test.ts:a call or interruption stops it by itself`
- ✓ Restarting reports what is true now, never a blanket "rebuilt" (6769-6779) — test: `unit:audio/conductor/conductor.test.ts:after a failed start, only the next tap rebuilds`
- — Only one rebuild at a time, "busy" (3166-3168). In the new app one tap starts one session, so two rebuilds can't overlap.
- ✓ A second try after a failed rebuild: the dead sound closed, 600 ms, one more; on the same tap, never a third (3195-3204; Robert, 22 Oct) — test: `android:second-try`, `android:second-try-once`
- — The headset going in or out re-judges the clock at once (3240-3248). In the new app the watchdog judges every 250 ms while anything plays.

### What leaves the app

- ✓ Overlapping sounds never clip: the old app had a limiter, measured at 1.796 with three notes (992-1012) — test: `takes:take-no-clip` (fixed 12 Oct: a take at full voice over the voice and music measured 1.10 at the speaker, 2.1 in the files)
- ✓ Measure what actually leaves the app, not what was scheduled (6644-6654) — test: `browser:start`
- ✓ One check of "working" used everywhere, so they can't disagree (6647-6648) — test: `unit:core/sound-check.test.ts:reads each row from what the phone says`
- ✓ The v9.8 loudness stage, as it was: in at 0.9, a compressor lifts the body (-12 dB, knee 6, ratio 3, 4 ms, 220 ms), 1.4 raises it all, a limiter holds the peaks (-3 dB, ratio 20, 1 ms, 60 ms) (991-1014; Robert, 23 Oct). Its tuning tests, loud.js and test_loud.js, are not in the repo — test: `loudness:song-loudness`, `unit:audio/engine-web/web-engine.test.ts:is the old app's v9.8 stage`
- — The keyboard levels (6276-6280). The new app has no synth or keyboard.
- ✓ Each song brought up to a proper level once: its loudest moment lifted to -1 dBFS, voice and music by the same gain, kept with the song; up, never down (Robert, 22 Oct) — test: `loudness:song-level`, `loudness:song-full`, `unit:core/song.test.ts:brings a song up, never down`, `unit:audio/conductor/conductor.test.ts:measures a song with no level kept`, `unit:audio/conductor/conductor.test.ts:uses the level kept with the song`
- ✓ Peaks held under -1 dB, between the samples too, with everything at 100: a ceiling after the limiter (Robert, 23 Oct; it withdraws 22 Oct's "nothing changes below 0.9") — test: `loudness:peaks-held`, `android:no-clip`, `takes:take-no-clip`, `unit:audio/engine-web/web-engine.test.ts:never reaching -1 dBFS`
- ✓ "Test without mic": let the mic go, wait for the phone to settle, make the sound anew, and say plainly whether it came back (6783-6824; Robert, 13 Oct) — test: `android:test-without-mic`, `unit:audio/conductor/conductor.test.ts:"Test without mic": lets the mic go`
- — Test sound into a muted channel, the phone's call volume (6693-6696, 6737-6741). Not in the new app: its Sound check plays one note at a fixed level.

### Playing notes and songs

- ✓ Song position comes from the sound's clock, not wall time (1180-1184) — test: `unit:audio/conductor/conductor.test.ts:knows where the song is, on the one clock`
- ✓ Parts of one song start together and stay together (23787-23816: the old app re-synced two players every 400 ms) — test: `unit:audio/conductor/conductor.test.ts:starts both parts together`, `song:sum-matches`
- ✓ Repeat a part, back 10 s and seeking start again from the right place (1194-1211) — test: `song:controls`
- ✓ One press, one note: a second press while it sounds is ignored (22372-22390) — test: `unit:audio/conductor/conductor.test.ts:ignores a repeat press on what is already going`
- ✓ The reference note is a real piano, corrected to its measured pitch (23330-23373) — test: `unit:core/piano.test.ts:puts the measured C4 sample exactly on C4`
- ✓ A note file that fails to load is said, never silence (1099-1101, 23336-23337) — test: `android:load-fails` (the old app played a synth note instead; the new one says "It didn't load. Tap Start to try again.")
- — The scheduler, the count-in clicks, the synth piano and voice, the keyboard trainer, packs, the map preview (76-113, 1025-1236, 4239-4273, 7546-7635). The new app has none of these.

### One thing at a time, and leaving

- ✓ One owner of sound; starting something stops what was going (11199-11235) — test: `unit:audio/conductor/conductor.test.ts:stops what was going before starting something else`
- ✓ Nothing starts while the app is hidden (11214-11220, 11276-11292) — test: `unit:audio/conductor/conductor.test.ts:will not start while the app is hidden`
- ✓ A finished background job never starts sound by itself (25173-25179) — test: `unit:audio/conductor/conductor.test.ts:coming back, and everything that was waiting finishing, starts nothing`
- ✓ Leaving by tab, back button or hiding stops it for good (25051-25086, 20097-20113, 22311-22320) — test: `browser:tab-switch-note`, `browser:back-while-running`, `song:song-leave`, `song:song-hidden`
- ✓ Nothing starts until Start is pressed (25710-25729) — test: `browser:nothing-before-start`
- ✓ A stop during the start is a stop (25315, 15930-15956) — test: `unit:audio/conductor/conductor.test.ts:a count-in that ends after leaving plays nothing`
- — Sleep pauses Learn a song and resumes it later (25088-25114). Replaced by RULEBOOK 2.1: hiding the app means silence, and nothing resumes by itself.
- ✓ A 3-2-1 count-in on Start, shown on the note map, at the song's tempo when it is known, else one a second; back 10 s and repeat this part don't count in; the take's timing is unaffected (25310-25333; Robert, 13 Oct) — test: `android:count-in`, `unit:audio/conductor/conductor.test.ts:counts 3, 2, 1, a beat each`, `unit:core/song.test.ts:counts in at the song`, `takes:take-lines-up`

### Timing

- ✓ The speaker's delay is taken off each line at its own source, never counted twice (2540-2553, 2585-2592) — test: `notemap:placement`, `takes:take-lines-up`
- ✓ A speaker delay of half a second or more is not believed (2551) — test: `unit:audio/engine-web/web-engine.test.ts:is not believed at half a second or more` (fixed 12 Oct: any reading was trusted)
- — A hand-set mic delay (22097-22128). The new app measures, and is checked to ±30 ms.

## 2. The microphone

- ✓ Ask for the mic ONCE, raw: echo cancellation, noise suppression and auto gain off (exact), lowest latency (1322-1333, 1410-1418). Corrected 21 Oct: this list had ticked the v8.1 ladder ("ask down a ladder, remember what worked"), which the old app withdrew in v9.4; on Robert's Samsung with a USB-C headset the sound stopped — test: `android:mic-once-raw`, `unit:audio/engine-web/web-engine.test.ts:asks for the raw mic exactly`, `unit:audio/conductor/conductor.test.ts:asks once on each Start, for the raw mic`
- ✓ No automatic ladder and no remembered mode: a mic that fails is said, and asked for raw again next time — test: `android:no-ladder`, `unit:audio/conductor/conductor.test.ts:never moves to another mode by itself`
- ✓ Other modes only by a hand tap ("Try another mode" in the Sound check), and only that choice is remembered; the old ladder's remembered rung is forgotten (1326-1327, 1559-1574) — test: `android:mode-by-hand`, `unit:audio/conductor/conductor.test.ts:another mode only by a hand tap`, `unit:audio/conductor/conductor.test.ts:forgets the rung the old ladder remembered`
- ✓ Ask once; silence is not a reason to ask again (1410-1418) — test: `android:ten-starts`, `android:mic-once-raw`
- ✓ Release our own microphone before asking again (1393-1404) — test: `android:ten-starts`
- ✓ Permission refused: say so, and "Carry on without it" (1998-2005, 572) — test: `browser:mic-refused`, `notemap:mic-refused`
- ✓ Another app holding the mic, by error or by a muted track: said plainly (2007-2018, 1359-1370) — test: `android:mic-held`, `unit:audio/conductor/conductor.test.ts:says plainly when another app has the mic`
- ✓ A track already muted when it opens counts as held (1365) — test: `unit:audio/conductor/conductor.test.ts:says plainly when another app has the mic`
- ✓ "Mic live" only when the track is live and not muted (2105-2116) — test: `unit:audio/conductor/conductor.test.ts:says plainly when another app has the mic`
- ✓ No microphone found: said (2040-2047) — test: `unit:core/sound-check.test.ts:offers "Carry on without it"`
- ✓ DuckDuckGo's browser won't give the mic: name the browser and the one that works (16174-16228) — test: `browser:duckduckgo` (fixed 12 Oct: it said "No microphone")
- ✓ The microphone opens before the sound (1421-1428) — test: `android:mic-first`
- ✓ Never stack input graphs (1338-1346) — test: `android:ten-starts`
- ✓ The engine rebuilt: the same stream re-attached, never asked for again (3211-3214) — test: `android:hear-yourself-rebuilt`
- ✓ Released when the app is hidden or closed (2982-3063) — test: `browser:hidden-listening`, `notemap:mic-hidden`
- ✓ On return, no automatic request and no loop (2996-2999) — test: `unit:audio/conductor/conductor.test.ts:a mic that opens after leaving is closed again at once`
- ✓ The microphone check on screen: on, hearing, which mic, held by another app (1531-1547) — test: `browser:start`
- ✓ Hear yourself hangs off the one mic, straight to the speaker, off unless singing (1271-1293, 22510-22539) — test: `notemap:hear-yourself`, `unit:audio/conductor/conductor.test.ts:"Hear yourself" sounds only while singing`
- ✓ Hear yourself is headphones only (1312, 7370-7371) — test: `notemap:hear-yourself`
- ✓ Hear yourself has its own volume, remembered (22455-22500). Robert, 22 Oct: a slider under the switch, 0 to 100, 70 at first, rounded off so it can't clip (the old app went to 200%); 23 Oct: three times the raw mic at 100, down from four; then six (about +15.6 dB), to stay about 3 dB over the louder music — test: `loudness:monitor-level`, `unit:core/song.test.ts:is off at 0, six times the mic (about +15.6 dB) at 100`
- ✓ Hear yourself is set whenever the switch moves, and kept while the song starts (22525-22532, the gate) — test: `loudness:monitor-count-in`, `loudness:monitor-before-start`, `unit:audio/conductor/conductor.test.ts:switched on during the 3-2-1 sounds as the song starts`
- ✓ Hear yourself kept attached across rewires (1358, 3182) — test: `loudness:monitor-after-rebuild`, `android:hear-yourself-rebuilt`
- ✓ The mic wired again a moment after the phone gives it back, or it can stay live and silent (1371-1374) — test: `loudness:monitor-unmute`
- ✓ The Hear yourself switch itself remembered between visits (1318-1320; Robert, 23 Oct) — test: `loudness:monitor-remembered`, `notemap:hear-yourself`
- ✓ While singing, "Use headphones." unless the phone lists some (25216-25238; RULEBOOK 4, Mic) — test: `android:use-headphones` (fixed 12 Oct: it only showed once, the first time Hear yourself was switched on)
- ✓ One microphone, one recorder (15052-15055) — test: `unit:audio/conductor/conductor.test.ts:keeps what the mic hears, from where in the song`
- ✓ Nothing recorded means nothing kept (5020, 15356) — test: `unit:audio/conductor/conductor.test.ts:keeps nothing heard before the song`
- ✓ A take not kept is thrown away only with Undo (15044-15045) — test: `takes:take-removed-undo`
- ✓ The mic's own delay taken off at its source (2520-2539) — test: `notemap:placement`
- ✓ "Device busy": let go and ask once more after 400 ms, because Android hands the mic back a beat late (1405-1408, 1463-1469). Robert, 13 Oct: only on the Start tap, once; never by itself (his Android rule 6 stands). Still held: "Another app is using the microphone. Tap Start to try again." — test: `android:held-retry`
- ✓ The phone's own mic: chosen in the Sound check, picked by device id and used on the first request from then on (kept on the phone, as the old app's rep_micdev), so the capture device never switches when a headset goes in; which mic is in use is said; "Let the phone choose the mic" undoes it (1429-1450; Robert, 13 and 21 Oct) — test: `android:phone-mic`, `unit:audio/conductor/conductor.test.ts:"Use the phone's own mic" is a choice`
- ✓ The chosen mic's id is written down before it is opened and cleared after; a mic that took the phone down is dropped, said once, and never chosen again by itself (1444-1449, 1512-1528) — test: `android:mic-crash`, `android:phone-mic`
- — A mic picker anywhere else (5977-5980). Not in the new app: Robert, 13 Oct, no general mic setting.
- — In-app browsers and plain http (1969-1997). Not in the new app: it is only served over https, and in-app browsers aren't tested.
- — The noise gate calibration, the mic chips (1576-1643, 6717-6727). Not in the new app.
- — Timed exercises start at the first sound (9058-9137). Not in the new app yet: exercises aren't built.
- — Hold the mic while a take records in the background (2994-3013). Replaced by RULEBOOK 2.1: hiding ends the take, and it's kept to decide on (`takes:take-leave`).

## 3. Pitch reading

- ✓ One reader for files and the microphone, the old app's own (24186-24191, 1712-1715) — test: `unit:audio/pitch/core.test.ts:gives the mic the same note at the same time as the file`
- ✓ YIN exactly as the old app: the dip under 0.15, the clarity gate, 60-1400 Hz (the shortest lag is what stops it at the top; the 1400 Hz cap itself never decides), the interpolation (1716-1754) — test: `unit:audio/pitch/old-app.test.ts:reads exactly what the old app's yinHz reads` (new 12 Oct: compared with next.html's own code)
- ✓ The loudness and clarity gates at the old app's default setting (1589-1602, 1642) — test: `unit:audio/pitch/old-app.test.ts:gates at the old app's default setting`
- ✓ A reading is dated where YIN reads, not the middle of the window (24216-24236) — test: `unit:audio/pitch/old-app.test.ts:dates a file's reading where the old app does`
- ✓ The octave anchor: a sure model (0.5), more than 4 semitones away, moved by whole octaves to within 1.5 (1760-1768, 24406-24411) — test: `unit:audio/pitch/old-app.test.ts:moves a note onto the model's octave only as the old app does`
- ✓ Twenty points a second, a 4096-sample window, an anchor every 0.22 s (24211-24213) — test: `unit:audio/pitch/core.test.ts:reads a file in pieces exactly as in one go`
- ✓ Median of five, never across silence (1758-1772) — test: `unit:audio/pitch/core.test.ts:changes note when the sound does` (the new app centres it: measured better in the bake-off, RULEBOOK 5)
- ✓ Reading in pieces gives exactly what one read gives (24426-24429) — test: `unit:audio/pitch/core.test.ts:reads a file in pieces exactly as in one go`
- ✓ The model can't be dropped: it corrects the octave of about 5% of points (24256-24259) — test: `notemap:line-follows`
- ✓ Shared over up to 4 workers, first notes back quickly, Start never waits (24326-24327, 24380-24387, 24599-24600) — test: `notemap:line-shared`, `song:line-first30`
- ✓ Read as soon as there is a voice, from the start, showing real progress, never 0% (24500-24513, 24719-24725) — test: `notemap:line-read`
- ✓ A stored line is versioned; a line read another way is read again (24214, 24239-24244) — test: `notemap:reopen-line`
- ✓ Gaps of 0.15 s or less bridged, only with a voice both sides and within 6 semitones; silence never (24797-24835) — test: `unit:audio/pitch/line.test.ts:bridges a gap of 0.15 s`, `unit:audio/pitch/line.test.ts:leaves a longer gap, a big leap, and the ends alone`
- ✓ The line on the phone follows the voice as well as the old app's measured (RULEBOOK 5) — test: `notemap:line-follows`
- ✓ The line breaks on a leap over 6 semitones or a gap over 0.15 s (3449-3455) — test: `unit:core/notemap.test.ts:lifts the pen across gaps and big jumps`
- — The view is pinned before Start and the mic can't move it (2471-2518, 25149-25166): Replaced by one map everywhere (Robert, 22 Nov), below; the mic still can't move it.
- ✓ ...never so tight the lanes fuse nor so wide nothing reads: 14 to 36 semitones (2475-2478) — test: `unit:core/notemap.test.ts:is never so tight the lanes fuse` (fixed 12 Oct: a narrow song could pin to 6 semitones)
- ✓ The exact octave by default, with an "Any octave" switch (25361-25365) — test: `notemap:octave-switch`, `unit:core/takes.test.ts:in the singer's octave unless "Any octave" is on`
- ✓ ...remembered on the phone (24975, 25024-25029) — test: `android:any-octave-kept` (fixed 12 Oct: it reset every visit)
- ✓ A note is right within half a semitone, one rule for the map and the score (25366-25375) — test: `unit:core/takes.test.ts:is right within half a semitone`, `takes:take-review` (the old app used one semitone and half the note's length; RULEBOOK 4 settled half a semitone)
- — Bubbles: cutting notes, rounding, scoops, fill (24841-24919, 25570-25627). Replaced by RULEBOOK 1b: no bubbles on Learn a song.
- — The old song analyser, the map editor, MIDI import, key detection, room listening, the voice-only sniff (882, 4080-5395, 1776-1851, 23949-24108). Not in the new app.
- — Live CREPE every 220 ms in its own worker (1674-1686). The new app reads the mic with the file's own code, so the anchor comes every 0.22 s of sound.
- — Scoring rules for exercises and games (3255-3332, 3792-4018, 9426-9445, 23149). Not in the new app yet: exercises aren't built.

## 4. Learn a song

- ✓ One screen; leaving by any route stops it for good (25051-25086) — test: `song:song-leave`, `song:song-hidden`, `browser:back-while-running`
- ✓ Start does nothing if it's already playing (25275) — test: `unit:audio/conductor/conductor.test.ts:ignores a repeat press`
- ✓ One sound in the headphones at a time, and none while hidden (25283-25285) — test: `unit:audio/conductor/conductor.test.ts:is one source: a note started over it stops the song`
- ✓ The song is read as soon as it's added, progressively, without blocking (24771-24787, 24380-24387) — test: `song:line-first30`, `notemap:line-read`
- ✓ A song opened while still being read shows its progress, not an empty map (25186-25187, 25551-25556) — test: `notemap:line-read`
- ✓ Only what has been read so far is shown; an old line is never shown under the singer (25468-25474) — test: `notemap:reopen-line`
- ✓ The singer and the music each have a slider, live while playing, starting at 100% (25240-25267) — test: `song:sliders`
- ✓ Your line is the mic on the song's clock, minus each delay (25500-25514, 2612-2619) — test: `notemap:placement`
- ✓ The title is the singer's own file name, wrapped, never cut (24996-25001) — test: `library:long-title`, `unit:core/song.test.ts:makes a title from the file name`
- ✓ A song that can't be stored says so; it's never claimed as added (23613, 23699-23709) — test: `song:add-fails` (fixed 12 Oct: Save stayed on "saving" for ever)
- ✓ Storage missing, refused or silent for 3 s is said (5411-5433) — test: `library:no-storage` (fixed 12 Oct: it showed "No songs yet.", or nothing)
- ✓ A song with no sound says so (25036) — test: `unit:core/song.test.ts:says what to do about each problem`
- ✓ A song that can't be read says so (25199-25200) — test: `unit:core/song.test.ts:says what to do about each problem`
- ✓ Use headphones while singing (25216-25238) — test: `android:use-headphones`
- ✓ Any octave is remembered (24975) — test: `android:any-octave-kept`
- ✓ Takes on this screen are recorded, kept, sent and played back in place (21098-21099) — test: `takes:take-review`, `takes:take-lines-up`
- — Built-in songs, two files split by hand, Listen to the room, the founders' lock (23505-23710, 24023-24108). Not in the new app: songs are split by the server (`song:split-progress`).
- — Wait to start until reading is 8 s ahead; "Catching up…" (24515-24516, 25655-25679). In the new app the song plays straight away and the singer's line draws as it's read (`song:first30-early`).
- — A stop resets to the beginning; scores at the end (25336-25434). Replaced by RULEBOOK 1b: Start and Pause on a play bar, and right notes on each take.
- — Sleep pauses and resumes (25088-25114). Replaced by RULEBOOK 2.1: hiding the app means silence.
- ✓ A 3-2-1 count-in on Start, shown on the note map, at the song's tempo when it is known, else one a second; back 10 s and repeat this part don't count in; the take's timing is unaffected (25310-25333; Robert, 13 Oct) — test: `android:count-in`, `unit:audio/conductor/conductor.test.ts:counts 3, 2, 1, a beat each`, `unit:core/song.test.ts:counts in at the song`, `takes:take-lines-up`

### Robert's song features (approved 16 Nov; built 27 Nov while he travelled)
- ✓ A song's lines, worked out from the singer's line the app read from the song's own voice (nothing sourced): a silence of 0.45 s ends a line, a line under 1.5 s joins its nearer neighbour, one over 8 s is cut at its longest breath; each played from 0.5 s before its first note to 0.4 s after its last, never into the line before or after. Measured on two real songs (tests/lab-lines.mjs) — test: `unit:core/nov27.test.ts:a song's lines, from the singer's line`
- ✓ Practise a line, reached from Learn a song by a tap, with a way back; the line picked on the song's timeline, the next, the one before, or a longer stretch with the next line added on; the line kept on the phone and shared with Speak it, then sing it — test: `songlines:line-door`, `songlines:line-pick`, `unit:core/nov27.test.ts:picking the line`
- ✓ Three steps, in order, each sung twice: the notes on a light "da"; an exercise sound, Train's own (Lip trills, Mum, Straw singing) with Train's own words; the words, as easily as on the sound. One Start: a count-in, then the line twice, each time exactly the line — test: `songlines:line-twice`, `songlines:line-steps`, `unit:core/nov27.test.ts:the steps and sounds, as Robert gave them`
- ✓ Each pass scored on its own, as Learn a song scores a take (half a half step, Any octave as set), only on the notes inside the line; sung right 80% or more, sung seven seconds off 2%; a pass stopped before is "not sung", and the next step waits for both — test: `songlines:line-scored`, `songlines:line-off`, `songlines:line-each-pass`, `songlines:line-stop-early`, `unit:core/nov27.test.ts:Practise a line: three steps, each sung twice, each pass scored`
- ✓ The singer's line against the song's on Learn a song's map (the same spacing, sliding, never zooming); after the third step, the next line or a longer stretch, starting again from the first step — test: `songlines:line-scored`, `songlines:line-next`
- ✓ Leaving mid-line: silence and the mic closed at once — test: `songlines:line-leave`
- ✓ Speak it, then sing it, on the same line: the singer speaks the words in time with the song, then sings them the way they spoke them; each recorded over the line once, kept on the phone straight away, and played back to back, spoken first; nothing scored, no map, and nothing says which is better; no mic says so — test: `songlines:speak-door`, `songlines:speak-pair`, `songlines:speak-back-to-back`, `songlines:speak-kept`, `songlines:speak-no-score`, `songlines:speak-no-mic`, `unit:core/nov27.test.ts:Speak it, then sing it scores nothing`
- ✓ The first take saved of each song is marked Before; another can be chosen, kept on the account in its own table that only the singer can read or change (script in scripts/db, 27 Nov), so it follows them to a new phone; the chosen one deleted, the first is the Before again — test: `songlines:before-first`, `songlines:before-choose`, `songlines:before-private`, `songlines:before-new-phone`, `songlines:before-falls-back`, `unit:core/nov27.test.ts:the Before`
- ✓ Any later take next to the Before: both lines on the map (the Before dashed), played together over the music where both were sung, either heard, switched without stopping; two takes from different parts of the song say so — test: `songlines:before-compare`, `songlines:before-hear-either`, `songlines:before-apart`
- ✓ Both pages fit at 390 and 360 wide with every button at least 44 px, and every word on them is from the copy — test: `songlines:pages-360`, `songlines:pages-words`

## 5. Train (read 23 Oct: next.html 3672-4024, 7652-8134, 8992-9240; src/rp-train.js, rp-flow.js, rp-range.js, rp-sus.js, rp-cloud.js 870-905, rp-score.js)

### The exercises and routines
- ✓ Every exercise of the old app's library, as data, with its group, level and quiet flag (7686-8099) — test: `unit:core/exercises.test.ts:has every exercise of the old app`, `unit:core/exercises.test.ts:keeps each one's group, level and quiet flag`, `train:train-tab`
- ✓ Each one runs as the old app ran it: its pattern and tempo, a held note's length, the hiss's target, the breath counts (7686-8099) — test: `unit:core/exercises.test.ts:runs each one the way the old app did`
- ✓ The melodic patterns (8063-8075), their notes as the old app's; every note of a round the same length, the top and the last included (Robert, 23 Nov; the old app held them twice as long) — test: `unit:core/exercises.test.ts:runs each pattern's notes as the old app did`
- ✓ The routines and cool-down, in the warm-up order every source agrees on (8100-8125) — test: `unit:core/exercises.test.ts:has the old app's routines and cool-down`, `train:routine`
- ✓ Every exercise says what the app can and cannot measure; nothing scored that was not measured (7672-7684, scoreNote) — test: `unit:core/exercises.test.ts:says what it measures, and only that`, `train:preview`, `train:cycle`, `train:guided`
- ✓ Groups by colour (1b): Warm-up orange, Breath teal, Tone pink, Agility blue; Range in Agility's blue (Robert, 23 Oct) — test: `unit:core/exercises.test.ts:has its seven groups by colour`, `train:train-tab`, `train:category`
- ✓ Train's one goal is to start today's warm-up in one tap (RULEBOOK 3; Robert, 24 Oct): the warm-up card with Start and one line to the other routines, then the five groups as cards with a picture, nothing else; a group's list and the other routines one tap away — test: `train:train-tab`, `train:routines-page`, `unit:core/screens.test.ts:as the first line of its file`
- ✓ A group's list: the rows with the level, Quiet and what is measured; the range check's row shows your range (Robert, 24 Oct) — test: `train:category`
- ✓ A sixth group, Articulation (clear words while singing), in a colour of its own, yellow, with its card and picture and its own list; its exercises in our own words, each with notes and scored on pitch, the syllables carried on note by note (Robert, 25 Oct) — test: `unit:core/exercises.test.ts:has its exercises, each with notes and so scored on pitch`, `unit:core/exercises.test.ts:the five vowels sit on one held note`, `unit:core/exercises.test.ts:a tongue twister fits its pattern exactly`, `unit:core/exercises.test.ts:consonant pops are short repeated notes`, `train:train-tab`, `train:category`, `train:articulation`
- ✓ Agility's picture is a quick run on a staff: five faint staff lines (35%), five solid dots each on a different line or space, one smooth curve through them, in Agility's blue and the same stroke weight as the other pictures (Robert, 27 Oct; it replaces the hummingbird of 25 Oct) — test: `train:train-tab`
- ✓ The top card is Today: what to sing next, its name, length and Start, with More routines under it; read from one source asked in order: a coach's assignment, a program's day, the singer's own plan, which falls back to the daily warm-up; a source that fails is passed over (Robert, 27 Oct) — test: `unit:core/today.test.ts:a coach's assignment comes first`, `unit:core/today.test.ts:with nothing from any of them, it is the daily warm-up`, `unit:core/today.test.ts:a source that fails is passed over`, `train:train-tab`, `train:today`
- ✓ The why, watch-for and care paragraphs (7686-8099), in the old app's words, behind "More about this" on the exercise page (Robert, 24 Oct); the preview itself keeps 1b's one-line goal and how — test: `train:more-about`, `unit:core/copy.test.ts:only the explanations under copy.about are prose`
- — The myth, note and dispute paragraphs (7686-8099). Not in the new app: Robert asked for why, watch for and care.
- — A level filter, and "never offer an empty level" (rp-train.js 66-76). Not in the new app: 1b shows groups, not levels; each exercise's level is on its row in the group's list (Robert, 24 Oct: off the exercise page).
- — The pitch tools Keyboard and Hold the interval, and the degree drills (rp-train.js 34-46). Not in the new app yet: Robert asked for Sing the interval, Match the note and Hold the note (28 Oct).

### The Pitch group (Robert, 28 Oct; read next.html 3790-4010, 19626-19629, 22998-23140)
- ✓ A seventh group, Pitch, in Agility's blue (blue means pitch, RULEBOOK 1b), with its card, its picture and its list — test: `unit:core/exercises.test.ts:has its seven groups by colour`, `train:train-tab`, `train:category`
- ✓ Sing the interval: a note plays, then a shape is sung from it, shown in words ("A fifth up", "Up the chord: 1, 3, 5"); ten shapes a round, every note in the singer's range; scored like every bubble, octave exact unless Any octave (Robert, 28 Oct) — test: `unit:core/pitch.test.ts:a note plays, then the shape is sung from it`, `unit:core/pitch.test.ts:every note of every shape sits in the singer`, `unit:core/pitch.test.ts:shows each shape in words`, `train:interval`
- ✓ Its levels: a step, 1-5 and an octave; then a third and 1-3-5 as well; then a fourth, sixth, seventh and the shapes downward too; picked in the sound sheet and remembered (Robert, 28 Oct) — test: `unit:core/pitch.test.ts:shapes by level`, `train:interval-level`
- ✓ The note map shows the whole turn at once: the note heard first (hollow, never scored) and every note to sing, so the next note is seen before it comes; fitted to the turn as the ladders fit the rung (Robert, 28 Oct) — test: `train:interval-view`
- ✓ Match the note, as the old app had it: ten notes, from one above the bottom of the range to one below the top, never the same twice running; the note plays, then is sung back (3800-3816) — test: `unit:core/pitch.test.ts:ten notes from one above the bottom`, `train:match`
- ✓ Match the note's hit: held 1.2 s within a semitone (3790, 3850-3856); here, half of a 2.4 s bubble, the bubbles' own rule — test: `unit:core/pitch.test.ts:a hit is holding it 1.2 s within a semitone`, `train:match`
- — Match the note's any octave always, its Replay and Skip buttons, its moving on 0.9 s after a hit, and its "Nearly every one" messages (3840-3880). The new app: octave exact unless Any octave (RULEBOOK 4, Pitch); the singing screen's own controls (1b); a fixed time per note; only what was measured.
- ✓ Hold the note, as the old app's Hold a note: ten notes, every third out at an edge of the range, the others three in from each end, never the same twice running (3909-3925) — test: `unit:core/pitch.test.ts:ten notes, held five seconds each`, `unit:core/pitch.test.ts:every third note out at an edge`
- ✓ Its rule: the note plays, then is held five seconds; held when 70% of that is within 35 cents (3976-4010) — test: `unit:core/pitch.test.ts:held when 70% of the five seconds is within 35 cents`, `train:hold-note`
- ✓ After each note it waits for Next; nothing moves on by itself (Robert, 1 Oct; 3955-3970) — test: `train:hold-note`
- — Hold a note's any octave always and its "Rock solid" messages (3990-4010). The new app: octave exact unless Any octave; only what was measured.

### The content round (Robert, 28 Oct; his audit of 27 Oct)
Sources: the audit doc names a source for each; it was not reachable from this session, so only Stemple is cited here, and the rest wait on the doc.
- ✓ Octave leaps is a true leap, 1-8-1 on "ma" (the old app's own Octave Leaps ladder, next.html 3704) — test: `unit:core/exercises.test.ts:Octave leaps is a true leap`, `train:content`
- ✓ Each tongue twister fits its pattern exactly: a syllable a note, the phrase ending on the last note, the same every repeat (Red leather and Peter Piper on 1-2-3-5-3-2-1; Unique New York said twice, on 1-2-3-5, 5-3-2-1) — test: `unit:core/exercises.test.ts:a tongue twister fits its pattern exactly`, `train:content`
- ✓ Long soft notes is Stemple's four steps, each twice: "ee" held on F4 or F3; a slide up and a slide down on "knoll"; "ol" held on C, D, E, F and G from C4 or C3; higher or lower from the singer's range; steps 1 and 4 timed and shown (Stemple, Lee, D'Amico and Pickup, "Efficacy of vocal function exercises as a method of improving voice production", Journal of Voice 8(3), 1994) — test: `unit:core/pitch.test.ts:higher voices on F4 and from C4`, `unit:core/pitch.test.ts:the four steps in order, each twice`, `train:long-soft`
- ✓ Bratty Bay dropped (it was Octave repeat's pattern); its saved results stay in the results list; Octave repeat takes its place in the advanced routine — test: `unit:core/exercises.test.ts:has every exercise of the old app`, `unit:core/exercises.test.ts:has the old app's routines and cool-down`, `train:content`, `train:bay-results`
- ✓ Loo, sung on "loo"; Straw says what you'll need ("A thin drinking straw.", Robert 3 Nov); Agility's staff lines at half the stroke — test: `unit:core/exercises.test.ts:Loo is sung on "loo"`, `train:content`, `train:train-tab`
- ✓ New exercises, in our own words: Buzzing, Raspberry slide (unscored), Tongue trill; Breath pulses (guided); Goo, Guh; the runs on "my" (Five-note run, Five-note minor run, Skipping run, Half-step run, Little turns), now with a speed for each level (Robert, 4 and 13 Nov); Big climb — test: `unit:core/exercises.test.ts:the new exercises: their groups, levels, patterns and syllables`, `unit:core/exercises.test.ts:the buzz is a repeat on`, `unit:core/exercises.test.ts:the runs have a speed for each level`, `train:category`

### Running an exercise
- ✓ Nothing starts until Start: no sound, clock or mic before the tap (rp-flow.js 1-20; Robert, 1 Oct) — test: `train:start-only`, `train:preview`
- ✓ A routine never moves on by itself: after a step, "Next: ..." and End session; the next step opens paused; ending returns to where it began (rp-flow.js 1-20; Robert, 1 Oct) — test: `train:routine`
- ✓ The ladder: from one note above the bottom of your range, a half step a rung, up to where the pattern fits, at most 14 rungs, two beats' rest (3700-3752) — test: `unit:core/exercises.test.ts:for every pattern, from one above your lowest`, `train:range-used`
- ✓ Each rung's first note carries its note name and the syllable; the rest the syllable (3725-3730) — test: `unit:core/exercises.test.ts:carries each note's syllable`
- ✓ The syllables on each note follow the old app's syl strings: "la-ga la-ga" alternates la and ga a note, la first each repeat; "mmm / nnn / ng" is one hum a repeat; "a · b" lists other ways to sing it, and the first is sung (tongue-out on "uh", its own how); the old ladder printed the first token on every note, which Robert asked to change (Robert, 27 Oct) — test: `unit:core/exercises.test.ts:La-Ga alternates one syllable a note`, `unit:core/exercises.test.ts:the three hums change with each repeat`, `unit:core/exercises.test.ts:every sung syllable comes from the old app`, `train:syllables`
- ✓ The reference is the shipped piano, any note played on the nearest sample, retuned (7611-7616; Robert, 23 Oct) — test: `unit:core/piano.test.ts:plays any other note on the nearest sample`, `train:range-used`
- ✓ The exercise page (Robert, 24 Oct; 3 Nov): back, the name, the plain line, its group as the only tag, You'll need, the pattern card, How to do it, Start; the pattern's notes played only on the card's button, the piano alone, no mic; the current note lights and its syllable shows under the notes — test: `train:preview`, `unit:core/exercises.test.ts:the first rung is the pattern alone`
- ✓ The pattern card draws each note as a short dash at its pitch height, like a melody line, wider for longer; nothing between the card and Goal (Robert, 25 Oct) — test: `train:preview`
- ✓ How says what to do with the body, breath or mouth, in one plain sentence up to 14 words, never which sound or how many notes; How lines alone are exempt from the eight-word cap (Robert, 25 Oct; for exercises with numbered steps, the 3 Nov spec replaces this rule) — test: `unit:core/copy.test.ts:say what to do with the body, breath or mouth`, `unit:core/copy.test.ts:a How line may run to 14 words`
- ✓ The proper name is the title (Vocal Function Exercises, Messa di voce, Pentatonic run...), the plain-words name a small line right under it, on the exercise page and in the group's list; no "Also called" lines (Robert, 28 Oct; it replaces 27 Oct's plain names as titles) — test: `unit:core/copy.test.ts:the proper names are the titles again`, `unit:core/copy.test.ts:no "Also called" lines`, `train:titles`, `train:more-about`
- ✓ Plain words: no singer jargon a beginner wouldn't know in the plain name, Goal or How; the title is exempt, and a jargon title has a plain name under it (Robert, 27 and 28 Oct) — test: `unit:core/copy.test.ts:no singer jargon in a plain name, goal or How`, `unit:core/copy.test.ts:catches a word a beginner would not know`
- ✓ The gear's sound sheet: Any octave (off at first, remembered for this exercise alone), Count-in sound, Hear yourself and its volume (Robert, 24 Oct) — test: `train:sound-sheet`
- ✓ A 3-2-1 count-in before singing (1b; Robert, 13 Oct) — test: `train:start-only`
- ✓ The count-in sound: a short, soft beep on each of 3, 2, 1, through the conductor; one setting for every count-in in the app, on at first, remembered, in the exercise's sound sheet and the song's sound card; never after Close, never in a score or a take (Robert, 24 Oct) — test: `train:count-in-sound`, `song:count-in-sound`, `unit:audio/conductor/conductor.test.ts:beeps once on each of 3, 2, 1`, `unit:audio/conductor/conductor.test.ts:beeps not at all when switched off`, `unit:audio/conductor/conductor.test.ts:never sounds after Close`, `unit:core/beep.test.ts:is a short, soft sound file`
- ✓ The singing screen (Robert, 24 Oct): the note map fills the screen, the ladder of note names at the left, every bubble with its syllable, the current one bigger with the ring, the dots along the bottom one per rung — test: `train:singing-screen`, `unit:core/exercises.test.ts:knows which rung is being sung`
- ✓ The map is zoomed to the notes of the rung being sung, about three semitones of room above and below, and glides smoothly as the pattern climbs; the bubbles bigger to match (Robert, 25 Oct) — test: `train:singing-screen`
- ✓ While singing, every singing screen has the same controls, built once, placed in one layout that can move without touching an exercise: Pause, Restart, the gear and Close (1b; Robert, 28 Oct; it replaces "close is the only control"); closing is silence and the mic closed at once (RULEBOOK 2.1) — test: `train:start-only`, `train:close`, `unit:core/screens.test.ts:every singing screen through the one layout`
- ✓ The map is smaller to make room for the controls; the dots stay (Robert, 28 Oct) — test: `train:singing-screen`
- ✓ A held note: one long bubble at a time, scored by the same rule (3908-4022) — test: `unit:core/exercises.test.ts:holds five notes`, `train:hold`
- — Hold a note's random notes, every third at the edge of your range (3909-3925). The new app holds five notes evenly through your range, so one run can be compared with the next.
- ✓ The timed hiss times itself from the first sound and stops after a second of quiet; the result stays; nothing starts after it (9110-9135; Robert, 1 Oct) — test: `unit:core/exercises.test.ts:times itself from the first sound`, `train:timed`
- ✓ The breath cycle: in, suspend, out, a count a second (9097-9110) — test: `train:cycle`
- ✓ A guided exercise: the how and a clock, Done, no invented score (9047-9100) — test: `train:guided`
- — The sirens' sine glide (9161-9180). The new app plays only the piano; sirens show your line, not scored.

### Pause, Restart and takes (Robert, 28 Oct; read next.html 6000-6130, the old exercise bar, and section 4's take rules)
- ✓ Pause stops the sound and the mic at once; its button then says Resume, as the old bar's said what it would do (6049-6055) — test: `train:pause-resume`
- ✓ Resume carries on from the start of the repeat it was in, with the count-in; nothing scored before it is lost — test: `train:pause-resume`, `unit:core/exercises.test.ts:knows which rung is being sung`
- — The old bar resumed from the very moment it was paused (6071-6080). The new app: from the start of the current repeat, with the count-in (Robert, 28 Oct).
- ✓ A part (Hold the note, Long soft notes), the hiss and a range step start again from their own start; a breath count's clock waits and carries on — test: `train:pause-others`
- ✓ Restart: from the first repeat, the score cleared, as the old bar's "From the top" (6083-6088) — test: `train:restart`
- ✓ The gear while singing opens the same sound sheet (Hear yourself and its volume, Any octave, Count-in sound); pausing to open it and resuming works, with what was set — test: `train:pause-gear`
- ✓ A sung exercise records the singer's voice while singing: the voice only, one mic one recorder, a stretch between pauses, joined into one take where each was sung (section 4) — test: `unit:audio/recorder.test.ts:a resume sung again from the repeat`, `train:ex-take`
- ✓ At the end, next to the score: Save take, Try again, Next; a take is kept on the phone first, then online, private to the singer, and works offline (section 4) — test: `train:ex-take`, `train:ex-take-offline`, `train:ex-take-online`
- ✓ Kept in the old takes table: its kind set to exercise, the exercise in its notes, no coach; the Sing tab's list of song takes leaves exercise takes out — test: `train:ex-take-online`, `train:ex-take`
- ✓ On the exercise page, one line "Your takes" opens its takes; each plays the voice over the exercise's piano notes in time; only heard for now (no send, no delete) — test: `train:ex-takes-page`
- — The old bar's Record toggle, "Pause take" and Listen (6062-6068, 6100-6110). Not in the new app: Robert asked for the voice recorded through every sung exercise and Save take at the end (28 Oct).
- ✓ Long soft notes: while holding, a small readout of the note being sung and how close, On the note, A bit high or A bit low, within half a semitone (the old app's interval card, 23146-23153) — test: `train:long-soft`

### The 3 Nov Train update (Robert's spec of 3 Nov and his answers to the plan; read next.html 18060-18200, the old body warm-up)
- ✓ The page: title, plain line, You'll need, How to do it as numbered steps, Start; behind More about this, You're doing it right when, Watch out for (the care points at its end, so nothing is lost), Why it helps — test: `train:page-layout`, `train:more-about`, `train:preview`
- ✓ The steps, doing it right, watch out and why are held to the banned words only, with no length cap; the jargon list still holds the plain line, You'll need and the steps; the plain line and You'll need run to 14 words, as How did — test: `unit:core/copy.test.ts:no singer jargon in a plain name, goal or How`, `unit:core/copy.test.ts:a How line may run to 14 words`, `unit:core/copy.test.ts:say what to do with the body, breath or mouth`
- ✓ The six rewrites (Slack-jaw La-Ga, Bratty Nay, Straw, Tongue-out singing, Mum, Messa di voce) with the spec's words, and every point of ours it did not list kept — test: `unit:core/exercises.test.ts:"How to do it" is the numbered steps`, `train:page-layout`
- ✓ Six new exercises in their places: Posture check and "Ah" tension check at the top of Warm-up, Cheek puffs and Chew and hum after Straw, Tongue-forward hum after Humming, Tongue-out bright "a" after Tongue-out with a crescendo; 55 in all — test: `unit:core/exercises.test.ts:the six new ones`, `train:category`
- ✓ A three-note pattern, 1-2-3-2-1, every note even (the last held until 23 Nov) — test: `unit:core/exercises.test.ts:a new three-note pattern`
- ✓ Levels inside La-Ga (1-2-3-2-1, five-note, Big climb's arpeggio), Bratty Nay (five-note Beginner, octave Intermediate) and Straw (the three), with their speeds; a level row in the gear's sheet, remembered for each exercise; the list row shows the span — test: `unit:core/exercises.test.ts:levels inside La-Ga`, `train:levels`
- ✓ A routine step uses its own level, capped at the exercise's top (Straw at Beginner in the Cool-down; since 4 Nov a level per step, the Advanced warm-up's straw and lip trills at Beginner) — test: `unit:core/exercises.test.ts:a routine step uses its own level`, `train:levels`, `train:routine`
- ✓ The spec's climbing exercises go up a half step every round with no 14-round cap; the rest of Train keeps the old app's 14, but Mum, which as his course's climbs a half step every round to the top and back down (Robert, 23 Nov) — test: `unit:core/exercises.test.ts:its climbing exercises go up a half step`, `train:climb`, `unit:core/exercises.test.ts:for every pattern, from one above your lowest`
- ✓ Straw, Cheek puffs, Chew and hum and the tension check: the line shown, not scored, and the list row says "Not scored" (Straw and Cheek puffs until Robert's straw test on a real phone: done 13 Nov, "the straw test was good", so both are scored now) — test: `unit:core/exercises.test.ts:says what it measures, and only that`, `train:line-only`
- ✓ The movement cue on Straw, Cheek puffs, Chew and hum, Tongue-forward hum and Mum, one line above the map, there from before the count-in so the map never jumps — test: `unit:core/tension.test.ts:the movement cue on its five exercises`, `train:cue-line`
- ✓ The "Ah" tension check: after the last round, "Tick where you felt tension." and the six spots; each tick kept as it is tapped, on the phone and then the account; a new check replaces the old ticks; stopped early, the list once a round was sung — test: `train:tension-ticks`, `train:tension-early`, `train:tension-online`
- ✓ The ticks online only the singer can read or change, on the server: not their linked coach, not anyone signed out — test: `train:tension-online`
- ✓ The reminders: at most one line, the cue winning on its five; rotating through the ticks that suit the exercise, one more each start; never one that contradicts it; none on Posture check, the tension check or Sing the interval — test: `unit:core/tension.test.ts:never a reminder that contradicts the exercise`, `unit:core/tension.test.ts:rotates`, `unit:core/tension.test.ts:none on Posture check`, `train:reminders`
- ✓ Posture check: its steps and a clock, about a minute, no pitch line, not scored; You'll need: a wall — test: `train:guided`
- ✓ Nothing on the body checks touches the front of the throat, no head is rolled backwards in a circle, nothing is held long (the old body warm-up, 18070-18160) — test: `unit:core/exercises.test.ts:the body checks keep the old app's body rules`
- — The old body warm-up's other parts: jaw circles, the back of the tongue, face and lips, and shaking (18130-18200). Not in the new app. Its neck stretch is in, as Neck and shoulder release (4 Nov), with no hand on the head, as the old one said (Robert, 13 Nov).

### The 4 Nov review, Robert's 13 Nov answers, and his 13 Nov phone finds (read next.html 18060-18200 again: the old neck stretch, "no hands involved")
- ✓ Next moves on to the next exercise in its group, by id, whatever level it is at: from the tension check to Lip trills, from Posture check to Neck and shoulder release (on his phone it went to Posture check, and there did nothing) — test: `unit:core/review.test.ts:is the next exercise in the group`, `train:next-moves-on`
- ✓ No button in Train is tapped and does nothing; one that can't act is disabled with a line saying what to do — test: `train:no-silent-taps`
- ✓ The menu at the bottom on every screen, exercises included; leaving by it stops the sound and the mic at once, keeps the rounds sung as a result without showing it, and Train opens its list; it fits at 360 px with Pause, Restart, the gear and the cue, and the map keeps its size — test: `train:menu-everywhere`, `train:menu-leave`, `train:tab-bar`
- ✓ Every exercise has its steps, doing it right, watch out and why, in the review's words (today's where it says so), with the accepted fixes (Buzzing, Farinelli's "Pause, throat open", Sustained note, Octave repeat) — test: `unit:core/copy.test.ts:only the explanations under copy.about are prose`, `train:page-layout`
- ✓ Climbing exercises end "Stop when it stops feeling easy; you don't have to finish the climb." unless they already say so; in the Cool-down "Stop whenever you like." — test: `unit:core/exercises.test.ts:"How to do it" is the numbered steps`, `train:routine-review`
- ✓ Rounds you didn't sing don't count; a silent note in a sung round is a miss; the result says how many rounds it counted — test: `unit:core/review.test.ts:a round with no voice at all is left out`, `unit:core/review.test.ts:a silent note inside a sung round is a miss`, `train:rounds-sung`
- ✓ Close once a round is sung shows the result for the rounds sung — test: `train:stop-early`
- ✓ Levels: Lip trills (five-note, octave, octave-and-a-half at 100); the runs 100, 130, 160 (the chromatic run and the turns 130 and 160 only); the nine-tone scale 130 and 160; the twisters 100 and today's speed — test: `unit:core/exercises.test.ts:the runs have a speed for each level`, `unit:core/exercises.test.ts:levels inside La-Ga, Bratty Nay and Straw`
- ✓ A level per routine step; the Advanced warm-up's straw and lip trills at Beginner — test: `unit:core/exercises.test.ts:a routine step uses its own level`, `train:routine-review`
- ✓ The daily warm-up: Match the note before Yawn-sigh; the tension check first for anyone who has never done it, the steps fixed when it starts — test: `unit:core/review.test.ts:the daily warm-up opens with the tension check`, `train:routine-review`
- ✓ The Cool-down steps down from the middle of the range — test: `unit:core/review.test.ts:a ladder in the Cool-down starts in the middle`, `train:routine-review`
- ✓ Listed lengths worked out from the exercises for the range — test: `unit:core/review.test.ts:lengths from the exercises`, `train:train-tab`, `train:today`
- ✓ Match the note: Beginner in order with no time limit, held at 1.2 s, then waiting for Next (nothing starts without a tap); Intermediate five seconds; Advanced the line hidden until the note plays again; a skipped silent note not counted — test: `unit:core/review.test.ts:Match the note at Beginner`, `unit:core/review.test.ts:Match the note: five seconds at Intermediate`, `train:match-wait`, `train:match-window`, `train:match-blind`
- ✓ A note to land in a longer time still counts after 1.2 s on it, the bubble showing the same rule — test: `unit:core/review.test.ts:1.2 s on it is a hit`
- ✓ Staccato and Consonant pops: a note counts once 0.1 s of it is heard on the note and most of what's heard is on it; nothing heard is not sung (the 4 Nov plan's fix, after the real-voice check found a correct 0.1 s staccato note never counted) — test: `unit:core/review.test.ts:very short notes`, lab `tests/lab-scoring.mjs` part A
- — The runs and the nine-tone scale at every speed score a real voice sung right, late by 80 ms, and sliding into each note, and not one sung off. Measured in the lab (tests/lab-scoring.mjs part B), which reports and doesn't pass or fail the build; the runs are scored by the rule every sung exercise uses, which the checks above test.
- ✓ How each try landed: first try, time to settle, how close; kept with the result (cents, seconds, and the new settle_cents column; no change to who can read or write results) — test: `unit:core/review.test.ts:the first try, the time to settle`, `unit:core/review.test.ts:kept with the result`, `train:match-window`
- ✓ Sing the interval: five seconds a note at Beginner; a song under a shape the first three times (Robert's approved list) — test: `unit:core/review.test.ts:Sing the interval at Beginner`, `train:interval-cue`
- ✓ Hold the note: the note's bubble and your line on the map — test: `train:hold-map`
- ✓ Match the tone: a plain tone made by the phone at the piano's level; line shown, not scored, until the headphone test; "I can hear the tone. Put your headphones in." when the line is the tone — test: `unit:core/review.test.ts:a pure tone on the note`, `train:match-tone`
- ✓ Three-note steps, scored, climbing a half step a round; Neck and shoulder release with no hand on the head — test: `unit:core/exercises.test.ts:the six new ones`, `unit:core/exercises.test.ts:the body checks keep the old app's body rules`
- ✓ Steady hiss: your best, not a set target — test: `unit:core/exercises.test.ts:the hiss: the seconds held`, `train:hiss-best`
- ✓ Breath counts grow 4 to 8 — test: `unit:core/review.test.ts:4, then one more each round, up to 8`, `train:cycle-grow`
- ✓ Range check: the old range beside the new — test: `train:range-was`
- ✓ Vocal Function Exercises: the goal is your best hiss; your longest "ee" day by day — test: `train:vfe-goal`
- ✓ Tongue-out with a crescendo on held notes, five half steps clear of the top; Blah on notes, line shown — test: `unit:core/review.test.ts:Tongue-out with a crescendo keeps its notes`, `train:on-notes`
- ✓ Straw and Cheek puffs scored (Robert's straw test, 13 Nov) — test: `unit:core/exercises.test.ts:says what it measures, and only that`, `train:line-only`
- ✓ When the voice arrives on each note, measured from a saved take, the whole spread; the delays the phone reported kept with the take; nothing about the bubbles or the score changed — test: `unit:core/review.test.ts:a voice 0.2 s late arrives 0.2 s after each note`, `train:note-timing`
- ✓ The pause between the piano and the singer (Robert, 13 and 20 Nov): each note's bubble starts, is checked and meets the white line 0.14 s after its piano note, the voice's arrival measured from his takes (the median by the app's line, which reads about 0.05 s late); the whole window moves, its length kept; not a whole second — test: `train:lead-pause`, `unit:core/nov20.test.ts:moves every note's whole window`, `unit:core/nov20.test.ts:is the voice's arrival measured from his takes`
- ✓ The first note of every round counts when sung on time from silence, and wrong notes still score low (Robert, 20 Nov), with a real voice in the timing lab (tests/lab-timing) — test: `unit:core/nov20.test.ts:the first note of every round counts when sung on time from silence`
- — Bubbles of at least 40 px with the menu on screen (Robert, 16 Nov): Replaced by bubbles exactly the band that counts (Robert, 20 Nov), below.

### Robert's 20 Nov phone check (Samsung, Chrome, wired headphones)
- ✓ A lead note before every round, the first included: the round's first note alone, after a beat's quiet, as long as one note of that round at the level picked (Robert, 23 Nov; it was a beat, never under half a second; a held note's, a second), in the rest, never scored and with no bubble; listed lengths count it — test: `train:lead-pause`, `train:lead-levels`, `unit:core/nov20.test.ts:before every round of every exercise that moves round by round`, `unit:core/nov20.test.ts:the listed length counts it`
- ✓ One zoom on every exercise and every round: one spacing between notes, 30 px a half step on every map whatever its height (a fixed 16 half steps a map, first tried, gave 15 to 31 px); a round too tall for the map is followed, never zoomed — test: `train:one-zoom`, `train:singing-screen`, `train:menu-everywhere`
- ✓ A run lasts until its last note is let go: Sustain's last 8 s hold was cut off when its 3 s piano recording ran out, and never counted (found by the 20 Nov timing lab; the build before had it too) — test: `train:last-hold`
- ✓ A round's dot is lit from its lead note, and Pause carries on from the round whose lead has sounded — test: `train:singing-screen`
- ✓ The singer's line draws while the lead note plays, so the note can be found before the round; nothing scored then (Robert, 21 Nov) — test: `train:lead-line`
- ✓ Every scored exercise has levels in the gear, remembered: Beginner wider and a notch slower, Advanced narrower and a notch faster; the bubble the level's band; the result says the level and keeps it (Robert, 21 Nov) — test: `train:levels`, `unit:core/nov21.test.ts:what counts is the band: 0.4 off counts at Beginner and Intermediate, not Advanced; 0.6 at Beginner alone; a half step off never`
- ✓ "Last time" compares within the same level only; a result saved before levels were kept compares with none — test: `unit:core/nov21.test.ts:last time is the last at the same level, never another level's, nor one from before levels were kept`
- ✓ Every tab shows its icon with its name underneath, all seven whole at 360 wide (Robert, 21 Nov) — test: `browser:tabs`
- ✓ Each bubble exactly as tall as the band that counts at its level (Robert, 21 Nov: Beginner 0.65 of a half step either side, Intermediate 0.5, Advanced 0.35; Hold the note and Match the tone 0.5, 0.35, 0.35), a line at its note, the one to sing now no taller; its syllable inside, or just above when it doesn't fit — test: `train:one-zoom`, `train:singing-screen`, `train:menu-everywhere`
- ✓ Short notes are never chopped (Robert, 23 Nov, replacing 20 Nov's quick fade): Bwoop, Staccato and Consonant pops sing and draw notes of a quarter second at most, while the piano plays each whole, its key down for its beat and let go as the next is pressed, with the same damper's fade as every note, measured on the waveform (tests/lab-audio.mjs, scripts/waveform.py) — test: `train:short-piano`, `unit:core/nov20.test.ts:Staccato, Consonant pops and Bwoop`, `unit:audio/engine-web/web-engine.test.ts:fades as a key let go does`
- ✓ Note bends a fast twitch: note, neighbour, note, neighbour, note, neighbour, note, each flick 0.18 s back to back, the piano the same; line shown, not scored — test: `unit:core/nov20.test.ts:note, neighbour, note`, `unit:core/nov16.test.ts:Note bends: a fast twitch`
- ✓ Match the tone scored: 4 s holds after 2 s to find the tone; Beginner in order, Intermediate at random, Advanced at random with your line hidden until the tone stops; how each landed (first try, time to settle, how close) beside last time; its page says its job — test: `train:match-tone`, `unit:core/nov20.test.ts:Beginner in order`, `unit:core/nov20.test.ts:scored, with its listed length`

### Robert's answers to the 21 Nov report (22 Nov)
- ✓ The level a result was sung at goes online in the results table's own level column, which can be left empty; who can read or write results unchanged; results saved before it stay without one; the name plain — test: `train:level-online`, `unit:core/nov21.test.ts:kept with the result, in its own level column online`
- ✓ Each two-level exercise gets its missing level, a notch slower or faster: Advanced for the four tongue twisters, Three-note run and Bratty Nay; Beginner for Nine-tone scale and Tongue trill; still no Beginner on Chromatic run or Three-note turns; every new level passes the real-voice check (tests/lab-levels.mjs) — test: `unit:core/nov22.test.ts:Advanced, a notch faster than Intermediate`, `unit:core/nov22.test.ts:Beginner, a notch slower than Intermediate`, `unit:core/nov22.test.ts:Chromatic run and Three-note turns still have no Beginner`, `train:levels`
- ✓ The list shows each exercise's own difficulty beside its level span ("Advanced · Levels Beginner to Advanced") — test: `train:own-tag`, `unit:core/nov22.test.ts:as it was listed, whatever level it starts at`
- ✓ One map everywhere: Learn a song's map at Train's 30 px a half step, never zooming, sliding with the song's notes a moment before them; no note of the next 2 s ever out of view while it fits; everything in view stays in view through a glide; the lines, bubbles and scoring as they were — test: `notemap:map-follows`, `unit:core/songview.test.ts:stays put while the notes fit`, `unit:core/songview.test.ts:each move glides`, `unit:core/songview.test.ts:no note of the next LOOK seconds is ever out of view`, `unit:core/songview.test.ts:a leap too wide for the view`, `unit:core/songview.test.ts:a brief slip an octave off is not followed`

### Robert's notes on the 22 Nov taps (23 Nov)
- ✓ Every note of a round the same length, the top and the last included, on every exercise but the holds (Sustained note, Messa di voce, Tongue-out with a crescendo, Hold the note, Match the tone, Vocal Function Exercises); the rest between rounds unchanged; every changed level passes the real-voice check (tests/lab-levels.mjs) — test: `unit:core/nov23.test.ts:every note the piano plays in a round`, `unit:core/nov23.test.ts:the holds keep their long notes`, `unit:core/nov23.test.ts:the rest between rounds stays`, `train:lead-pause`
- ✓ The lead note lasts exactly one note of the round at the level picked, on its pitch, the round straight after it — test: `train:lead-levels`, `unit:core/nov23.test.ts:as long as the round's first note`, `unit:core/nov23.test.ts:on every exercise that moves round by round`
- ✓ Short notes never chopped: every piano key held for its whole note and let go with the one damper's fade, measured on the app's own output (tests/lab-audio.mjs, scripts/waveform.py) — test: `train:short-piano`, `unit:core/nov23.test.ts:Bwoop, Staccato and Consonant pops`, `unit:audio/engine-web/web-engine.test.ts:fades as a key let go does`
- ✓ Mum as his course's: a half step every round, up to the top of the range and back down; the Cool-down still only down — test: `unit:core/nov23.test.ts:up a half step a round`
- ✓ Learn a song's line: nothing once the song is ready ("Ready. Tap Start." dropped), the singer's line being read shown there, hidden while the song plays with its room kept, a problem always shown; the map takes the line's room — test: `notemap:status-line`, `notemap:line-read`, `unit:core/song.test.ts:says nothing once the parts are on the phone`
- ✓ A take stored online whose answer never came back (the signal gone just as the upload ended) counts as online once the whole recording is found stored, and the takes after it still go up; found in the train suite on 23 Nov, where sending it again was refused for good and held every later take on the phone — test: `takes:take-reply-lost`
- ✓ The Today card shows the right length and number of exercises from the first moment, never a stand-in first; found in the train suite on 24 Nov, where it said 8 exercises for a moment, then 9 — test: `train:routine-review`

### Vibrato (Robert approved it on 16 Nov; built 24 Nov)
- ✓ Vibrato, its own round in Tone, last, Advanced, Train 63: after a note's quiet, the lower note alone (a note of the first speed), the two notes a half step apart taking turns at three speeds, slower to faster, every note of a speed the same length, ending on the upper; then the lower note held 4 s. A half step higher each round, both notes two half steps inside the range. No levels: nothing scored — test: `unit:core/nov24.test.ts:Vibrato, the exercise`, `train:vibrato`
- ✓ On "ah", or "oh" or "ee" picked in the gear, remembered; no Any octave there — test: `unit:core/nov24.test.ts:is sung on the vowel picked`, `train:vibrato`
- ✓ The wobble measured on each hold from the line's own readings (twenty a second, before the median of five), a wave fitted over whole cycles on top of the note's drift: its speed and width (cents, top to bottom); two notes taking turns slowly never called a wobble; a steady note no wobble. Proved in the lab (scripts/vibrato-lab; REPORTS, 24 Nov) — test: `unit:core/nov24.test.ts:the wobble, measured`, `train:vibrato`
- ✓ The result: speed and width over the held notes, each beside its typical range (about 4.5 to 6.5 a second, 50 to 120 cents: the research report), "Typical, not a target.", then each held note at its start, middle and end; last time's beside them (where from: below); never a verdict — test: `train:vibrato`, `train:vibrato-again`
- ✓ The page never says how to make the wobble inside the body, never whether it sounds good; Watch out for names shaking the jaw or head, pushing louder, and forcing it where it doesn't come — test: `unit:core/nov24.test.ts:never says how to make the wobble`
- ✓ The map draws the line's own readings on Vibrato, so the wobble shows: over the newest second of a hold sung with an 80-cent wobble, the line drawn swings at least two-thirds of a half step — test: `train:vibrato`
- ✓ Robert, 25 Nov: Vibrato's speed (cycles a second, to two places) and width (whole cents) over the held notes that wobbled, saved with the result to the account, in the results table's own two columns, both can be left empty (script in scripts/db, 25 Nov); no change to who reads or writes results — test: `unit:core/nov25.test.ts:Vibrato on the account`, `train:vibrato-online`
- ✓ Last time from the account when signed in (even on a phone remembering another), from this phone when signed out; a session kept only on this phone stays there; Try again compares with the session just sung — test: `unit:core/nov25.test.ts:last time`, `train:vibrato-again`, `train:vibrato-online`
- ✓ The singer's linked coach (the second test account) reads them, and not once unlinked; no one signed out reads them; the coach can't add or change any — test: `train:vibrato-online`

### Robert's 16 Nov additions (read next.html 18175-18183 again: the old tongue check rests a thumb under the chin, "Resting, not pressing")
- ✓ Four new exercises, none in a routine, Train 62: Find your resting note after the tension check (Beginner, Quiet), Three-note run before Five-note run (Beginner 100, Intermediate 130), Note bends after Three-note turns (Advanced, at 100), Bwoop after Descending five-tone (Advanced, not Quiet, at 120) — test: `unit:core/nov16.test.ts:in their groups, levels and places`, `train:new-four`
- ✓ Find your resting note: your line alone; after each slide the note it came to rest on (the last stretch held within 35 cents for 0.6 s, as settling on Match the note), or "That slide didn't come to rest on a note. Try again and let it settle."; at Done "Your slides came to rest on ..."; never called anything the app doesn't measure — test: `unit:core/nov16.test.ts:names the note a slide settled on`, `unit:core/nov16.test.ts:a slide that never settles names nothing`, `train:rest-note`
- ✓ Three-note run: 3-2-1 then 1-2-3 a round, a half step higher each round, scored, with the runs' steps and "my" — test: `unit:core/nov16.test.ts:Three-note run`
- ✓ Note bends: four flicks a round, up one round and down the next, the line shown, not scored — test: `unit:core/nov16.test.ts:Note bends`, `train:new-four`
- ✓ Bwoop: "bwoop" in the title, every bubble and every line; from the middle of the range to the top, a half step a round; scored by the short-note rule — test: `unit:core/nov16.test.ts:Bwoop`, `train:new-four`
- ✓ No reminder that contradicts them: not "Open tall, not wide." on the hum or the "bwoop"; not "Keep your face still." on Tongue trill at Advanced — test: `unit:core/nov16.test.ts:no reminder that contradicts them`, `unit:core/nov16.test.ts:no "Keep your face still." at Advanced`
- ✓ Tongue trill: Intermediate to Advanced, the trill through puffed cheeks, the same pattern and speed, with its own step 3 and doing-right line — test: `unit:core/nov16.test.ts:at Advanced its own step 3`, `train:trill-advanced`
- ✓ The added lines on Humming (a fingertip resting under the chin, as the old app's own tongue check), the three tongue-out exercises, Cheek puffs, Mum and Breath pulses; sounds and cues as they were — test: `unit:core/nov16.test.ts:Humming`, `unit:core/nov16.test.ts:the three tongue-out exercises`, `unit:core/nov16.test.ts:Cheek puffs, Mum and Breath pulses`
- — Find your resting note read right from a real voice (12 of 12 slides at known notes, none named for 3 that never settle) and Bwoop by the short-note rule over a singer's own range: measured in the lab (tests/lab-scoring.mjs parts C and D), not a check: the lab reports and doesn't pass or fail the build.

### Robert's 17 Nov phone finds in Learn a song
- ✓ The song plays just as loud with the mic open as with it refused, and with Hear yourself at his 42 (17 Nov: "even with Hear yourself off it's far too low") — test: `loudness:song-mic`
- ✓ Voice and Music go on past 100 to 200, twice the song's level, as the old app's Hear me went to 200%; the song at 200 comes out louder than at 100, peaks still under -1 dB; Hear yourself and Your take stay 0 to 100 — test: `loudness:song-louder`, `unit:core/song.test.ts:Voice and Music go on past 100`
- ✓ Peaks under -1 dB between the samples on every test song at every slider, every run: the ceiling's top lowered to 0.66, because coming back down from twice the rate lets a rounded peak ring up to 2.1 dB past it (measured offline at the phone's rate, tests/ceiling-lab; the 16 Nov build reached +0.1 dB live with a song and your voice at the top). Peaks are read only where the test's recorder ran unbroken (missed blocks counted). Hear yourself at 100 is rounded a little more: about x5.2 for six, about 2.3 dB over the music (2.8 before) — test: `loudness:peaks-held`, `loudness:monitor-level`, `unit:audio/engine-web/web-engine.test.ts:sits low enough`
- ✓ A take waits to be decided on, with its Save, however it ended: Stop, the song's end, the menu mid-song, Back, the phone locked or the app hidden, leaving and coming back, the app closed and opened again (or Chrome throwing the page away while the phone was locked), and something else sung in between; Try again throws it away with Undo; once saved or thrown away it doesn't come back; one brought back after the app was closed is the same take, plays, and gets its score once the song's own line is read (17 Nov: a reload or another exercise lost it) — test: `takes:take-endings`, `unit:shell/take-review.test.ts:is scored once the singer's line is there`

### Bubbles and the score
- ✓ A hit is half the note within a semitone; the fill shows the same share (RULEBOOK 4, Bubbles; the old app used 60 cents, 3314-3330) — test: `unit:core/exercises.test.ts:a hit is half the note within a semitone`, `train:ladder-sung`, `train:ladder-wrong`
- ✓ Within a semitone means the note itself, half a semitone either side, the note map's own rule — test: `unit:core/exercises.test.ts:within a semitone means the note itself`
- ✓ Times rounded before comparing (RULEBOOK 4, Bubbles) — test: `unit:core/exercises.test.ts:rounds time before comparing`
- ✓ Octave exact, with Any octave (2797-2848; RULEBOOK 4, Pitch) — test: `unit:core/exercises.test.ts:is octave exact, unless Any octave is on`, `train:any-octave`
- ✓ Nothing sung, nothing scored — test: `unit:core/exercises.test.ts:scores nothing that was not sung`
- — Cut at 1 semitone and 0.15 s; bubbles start where the voice starts (RULEBOOK 4, Bubbles). Not needed for exercises: their bubbles are the exercise's own notes, not cut from a sung line.
- — The grade letter, points and combo (2309-2320, 3322-3332). Not in the new app: only the notes hit and the share are shown, as measured.

### Your range
- ✓ One source of truth; the old app's default A2-A4 until it is measured, shown as "Not measured yet" (rp-range.js 66-75) — test: `unit:core/exercises.test.ts:is A2 to A4 until it is measured`, `train:range-check`
- ✓ Kept on the phone and on the account, with when and how it was found; the old app's range on this phone or on the account is used if this app has none (rp-range.js 40-140) — test: `train:range-check`
- ✓ The range check: four seconds of singing at each end, the 5th and 95th percentiles, seven notes apart or an octave (3754-3790) — test: `unit:core/exercises.test.ts:measures four seconds of singing at each end`, `unit:core/exercises.test.ts:keeps at least seven notes between them`, `train:range-check`
- — The voice-type presets (633-639). Not in this round: the range check measures it instead.

### Results
- ✓ Saved straight away: on the phone always, the newest 200; online when signed in, in the old app's results table (rp-cloud.js 870-905) — test: `train:progress-phone`, `train:progress-online`
- ✓ Only what was measured: notes hit of notes and the %, or seconds held of the target; otherwise only that it was done (rp-score.js 1-10) — test: `unit:core/exercises.test.ts:a sung exercise: notes hit of notes`, `unit:core/exercises.test.ts:anything not measured`, `train:progress-phone`
- ✓ The microphone refused: the exercise still plays, "Carry on without it", nothing scored (RULEBOOK 3) — test: `train:mic-refused`

## Decided by Robert, 13 Oct

1. A mic another app holds: no automatic retry. The Start tap lets go and asks once more, and if it is still held the app says "Another app is using the microphone. Tap Start to try again."
2. A 3-2-1 count-in before the song on Learn a song, shown on the note map; back 10 s and repeat this part don't count in.
3. The Sound check has "Test without mic" and "Use the phone's own mic". No mic setting anywhere else.

## Decided by Robert, 21 Oct (the USB-C headset)

1. Ask for the mic once, raw (exact); no automatic ladder, no remembered mode; "Try another mode" by hand only, remembered.
2. Mic first, then the sound, for Start, Test without mic and Hear yourself; a sound made before the mic opened is made anew once it opens.
3. A rebuild awaits the old sound's close, waits 800 ms, makes the new one, kicks it and proves it by the clock.
4. "Use the phone's own mic" by device id, before the first request, kept; a mic that took the phone down is never chosen again by itself.

## Decided by Robert, 22 Oct (after the headset worked)

1. Keep the old app's second rebuild try after 600 ms, only on the tap, never by itself.
2. Hear yourself must sound on a rebuilt sound, and when switched on before Start.
3. A Hear yourself slider under the switch: 0 to 100, remembered, 70 at first; 100 about +12 dB over the raw mic, rounded off so it can't clip, with low delay.
4. Each song brought up once to its loudest moment at -1 dBFS, the same gain on voice and music, kept with the song; sliders at 100 play at that level. Nothing in the way out changes the sound below 0.9. (Done as "up, never down": the test song's parts together peak above full volume, and turning it down made it quieter than before; for Robert to confirm.)

## Decided by Robert, 23 Oct (his phone test: everything sounds better, nothing crackled)

1. Hear yourself at 100 a little too loud: three times the mic (about +9.5 dB), not four. Default 70 on the new scale; the soft limit kept.
2. Whether Hear yourself is on is remembered between visits, as the old app did.
3. Raise quiet songs, never turn loud ones down (agreed).
4. Songs louder, porting the old app's v9.8 stage, about -14 LUFS: held, not built. Measured, the songs already play at -9.8 to -15.5 LUFS, so -14 would make most of them no louder; the v9.8 stage makes them 3 to 6 dB louder (-6.8 to -9.3 LUFS). Robert chose the v9.8 stage (below).

## Decided by Robert, 23 Oct (later): option 2

1. The old app's v9.8 loudness stage as it was, peaks held under -1 dB: songs 3 to 6 dB louder than before at sliders 100; his song near -7 LUFS. It withdraws "nothing changes below 0.9" (22 Oct).
2. Hear yourself at 100 stays clearly louder than the music, about 3 dB over it; its top raised if the louder song swallows it.

## Decided by Robert, 23 Oct (the Train tab)

1. Range exercises use Agility's blue.
2. Any note the piano samples do not cover is played on the nearest sample, retuned.

## Decided by Robert, 24 Oct (the Train design pass)

1. Every screen has ONE stated goal (RULEBOOK 3); its goal is the first line of its file, checked by a unit test.
2. The exercise page: back, name, group tag, the pattern card (bars, one play button, the current bar lit, the syllable under the card), Goal, How, Start. The gear opens the sound sheet; "More about this" opens the old app's why, watch for and care. Level, Quiet and what is measured stay on the list rows.
3. The singing screen: the note map fills the screen, note names at the left, every bubble with its syllable, the current one bigger with the ring, progress dots along the bottom. Close is the only control; no pause. (Replaced 28 Oct: Pause, Restart, the gear and Close.)
4. Train: the warm-up card with Start and "More routines", then five group cards with a picture. A group's list, the other routines and the range check (in Range) are one tap away.
5. The count-in sound: a soft beep on 3, 2, 1, on at first, one app-wide setting in the exercise sheet and the song's sound card; never in a score or a take, never after Close.
6. Kept from the Train report: held notes spread evenly, sirens unscored, the long explanations behind "More about this"; the two test results left on the test account.

## Decided by Robert, 25 Oct (fixes to the design pass)

1. The pattern card draws each note as a short dash at its pitch height, like a melody line; no gap between the card and Goal.
2. The singing screen zooms to the rung being sung, about three semitones of room above and below, gliding as the pattern climbs; bubbles bigger to match; note names still at the left.
3. Every How line rewritten: what to do with the body, breath or mouth, one plain sentence up to 14 words, never the sound or how many notes. How lines are exempt from the eight-word cap.
4. Agility's picture is a hummingbird.
5. A sixth group, Articulation, in yellow (RULEBOOK 1b): Five vowels, three sung tongue twisters (Red leather, Unique New York, Peter Piper), Consonant pops, Tip of the tongue, Lips and tongue.
6. Everything else from the design pass stays as it is.

## Decided by Robert, 28 Oct (the content round)

1. Octave leaps 1-8-1; tongue twisters fit their patterns; Long soft notes as Stemple's four steps; Bratty Bay dropped, its results kept; Loo; "You'll need a straw."; thinner staff lines.
2. New exercises in Warm-up, Breath, Tone, Agility and Range, and a Pitch group: Sing the interval (levels in the sound sheet), Match the note and Hold the note, the old app's.

## Decided by Robert, 27 Oct

1. Agility's picture: five faint staff lines and five dots on different lines or spaces, joined by one smooth curve, like a quick run.
2. La-Ga alternates one syllable a note, as the old app's "la-ga la-ga"; every exercise's syllables checked against the old app's syl strings.
3. The top card is Today, read from one source in order: a coach's assignment, a program's day, the singer's own plan (falling back to the daily warm-up). Only the own plan exists yet.
4. Plain words in names and How lines: "break" becomes "where your voice flips"; Vocal Function Exercises becomes Long soft notes, its old name only behind More about this. (Replaced 28 Oct: the proper name is the title, the plain name under it.)

## Decided by Robert, 28 Oct (phone testing)

1. Every singing screen gets Pause (Resume from the start of the current repeat, with the count-in, nothing scored lost), Restart (from the first repeat, score cleared), the gear (the sound sheet) and Close. Built once, placed in one layout that the path map can move later. The map smaller; the dots kept. No speed setting until the path map.
2. Exercise takes: the voice recorded while singing, Save take next to the score with Try again and Next; the old takes table with its kind set to exercise; "Your takes" on the exercise page, played over the piano notes. Only Save for now.
3. The proper name is the title, the plain name a small line under it; no "Also called".
4. Sing the interval: shapes by level, shown in words; the note map shows the whole turn.
5. Long soft notes: a small readout of the note being sung and how close, while holding.

## Decided by Robert, 3 Nov (the Train update plan)

1. The page: title, plain line, You'll need, How to do it, Start. Behind "More about this": You're doing it right when, Watch out for, Why it helps; care points at the end of Watch out for.
2. Wording checks: the new steps, doing-it-right, watch-out and why for banned words only, no length cap; the jargon list for the plain line, You'll need and the steps. The 3 Nov spec replaces the 25 Oct How rule for steps.
3. Tongue-forward hum's cue: "Keep your head moving slowly."
4. Levels: a level row in the gear's sheet, remembered per exercise; the list row shows the span; routines use their own level, capped at the exercise's top.
5. A half step every round with no 14-round cap, only for the spec's climbing exercises.
6. Speeds and note lengths as proposed. 7. Big climb's arpeggio. 8. Bratty Nay: five-note Beginner, octave Intermediate.
9. Straw: the "accents" clause dropped; the water warning kept in Watch out for.
10. Tongue-out's cloth line in Robert's words. 11. Tension check: "Tick where you felt tension."; the rotation and exclusions as listed; stopping early and retaking as proposed. 12. The bright "a" bubble says "a".
13. All six of section 5: the phone at eye level, the head rolled forward only, the wall step, "Overdo the brat, not the volume.", Straw at Beginner in the Cool-down, the tension check not scored.
14. Straw and Cheek puffs show the line but are not scored until Robert's real-phone test with a straw.
15. The ticks: only the singer can read or change their own, enforced on the server, tested with a second account.
