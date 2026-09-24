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
    synth: false, clock0: 0, sung: 0   /* a built-in has no file: the app plays it */
  };

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
      '</div>' +
      '<div class="notice" id="rpLsPhones" style="display:none;margin-bottom:8px"></div>' +
      '<div style="position:relative">' +
        '<canvas id="rpLsCv" style="display:block;width:100%;border-radius:var(--radius);' +
          'border:1px solid var(--line)"></canvas>' +
        '<div id="rpLsCount" style="position:absolute;inset:0;display:none;align-items:center;' +
          'justify-content:center;font-size:74px;font-weight:900;color:var(--gold);' +
          'text-shadow:0 2px 18px rgba(0,0,0,.6);pointer-events:none"></div>' +
      '</div>' +
      '<div id="rpLsMix" style="margin-top:10px"></div>' +
      '<div class="measured" id="rpLsFoot" style="margin-top:10px"> </div>';
    on($('rpLsBack'), 'click', L.close);
    on($('rpLsStart'), 'click', start);
    on($('rpLsStop'), 'click', function () { stop(true); });
    size();
    mix();
    phones();
    S.synth = !song.blob && !!(song.notes && song.notes.length);
    if (!song.blob && !S.synth) { sub('There is no sound on this one.'); foot(''); }
    else if (!(song.notes && song.notes.length)) autoMap();
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
    try { if (window.RPSound) RPSound.release('learn-a-song'); } catch (e) {}
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
    if (!S.playing || !S.open) return;
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
    if (ns && ns.length && rpPinLaneToNotes(cv, ns, 3)) return;
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
  function autoMap() {
    if (S.mapping) return;
    S.mapping = true;
    sub('Working out the tune…');
    foot('The app is listening to the file once, to find the notes. It only has to do this the first time.');
    var t0 = Date.now();
    var iv = setInterval(function () {
      var m = $('libMapMsg');
      var stage = m ? (m.textContent || '').split(' · ')[0] : '';
      var bar = $('libMapBar');
      var pct = bar ? (bar.style.width || '0%') : '';
      sub(esc(stage || 'Working out the tune') + ' — ' + pct +
          ' · ' + Math.round((Date.now() - t0) / 1000) + 's');
    }, 700);
    var done = function (okNotes) {
      clearInterval(iv);
      S.mapping = false;
      if (okNotes) {
        pinWindow();          /* the song is known now, so the view is settled */
        sub('Press Start. The bubbles are the song. Your line is you.');
        foot('');
      } else {
        sub('Could not find a clear tune in that file.');
        foot('It works best on a recording of one voice with no band behind it. ' +
             'Go back and try another file.');
      }
    };
    try {
      RPFileMap.build(S.song).then(function () {
        done(!!(S.song.notes && S.song.notes.length));
      }).catch(function () { done(false); });
    } catch (e) { done(false); }
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
      el.innerHTML = '<b>Headphones in?</b> The song plays to you and the microphone is open. ' +
        'Through a speaker the app hears the song as well as you, and draws it as if you sang it.';
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
    if (window.RPFileMap && RPFileMap.needsBuild(s)) { autoMap(); return; }
    if (!(s.notes && s.notes.length)) { autoMap(); return; }
    try { ensureCtx(); } catch (e) {}
    try { enableMic(); } catch (e) {}
    /* one thing in his headphones at a time */
    try { if (window.RPSound) RPSound.claimResumable('learn-a-song', leave); } catch (e) {}
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
    S.countdown = 0;
    S.asleep = false; S.heldT = 0;     /* a stop is not a pause: it lets go */
    try { if (S.vox) S.vox.pause(); } catch (e) {}
    try { if (S.mus) S.mus.pause(); } catch (e) {}
    var cd = $('rpLsCount'); if (cd) cd.style.display = 'none';
    if ($('rpLsStart')) $('rpLsStart').disabled = false;
    if ($('rpLsStop')) $('rpLsStop').disabled = true;
    if (byHand && S.song && S.song.notes) sub('Press Start. The bubbles are the song. Your line is you.');
  }

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

  function loop() {
    if (!S.open) { S.raf = null; return; }
    S.raf = requestAnimationFrame(loop);
    var cv = $('rpLsCv');
    if (!cv || cv.offsetParent === null) return;
    var t = songTime();

    /* his voice, on the song's own clock, so the same x is the same moment.
       The microphone reads a note 0.1s after it was sung and the note map
       reads one 0.05s before it sounded (both measured, 17 Sep — see the
       note beside rpMicLag in the build), so each line is put back where the
       sound actually was and they meet there. */
    var lag = 0;
    try { lag = window.rpNoteLag ? rpNoteLag(S.song) : 0; } catch (e) { lag = 0; }
    var tv = t - (window.rpMicLag ? rpMicLag() : 0.1);   /* when he actually sang */
    if (S.playing && t > 0 && !S.asleep) {
      var m = null;
      try { m = (MIC && MIC.on) ? smoothedMidi() : null; } catch (e) { m = null; }
      S.trail.push({ t: tv, m: (m == null ? null : m) });
      while (S.trail.length > 4000) S.trail.shift();
      /* how long each bubble has been sung */
      if (m != null && S.song && S.song.notes) {
        var ns = S.song.notes;
        for (var i = 0; i < ns.length; i++) {
          var n = ns[i];
          if (tv >= n.t + lag && tv <= n.t + lag + (n.d || 0.4)) {
            var off = Math.abs(((m - n.m + 6) % 12 + 12) % 12 - 6);
            if (off < 1.0) held[i] = (held[i] || 0) + 0.016;
            break;
          }
        }
      }
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
    if (!s || !s.notes || !s.notes.length) return;
    var t = now - LOOK;
    var headX = W - LOOK * pps;
    var ns = s.notes;
    var lag = 0;
    try { lag = window.rpNoteLag ? rpNoteLag(s) : 0; } catch (e) { lag = 0; }

    /* which bubble is next: the first one that has not started yet */
    var next = -1;
    for (var i = 0; i < ns.length; i++) { if (ns[i].t + lag > t) { next = i; break; } }

    /* as tall as the lane it sits in, so it reads as a bubble on that note
       rather than a hairline */
    var laneH = Math.abs(yOf(60) - yOf(61)) || 14;
    var bh = Math.max(12, Math.min(26, laneH * 1.4));

    c2.save();

    /* Robert, 20 Sep: "grey blobs." A take's pitch line is twenty points a
       second with no duration on any of them, so bubbling each one drew
       twenty overlapping blobs a second. It is a traced line, and it is
       drawn as one — the same gold line the Pitch Tracker uses. */
    if ((window.rpNoteShape ? rpNoteShape(ns) : 'bars') === 'line') {
      c2.strokeStyle = 'rgba(255,209,102,.95)';
      c2.lineWidth = 2.5;
      c2.shadowColor = 'rgba(255,209,102,.6)';
      c2.shadowBlur = 8;
      c2.beginPath();
      var pen = false, prev = null;
      for (var k = 0; k < ns.length; k++) {
        var p = ns[k];
        if (!p || p.m == null) { pen = false; prev = null; continue; }
        var px = W - (now - (p.t + lag)) * pps;
        if (px < -4 || px > W + 4) { pen = false; prev = null; continue; }
        var py = yOf(p.m);
        var jump = prev && Math.abs(p.m - prev.m) > 6;
        if (!pen || jump) c2.moveTo(px, py); else c2.lineTo(px, py);
        pen = true; prev = p;
      }
      c2.stroke();
      c2.shadowBlur = 0;
      c2.lineWidth = 2;
      c2.strokeStyle = 'rgba(255,255,255,.55)';
      c2.beginPath(); c2.moveTo(headX, 0); c2.lineTo(headX, H); c2.stroke();
      c2.lineWidth = 1;
      c2.restore();
      return;
    }

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
      /* how much of it he has held */
      if (ratio > 0) {
        c2.save();
        c2.beginPath();
        if (c2.roundRect) c2.roundRect(x, y - h / 2, Math.max(3, w * ratio), h, h / 2);
        else c2.rect(x, y - h / 2, Math.max(3, w * ratio), h);
        c2.fillStyle = 'rgba(255,209,102,.85)';
        c2.fill();
        c2.restore();
      }
      /* the one he is coming to, lit up ahead of the playhead */
      if (j === next) {
        c2.strokeStyle = 'rgba(255,209,102,.95)';
        c2.lineWidth = 2;
        c2.beginPath();
        if (c2.roundRect) c2.roundRect(x - 2, y - h / 2 - 2, w + 4, h + 4, (h + 4) / 2);
        else c2.rect(x - 2, y - h / 2 - 2, w + 4, h + 4);
        c2.stroke();
        c2.lineWidth = 1;
      }
    }

    /* where you are now */
    c2.strokeStyle = 'rgba(255,255,255,.55)';
    c2.lineWidth = 2;
    c2.beginPath(); c2.moveTo(headX, 0); c2.lineTo(headX, H); c2.stroke();
    c2.lineWidth = 1;
    c2.restore();
  };

  /* ---------------------------------------------------------------- */
  L.reset = function () { held = {}; };
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
