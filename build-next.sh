#!/usr/bin/env bash
# Builds next.html = base.html (v10.1) + the cloud layer + the hooks.
#
# base.html is v10.1 exactly as it shipped and is NEVER modified — every change
# lives in src/ and is applied here, so the base can always be diffed against
# what is live.
#
# next.html is the WORKING copy: the one to open while something is half built.
# index.html is the RELEASED app, and only ./release.sh moves next into index.
# That is the whole reason there are two: the link people have can stay solid
# while the next thing is still in pieces.
set -euo pipefail
cd "$(dirname "$0")"

for f in src/rp-cloud.js src/rp-coach.js src/rp-score.js src/rp-plain.js src/rp-studio.js src/rp-voice.js src/rp-send.js src/rp-work.js src/rp-test.js src/rp-level.js src/rp-trivia.js src/rp-body.js src/rp-goals.js src/rp-find.js src/rp-range.js src/rp-today.js src/rp-pages.js src/rp-nav.js src/rp-train.js src/rp-learn.js src/rp-profile.js src/rp-lib.js src/rp-sus.js src/rp-tour.js src/rp-example.js src/rp-timing.js src/rp-scroll.js src/rp-back.js src/rp-once.js src/rp-soundcheck.js src/rp-monitor.js src/rp-maps.js src/rp-takes.js; do node --check "$f"; done
test -s src/rp-skin.css

python3 - <<'PY'
base = open('base.html', encoding='utf-8').read()

