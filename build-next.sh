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

for f in src/rp-cloud.js src/rp-coach.js src/rp-score.js src/rp-plain.js src/rp-studio.js src/rp-voice.js src/rp-send.js src/rp-work.js; do node --check "$f"; done
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

for anchor, replacement in PATCHES:
    n = base.count(anchor)
    assert n == 1, 'anchor found %d times, expected 1: %r' % (n, anchor[:60])
    base = base.replace(anchor, replacement, 1)

mods = ['<style>\n' + open('src/rp-skin.css', encoding='utf-8').read() + '\n</style>']
for f in ('src/rp-cloud.js', 'src/rp-coach.js', 'src/rp-score.js', 'src/rp-plain.js', 'src/rp-send.js', 'src/rp-studio.js', 'src/rp-voice.js', 'src/rp-work.js'):
    mods.append('<script>\n' + open(f, encoding='utf-8').read() + '\n</script>')
block = '\n<!-- ===== Repertoire Pro cloud layer (accounts, coach channel, scorecards) ===== -->\n' \
        + '\n'.join(mods) + '\n'

marker = '</body>'
assert base.count(marker) == 1, 'expected exactly one </body>'
open('next.html', 'w', encoding='utf-8').write(base.replace(marker, block + marker))
print('next.html written, %d hooks applied' % len(PATCHES))
PY
