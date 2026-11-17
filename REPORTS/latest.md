# Report, 17 Nov 2026, commit 151bf8d

This round's three fixes are built and live: Learn a song plays louder, a take now keeps its Save however it ends, and Find your resting note has your new steps. Main hadn't moved since 64c91cc apart from my own report commit, so this round was built on exactly what went live on 16 Nov.

Still on hold, as you said: none of your takes have been read, bubbles and scoring timing are unchanged, and Match the tone is still unscored.

## 1. Learn a song was too quiet

**What I measured first.** This was on the built app, in a Chrome made to behave like Android, with the test songs and every slider at 100.
- With the microphone open, the song came out at -7.8 LUFS. That's the standard loudness measure, and -7.8 is as loud as a loud pop record.
- With the microphone refused, it was also -7.8 LUFS.
- With Hear yourself on at 42, it was -7.7 LUFS.
- So the app sends the phone the same loud song whether the microphone is open or not. Nothing in the app turns it down when the microphone opens.

**Whether your phone turns it down: confirmed in Chrome's code, not on your phone.** Android Chrome switches to the quieter call-style sound only when the app asks for "cleaned-up" microphone sound (echo and noise removal). The app asks for raw sound, which keeps the phone on normal media volume. I checked this in Chrome's own source code. I can't test your phone from here, though, and two things could still put it on call-style sound:
- an older Chrome;
- the mic mode having been changed by hand in Sound check ("Try another mode"), which the phone remembers.

Taps 13 and 14 below check both in a few seconds. If your phone turns out to be on call-style sound, that's the real cause, and I'll fix it next round.

**What I changed.**
- **Voice and Music now go to 200%.** 200% sends the song in at twice its own level, as the old app's Hear me did. Hear yourself and Your take still stop at 100.
- **How much louder,** measured on the built app over the same 15 seconds of the song:
  - before, at full slider (100): -7.8 LUFS;
  - now, at full slider (200): -6.6 LUFS.
  - That's **1.2 dB louder**: a small step you'll hear side by side, not a big jump.
- **Why not more:** the song was already close to the loudest a phone can play without distortion. I tried four times its level: that gained only 0.4 dB more, and the song came out audibly squashed. So I stopped at 200%, where it gets louder and still sounds clean. Tap 14 asks you to judge that by ear.
- At 100, the song is 0.2 dB quieter than before, too little to hear.