# ---------------------------------------------------------------------
# Two hooks into the places where the app has ALREADY worked a number out
# and shown it to the singer. We send that same number on to their coach.
# Nothing here computes, rounds or invents a score of its own.
# ---------------------------------------------------------------------
PATCHES = [
    # 1. Ear drills: score out of rounds, and average distance from the note.
    ("    V10.markPractised('Ear training');",
     "    try { if (window.RP && RP.logResult) RP.logResult({ kind: 'ear',\n"
     "      label: 'Ear · ' + EAR.kind, score: EAR.score, out_of: EAR.rounds, cents: avg }); } catch (e) {}\n"
     "    V10.markPractised('Ear training');"),

    # 3. THE MICROPHONE LADDER.
    #    'raw' capture — echo cancellation, noise suppression and gain control
    #    all off — is the best input for reading pitch, so it is asked for
    #    first and that does not change. But a lot of Android phones cannot
    #    open the unprocessed path at all and answer NotReadableError however
    #    many times you ask. The old code retried the SAME constraints twice
    #    and then gave up, which is why Briar's phone could never work and why
    #    closing tabs and restarting made no difference. Now, if the phone says
    #    no, we ask for something it is likelier to be able to give, and we
    #    remember whatever finally worked.
    ("""  const prof = MIC_PROFILES[(opts.profile != null) ? opts.profile : 0];""",
     """  let savedProf = null;
  try{ const sp = localStorage.getItem('rep_micprof'); if(sp !== null && sp !== '') savedProf = +sp; }catch(e){}
  const profIdx = (opts.profile != null) ? opts.profile
                : (savedProf != null && MIC_PROFILES[savedProf]) ? savedProf : 0;
  let prof = MIC_PROFILES[profIdx];"""),

    ("""  let stream = null, err = null;
  try{ stream = await ask(want); }
  catch(e1){
    err = e1;
    if(micIsBusyErr(e1)){
      // it may be US holding it. Let go, give the OS a breath, ask once more.
      micRelease();
      await new Promise(r => setTimeout(r, 350));
      try{ stream = await ask(want); err = null; }catch(e2){ err = e2; }
    }
    if(!stream && wanted){            // that device may be gone — retry without it
      try{ stream = await ask(prof.c === true ? true : prof.c); err = null; }catch(e3){ err = e3; }
    }
  }""",
     """  let stream = null, err = null;
  /* preferred first, then the same thing without the named device, then every
     other capture mode. One release-and-retry per rung, because Android hands
     the microphone back a beat after another app lets go of it. */
  const rungs = [{p: prof, dev: wanted}];
  if(wanted) rungs.push({p: prof, dev: null});
  MIC_PROFILES.forEach((pp, i) => { if(i !== profIdx) rungs.push({p: pp, dev: null}); });

  for(const rung of rungs){
    const cc = (rung.p.c === true)
      ? (rung.dev ? {deviceId:{exact:rung.dev}} : true)
      : Object.assign({}, rung.p.c, rung.dev ? {deviceId:{exact:rung.dev}} : {});
    try{ stream = await ask(cc); err = null; }
    catch(eA){
      err = eA;
      if(micIsBusyErr(eA)){
        micRelease();
        await new Promise(r => setTimeout(r, 400));
        try{ stream = await ask(cc); err = null; }catch(eB){ err = eB; }
      }
    }
    if(stream){ prof = rung.p; break; }
  }
  /* go straight to what worked next time, instead of walking the ladder again */
  if(stream){ try{ localStorage.setItem('rep_micprof', String(MIC_PROFILES.indexOf(prof))); }catch(e){} }"""),

    # 4. THE PITCH MONITOR'S VERTICAL BLUE LINES.
    #    Robert, singing into a headset: "the line would come from the top of
    #    the box all the way down to the note, this giant vertical blue line".
    #    The tracker reads an octave out for a frame or two — every tracker
    #    does — and the chart joined that stray reading to the notes either
    #    side, drawing a slide nobody sang. Lift the pen across a jump no
    #    voice could make. A gap is true; a vertical line is not.
    #    The note and cents readout is untouched: it still reports exactly
    #    what was measured.
    ("""  c2.beginPath(); let started=false;
  for(const p of trail){
    if(p.m===null){ started=false; continue; }
    const x = W - (now-p.t)*pps;
    const y = yOf(p.m);
    if(!started){ c2.moveTo(x,y); started=true; } else c2.lineTo(x,y);
  }""",
     """  c2.beginPath(); let started=false, prev=null;
  for(const p of trail){
    if(p.m===null){ started=false; prev=null; continue; }
    const x = W - (now-p.t)*pps;
    const y = yOf(p.m);
    /* Frames arrive about every 16ms. A real leap, even a fast one, passes
       through the notes between it and leaves frames along the way; the
       tracker's slips do not — they are a clean jump of an octave, or
       sometimes a fifth. Break above a fifth, so genuine melodic leaps stay
       joined and only the slips are cut. */
    const leap = prev && (Math.abs(p.m - prev.m) > 6 || (p.t - prev.t) > 0.15);
    if(!started || leap){ c2.moveTo(x,y); started=true; } else c2.lineTo(x,y);
    prev = p;
  }"""),

    # 5. ...and the same stray frame used to yank the whole view, because the
    #    window centred on the single newest reading. It now centres on the
    #    median of the last moment, so one bad frame cannot move the chart.
    ("""  const vals = trail.filter(p=>p.m!==null).map(p=>p.m);
  const center = vals.length? vals[vals.length-1] : 57;""",
     """  const vals = trail.filter(p=>p.m!==null).map(p=>p.m);
  const near = trail.filter(p=>p.m!==null && now-p.t < 0.7).map(p=>p.m).sort((a,b)=>a-b);
  const center = near.length ? near[near.length >> 1]
               : (vals.length ? vals[vals.length-1] : 57);"""),

    # 6. Free Sing and the Pitch Tracker are two different features. The Sing
    #    menu and the Home card now open Free Sing (a screen of its own); the
    #    old pitch screen belongs to Train, so its back button goes there
    #    instead of offering a "Sing menu" nobody came from.
    ("""$('mcFree').addEventListener('click', ()=>switchMode('free'));""",
     """$('mcFree').addEventListener('click', ()=>switchMode('voice'));"""),
    ("""$('shFree').addEventListener('click', ()=>switchMode('free'));""",
     """$('shFree').addEventListener('click', ()=>switchMode('voice'));"""),
    ("""$('bsFree').addEventListener('click', ()=>switchMode('singhub'));""",
     """$('bsFree').addEventListener('click', ()=>switchMode('train'));"""),
    ('<button class="pill backpill" id="bsFree">\u2190 Sing menu</button>',
     '<button class="pill backpill" id="bsFree">\u2190 Train</button>'),

    # 12. TWO THINGS CALLED COACH ON ONE SCREEN. Robert, 13 Sep: the app's own
    #     coach is "From Repertoire" — named after what it is. The human coach's
    #     box above it already says "From Ja Ronn". Parallel, and no jargon.
    ("""    let h = '<h1 style="margin:0 0 4px">Coach</h1>';
    h += '<div class="notice" style="margin-bottom:12px">A plan that changes as you do. It reads what ' +
      'the app has actually measured — nothing else.</div>';""",
     """    let h = '<h1 style="margin:0 0 4px">From Repertoire</h1>';
    h += '<div class="notice" style="margin-bottom:12px">The app’s plan for you, built from what it has ' +
      'measured. It changes as you do.</div>';"""),

    # 13. Home's "Today" shows the same plan, read from the same function, so
    #     the two screens can never disagree.
    ("  V10.renderCoach = renderCoach;",
     "  V10.renderCoach = renderCoach;\n  V10.planFor = planFor;"),

    # 14. THE RANGE TEST ON A PROFILE PAGE. The pitch loop only fed the test
    #     while the Train tab was showing; the test now lives in Profile →
    #     Your voice, so on Briar's phone the bar never filled. Feed it
    #     wherever it is, as long as it is running.
    ("  if(state.mode==='train' && TRAIN.kind!=='ladder'){ trainFrame(dt); return; }",
     "  if((state.mode==='train' && TRAIN.kind!=='ladder') || RT.phase){ trainFrame(dt); return; }"),

    # 15. STEADY HISS STOPS WHEN YOU DO. A timed exercise counted up until
    #     Done was pressed — Briar stopped blowing and the clock kept going.
    #     A guided exercise never asked for the microphone, so it asks now;
    #     once air has been heard, a second of silence ends it and the time
    #     it actually lasted is the result. If the phone will not give up
    #     the microphone, it counts up the old way rather than sitting at 0.
    ("    GUIDE.on = true; GUIDE.ex = e; GUIDE.t0 = Date.now(); GUIDE.mode = eng.kind;",
     "    GUIDE.on = true; GUIDE.ex = e; GUIDE.t0 = Date.now(); GUIDE.mode = eng.kind;\n" +
     "    GUIDE.heard = false; GUIDE.heardAt = 0; GUIDE.quietSince = 0; GUIDE.askedMic = false; GUIDE.finished = false;\n" +
     "    if (eng.kind === 'timed' && typeof MIC !== 'undefined' && !MIC.on && typeof enableMic === 'function') {\n" +
     "      GUIDE.askedMic = true; try { enableMic(); } catch (err) {}\n" +
     "    }"),
    ("""    el.textContent = s.toFixed(1) + 's';
    if (GUIDE.mode === 'timed' && GUIDE.target) {""",
     """    if (GUIDE.finished) return;   /* the result stays on screen until the panel closes */
    const canHear = GUIDE.mode === 'timed' && typeof MIC !== 'undefined' && MIC.on;
    if (canHear) {
      const loud = MIC.level > 0.005;
      if (loud) { if (!GUIDE.heard) { GUIDE.heard = true; GUIDE.heardAt = s; } GUIDE.quietSince = 0; }
      else if (GUIDE.heard) { GUIDE.quietSince = (GUIDE.quietSince || 0) + 0.1; }
      if (GUIDE.heard && GUIDE.quietSince >= 1.0) {
        const held = Math.max(0, s - GUIDE.quietSince - GUIDE.heardAt);
        el.textContent = held.toFixed(1) + 's';
        sub.textContent = 'Stopped when you did — ' + held.toFixed(1) + ' seconds' +
          (GUIDE.target ? (held >= GUIDE.target ? ', past the ' + GUIDE.target + ' you were aiming for.' : ' of the ' + GUIDE.target + ' you were aiming for.') : '.');
        try { if (window.RP && RP.logResult) RP.logResult({ kind: 'practice', label: GUIDE.ex ? GUIDE.ex.name : 'Timed', score: Math.round(held), out_of: GUIDE.target || null }); } catch (e) {}
        GUIDE.heard = false; GUIDE.quietSince = 0; GUIDE.finished = true;
        setTimeout(endGuided, 1400);
        return;
      }
      if (!GUIDE.heard) { el.textContent = '0.0s'; sub.textContent = 'Start when you are ready — it times itself from the first sound.'; return; }
      el.textContent = (s - GUIDE.heardAt).toFixed(1) + 's';
    } else {
      el.textContent = s.toFixed(1) + 's';
    }
    if (GUIDE.mode === 'timed' && GUIDE.target) {"""),

    # 16. THE LADDER'S VERTICAL LINE. The same octave-slip that was fixed on
    #     the Pitch Tracker (patch 4) was still drawn on the exercise chart —
    #     Briar's lip trill showed the line dropping from the top to meet her.
    #     Lift the pen across a jump no voice makes.
    ("""    for(const pt of G.trail){
      if(pt.m===null){ started=false; continue; }
      const x = nowX + (pt.b-beat)*ppb;
      if(x<-20) continue;
      const disp = state.octaveEquiv? foldToRange(pt.m, lo, hi) : pt.m;
      const y = yOf(disp);
      if(!started){ cx2.moveTo(x,y); started=true; } else cx2.lineTo(x,y);
    }""",
     """    let prevM=null;
    for(const pt of G.trail){
      if(pt.m===null){ started=false; prevM=null; continue; }
      const x = nowX + (pt.b-beat)*ppb;
      if(x<-20) continue;
      const disp = state.octaveEquiv? foldToRange(pt.m, lo, hi) : pt.m;
      const y = yOf(disp);
      const leap = prevM!==null && Math.abs(disp-prevM) > 6;
      if(!started || leap){ cx2.moveTo(x,y); started=true; } else cx2.lineTo(x,y);
      prevM = disp;
    }"""),

    # 17. NOTE MATCH COUNTS. It ended in an alert and wrote nothing down, so it
    #     earned no points and never reached the coach's scorecard. Same
    #     shape as the ear drills: score out of rounds.
    ("""  const pct = Math.round(100*MATCH.score/MATCH.total);
  const msg = pct>=90?'Incredible ear.':pct>=70?'Strong — keep drilling.':pct>=40?'Coming along — get your reps in daily.':'Everyone starts here. Run it again.';""",
     """  const pct = Math.round(100*MATCH.score/MATCH.total);
  try { if (window.RP && RP.logResult) RP.logResult({ kind: 'ear', label: 'Ear · Note Match', score: MATCH.score, out_of: MATCH.total }); } catch (e) {}
  const msg = pct>=90?'Incredible ear.':pct>=70?'Strong — keep drilling.':pct>=40?'Coming along — get your reps in daily.':'Everyone starts here. Run it again.';"""),

    # 18. A MEZZO PRESET. The list jumped from Alto to Soprano; most voices in
    #     between had no row.
    ("""            <option value="53,77">Alto (F3–F5)</option>
            <option value="60,84">Soprano (C4–C6)</option>""",
     """            <option value="53,77">Alto (F3–F5)</option>
            <option value="57,81">Mezzo-soprano (A3–A5)</option>
            <option value="60,84">Soprano (C4–C6)</option>"""),

    # 19. YOUR COACH IS NOT A "HE". Robert, 13 Sep: "that's not ok in today's
    #     times." Every lesson that said he/him about the coach now says they.
    ("Your coach is not describing the song. He is telling you", "Your coach is not describing the song. They are telling you"),
    ("Three things, and they are the reason he said it:", "Three things, and they are the reason they said it:"),
    ("""Now when he says "you're flat on the 5", you know which note he means without asking.""",
     """Now when they say "you're flat on the 5", you know which note they mean without asking."""),
    ("he is at the piano playing a chord when he says it.", "they are at the piano playing a chord when they say it."),
    ("Clue: he is talking about", "Clue: they are talking about"),
    ("Clue: he is teaching you a backing part", "Clue: they are teaching you a backing part"),
    ("means something completely different to him than it does in a theory book.", "means something completely different to them than it does in a theory book."),
    ("that word, check which one he means.", "that word, check which one they mean."),

    # 20. A HOOK AFTER THE LIVE LINE. Robert, 13 Sep: on playback, show the
    #     take's notes on the main key map in a different colour and keep the
    #     live voice blue. The tracker's scale (pps, yOf) is local to its draw,
    #     so it is handed out here; rp-studio.js draws the take with it.
    ("""  c2.shadowBlur=0; c2.lineWidth=1;
  const lastLive = trail.length && trail[trail.length-1].m!==null && now-trail[trail.length-1].t < 0.6""",
     """  c2.shadowBlur=0; c2.lineWidth=1;
  if(window.__rpOverlay){ try{ window.__rpOverlay(c2, W, H, now, pps, yOf); }catch(e){} }
  const lastLive = trail.length && trail[trail.length-1].m!==null && now-trail[trail.length-1].t < 0.6"""),

    # 21. THE AUDIO CLOCK, ASKED FOR AS LIVE AS THE PHONE CAN GIVE. Briar,
    #     13 Sep: the live mic feedback is about a second late. Part of that
    #     is the phone and its headphones, which no app can remove; this part
    #     is ours to ask for. The plain constructor stays as the fallback.
    ("    ctx = new (window.AudioContext||window.webkitAudioContext)();",
     "    try { ctx = new (window.AudioContext||window.webkitAudioContext)({ latencyHint: 'interactive' }); }\n"
     "    catch (e) { ctx = new (window.AudioContext||window.webkitAudioContext)(); }"),

    # 22. THE CHART'S CLOCK. Two things read it: the words and bars are drawn
    #     where the sound has REACHED THE EARS (the phone's reported output
    #     delay, window.__rpHeardS, set by rp-timing.js), so what lights up is
    #     what is heard; and after the run, or while dragging back, the chart
    #     is drawn at an earlier beat (window.__rpScrollB, rp-scroll.js).
    ("  const beat = G.running? songBeat() : 0;",
     "  const beat = (G.running ? songBeat() - (window.__rpHeardS||0)*T.bps : (G.lastBeat||0)) - (window.__rpScrollB||0);"),
    ("  const ppb = Math.max(28, Math.min(160, (W-nowX)/Math.max(0.5, state.lookahead*bpsNow)));",
     "  const ppb = Math.max(28, Math.min(160, (W-nowX)/Math.max(0.5, state.lookahead*bpsNow)));\n"
     "  window.__rpPpb = ppb;"),
    ("function renderLyrics(s, beat){",
     "function renderLyrics(s, beat){\n"
     "  if(beat >= 0) beat -= (window.__rpHeardS||0)*T.bps;   /* light the word when it is HEARD */"),

    # 23. Where the run stopped, kept, so the chart can still be scrolled
    #     back through afterwards. A fresh start clears it.
    ("  stopSong();\n  G.running=false;",
     "  try{ if(T.playing) G.lastBeat = Math.max(0, songBeat()); }catch(e){}\n  stopSong();\n  G.running=false;"),
    ("  G.trail=[]; G.lastT=performance.now(); G.winLo=null; G.winHi=null;",
     "  G.trail=[]; G.lastBeat=0; G.lastT=performance.now(); G.winLo=null; G.winHi=null;"),

    # 24. The Pitch Tracker's clock, same idea: drag back to see what you sang.
    ("  drawPitchLane(fcx, fcv, FREE.trail, now);",
     "  drawPitchLane(fcx, fcv, FREE.trail, now - (window.__rpScrollS||0));"),

    # 25. THE GUIDED PANEL LEADS WITH WHAT THE EXERCISE IS. Briar: "the Blah
    #     exercise isn't intuitive — just a timer." Now: the name, what it is,
    #     a Hear-it button (rp-example.js), then the clock, then how.
    ("""        '<button class="btn danger ghost" id="gQuit" style="padding:7px 12px;font-size:12px">Done</button>' +
      '</div>' +
      '<div style="text-align:center;margin:14px 0">' +""",
     """        '<button class="btn danger ghost" id="gQuit" style="padding:7px 12px;font-size:12px">Done</button>' +
      '</div>' +
      (e.what ? '<div style="font-size:14px;line-height:1.5;margin-top:8px">' + e.what + '</div>' : '') +
      (window.RPExample && RPExample.enabled ? '<div style="margin-top:8px">' + RPExample.button(e.id) + '</div>' : '') +
      '<div style="text-align:center;margin:14px 0">' +"""),

    # 26. A VOICE, NOT A PIANO, FOR THE NOTE TO MATCH AND THE NOTE TO HOLD.
    #     Briar: "some people find it easier to match the note of a voice."
    #     V10.playRef is the app's own switch (voice by default, piano if the
    #     singer flips it in Profile); these three calls had bypassed it.
    ("  playPiano(MATCH.target, ctx.currentTime+0.02, 1.4, guideGain, 0.7);",
     "  (window.V10 && V10.playRef ? V10.playRef : playPiano)(MATCH.target, ctx.currentTime+0.02, 1.4, guideGain, 0.7);"),
    ("playPiano(SUS.target, ctx.currentTime+0.02, 1.4, guideGain, 0.7);",
     "(window.V10 && V10.playRef ? V10.playRef : playPiano)(SUS.target, ctx.currentTime+0.02, 1.4, guideGain, 0.7);"),
    ("  playPiano(SUS.target, ctx.currentTime+0.02, 1.2, guideGain, 0.7);",
     "  (window.V10 && V10.playRef ? V10.playRef : playPiano)(SUS.target, ctx.currentTime+0.02, 1.2, guideGain, 0.7);"),

    # 27. Note Match's card said "I play a piano note". It is a voice unless
    #     Reference notes is set to piano in Profile, so say what happens.
    ("<p>I play a piano note — you sing it back and hold it. 10 rounds. The purest pitch trainer there is.</p>",
     "<p>You hear a note — sing it back and hold it. 10 rounds.</p>"),

    # 28. THE RANGE TEST TOOK THE FIRST NOTE IT HEARD. Briar: "it just cuts
    #     out at the first note it hears — give people a few seconds and use
    #     the highest / lowest note it tracked." About four seconds of voice
    #     now, and the extremes of what was sung, trimmed of glitches.
    ("  const need = 80; // ~1.5s of voiced audio",
     "  const need = 240; // ~4s of voiced audio — the first note is not the lowest note"),
    ("      RANGE.lo = Math.round(percentile(RT.samples, 0.15));",
     "      RANGE.lo = Math.round(percentile(RT.samples, 0.05));"),
    ("      RANGE.hi = Math.round(percentile(RT.samples, 0.85));",
     "      RANGE.hi = Math.round(percentile(RT.samples, 0.95));"),
    ("  $('rtPrompt').innerHTML = 'Sing your <span style=\"color:var(--accent2)\">LOWEST</span> comfortable note on “oooh” and hold it…';",
     "  $('rtPrompt').innerHTML = 'Sing your <span style=\"color:var(--accent2)\">LOWEST</span> comfortable note on “oooh” and keep going until the bar fills — slide lower if you can…';"),
    ("      $('rtPrompt').innerHTML = 'Got it! Now your <span style=\"color:var(--gold)\">HIGHEST</span> comfortable note — “oooh”, no straining…';",
     "      $('rtPrompt').innerHTML = 'Got it! Now your <span style=\"color:var(--gold)\">HIGHEST</span> comfortable note — “oooh”, keep going until the bar fills, no straining…';"),

    # 29. THE KEYBOARD, SIDEWAYS. Briar: "when people turn the phone sideways
    #     it should expand to show more keys." The base already re-draws on
    #     resize; the width of the window is now the width of the phone.
    ("  const host = document.getElementById('kbdKeys');\n  if(!host) return;\n  host.innerHTML = '';",
     "  const host = document.getElementById('kbdKeys');\n  if(!host) return;\n"
     "  KBD.span = window.innerWidth > window.innerHeight ? 29 : 17;   /* sideways: nearly two octaves */\n"
     "  if(KBD.lo + KBD.span > 100) KBD.lo = kbdWhiteBelow(100 - KBD.span);\n"
     "  host.innerHTML = '';"),

    # 30. A HELD KEY GOES QUIET SO THE MIC CAN HEAR YOU. Briar: holding a key
    #     down, the app tracked her voice badly; letting go, it tracked her
    #     perfectly. The key was the loudest sound the app makes, and the
    #     phone's mic hears it as well as her. It still rings; after a second
    #     it drops to a hum under the voice.
    ("  g.gain.linearRampToValueAtTime(0.92, t + 0.015);",
     "  g.gain.linearRampToValueAtTime(0.92, t + 0.015);\n"
     "  g.gain.setValueAtTime(0.92, t + 1.0);\n"
     "  g.gain.exponentialRampToValueAtTime(0.12, t + 1.6);   /* the mic hears the key too */"),
    ("'<div class=\"notice\" id=\"kbdMsg\" style=\"margin-top:10px\">Tap a key and it rings like a piano; hold it and it stays' +\n"
     "      ' until you let go. The arrows slide the keyboard one key at a time &mdash; they never jump an octave.</div>'",
     "'<div class=\"notice\" id=\"kbdMsg\" style=\"margin-top:10px\">Tap a key, then sing it. A held key goes quiet after a second so the mic hears you, not the key.' +\n"
     "      ' Turn the phone sideways for more keys. This is free play &mdash; Note Match and Sustain Hold are the scored versions.</div>'"),

    # 31. "FIND HOME" MEANT NOTHING TO BRIAR. Said the way it would be said.
    ("      ['tonic', 'Find home', 'A phrase plays. Sing the note it wants to rest on.',",
     "      ['tonic', 'Sing the home note', 'A short tune plays. Sing the note it sounds finished on.',"),
    ("    const titles = { tonic: 'Find home', degree: 'Name the degree', singdeg: 'Sing the degree', hilo: 'Higher or lower' };",
     "    const titles = { tonic: 'Sing the home note', degree: 'Name the degree', singdeg: 'Sing the degree', hilo: 'Higher or lower' };"),
    ("      h += '<div style=\"font-size:15px;font-weight:800;color:var(--ink-dim)\">Sing the note it wants to rest on</div>' +",
     "      h += '<div style=\"font-size:15px;font-weight:800;color:var(--ink-dim)\">Sing the note the tune sounds finished on</div>' +"),

    # 32. NAME THE INTERVAL, BY EAR. Robert: showing the two notes on the keys
    #     made it counting, not hearing. It plays them and shows no keys. Two
    #     new games for advanced ears keep the keys: play the note you hear,
    #     play the interval you hear.
    ("      return { kind: 'choice', lo: root, n: 13, root, highlight: [root, root + s],\n"
     "        prompt: 'How far apart are these two notes?',",
     "      return { kind: 'choice', lo: root, n: 13, root, highlight: [], ear: true,\n"
     "        prompt: 'Listen. How far apart are the two notes?',"),
    ("    if (id === 'interval') {\n      const sizes = G.hard > 2",
     "    if (id === 'playnote' || id === 'playint') {\n"
     "      const sizes = G.hard > 2 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [2, 4, 5, 7, 9, 12];\n"
     "      const s = sizes[Math.floor(Math.random() * sizes.length)];\n"
     "      return { kind: 'pick', lo: root, n: 13, root, ref: root,\n"
     "        target: id === 'playnote' ? [root + s] : [root, root + s],\n"
     "        prompt: id === 'playnote' ? 'The lit key plays, then another note. Play that other note.'\n"
     "                                  : 'Two notes play; the first is lit. Play both, in order.',\n"
     "        after: 'The second note was a ' + ['unison','2nd','2nd','3rd','3rd','4th','tritone','5th','6th','6th','7th','7th','octave'][s] + ' up from the first.' };\n"
     "    }\n"
     "    if (id === 'interval') {\n      const sizes = G.hard > 2"),
    ("    { id: 'interval', name: 'Name the interval', level: 3, need: 2,\n"
     "      teaches: 'Distance between two notes, counted inclusively.',\n"
     "      why: 'The inclusive count is the number one beginner stumble: two steps is called a third.' }\n"
     "  ];",
     "    { id: 'interval', name: 'Name the interval', level: 3, need: 2,\n"
     "      teaches: 'Two notes play. How far apart are they?',\n"
     "      why: 'By ear, with no keys to count. A third and a fifth sound different long before you can name them.' },\n"
     "    { id: 'playnote', name: 'Play the note you hear', level: 3, need: 2,\n"
     "      teaches: 'A note plays after a lit one. Find it on the keys.',\n"
     "      why: 'Hearing a note and finding it is the ear and the hand working together.' },\n"
     "    { id: 'playint', name: 'Play the interval you hear', level: 3, need: 2,\n"
     "      teaches: 'Two notes play. Play them both.',\n"
     "      why: 'The same skill, one step harder: the distance has to be right, not just the note.' }\n"
     "  ];"),
    ("    } else {\n      h += kbd(q.lo, q.n, {\n        label: labeller(q),\n        state: m => (q.highlight || q.show || []).indexOf(m) >= 0 ? 'lit' : ''\n      });",
     "    } else {\n      if (!q.ear) h += kbd(q.lo, q.n, {\n        label: labeller(q),\n        state: m => (q.highlight || q.show || []).indexOf(m) >= 0 ? 'lit' : ''\n      });"),
    ("        state: m => {\n          if (feedback && q.target.indexOf(m) >= 0) return 'ok';",
     "        state: m => {\n          if (q.ref === m && q.target.indexOf(m) < 0 && done.indexOf(m) < 0) return 'lit';\n          if (feedback && q.target.indexOf(m) >= 0) return 'ok';"),
    ("      playRun(q.target || [q.root]);\n      return;\n    }\n    playRun(q.show || [q.root]);",
     "      playRun(q.ref != null && q.target.indexOf(q.ref) < 0 ? [q.ref].concat(q.target) : (q.target || [q.root]));\n      return;\n    }\n    playRun(q.show || [q.root]);"),
    ("    play(m, 0, 0.5, 0.5);\n    const i = G.picked.length;",
     "    play(m, 0, 0.5, 0.5);\n    if (q.ref === m && q.target.indexOf(m) < 0) return;   /* the reference key is not an answer */\n    const i = G.picked.length;"),

    # 33. TWO LEARN CARDS, SAID PLAINLY. Briar: chords and harmony, and triads,
    #     "just plainly confusing."
    ("""      body: `<p>Two or more notes at once. As a singer you almost never build one — but you are singing
      <i>over</i> one at every moment, and which note of it you land on is most of what makes a melody
      sound right or wrong.</p>`""",
     """      body: `<p>A <b>chord</b> is two or more notes played at the same time. A guitar strum is a chord.
      Three piano keys pressed together is a chord.</p>
      <p>Singers hardly ever sing chords. You sing one note while the band plays the chord underneath
      you. Which note of that chord you land on is most of what makes a tune sound right.</p>`"""),
    ("""      body: `<p>The standard chord is three notes: <b>1, 3 and 5</b> of a scale starting on the chord's
      own note. In C: <b>C, E, G</b>.</p>
      <p>The bottom note is the <b>root</b> and gives the chord its name. The <b>third</b> decides
      major or minor. The <b>fifth</b> mostly just fills it out.</p>`""",
     """      body: `<p>The usual chord has three notes. Start on any note. Skip a note, take the next. Skip a
      note, take the next. Starting on C that gives <b>C, E and G</b>.</p>
      <p>The bottom note is the <b>root</b>, and it names the chord: this one is called C. The middle
      note is the <b>third</b>, and it decides whether the chord sounds bright (major) or sad (minor).
      The top note is the <b>fifth</b>, and it fills the sound out.</p>`"""),

    # 34. COPY THAT TALKED TO ROBERT. Robert: "so much of this app text is
    #     written like you are talking to me specifically." Said to the
    #     singer holding the phone.
    ("      note: 'Robert — this is my best identification of the exercise you described as <b>\"bhay\"</b>. ' +\n"
     "            'If yours was a bratty belting sound, this is it. If yours was a loose floppy-tongue ' +\n"
     "            'release, you want <b>Blah</b> in the Articulation group instead. I could not be certain ' +\n"
     "            'from the spelling, so both are here.'",
     "      note: 'Coaches spell this one differently. If yours means a bratty belting sound, this is it. ' +\n"
     "            'If yours means a loose, floppy-tongue release, use <b>Blah</b> in the Articulation group instead.'"),
    ("      note: '<b>Honest label:</b> both halves of this are well documented on their own, but I could not ' +\n"
     "            'find a source that names the combination as a standard exercise. It is a coherent, safe ' +\n"
     "            'thing a coach would plausibly assign — I am describing it as a combination rather than ' +\n"
     "            'dressing it up as a classic.'",
     "      note: 'Both halves of this are standard exercises. Putting them together is a safe combination, ' +\n"
     "            'not a classic with a name of its own.'"),
    ("      note: 'The family this belongs to is well attested; this exact syllable is not documented as a ' +\n"
     "            'named exercise anywhere I could find. Here in case it is the \"blah\" you were taught.'",
     "      note: 'A tongue-release exercise. Coaches use different syllables for it; this is the loose one.'"),
    ("blurb: 'The colour of the sound, and where your voice changes gear. Robert: this is the one I could not practise around.' },",
     "blurb: 'The colour of the sound, and where your voice changes gear.' },"),
    ("      '<div class=\"ctl\"><label>What should I call you?</label>' +",
     "      '<div class=\"ctl\"><label>Your name</label>' +"),

    # 35. THE WHOLE RUN CAN BE SCROLLED BACK THROUGH. 600 points was ten
    #     seconds of voice; the bars went further back than the line did.
    ("  if(G.trail.length>600) G.trail.shift();",
     "  if(G.trail.length>9000) G.trail.shift();"),

    # 36. THE GAME'S QUIT. Robert's audit, 17 Sep: a theory game could not be
    #     quit. Its Quit button had the same id as the guided panel's Done, and
    #     $('gQuit') found the Done button first, so the game's Quit was never
    #     wired. Its own id, looked up on its own panel.
    ("""'<button class="btn danger ghost" id="gQuit" style="padding:7px 12px;font-size:12px">Quit</button></div>';""",
     """'<button class="btn danger ghost" id="gameQuit" style="padding:7px 12px;font-size:12px">Quit</button></div>';"""),
    ("const qb = $('gQuit'); if (qb) qb.addEventListener('click', quit);",
     "const qb = p.querySelector('#gameQuit'); if (qb) qb.addEventListener('click', quit);"),

    # 2a. "101% steady" — SUS.within keeps accumulating on the frame that ends
    #     the hold, so the time spent on the note could come out fractionally
    #     longer than the hold itself. A percentage over 100 is exactly the
    #     kind of number this app refuses everywhere else.
    ("    const pct = Math.round(100*SUS.within/SUS.dur);",
     "    const pct = Math.min(100, Math.round(100*SUS.within/SUS.dur));"),

    # 2. Steady note: the percentage of the hold that stayed inside the window.
    ("    $('susResult').textContent = pct+'% steady — '+msg;",
     "    $('susResult').textContent = pct+'% steady — '+msg;\n"
     "    try { if (window.RP && RP.logResult) RP.logResult({ kind: 'sustain',\n"
     "      label: 'Steady note', pct: pct, seconds: SUS.dur }); } catch (e) {}"),
]
# ---------------------------------------------------------------------
# Home, in plain words with a sense of where you are in the session.
# "scale ladder", "note maps" and "key guardrails" told a beginner nothing.
# ---------------------------------------------------------------------
WORDS = [
    ('<div class="js">scale ladder &middot; 5 min</div>', '<div class="js">Step 1 &middot; 5 min</div>'),
    ('<div class="js">scale ladder · 5 min</div>',        '<div class="js">Step 1 · 5 min</div>'),
    ('<div class="js">note match · 5 min</div>',          '<div class="js">Step 2 · 5 min</div>'),
    ('<div class="js">your song · 5 min</div>',           '<div class="js">Step 3 · 5 min</div>'),
    ('<p>Warmups &amp; exercises, on the keys</p>',
     '<p>Exercises that build your voice, a level at a time</p>'),
    ('<p>Your song &mdash; note bars, words, scoring</p>',
     '<p>Sing a song and see every note you hit</p>'),
    ('<p>Sing with any video &mdash; key guardrails</p>',
     '<p>Sing along to any video, kept in your range</p>'),
    ('<p>Songs, takes &amp; note maps</p>',
     '<p>Your songs, and every take you have recorded</p>'),
    ('<h4>Pitch Monitor</h4><p>Your voice, live on the keyboard</p>',
     '<h4>Free Sing</h4><p>Sing freely and watch your pitch, and record a take</p>'),
    ('<p>Note bars, words &amp; scoring &mdash; your songs, takes or built-ins</p>',
     '<p>Sing a song and see every note you hit</p>'),
    ('<p>Karaoke over songs you own, with key rails</p>',
     '<p>Sing over songs you own, kept in your range</p>'),
    ('<h4>Pitch Monitor</h4><p>Live pitch on the keys — see the exact note</p>',
     '<h4>Free Sing</h4><p>Sing freely and watch your pitch, and record a take</p>'),
]
for a, r in WORDS:
    if a in base:
        base = base.replace(a, r)


