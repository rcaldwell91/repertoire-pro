/* =====================================================================
   Repertoire Pro — LEARN A SONG: one screen, one map.

   Robert, 17 Sep, after the first attempt was built on the Song Trainer
   and handed him an editor: "ONE MAP. The big one, exactly the map Pitch
   Tracker already draws — full width, piano keys down the left, note
   lanes across. On that one map, two things at once: the song's notes,
   drawn as bubbles that fill up as you hold them, and his voice, the
   live line, drawn over the top of them."

   He had already made this picture by hand, with two phones: one take of
   the song played out loud, one of him singing over it. This does it for
   him, from one file.

   The map is not a copy. It is drawPitchLane — the same function the
   Pitch Tracker, Karaoke and the Library player all draw with — and the
   bubbles go on through __rpOverlay, the seam that is already there.
   The Pitch Tracker is not touched.

   Nothing else is on this screen. No editor, no Preview map, no Edit
   map, no Import MIDI, no Voice-only tickbox, no Build note map. He adds
   a file; the app works the notes out itself and shows a bar while it
   does; the map appears.

   One trick worth knowing: drawPitchLane puts `now` at the right-hand
   edge, so the future would be off-screen. This screen hands it a `now`
   that is LOOK seconds ahead, which slides the playhead back to about
   two-thirds across and leaves room for the notes coming at you. That is
   what he means by seeing where to come in.
   ===================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  var L = window.RPLearnSong = {};
  var LOOK = 2.4;            /* seconds of the song visible ahead of you */
  var S = {
    song: null, open: false, playing: false, raf: null,
    trail: [], t0: 0, vox: null, mus: null, voxUrl: null, musUrl: null,
    countdown: 0, hid: [], mapping: false,
    asleep: false, heldT: 0,           /* where the song got to before sleep */
    lastFrame: 0,                      /* for real elapsed time, not 60fps */
    synth: false, clock0: 0, sung: 0,  /* a built-in has no file: the app plays it */
    anyOct: false                      /* a note counts in its own octave unless he says */
  };
  try { S.anyOct = localStorage.getItem('rp_any_octave') === '1'; } catch (e) {}

  /* ---------------------------------------------------------------- */
  /* THE SCREEN                                                        */
  /* ---------------------------------------------------------------- */
  L.open = function (song) {
    var host = $('modeSong');
    if (!host || !song) return;
    S.song = song;
    S.open = true;
    S.trail = [];
    hideEngine(host);
    var box = $('rpLsScreen');
    if (!box) {
      box = document.createElement('div');
      box.id = 'rpLsScreen';
      host.appendChild(box);
    }
    box.style.display = '';
    box.innerHTML =
      '<button class="pill backpill" id="rpLsBack">← Learn a song</button>' +
      /* Robert, 20 Sep: a long file name filled the screen as an <h1>. A song
         title is a card title, not a page heading — same size as one, and it
         wraps like ordinary text. His file names are his own and are not
         renamed or trimmed to fit. */
      '<div style="font-size:18px;font-weight:900;line-height:1.25;margin:0 0 2px;' +
        'overflow-wrap:anywhere">' + esc(song.title || 'Your song') + '</div>' +
      '<div class="rp-sub" id="rpLsSub" style="margin:0 0 10px"> </div>' +
      '<div class="row" style="gap:8px;align-items:center;margin-bottom:8px">' +
        '<button class="btn primary" id="rpLsStart" style="padding:11px 18px">Start</button>' +
        '<button class="btn" id="rpLsStop" style="padding:11px 16px" disabled>Stop</button>' +
        '<span class="pill" id="rpLsClock" style="flex:none">0:00</span>' +
        '<button class="btn' + (S.anyOct ? ' primary' : '') + '" id="rpLsOct" style="padding:11px 12px;margin-left:auto">' +
          'Any octave: ' + (S.anyOct ? 'on' : 'off') + '</button>' +
      '</div>' +
      '<div class="notice" id="rpLsPhones" style="display:none;margin-bottom:8px"></div>' +
      '<div style="position:relative">' +
        '<canvas id="rpLsCv" style="display:block;width:100%;border-radius:var(--radius);' +
          'border:1px solid var(--line)"></canvas>' +
        '<div id="rpLsCount" style="position:absolute;inset:0;display:none;align-items:center;' +
          'justify-content:center;font-size:74px;font-weight:900;color:var(--gold);' +
          'text-shadow:0 2px 18px rgba(0,0,0,.6);pointer-events:none"></div>' +
      '</div>' +
      '<div id="rpLsScore" style="display:none;margin-top:12px"></div>' +
      '<div id="rpLsMix" style="margin-top:10px"></div>' +
      '<div class="measured" id="rpLsFoot" style="margin-top:10px"> </div>';
    on($('rpLsBack'), 'click', L.close);
    on($('rpLsStart'), 'click', start);
    on($('rpLsStop'), 'click', function () { stop(true); });
    on($('rpLsOct'), 'click', function () {
      S.anyOct = !S.anyOct;
      try { localStorage.setItem('rp_any_octave', S.anyOct ? '1' : '0'); } catch (e) {}
      var b = $('rpLsOct');
      if (b) { b.textContent = 'Any octave: ' + (S.anyOct ? 'on' : 'off'); b.classList.toggle('primary', S.anyOct); }
    });
    size();
    mix();
    phones();
    S.synth = !song.blob && !!(song.notes && song.notes.length);
    S.startWhenReady = false;
    S.cut = null;
    if (!song.blob && !S.synth) { sub('There is no sound on this one.'); foot(''); }
    else if (window.RPFileMap && RPFileMap.needsBuild(song)) autoMap();
    else {
      sub('Press Start. The bubbles are the song. Your line is you.');
      foot(S.synth ? 'This one is built in, so the app plays the tune itself.' : '');
    }
    loop();
  };

  L.close = function () {
    stop(true);
    S.open = false;
    var box = $('rpLsScreen');
    if (box) box.style.display = 'none';
    showEngine();
    if (window.RPSong && RPSong.doors) RPSong.doors();
  };

  /* Robert, 20 Sep: leaving by anything other than the screen's own back
     button — a bottom tab, the phone's back gesture, the app going to the
     background — left the song playing, and the only way he could stop it
     was the phone's media notification. Only the back button called close().

     So the sound is tied to the screen being on, not to one button. Leaving
     stops it for good; the phone going to sleep pauses it, the same way the
     Pitch Tracker already does. */
  function leave() {
    try { if (window.RPOneSound) RPOneSound.release('learn-a-song'); } catch (e) {}
    if (!S.open && !S.playing) return;
    S.asleep = false; S.heldT = 0;
    stop(true);
    S.open = false;
    var box = $('rpLsScreen');
    if (box) box.style.display = 'none';
    showEngine();
  }
  L.leave = leave;

  (function () {
    var real = window.switchMode;
    if (typeof real !== 'function' || real.rpLsWrapped) return;
    var wrapped = function (m) {
      /* staying on this tab is how the back button gets here; anything else
         is a way out of the screen */
      if (S.open && m !== 'song') leave();
      return real.apply(this, arguments);
    };
    wrapped.rpLsWrapped = true;
    window.switchMode = wrapped;
  })();

  /* the phone's own back gesture pops history rather than calling anything */
  window.addEventListener('popstate', function () { if (S.open) leave(); });
  window.addEventListener('pagehide', function () { if (S.playing) leave(); });

  /* The phone going to sleep is not leaving — he is coming back to the same
     place in the same song. So this pauses, the way the Pitch Tracker does,
     and picks up where it left off. */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (!S.playing || S.asleep) return;
      S.heldT = songTime();
      S.asleep = true;
      try { if (S.vox) S.vox.pause(); } catch (e) {}
      try { if (S.mus) S.mus.pause(); } catch (e) {}
      sub('Paused — the app went to the background.');
      return;
    }
    if (!S.asleep) return;
    S.asleep = false;
    S.lastFrame = 0;                 /* do not credit the time it was asleep */
    if (!S.playing || !S.open || S.catching) return;
    if (S.synth) {
      /* the timer clock has run on while nothing sounded; move its origin
         back to where the song actually got to */
      S.clock0 = ((window.performance ? performance.now() : Date.now()) / 1000) - (S.heldT || 0);
    } else {
      try { if (S.vox) { var pr = S.vox.play(); if (pr && pr.catch) pr.catch(function () {}); } } catch (e) {}
      try { if (S.mus) { var pm = S.mus.play(); if (pm && pm.catch) pm.catch(function () {}); } } catch (e) {}
    }
    sub('Keep going.');
  });

  /* the old Song Trainer screen stays in the page, because the mapper and
     its progress bar live in it — but he never sees it */
  function hideEngine(host) {
    S.hid = [];
    Array.prototype.slice.call(host.children).forEach(function (el) {
      if (el.id === 'rpLsScreen') return;
      if (el.style.display === 'none') return;
      S.hid.push([el, el.style.display]);
      el.style.display = 'none';
    });
  }
  function showEngine() {
    S.hid.forEach(function (p) { p[0].style.display = p[1]; });
    S.hid = [];
  }

  function sub(t) { var e = $('rpLsSub'); if (e) e.innerHTML = t || '&nbsp;'; }
  function foot(t) { var e = $('rpLsFoot'); if (e) e.innerHTML = t || '&nbsp;'; }

  function size() {
    var cv = $('rpLsCv');
    if (!cv) return;
    var dpr = window.devicePixelRatio || 1;
    var w = cv.clientWidth || 340;
    var h = Math.max(260, Math.min(430, Math.round(window.innerHeight * 0.46)));
    cv.style.height = h + 'px';
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    pinWindow();
  }

  /* Robert, 17 Sep: "The view is decided by THE SONG before Start, and does
     not move for the whole song. Work out the song's range from the note map,
     set the window to fit it with headroom, lock it. His voice goes wherever
     it goes inside that fixed window, including off the top or bottom."
     So: every note of the song on screen, three semitones of air above and
     below, and nothing the microphone hears can move it afterwards. */
  function pinWindow() {
    var cv = $('rpLsCv');
    if (!cv || !window.rpPinLane) return;
    var ns = S.song && S.song.notes;
    if (ns && ns.length && window.RPFileMap && RPFileMap.needsBuild(S.song)) {
      if (window.rpPinLaneToPartial && rpPinLaneToPartial(cv, ns, 5)) return;
    } else if (ns && ns.length && rpPinLaneToNotes(cv, ns, 3)) return;
    var r = null;
    try { r = window.RPRange && RPRange.get ? RPRange.get() : null; } catch (e) {}
    if (r && isFinite(r.lo) && isFinite(r.hi) && r.hi > r.lo) rpPinLane(cv, r.lo - 2, r.hi + 2);
    else rpPinLane(cv, 48, 72);                 /* C3 to C5 */
  }
  L.pinWindow = pinWindow;
  window.addEventListener('resize', function () { if (S.open) size(); });

  /* ---------------------------------------------------------------- */
  /* THE APP WORKS THE NOTES OUT ITSELF                                 */
  /* ---------------------------------------------------------------- */
  /* Robert, 25 Sep: a finished read may only start the song if this screen
     is still the one showing AND the page is visible; otherwise the song is
     just ready. The same rule as the Pitch Tracker. */
  function here() {
    var m = $('modeSong');
    return !!(S.open && m && m.classList.contains('active')) && !document.hidden;
  }
  L.here = here;

  function autoMap() {
    var song = S.song;
    if (!song || S.mapping === song.id) return;
    S.mapping = song.id;
    /* Robert, 25 Sep: "Opening a song from any screen while its read is
       still running shows progress, not an empty board", "Start never
       blocks", and now: the song may play once the reading is eight seconds
       ahead of where it begins. The reading carries on while he sings. */
    var failed = false;
    RPFileMap.ensure(song, true).catch(function () { failed = true; });
    var iv = setInterval(function () {
      if (S.song !== song) { clearInterval(iv); if (S.mapping === song.id) S.mapping = false; return; }
      if (failed) {
        clearInterval(iv);
        S.mapping = false;
        S.startWhenReady = false;
        if (!S.open) return;
        sub('Could not find a clear tune in that file.');
        foot('It works best on a recording of one voice with no band behind it. ' +
             'Go back and try another file.');
        return;
      }
      var a = RPFileMap.aheadOf(song, 0);
      if (!(a.done || a.canStart)) { if (S.open) sub('Reading the song.'); return; }
      clearInterval(iv);
      S.mapping = false;
      S.cut = null;             /* the notes have just changed */
      pinWindow();
      foot('');
      if (S.startWhenReady && here()) { S.startWhenReady = false; start(); return; }
      S.startWhenReady = false;
      if (S.open && !S.playing) sub('Press Start.');
    }, 200);
  }

  /* ---------------------------------------------------------------- */
  /* THE SOUND: in his headphones, always                               */
  /* ---------------------------------------------------------------- */
  function phones() {
    var el = $('rpLsPhones');
    if (!el) return;
    var micOn = false;
    try { micOn = !!(MIC && MIC.on); } catch (e) {}
    if (!micOn) { el.style.display = 'none'; return; }
    var show = function (yes) {
      if (yes) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.innerHTML = 'Use headphones.';
    };
    try {
      navigator.mediaDevices.enumerateDevices().then(function (list) {
        var found = list.some(function (d) {
          return d.kind === 'audiooutput' && /head|earbud|airpod|buds|bluetooth/i.test(d.label || '');
        });
        show(found);
      }).catch(function () { show(false); });
    } catch (e) { show(false); }
  }

  function mix() {
    var box = $('rpLsMix');
    if (!box) return;
    var s = S.song;
    var two = !!(s && s.musicBlob);
    if (s && !s.blob) { box.innerHTML = ''; return; }   /* built in: nothing to mix */
    function row(id, label, v) {
      return '<label style="display:block;margin-top:8px"><span style="font-size:12.5px;font-weight:800">' +
        label + '</span><output id="' + id + 'Out" style="float:right;font-size:12px;color:var(--ink-dim)">' +
        Math.round(v * 100) + '%</output><input type="range" id="' + id + '" min="0" max="100" value="' +
        Math.round(v * 100) + '" style="width:100%;margin-top:4px"></label>';
    }
    box.innerHTML = '<div class="panel" style="padding:12px">' +
      (two ? '<b style="font-size:13px">The mix</b>' +
             '<div class="measured" style="margin:4px 0 2px">Learn it with the singer up. As you get it, ' +
             'slide the singer down and the music up until you are singing it on your own.</div>' +
             row('rpLsVox', 'Singer', 1) + row('rpLsMus', 'Music', 1)
           : '<b style="font-size:13px">Volume</b>' + row('rpLsVox', 'The song', 1)) + '</div>';
    on($('rpLsVox'), 'input', vols);
    on($('rpLsMus'), 'input', vols);
  }
  function vols() {
    var v = $('rpLsVox') ? +$('rpLsVox').value / 100 : 1;
    var m = $('rpLsMus') ? +$('rpLsMus').value / 100 : 1;
    if ($('rpLsVoxOut')) $('rpLsVoxOut').textContent = Math.round(v * 100) + '%';
    if ($('rpLsMusOut')) $('rpLsMusOut').textContent = Math.round(m * 100) + '%';
    if (S.vox) S.vox.volume = v;
    if (S.mus) S.mus.volume = m;
  }

  /* ---------------------------------------------------------------- */
  /* PLAY                                                               */
  /* ---------------------------------------------------------------- */
  function start() {
    var s = S.song;
    if (!s || S.playing) return;
    /* Robert, 24 Sep: a song carrying a map from the old analyser is read
       again with the live tracker the next time it is opened. */
    if (window.RPFileMap && RPFileMap.needsBuild(s)) {
      var ah = RPFileMap.aheadOf(s, 0);
      if (!(ah.done || ah.canStart)) { S.startWhenReady = true; autoMap(); return; }
    }
    if (!(s.notes && s.notes.length)) { S.startWhenReady = true; autoMap(); return; }
    /* one thing in his headphones at a time, and nothing while the page is
       hidden */
    try { if (window.RPOneSound && !RPOneSound.claimResumable('learn-a-song', leave)) return; } catch (e) {}
    try { ensureCtx(); } catch (e) {}
    try { enableMic(); } catch (e) {}
    if (!S.synth) {
      if (!S.vox) { S.vox = new Audio(); S.vox.preload = 'auto'; }
      if (S.voxUrl) URL.revokeObjectURL(S.voxUrl);
      S.voxUrl = URL.createObjectURL(s.blob);
      S.vox.src = S.voxUrl;
    }
    if (!S.synth && s.musicBlob) {
      if (!S.mus) { S.mus = new Audio(); S.mus.preload = 'auto'; }
      if (S.musUrl) URL.revokeObjectURL(S.musUrl);
      S.musUrl = URL.createObjectURL(s.musicBlob);
      S.mus.src = S.musUrl;
    }
    vols();
    pinWindow();               /* decided here, before a note sounds, and held */
    held = {};
    hideScore();
    S.lastFrame = 0;
    S.trail = [];
    S.playing = true;
    $('rpLsStart').disabled = true;
    $('rpLsStop').disabled = false;
    phones();
    /* a countdown to the first note, so he knows when to come in */
    var first = s.notes[0].t || 0;
    S.countdown = 3;
    var cd = $('rpLsCount');
    var tick = function () {
      if (!S.playing) { if (cd) cd.style.display = 'none'; return; }
      if (S.countdown > 0) {
        if (cd) { cd.style.display = 'flex'; cd.textContent = String(S.countdown); }
        S.countdown--;
        setTimeout(tick, 1000);
      } else {
        if (cd) cd.style.display = 'none';
        S.t0 = (window.performance ? performance.now() : Date.now()) / 1000;
        if (S.synth) { S.clock0 = S.t0; S.sung = 0; }
        else {
          S.vox.currentTime = 0;
          S.vox.play().catch(function () {});
          if (S.mus) { S.mus.currentTime = 0; S.mus.play().catch(function () {}); }
        }
      }
    };
    sub(first > 0.6 ? 'First note comes in after ' + first.toFixed(1) + ' seconds.'
                    : 'It starts straight away.');
    tick();
  }

  function stop(byHand) {
    S.playing = false;
    S.catching = false;
    S.countdown = 0;
    S.asleep = false; S.heldT = 0;     /* a stop is not a pause: it lets go */
    try { if (S.vox) S.vox.pause(); } catch (e) {}
    try { if (S.mus) S.mus.pause(); } catch (e) {}
    var cd = $('rpLsCount'); if (cd) cd.style.display = 'none';
    if ($('rpLsStart')) $('rpLsStart').disabled = false;
    if ($('rpLsStop')) $('rpLsStop').disabled = true;
    if (!byHand) showScore();         /* it reached the end: how did it go */
    if (byHand && S.song && S.song.notes) sub('Press Start. The bubbles are the song. Your line is you.');
  }

  /* Robert, 24 Sep: at the end of the song, in plain words — how many
     notes were hit, how long they were held on average, and the three that
     went worst. A note counts as hit when it was sung within a semitone for
     at least half its length, which is the same fill that has been drawing
     inside each bubble all the way through. Nothing else on the screen
     changes. */
  /* Robert, 25 Sep: "A STEADY SCORE TEST ... the same code path the screen
     uses, no microphone, no clock." So crediting a note is one function.
     The screen calls it every frame with the singer's reading; the test
     calls it on a recording's own traced line. tNote is the singer's time
     on the notes' own clock, so neither caller has to know about lags. */
  /* Robert, 25 Sep: "A note counts only in the exact octave by default. Add
     an 'Any octave' switch on the screen, off by default." It used to count
     any octave, always. With the switch on, a man singing along with a man
     an octave down - which is where most men sing John Legend - still gets
     the note. */
  function credit(held, ns, tNote, m, dt, anyOct) {
    for (var i = 0; i < ns.length; i++) {
      var n = ns[i];
      if (tNote >= n.t && tNote <= n.t + (n.d || 0.4)) {
        var off = anyOct ? Math.abs(((m - n.m + 6) % 12 + 12) % 12 - 6) : Math.abs(m - n.m);
        if (off < 1.0) held[i] = (held[i] || 0) + dt;
        return i;
      }
    }
    return -1;
  }
  function tally(ns, h) {
    if (!ns.length) return null;
    var hit = 0, sum = 0, rows = [];
    for (var i = 0; i < ns.length; i++) {
      var d = ns[i].d || 0.4;
      var frac = Math.max(0, Math.min(1, (h[i] || 0) / d));
      sum += frac;
      if (frac >= 0.5) hit++;
      rows.push({ m: ns[i].m, frac: frac });
    }
    rows.sort(function (a, b) { return a.frac - b.frac; });
    return { total: ns.length, hit: hit, pct: Math.round(100 * hit / ns.length),
             avg: Math.round(100 * sum / ns.length), worst: rows.slice(0, 3) };
  }
  /* a whole line at once: every voiced point counts for the step it covers */
  L.scoreTrace = function (ns, trace, anyOct) {
    var h = {}, step = 0.05;
    if (trace && trace.length > 1) {
      var g = trace[1].t - trace[0].t;
      if (g > 0) step = +g.toFixed(3);
    }
    for (var i = 0; i < (trace || []).length; i++) {
      var p = trace[i];
      if (p && p.m != null) credit(h, ns, p.t, p.m, step, !!anyOct);
    }
    return tally(ns, h);
  };

  function scoreNow() {
    var ns = notes();
    if (!ns.length) return null;
    return tally(ns, held);
  }
  L.score = scoreNow;

  function noteName(m) { try { return midiName(m); } catch (e) { return String(m); } }

  function showScore() {
    var el = $('rpLsScore');
    if (!el) return;
    var r = scoreNow();
    if (!r) { el.style.display = 'none'; return; }
    var worst = r.worst.map(function (w) {
      return esc(noteName(w.m)) + ' <span style="color:var(--ink-faint)">' +
             Math.round(w.frac * 100) + '%</span>';
    }).join(' &nbsp; ');
    el.innerHTML = '<div class="panel" style="padding:12px">' +
      '<div style="font-size:15px;font-weight:900;margin-bottom:6px">' +
        'You hit ' + r.hit + ' of ' + r.total + ' notes.</div>' +
      '<div class="measured" style="margin-bottom:8px">On average you held each one ' +
        r.avg + '% of the way. A note counts as hit when you were within a semitone ' +
        'of it for at least half its length.</div>' +
      (r.worst.length ? '<div style="font-size:12.5px;font-weight:800;color:var(--ink-dim);' +
        'margin-bottom:3px">Held least well</div><div style="font-size:14px;font-weight:800">' +
        worst + '</div>' : '') +
      '</div>';
    el.style.display = '';
  }
  function hideScore() { var el = $('rpLsScore'); if (el) el.style.display = 'none'; }

  function songTime() {
    if (S.synth) {
      if (!S.playing || !S.clock0) return 0;
      if (S.asleep) return S.heldT || 0;
      return ((window.performance ? performance.now() : Date.now()) / 1000) - S.clock0;
    }
    if (!S.vox) return 0;
    /* a paused song keeps its place rather than snapping the map back to the
       start — that is the difference between a pause and a stop */
    if (S.vox.paused) return S.playing ? (S.heldT || 0) : 0;
    S.heldT = S.vox.currentTime || 0;
    return S.heldT;
  }

  /* ---------------------------------------------------------------- */
  /* THE MAP: drawPitchLane draws it, the overlay puts the song on it   */
  /* ---------------------------------------------------------------- */
  var held = {};                                  /* note index -> seconds held */

  /* Robert, 24 Sep: "Learn a song SHOWS the bubbles. They are for judging
     pitch and how long a note is held, and for the game on top of that. The
     Pitch Tracker sing-along stays a plain line — that screen is 'draw it
     wherever you can hear it'. Learn a song is 'hit these notes'."

     So this screen works from notes, not from the traced line, whatever the
     song came from: a file's trace and a take's live line are both cut into
     notes the same way, and a built-in was written as notes to begin with.
     The line itself is not drawn here — his own blue line goes over the
     bubbles, which is what the caption has always promised. */
  function notes() {
    if (!S.song) return [];
    /* a song still to be read has no notes worth showing: the old ones are
       about to be replaced, and showing them would change under the singer */
    if (window.RPFileMap && RPFileMap.needsBuild(S.song)) {
      /* being read: the notes found so far, and they grow as it reads */
      var rs = RPFileMap.stateOf(S.song.id);
      return (rs && rs.readTo > 0 && S.song.bubbles) ? S.song.bubbles : [];
    }
    if (S.cut && S.cutFor === S.song.id) return S.cut;
    var b = [];
    try { b = window.RPFileMap ? RPFileMap.notesOf(S.song) : (S.song.notes || []); } catch (e) { b = []; }
    S.cut = b; S.cutFor = S.song.id;
    return b;
  }
  L.notes = notes;

  function loop() {
    if (!S.open) { S.raf = null; return; }
    S.raf = requestAnimationFrame(loop);
    var cv = $('rpLsCv');
    if (!cv || cv.offsetParent === null) return;
    var t = songTime();

    /* How long this frame actually lasted. It used to credit a flat 0.016s
       to a note per frame, which is only true at exactly 60 frames a
       second: on a phone that is throttling, or on a tired battery, every
       score read short and every bubble drew part-filled for a note that
       was sung perfectly. Clamped, so a stall cannot hand one note a whole
       second at once. */
    var nowMs = (window.performance ? performance.now() : Date.now());
    var dt = S.lastFrame ? Math.min(0.1, (nowMs - S.lastFrame) / 1000) : 0;
    S.lastFrame = nowMs;

    /* his voice, on the song's own clock, so the same x is the same moment.
       The microphone reads a note 0.1s after it was sung and the note map
       reads one 0.05s before it sounded (both measured, 17 Sep — see the
       note beside rpMicLag in the build), so each line is put back where the
       sound actually was and they meet there. */
    var lag = 0;
    try { lag = (window.rpNoteLag ? rpNoteLag(S.song) : 0) + (window.rpEarLag ? rpEarLag() : 0); } catch (e) { lag = 0; }
    /* when he actually sang, on the ear's clock: the notes carry the output
       delay, so the voice takes back only the microphone's own part */
    var tv = t - (window.rpVoiceLag ? rpVoiceLag() : 0.1);
    if (S.playing && t > 0 && !S.asleep && !S.catching) {
      var m = null;
      try { m = (MIC && MIC.on) ? smoothedMidi() : null; } catch (e) { m = null; }
      S.trail.push({ t: tv, m: (m == null ? null : m) });
      while (S.trail.length > 4000) S.trail.shift();
      /* how long each bubble has been sung - by the one rule below, which
         the steady score test also runs, so the two cannot disagree */
      if (m != null && S.song) credit(held, notes(), tv - lag, m, dt, S.anyOct);
      var cl = $('rpLsClock');
      if (cl) cl.textContent = Math.floor(t / 60) + ':' + ('0' + Math.floor(t % 60)).slice(-2);
      if (S.synth) {
        var ns2 = S.song.notes;
        while (S.sung < ns2.length && ns2[S.sung].t <= t + 0.05) {
          var nn = ns2[S.sung];
          try {
            (window.V10 && V10.playRef ? V10.playRef : playPiano)(
              nn.m, ctx.currentTime + 0.01, Math.max(0.3, nn.d || 0.5), null, 0.5);
          } catch (e) {}
          S.sung++;
        }
        var last = ns2[ns2.length - 1];
        if (t > (last.t + (last.d || 0.5) + 1.5)) stop(false);
      } else if (S.vox.ended) stop(false);
    }

    mine = true;
    try {
      drawPitchLane(cv.getContext('2d'), cv, S.trail, t + LOOK, null);
    } catch (e) {}
    mine = false;
  }

  /* the seam that is already in drawPitchLane. The Pitch Tracker uses it
     too, for singing over a take, so this hands back to it when this
     screen is not the one drawing. */
  var mine = false;
  var theirs = window.__rpOverlay || null;
  window.__rpOverlay = function (c2, W, H, now, pps, yOf) {
    if (!mine) { if (theirs) theirs(c2, W, H, now, pps, yOf); return; }
    var s = S.song;
    if (!s) return;
    if (S.mapping === s.id && window.RPFileMap && window.rpBoardNote) {
      var rs = RPFileMap.stateOf(s.id);
      rpBoardNote(c2, W, H, 'Reading the song \u2014 ' + RPFileMap.pct(rs) + '%',
                  S.startWhenReady ? 'It starts by itself in a moment'
                                   : 'The notes appear here in a moment');
      return;
    }
    var ns = notes();
    if (!ns.length) return;
    var t = now - LOOK;
    var headX = W - LOOK * pps;
    var ear = 0, lag = 0;
    try { ear = window.rpEarLag ? rpEarLag() : 0; } catch (e) { ear = 0; }
    try { lag = (window.rpNoteLag ? rpNoteLag(s) : 0) + ear; } catch (e) { lag = ear; }

    /* which bubble is next: the first one that has not started yet */
    var next = -1;
    for (var i = 0; i < ns.length; i++) { if (ns[i].t + lag > t) { next = i; break; } }

    /* as tall as the lane it sits in, so it reads as a bubble on that note
       rather than a hairline */
    var laneH = Math.abs(yOf(60) - yOf(61)) || 14;
    var bh = Math.max(12, Math.min(26, laneH * 1.4));

    c2.save();

    /* Measurement only, and only when a test asks: for every bubble near the
       bar, where this frame drew its left edge and where its fill ends,
       against the song's own clock. Robert, 25 Sep: "measured with numbers,
       not searches" - so the numbers come from the drawing itself, not from
       a formula written again somewhere else. Nothing is recorded otherwise. */
    var rec = window.__rpMeasure, near = rec ? [] : null, nxX = null;

    /* 20 Sep this screen drew a take's twenty-a-second line as twenty
       overlapping bubbles a second, which is where the grey blobs came
       from. The answer was never to draw a line here — it was to cut the
       line into notes first, which is what notes() above does. */

    for (var j = 0; j < ns.length; j++) {
      var n = ns[j];
      var dur = n.d || 0.35;
      var x = W - (now - (n.t + lag)) * pps;
      var w = Math.max(14, dur * pps - 3);
      if (x + w < -30 || x > W + 30) continue;
      var y = yOf(n.m);
      var h = bh;
      var ratio = Math.max(0, Math.min(1, (held[j] || 0) / dur));
      var past = t > n.t + lag + dur;

      /* the bubble */
      c2.beginPath();
      if (c2.roundRect) c2.roundRect(x, y - h / 2, w, h, h / 2); else c2.rect(x, y - h / 2, w, h);
      c2.fillStyle = past ? (ratio >= 0.5 ? 'rgba(76,201,240,.55)' : 'rgba(120,130,150,.30)')
                          : 'rgba(255,255,255,.16)';
      c2.fill();
      /* Robert, 25 Sep: "a bubble may only start filling once its left edge
         has passed the bar." The fill is how much has been held, laid from
         the left edge - and it stops at the bar, so it can never run ahead
         of it, however short the note or however wide it is drawn. */
      var fillW = ratio > 0 ? Math.min(Math.max(3, w * ratio), headX - x) : 0;
      if (near && Math.abs(x - headX) < 80) {
        near.push([j, +x.toFixed(2), fillW > 0 ? +(x + fillW).toFixed(2) : null]);
      }
      /* how much of it he has held */
      if (fillW > 0) {
        c2.save();
        c2.beginPath();
        if (c2.roundRect) c2.roundRect(x, y - h / 2, fillW, h, Math.min(h / 2, fillW / 2));
        else c2.rect(x, y - h / 2, fillW, h);
        c2.fillStyle = 'rgba(255,209,102,.85)';
        c2.fill();
        c2.restore();
      }
      /* the one he is coming to, ringed ahead of the playhead - in white.
         It was gold, the same gold as a filled bubble, so every note coming
         up looked sung before it reached the bar. Gold now means one thing:
         you held it. */
      if (j === next) {
        nxX = x;
        c2.strokeStyle = 'rgba(255,255,255,.9)';
        c2.lineWidth = 2;
        c2.beginPath();
        if (c2.roundRect) c2.roundRect(x - 2, y - h / 2 - 2, w + 4, h + 4, (h + 4) / 2);
        else c2.rect(x - 2, y - h / 2 - 2, w + 4, h + 4);
        c2.stroke();
        c2.lineWidth = 1;
      }
    }

    if (rec && rec.length < 40000) {
      rec.push({ s: 'ls', a: (S.vox && !S.synth) ? S.vox.currentTime : t,
                 p: performance.now(), head: +headX.toFixed(2), lag: lag, ear: ear,
                 nx: nxX, b: near });
    }

    /* where you are now */
    c2.strokeStyle = 'rgba(255,255,255,.55)';
    c2.lineWidth = 2;
    c2.beginPath(); c2.moveTo(headX, 0); c2.lineTo(headX, H); c2.stroke();
    c2.lineWidth = 1;
    c2.restore();
    if (S.catching && window.rpBoardNote) rpBoardNote(c2, W, H, 'Catching up\u2026', 'The song carries on in a moment');
  };

  /* Robert, 25 Sep: "Playback may start once the read is 8 seconds ahead of
     the playhead, and must stay at least 4 seconds ahead; if it falls
     behind, pause with 'Catching up…' rather than drawing nothing." It picks
     up once the reading is 8 seconds ahead of where it stopped. */
  S.catching = false;
  setInterval(function () {
    if (!S.playing || S.synth || !S.song || !S.vox || S.asleep || !window.RPFileMap) return;
    if (!S.catching && !RPFileMap.reading(S.song)) return;     /* only a song still being read */
    var t = songTime();
    var a = RPFileMap.aheadOf(S.song, t);
    if (!S.catching) {
      if (a.done || a.ok || S.vox.paused) return;
      S.catching = true;
      S.heldT = t;
      try { S.vox.pause(); } catch (e) {}
      try { if (S.mus) S.mus.pause(); } catch (e) {}
      sub('Catching up\u2026');
    } else if ((a.done || a.canStart) && !document.hidden) {
      S.catching = false;
      S.lastFrame = 0;                 /* do not credit the time it stood still */
      try { var pr = S.vox.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
      try { if (S.mus) { var pm = S.mus.play(); if (pm && pm.catch) pm.catch(function () {}); } } catch (e) {}
      sub('Keep going.');
    }
  }, 50);
  L.catching = function () { return !!S.catching; };

  /* ---------------------------------------------------------------- */
  L.reset = function () { held = {}; hideScore(); };
  /* one way in for a measurement to see what this screen is working from,
     rather than a handful of accessors bolted on one at a time */
  L.inspect = function () {
    return { notes: notes(), held: held, trail: S.trail, t: songTime(),
             playing: S.playing, lag: (window.rpNoteLag ? rpNoteLag(S.song) : 0) };
  };
  L.seek = function (by) {
    if (S.synth) { S.clock0 -= by; return true; }
    if (!S.vox) return false;
    try { S.vox.currentTime = Math.max(0, S.vox.currentTime + by); } catch (e) { return false; }
    if (S.mus) { try { S.mus.currentTime = S.vox.currentTime; } catch (e) {} }
    return true;
  };
  L.isOpen = function () { return !!S.open; };
  /* the app's own answer to "is a song sounding right now", so a test can
     ask it rather than guess from a canvas */
  L.isPlaying = function () {
    if (S.playing) return true;
    try { if (S.vox && !S.vox.paused && !S.vox.ended) return true; } catch (e) {}
    try { if (S.mus && !S.mus.paused && !S.mus.ended) return true; } catch (e) {}
    return false;
  };
})();