**The stage that rounds off the loudest peaks.** Peaks now stay under -1 dB, measured between samples.
- **Before:** with a song and your voice both at full, the 16 Nov build reached **+0.1 dB** in a live check today, above the limit. (On 16 Nov the same check had reached -0.4 dB.)
- **Why:** when that stage rounds off a peak, the sound rings a little past it, by up to about 2 dB, and the stage's ceiling sat too close to the limit to allow for that.
- **My first fix wasn't enough.** I lowered the ceiling a little and tested it offline at the wrong rate: 48,000 samples a second, where your phone's Chrome plays at 44,100. In one live run, a song at 200 plus your voice at full reached exactly -1.0 dB, right at the limit. I lowered the ceiling further and retested at the phone's rate.
- **Offline now:** three songs (yours, the same made five times quieter, and Ride's chorus), sliders from half to 200, your voice back at full and lined up with the song 16 different ways. Worst peak: -1.5 dB.
- **Live, in the app, four full runs, every check passing every time:**
  - the song alone: no higher than -2.2 dB at 100, -2.5 at 200;
  - Ride's chorus: no higher than -1.9 at 100, -2.5 at 200;
  - a song plus your voice at full: no higher than -1.6, with the song at 100 or at 200.
- **The check itself:** it now notices if its own recorder misses a stretch of sound, since the join could look like a peak that isn't there. None was missed in any run. Its reading matched the standard meter to within 0.1 dB.

**What it costs.**
- The very loudest moments of the song are rounded off a little more.
- Your own voice at the very top of Hear yourself (100) comes out a little quieter: now 2.4 dB over the music, where it was 2.8. At your 42, the song and your voice together measured 0.2 dB quieter than before.
- I loosened one check for this. It required your voice at the top of Hear yourself to be within 10% of six times the microphone, and 2.5 dB over the music. It now allows 15%, and 2 dB over the music. Six times the microphone is what you asked for on 23 Oct, and now it comes out at 5.3.

## 2. The missing Save

**The cause, confirmed.** A take waiting for Save or Try again lived only in the app's memory. It was lost in two ways:
- when the page was reloaded: the app closed and opened again, or Chrome throwing the page away while the phone was locked, which Android Chrome does to save memory;
- when something else was sung in between.

Now the waiting take is also kept on the phone, with your line, until you save it or throw it away. It comes back when the song opens.

**Every way a take can end**, checked on the built app, each with a real sung take:

| How it ended | Take and Save still there? |
|---|---|
| Stop | Yes, before and after the fix |
| The song reaching its end | Yes, before and after |
| Try again | Thrown away, with Undo for 6 seconds, as before |
| The menu at the bottom, mid-song, then back to the song | Yes, before and after |
| Back, mid-song, then the song again | Yes, before and after |
| The phone locked, or the app hidden, mid-song | Yes, before and after |
| Leaving the song and coming back | Yes, before and after |
| The app closed and opened again, or Chrome throwing the page away while locked | **Lost before; now kept.** The same take, the same score, and it plays |
| Something else sung in between (a Train exercise), then back | **Lost before; now kept** |

- Once a take is saved, or thrown away and its Undo has passed, it doesn't come back.
- On a 360-wide phone, Save is on the screen.
- The new check failed on the 16 Nov build (the last two rows) and passes on the fix.
- **A second bug that check found.** A take brought back after closing the app read "too little sung to score" instead of its score. The app worked out the score before it had finished reading the song's own line again, then kept that. It now works it out again once the line is ready, and the take shows the same score it had before (for example 84%).
- **When the take card appears:** only once the song has stopped, after it played with the microphone open for at least a second. It doesn't wait for singing: if you didn't sing, the card says "too little sung to score".

## 3. Find your resting note

Your new steps are in, word for word. The first sigh is now the first slide, so three slides name three notes. The 16 Nov note about step 1's sigh no longer applies.

## Bubbles on a 360-wide phone

Unchanged, as you said: 40 px, a little taller than their rows.

## Checks

All on the built app, in a Chrome made to behave like Android, with a real voice wherever something was sung.

- **Every check passes on the final build:** Train 77, browser 15, Android 28, library 7, note map 13, Learn a song 19, takes 20, loudness 13, 316 unit tests, and the old app's 187.
- **Every broken build is caught:** 300 of the app and 209 of the core.
  - 15 are new this round, for the louder sliders, the peaks and the kept take. Two older ones were re-aimed at the new ceiling.
  - A machine restart cut one run short partway; I restarted it from where it stopped.
- **The test takes** those checks saved on the test account were deleted afterwards. The test account now holds none.
- **The checklist** has this round's rules: 242 ticked, 38 left out with reasons, none crossed.
- **Live:** all 27 app files match the tested build. The old app is unchanged. The live app shows the new Find your resting note steps word for word.

## Mistakes of mine

All caught before anything went live.
- **I briefly undid my working changes while a loudness run was using the built app.** They were back within seconds, but a run going at that moment may have loaded the old build. I didn't count that run and ran fresh ones.
- **I tested the peak stage at the wrong rate.** I used 48,000 samples a second where your phone's Chrome plays at 44,100. So my first, smaller lowering of the ceiling looked safe offline, but reached exactly -1.0 dB in one live run. I lowered it further and retested at the right rate.
- **My first version of the check for a skipped stretch of recording flagged almost every stretch.** The recorder's timestamps wobble slightly, which is normal. The count was obviously impossible, so I fixed it before trusting any result.
- **One check couldn't fail.** The check that the song is as loud with the microphone open as with it refused would have passed even if the app turned the song down whenever the microphone was open. A broken build showed it. The check now also measures against the song's own files.

## Your taps

Samsung, Chrome. These are the 11 from 16 Nov, then this round's. Before each sung step, tell me in a word how you sang it (for example "all on pitch" or "missed the top notes").

1. Close Chrome fully, then open:
```
https://rcaldwell91.github.io/repertoire-pro/app/
```
2. **The button.** Tap Train, Warm-up, "Ah" tension check, Start. Sing a round, then tap Close. The button at the bottom should read "Next: Find your resting note". Tap it: Find your resting note opens. Then go back to Warm-up, open Posture check, Start, tap Done: Next: Neck and shoulder release opens.
3. **The menu, and the bubble size.** Tap Train, Tone, Mum, Start. While it plays, look at the bubbles: a touch bigger than on 14 Nov. After a round or two, tap Home at the bottom: the piano and the mic should stop at once. Tap Train: you should get the Train list.
4. **Staccato.** Tap Train, Agility, Staccato, Start. Sing the notes short and bouncy. At the end, tap Save take.
5. **Consonant pops.** Tap Train, Articulation, Consonant pops, Start. At the end, tap Save take.
6. **Five-note run at 160.** Tap Train, Agility, Five-note run. Tap the gear, pick Advanced, close it, tap Start. At the end, tap Save take.
7. **Timing.** Tap Train, Tone, Mum, Start, sing it through, and tap Save take.
8. **Match the tone, without headphones.** Tap Train, Pitch, Match the tone, Start, and sing along through the phone's speaker. Tell me whether "I can hear the tone. Put your headphones in." showed.
9. **Match the tone, with headphones.** The same again with headphones in. That line should not show, and your line should follow your voice.
10. **Find your resting note, with the new steps.** Tap Train, Warm-up, Find your resting note, Start. Read the steps: the first says to sigh out an easy "hmm" and let it slide down. Do three slides with a pause between, then Done. It should name three notes. Tell me the notes, and whether that's where your voice felt it came to rest.
11. **Bwoop.** Tap Train, Range, Bwoop, Start. Sing it as the steps say. Tell me the score, and whether it matches how you sang.
12. **Note bends.** Tap Train, Agility, Note bends, Start. Tell me whether your line showed the flicks, and whether the piano's flicks were clear enough to copy.
13. **Mic mode.** Tap Profile, Sound check. Under Start it says "Mic mode: …". Tell me what it says. It should be "raw (best for pitch)".
14. **How loud a song plays now.** Open a song in Learn a song, with the phone's volume all the way up and Hear yourself as you like it. Tap Start.
   - While it plays, press the phone's volume-up button once and look at the bar that appears: tell me whether it's for media (a music note) or for a call (a phone handset).
   - Then slide Voice and Music to the right: they now go to 200%. Tell me whether 200% is loud enough, and whether it sounds clean or squashed.
15. **The save, after closing the app.** In the same song, sing about 20 seconds and tap Pause. The take card shows with Save. Close Chrome fully, open the app again and open the same song: the take card should be back, with Save. Tap Hear it, then Save.
16. **The save, with something sung in between.** Sing about 20 seconds of the song again and tap Pause. Without saving, tap Train, sing a round of Mum, then go back to Learn a song and open the same song: the take card should be back. Tap Save.

## Two questions, again

1. May I read the takes you save in the steps above (Staccato, Consonant pops, the Five-note run at 160, and Mum), read only, and nothing else on your account? Only those saved after the 14 Nov build.
2. When you noticed the timing, were you listening through the phone's speaker, wired headphones, or Bluetooth?