# ---------------------------------------------------------------------
# THE WRITING PASS (Robert, 15 Sep). Briar: "it's all written like ChatGPT,
# nobody actually talks like that." Each entry is the sentence as a person
# reads it on screen, and what it says now. The matcher tolerates the
# base's line breaks and ' + ' string joins, so the anchor is the words.
# ---------------------------------------------------------------------
import re as _re
def _loose(s):
    sep = r"(?:\s|'\s*\+\s*')+"
    return sep.join(_re.escape(w).replace("'", r"\\?'") for w in s.split())
def rewrite(text, pairs, where):
    for old, new in pairs:
        text, n = _re.subn(_loose(old), lambda m: new, text)
        assert n == 1, 'writing pass (%s): found %d, expected 1: %r' % (where, n, old[:70])
    return text

WRITING = [
    # ---- Coach tab: From Repertoire ----
    ("I pick the session, I say why first, and I keep it to one thing at a time. Best if you do not yet know what you need — which is most people at the start, including me about you.",
     "Repertoire picks the session, says why, and keeps it to one thing at a time. Best if you do not yet know what you need."),
    ("I propose a session and offer two or three alternatives. You pick the order within the block.",
     "Repertoire suggests a session and two or three alternatives. You pick."),
    ("You assemble the session. I show you what the numbers say and tell you what I think you are leaving out.",
     "You build the session. Repertoire shows you the numbers and what you might be leaving out."),
    ("Days, not minutes — deliberately. In a study of practice sessions ranging from 8 to 57 minutes, neither total time nor number of correct repetitions predicted how well people played the next day. What predicted it was how they handled mistakes. So this app will never set you a minute target, and it counts <b>4 to 6 days a week with a rest day</b> as a full week rather than punishing you for not doing seven. Missing one day does not set you back — that is measured, not encouragement.",
     "Days, not minutes. <b>Four to six days a week with a rest day</b> counts as a full week. Missing a day does not set you back."),
    ("<b>Worth saying plainly.</b> Most coaches would start you on pitch, because it transfers faster and it is the thing people notice. You have asked for tone. That is a legitimate route and the evidence is friendlier to it than the convention suggests — one study of registration work alone improved pitch accuracy by 157 cents against 46 for a control group, and the singers who were worst gained the most. Pitch work is folded in here at a lower dose from the start rather than removed. You can flip this any time.",
     "Most coaches would start you on pitch, because it shows fastest. You picked tone. That works too, and you still get a little pitch work from the start. Change it any time."),
    ("Pitch first is the conventional order and it transfers fast. One thing to know: if practising while you sound rough is what stops you practising at all, switching to tone for a few weeks is a real strategy and not a cop-out. Say so and I will reorder it.",
     "Pitch first is the usual order, and it shows fast. If sounding rough puts you off practising, switch to tone for a few weeks. That is a real plan, not a cop-out."),
    ("How much should I push?", "How much should the app decide?"),
    ("This changes who chooses and how much I explain. It never changes whether there is a plan — the best teaching is high on both structure and choice, not a trade between them. I will also step back on my own as you get further in, and tell you when I do.",
     "This only changes who chooses and how much gets explained. There is always a plan."),
    ("Naming a time and a place is the single best-evidenced thing on this screen. In one study, people who only had the intention to exercise managed it 35% of the time; the ones who wrote down the day, time and place managed 91%.",
     "Pick a time and a place. People who write down when and where they will practise do it far more often than people who only mean to."),
    ("Turn this on and the Coach tab becomes your coach's channel instead of mine: they set the week's work, your practice records itself, and they review it in their own time.",
     "Sign in and join your coach with their code, and this tab becomes their channel: they set the work, you record, they listen in their own time."),
    ("<b>Not built yet — this is the shape, not a working link.</b> Sending takes to another person needs an account system and a server, which is Phase 2. What works today: the recordings are tagged and titled, so they can be shared by hand.",
     "Join your coach from the top of this tab, with the code they give you."),
    ("What I can and cannot tell you", "What the app can and cannot tell you"),
    ("<span class=\"lab\">I CAN MEASURE</span>", "<span class=\"lab\">IT CAN MEASURE</span>"),
    ("<span class=\"lab\">I CANNOT MEASURE</span>", "<span class=\"lab\">IT CANNOT MEASURE</span>"),
    ("Those need equipment a phone does not have, and the ones that can be approximated from audio fall apart in an ordinary room on an ordinary phone. The best validated measure of tone quality in the research explains about two thirds of what a listener hears at its very best — and the expert listeners it was validated against only agree with themselves 39% of the time. So I will give you numbers and leave the judgement to you.",
     "Those need equipment a phone does not have. So you get the numbers, and the judgement stays yours."),
    # ---- Sing, Song, Tracker, Profile chrome ----
    ("Pick your stage.", "Pick one."),
    ("Settings for this device. Everything here is remembered.", "Your account, your voice, and how the app works."),
    ("The horizontal lines are notes (C in gold). Hold a note and try to keep your blue line flat and centered on a note line. Steadiness scores how level you hold your pitch.",
     "The lines are notes, with C in gold. The blue line is your voice. Keep it flat on a line and Steadiness goes up."),
    ("<b>Sound not working? Plug your headphones in first</b> — that is when it breaks, so that is when to test it. Then press <b>1</b> and <b>2</b>, in that order. Each one prints an answer, and between them they say whether it is the app, the microphone, or the phone itself.",
     "<b>No sound?</b> Plug your headphones in first, then press <b>1</b> and <b>2</b> in that order. Each one says what it found."),
    ("Everything you record and every note map you build is stored on this device only. Nothing is uploaded anywhere.",
     "Recordings stay on this phone unless you send one to your coach."),
    ("<b>How this app talks about your voice.</b> It reports what it measured and stops there. It will tell you how many cents off a note was, because it counted; it will not tell you whether you sounded good, because it cannot hear that and neither can any software. When conditions are too noisy to measure something honestly, it says so instead of guessing.",
     "The app tells you what it measured and stops there. It can say how far off a note was. It cannot say whether it sounded good, and it will not pretend to."),
    ("Everything in Repertoire lives on this phone and nowhere else. There is no account, no server and no sign-in — so nothing here is sent anywhere, and clearing your browser data would clear it. Accounts and sync are a later job.",
     "Sign in and your range, your takes and your progress follow you to a new phone."),
    ("<b>This one is worth a minute of your time.</b> In a study where people matched pitch against five different reference sounds, the average error was 46 cents against a live voice and about 188 against a piano — four times worse. The people who were <i>worst</i> with the piano improved the most with a voice. Every reference note in this app used to be a piano.<br><br>Being straight with you: what you get here is a <b>synthesised voice-like tone</b>, not a recording of a person. It has a soft onset, vibrato and vowel-shaped resonance, so it is far closer to a sung note than a piano is — but the study measured real voices and I am not claiming this recovers the whole difference. A real recorded voice would be better, and you recording your own reference notes is the honest way to get there.",
     "People match a voice more closely than a piano, and the ones who find a piano hardest gain the most from a voice. So every reference note here is a voice-like tone. It is made by the app, not recorded from a person. A real recorded voice would be better."),
    # ---- exercise scoring notes ----
    ("The app tracks your pitch on this one and can tell you how far off you were, in cents. It cannot tell you whether it sounded good — that part is still yours.",
     "The app tracks your pitch on this one and tells you how far off you were. Whether it sounded good is your call."),
    ("The app times this one. That is all it does — it cannot see your breathing, so it will not tell you anything about your support.",
     "The app only times this one. It cannot see your breathing."),
    ("The app does not score this one. There is no honest way to measure it from a phone microphone, so it guides you and stays quiet rather than inventing a number.",
     "The app does not score this one. A phone microphone cannot measure it, so the app guides you and does not invent a number."),
    # ---- exercises ----
    ("The trill stalling at the top — that means the air stopped or the throat gripped, and it is information, not failure.",
     "The trill stalling at the top. That means the air stopped or the throat gripped."),
    ("The most precisely controllable version of the same effect as lip trills — the straw is a calibrated resistor. It has the strongest research base of anything in this library.",
     "The same idea as lip trills, but the straw sets the resistance for you. It is the best-researched exercise in the app."),
    ("The three errors Titze names: <b>air escaping around the straw</b>,", "<b>Air escaping around the straw</b>,"),
    ("It is the single most prescribed warm-up there is, and the best diagnostic in the whole library — what your voice does on a siren tells you what it will do everywhere else.",
     "It is the most common warm-up there is. What your voice does on a siren, it does everywhere else."),
    ("If nobody tells you that, you will reasonably conclude the exercise is broken.", ""),
    ("Here is the whole point in one sentence: <b>L uses the tip of your tongue and G uses the back of it.</b>",
     "<b>L uses the tip of your tongue and G uses the back of it.</b>"),
    ("note: 'Robert — this is your \"loga loga\".'", "note: ''"),
    ("Measured, not folklore: in one study seven of eight subjects showed real widening of the throat and a lowering of the larynx. It is a first-line treatment for a voice that is working too hard.",
     "A yawn opens the throat and lowers the larynx. It is one of the first things a voice therapist gives to a voice that is working too hard."),
    ("Counter-intuitive and badly under-used.", "Under-used."),
    ("A stamina test. The first top note is easy; the honest question is whether the fourth is as easy as the first.",
     "A stamina test. The first top note is easy. The question is whether the fourth is."),
    ("Physical therapy for your voice, and <b>the set with the strongest research base of anything in this library.</b> Dose matters far more than effort here.",
     "Physical therapy for your voice, and very well researched. Doing it every day matters far more than doing it hard."),
    # ---- lessons ----
    ("This is the atomic unit. Scales, keys, chord quality and transposing are all <i>defined</i> in half steps, and it is the single most under-taught idea in music. Get this one solid and four later lessons collapse into it.",
     "Scales, keys, chords and transposing are all built from half steps. Get this one solid and four later lessons get easy."),
    ("In this app, one press of <b>Move the key down</b> is exactly one half step. I measured it so you would not have to wonder.",
     "In this app, one press of <b>Move the key down</b> is exactly one half step."),
    ("That is why this unit comes before scales — the same order Berklee uses for singers.",
     "That is why this unit comes before scales."),
    ("This is the single most useful ear skill in music, and it is the one almost every ear-training app skips. There is a drill for it in Train → Ear.",
     "It is the most useful ear skill there is. There is a drill for it in Train, Ear: Sing the home note."),
    ("<p>Here is a genuinely useful thing that most ear training gets backwards.</p>", "<p>Most ear training gets this backwards.</p>"),
    ("<p class=\"say\"><b>Honest caveat:</b> nobody has run a head-to-head trial of the two approaches. Every curriculum I checked sequences it this way, and the perception research points the same direction — but that is agreement, not proof.</p>",
     "<p class=\"say\">Nobody has tested the two approaches head to head. Music schools teach it this way, and the research on hearing points the same way.</p>"),
    ("This phrase is genuinely ambiguous, and that ambiguity is doing the confusing — not you. It has three meanings:",
     "This phrase means three different things, which is why it confuses people:"),
    ("This is pure vocabulary and it takes five minutes, but not knowing it is the fastest way to look lost in a rehearsal.",
     "This is just vocabulary, and it takes five minutes to learn."),
    ("They are not the same, and the difference is the most practical idea in this whole tab.",
     "They are not the same, and the difference matters more than anything else here."),
    ("<p class=\"say\">There is a drill for the underlying ear skill in Train → Ear: <b>Sing the bass</b>. In one study, 88% of trained listeners said the bass line was how they identified what a chord was — more than any other strategy.</p>",
     "<p class=\"say\">Start with the ear drills in Train, Ear. Hearing where home is comes first.</p>"),
    ("This is the single most common place people hurt themselves in a warm-up.",
     "This is where people hurt themselves in a warm-up."),
    ("Getting louder and softer without the note changing is genuinely hard, because",
     "Getting louder and softer without the note changing is hard, because"),
    # ---- the daily plan's step notes ----
    ("Semi-occluded work first — the gentlest way to bring the instrument online.",
     "Lip trills, straws and hums first. The gentlest way to start."),
    ("Pick anything from your library and use today's one thing on it. This happens every session, not in week four.",
     "Pick any song and use today\\'s one thing on it."),
    ("Straw or hum, then descending. Singers report it helps; the objective evidence is not there yet. It takes two minutes and is very unlikely to hurt.",
     "Straw or hum, then a few notes coming down. Two minutes."),
    ("The single most common thing a coach says that beginners cannot act on.",
     "The thing coaches say most that beginners cannot act on."),
]
base = rewrite(base, WRITING, 'base')

