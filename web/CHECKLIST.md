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
- ✓ The view is pinned before Start and the mic can't move it (2471-2518, 25149-25166) — test: `notemap:pinned`, `unit:core/notemap.test.ts:never recentred`
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

## 5. Train (read 23 Oct: next.html 3672-4024, 7652-8134, 8992-9240; src/rp-train.js, rp-flow.js, rp-range.js, rp-sus.js, rp-cloud.js 870-905, rp-score.js)

### The exercises and routines
- ✓ Every exercise of the old app's library, as data, with its group, level and quiet flag (7686-8099) — test: `unit:core/exercises.test.ts:has every exercise of the old app`, `unit:core/exercises.test.ts:keeps each one's group, level and quiet flag`, `train:train-tab`
- ✓ Each one runs as the old app ran it: its pattern and tempo, a held note's length, the hiss's target, the breath counts (7686-8099) — test: `unit:core/exercises.test.ts:runs each one the way the old app did`
- ✓ The melodic patterns (8063-8075) — test: `unit:core/exercises.test.ts:runs each pattern as the old app did`
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
- ✓ Loo, sung on "loo"; Straw singing says "You'll need a straw."; Agility's staff lines at half the stroke — test: `unit:core/exercises.test.ts:Loo is sung on "loo"`, `train:content`, `train:train-tab`
- ✓ New exercises, in our own words: Buzzing, Raspberry slide (unscored), Tongue trill; Breath pulses (guided); Goo, Guh; the runs on "my", faster at higher levels (Five-note run, Five-note minor run, Skipping run, Half-step run, Little turns); Big climb — test: `unit:core/exercises.test.ts:the new exercises: their groups, levels, patterns and syllables`, `unit:core/exercises.test.ts:the buzz is a repeat on`, `unit:core/exercises.test.ts:the runs go faster at higher levels`, `train:category`

### Running an exercise
- ✓ Nothing starts until Start: no sound, clock or mic before the tap (rp-flow.js 1-20; Robert, 1 Oct) — test: `train:start-only`, `train:preview`
- ✓ A routine never moves on by itself: after a step, "Next: ..." and End session; the next step opens paused; ending returns to where it began (rp-flow.js 1-20; Robert, 1 Oct) — test: `train:routine`
- ✓ The ladder: from one note above the bottom of your range, a half step a rung, up to where the pattern fits, at most 14 rungs, two beats' rest (3700-3752) — test: `unit:core/exercises.test.ts:for every pattern, from one above your lowest`, `train:range-used`
- ✓ Each rung's first note carries its note name and the syllable; the rest the syllable (3725-3730) — test: `unit:core/exercises.test.ts:carries each note's syllable`
- ✓ The syllables on each note follow the old app's syl strings: "la-ga la-ga" alternates la and ga a note, la first each repeat; "mmm / nnn / ng" is one hum a repeat; "a · b" lists other ways to sing it, and the first is sung (tongue-out on "uh", its own how); the old ladder printed the first token on every note, which Robert asked to change (Robert, 27 Oct) — test: `unit:core/exercises.test.ts:La-Ga alternates one syllable a note`, `unit:core/exercises.test.ts:the three hums change with each repeat`, `unit:core/exercises.test.ts:every sung syllable comes from the old app`, `train:syllables`
- ✓ The reference is the shipped piano, any note played on the nearest sample, retuned (7611-7616; Robert, 23 Oct) — test: `unit:core/piano.test.ts:plays any other note on the nearest sample`, `train:range-used`
- ✓ The exercise page (Robert, 24 Oct): back, the name, its group as the only tag, the pattern card, Goal, How, Start; the pattern's notes played only on the card's button, the piano alone, no mic; the current note lights and its syllable shows under the notes — test: `train:preview`, `unit:core/exercises.test.ts:the first rung is the pattern alone`
- ✓ The pattern card draws each note as a short dash at its pitch height, like a melody line, wider for longer; nothing between the card and Goal (Robert, 25 Oct) — test: `train:preview`
- ✓ How says what to do with the body, breath or mouth, in one plain sentence up to 14 words, never which sound or how many notes; How lines alone are exempt from the eight-word cap (Robert, 25 Oct) — test: `unit:core/copy.test.ts:say what to do with the body, breath or mouth`, `unit:core/copy.test.ts:a How line may run to 14 words`
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