# Robert, 16 Sep: "make every label say what it actually controls". This
# slider is the piano and the notes to match in exercises, not a guide.
base, _n = _re.subn(_re.escape("Guide &amp; warm-up volume"), "Exercise notes volume", base)
assert _n >= 3, 'guide volume label: found %d' % _n
base, _n = _re.subn(_re.escape("Guide & warm-up volume"), "Exercise notes volume", base)

# the transposition note, in both places it is written
base = rewrite(base, [
    ("Use these if the notes feel too high or too low for your voice. It moves the whole song, not just one note.",
     "Too high or too low? Each press moves the whole song one half step."),
    ("note.innerHTML = 'Use these if the notes feel too high or too low for your voice. ' + 'Each press moves everything by a half step &mdash; the smallest step in music &mdash; ' +",
     "note.innerHTML = 'Too high or too low? Each press moves everything by one half step, ' +"),
], 'transposition')

for anchor, replacement in PATCHES:
    n = base.count(anchor)
    assert n == 1, 'anchor found %d times, expected 1: %r' % (n, anchor[:60])
    base = base.replace(anchor, replacement, 1)

mods = ['<style>\n' + open('src/rp-skin.css', encoding='utf-8').read() + '\n</style>']
for f in ('src/rp-cloud.js', 'src/rp-coach.js', 'src/rp-score.js', 'src/rp-plain.js', 'src/rp-send.js', 'src/rp-studio.js', 'src/rp-voice.js', 'src/rp-work.js', 'src/rp-test.js', 'src/rp-level.js', 'src/rp-trivia.js', 'src/rp-body.js', 'src/rp-goals.js', 'src/rp-find.js', 'src/rp-range.js', 'src/rp-today.js', 'src/rp-pages.js', 'src/rp-nav.js', 'src/rp-train.js', 'src/rp-learn.js', 'src/rp-profile.js', 'src/rp-lib.js', 'src/rp-sus.js', 'src/rp-tour.js', 'src/rp-example.js', 'src/rp-timing.js', 'src/rp-scroll.js', 'src/rp-back.js', 'src/rp-once.js', 'src/rp-soundcheck.js', 'src/rp-monitor.js', 'src/rp-maps.js', 'src/rp-takes.js'):
    mods.append('<script>\n' + open(f, encoding='utf-8').read() + '\n</script>')
block = '\n<!-- ===== Repertoire Pro cloud layer (accounts, coach channel, scorecards) ===== -->\n' \
        + '\n'.join(mods) + '\n'

marker = '</body>'
assert base.count(marker) == 1, 'expected exactly one </body>'
open('next.html', 'w', encoding='utf-8').write(base.replace(marker, block + marker))
print('next.html written, %d hooks applied' % len(PATCHES))
PY
