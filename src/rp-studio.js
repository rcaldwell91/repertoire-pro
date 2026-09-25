/* ======================================================================
   Repertoire Pro — the take recorder on the pitch screen.

   Record · Pause · Listen back · Keep or Discard, without saving anything
   you did not ask to keep. A kept take goes into My Recordings exactly like
   every other take, so Song Trainer can already sing you over it.

   It also stores the PITCH LINE alongside the audio. That is the part that
   matters for Robert's actual use: Ja Ronn sings a phrase, and you can see
   where the notes were meant to be, not just hear them.

   The app already has a recorder in the Library. This is a second, smaller
   one on the pitch screen rather than a rewiring of that one, because that
   one always saves and this one must be able to throw a take away. They
   refuse to run at the same time — one microphone, one recorder.
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  /* MIC, REC and LIB are top-level `const`s in the build below, so they are
     reachable by name from this script but are NOT properties of window.
     Guarding with `window.MIC` silently did nothing — which is exactly how
     the first version of this failed. Check the bindings with typeof. */
  var ST = window.RPStudio = {
    rec: null, chunks: [], state: 'idle',
    activeMs: 0, segT0: 0,
    notes: [], noteTimer: null,
    blob: null, url: null, audio: null, playing: false,
    /* When the singer opened this from an assignment, the take belongs to
       that assignment and says so from the moment it is kept. Robert: "it's
       its own thing and has a take that's attached to that." So we do NOT
       record a loose take and go hunting for an assignment afterwards. */
    assign: null
  };

  /* false when the sound may not start - the page is hidden */
  function claimSound(name, stop) {
    try { if (window.RPOneSound) return !!RPOneSound.claim(name, stop); } catch (e) {}
    return !document.hidden;
  }

  function say(msg) {
    if (window.RP && RP.toast) RP.toast(msg);
    else if (window.libNotice) libNotice(msg);
  }

  /* ---------------------------------------------------------------- */
  /* the panel                                                         */
  /* ---------------------------------------------------------------- */
  function title() {
    var host = $('modeFree');
    if (!host || $('rpPitchTitle')) return;
    var back = host.querySelector('.backpill');
    var t = document.createElement('div');
    t.id = 'rpPitchTitle';
    t.innerHTML = '<h1 style="margin:0 0 10px">Pitch Tracker</h1>';
    if (back && back.parentNode === host) host.insertBefore(t, back.nextSibling);
    else host.insertBefore(t, host.firstChild);
  }

  /* Robert, 17 Sep: "THE MAP STILL JUMPS ... The view is decided by THE SONG
     before Start, and does not move for the whole song. Work out the song's
     range from the note map, set the window to fit it with headroom, lock it.
     His voice goes wherever it goes inside that fixed window, including off
     the top or bottom."

     So the Pitch Tracker's window is decided by whatever is on it and then
     held: the take or map being sung over if there is one, otherwise the
     range he measured in Profile, otherwise C3 to C5. Nothing about what the
     microphone hears can move it. */
  function pinTracker() {
    var cv = $('freeCanvas');
    if (!cv || !window.rpPinLane) return;
    var o = ST.overlay;
    if (o && o.notes && o.notes.length && o.song && window.RPFileMap && RPFileMap.needsBuild(o.song)) {
      if (window.rpPinLaneToPartial && rpPinLaneToPartial(cv, o.notes, 5)) return;
    } else if (o && o.notes && o.notes.length && rpPinLaneToNotes(cv, o.notes, 3)) return;
    var r = null;
    try { r = window.RPRange && RPRange.get ? RPRange.get() : null; } catch (e) {}
    if (r && isFinite(r.lo) && isFinite(r.hi) && r.hi > r.lo) rpPinLane(cv, r.lo - 2, r.hi + 2);
    else rpPinLane(cv, 48, 72);                 /* C3 to C5 */
  }
  ST.pinLane = pinTracker;

  function mount() {
    title();
    var host = $('modeFree');
    if (!host || $('rpStudio')) return;
    var hud = host.querySelector('.hud');
    var d = document.createElement('div');
    d.id = 'rpStudio';
    d.className = 'panel';
    d.style.cssText = 'margin-top:10px;padding:12px';
    hud && hud.parentNode ? hud.parentNode.insertBefore(d, hud.nextSibling) : host.appendChild(d);
    draw();
  }

  /* Robert, 25 Sep, the Pitch Tracker:
       - "The three cards stay - note, Hz, steadiness - with the cents line
         removed, all in one compact row about a third of the current
         height."
       - "Hear yourself (on/off), Hear the take (on/off) and Take volume
         move into one small drop-down right under the map, labelled
         Sound. Hear yourself stays in the gear panel too; it is the same
         switch in both places."
       - "Remove the 'Play a track & settings' section. Singing along to a
         song already happens from takes and the Library. Put a small (i)
         where it was with one line saying how."
     The old section is hidden rather than taken out of the page: the
     microphone button and the audio element inside it are still used. */
  function tidy() {
    var host = $('modeFree');
    if (!host) return;
    var hud = host.querySelector('.hud');
    if (hud && !hud.classList.contains('rp-hud-compact')) hud.classList.add('rp-hud-compact');
    var cv = $('freeCanvas'), wrap = cv ? cv.parentElement : null;
    if (wrap && wrap.style.position !== 'relative') wrap.style.position = 'relative';
    var dd = $('rpSoundDD');
    if (dd && wrap && dd.previousSibling !== wrap) host.insertBefore(dd, wrap.nextSibling);   /* kept right under the map */
    if (wrap && wrap.parentNode === host && !dd) {
      var d = document.createElement('details');
      d.id = 'rpSoundDD';
      d.className = 'rp-sound';
      d.innerHTML = '<summary>Sound</summary><div class="rp-sound-in">' +
        '<button class="btn" id="rpSdSelf"></button>' +
        '<button class="btn" id="rpSdTake"></button>' +
        '<label class="rp-sd-vol"><span>Take volume</span>' +
          '<input type="range" id="rpSdVol" min="0" max="100" step="5">' +
          '<output id="rpSdVolOut"></output></label></div>';
      host.insertBefore(d, wrap.nextSibling);
      on($('rpSdSelf'), 'click', function () {
        /* the gear's own switch, pressed: one switch, two places */
        var q = $('qMonitor');
        if (q) q.click();
        else try { MONITOR.on = !MONITOR.on; if (typeof monitorWire === 'function') monitorWire(); } catch (e) {}
        setTimeout(soundDD, 80);
      });
      on($('rpSdTake'), 'click', function () {
        ST.hearTake = !ST.hearTake;
        try { localStorage.setItem('rp_hear_take', ST.hearTake ? '1' : '0'); } catch (e) {}
        if (over && over.audio) over.audio.muted = !ST.hearTake;
        soundDD();
      });
      on($('rpSdVol'), 'input', function (e) {
        ST.takeVol = (+e.target.value) / 100;
        try { localStorage.setItem('rp_take_vol', String(ST.takeVol)); } catch (err) {}
        if (over && over.audio && 'volume' in over.audio) { try { over.audio.volume = ST.takeVol; } catch (err) {} }
        soundDD();
      });
    }
    soundDD();
    var fs = $('freeSettings');
    if (fs && fs.style.display !== 'none') fs.style.display = 'none';
    if (fs && !$('rpAlongInfo')) {
      var i = document.createElement('div');
      i.id = 'rpAlongInfo';
      i.className = 'rp-along';
      i.innerHTML = '<span class="rp-i" aria-hidden="true">i</span>' +
        'To sing along to a song, open it from the Library, or tap Open in Pitch Tracker on a take.';
      fs.parentNode.insertBefore(i, fs);
    }
  }
  function soundDD() {
    var self = $('rpSdSelf'), take = $('rpSdTake'), vol = $('rpSdVol'), out = $('rpSdVolOut');
    if (!self) return;
    var mon = false;
    try { mon = !!(typeof MONITOR !== 'undefined' && MONITOR.on); } catch (e) {}
    self.textContent = 'Hear yourself: ' + (mon ? 'on' : 'off');
    self.classList.toggle('primary', mon);
    take.textContent = 'Hear the take: ' + (ST.hearTake ? 'on' : 'off');
    take.classList.toggle('primary', !!ST.hearTake);
    if (document.activeElement !== vol) vol.value = String(Math.round(ST.takeVol * 100));
    out.textContent = Math.round(ST.takeVol * 100) + '%';
  }
  ST.soundDD = soundDD;
  (function css() {
    var st = document.createElement('style');
    st.textContent =
      '#modeFree .hud.rp-hud-compact{margin:8px 0 6px;gap:6px;align-items:stretch}' +
      '#modeFree .hud.rp-hud-compact .stat{padding:3px 6px;display:flex;flex-direction:column;justify-content:center}' +
      '#modeFree .hud.rp-hud-compact #bigNote{font-size:22px;line-height:1.1;min-width:0}' +
      '#modeFree .hud.rp-hud-compact #bigCents{display:none}' +
      '#modeFree .hud.rp-hud-compact .v{font-size:15px;line-height:1.15}' +
      '#modeFree .hud.rp-hud-compact .l{margin-top:0;font-size:7.5px}' +
      '.rp-sound{margin:8px 0 0}' +
      '.rp-sound>summary{display:inline-flex;align-items:center;gap:6px;list-style:none;cursor:pointer;' +
        'padding:6px 12px;border:1px solid var(--line);border-radius:999px;background:var(--panel);' +
        'font-size:12.5px;font-weight:800;color:var(--ink)}' +
      '.rp-sound>summary::-webkit-details-marker{display:none}' +
      '.rp-sound>summary::after{content:"\u25be";font-size:11px;color:var(--ink-dim)}' +
      '.rp-sound[open]>summary::after{content:"\u25b4"}' +
      '.rp-sound-in{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;padding:10px;' +
        'border:1px solid var(--line);border-radius:12px;background:var(--panel)}' +
      '.rp-sound-in .btn{padding:7px 11px;font-size:12px}' +
      '.rp-sd-vol{flex:1 1 100%;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:var(--ink-dim)}' +
      '.rp-sd-vol input{flex:1;min-width:0}' +
      '.rp-along{display:flex;align-items:flex-start;gap:8px;margin-top:10px;font-size:12.5px;color:var(--ink-dim);line-height:1.4}' +
      '.rp-i{flex:none;width:16px;height:16px;border-radius:50%;border:1.5px solid var(--ink-dim);display:inline-flex;' +
        'align-items:center;justify-content:center;font-size:10.5px;font-weight:900;font-style:normal;margin-top:1px}' +
      '#rpPtCount{position:absolute;inset:0;display:none;align-items:center;justify-content:center;font-size:74px;' +
        'font-weight:900;color:var(--gold);text-shadow:0 2px 18px rgba(0,0,0,.6);pointer-events:none}';
    document.head.appendChild(st);
  })();

  function fmt(ms) {
    var s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function draw() {
    var d = $('rpStudio');
    if (!d) return;
    var h = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<b style="font-size:13px">Record a take</b>' +
      '<span id="rpStTime" style="font-size:12px;font-weight:800;color:var(--ink-dim)">' +
      fmt(elapsed()) + '</span></div>';

    if (ST.state === 'idle' && !ST.blob) {
      h += '<button class="btn primary" id="rpStRec" style="width:100%;padding:12px;margin-top:10px">' +
        '<svg class="ic"><use href="#i-mic"/></svg> Record</button>';
    } else if (ST.state === 'rec' || ST.state === 'paused') {
      h += '<div class="notice" style="margin:8px 0 10px">' +
        (ST.state === 'rec' ? 'Recording.' : 'Paused.') + '</div>';
      h += '<div class="row" style="gap:7px">' +
        '<button class="btn' + (ST.state === 'rec' ? '' : ' primary') + '" id="rpStPause" style="flex:1;padding:11px">' +
        (ST.state === 'rec' ? 'Pause' : 'Keep going') + '</button>' +
        '<button class="btn" id="rpStStop" style="flex:1;padding:11px">Stop</button></div>';
      if (ST.state === 'paused' && ST.chunks.length) {
        h += '<button class="btn" id="rpStPeek" style="width:100%;padding:10px;margin-top:7px">' +
          'Listen to it so far</button>';
      }
    } else {
      var n = ST.notes.filter(function (x) { return x.m != null; }).length;
      h += '<div class="notice" style="margin:8px 0 10px">' + fmt(ST.activeMs) + ' recorded.</div>';
      /* The line goes in BEFORE the buttons, because deciding whether to keep
         a take is a question about where you were, not only how it sounded. */
      var svg = ST.lineHtml(ST.notes, 'pending');
      if (svg) h += svg;
      h += '<input id="rpStName" class="rp-inp" maxlength="60" placeholder="Name it (or leave it as ' + esc(defaultTitle()) + ')" style="width:100%;margin-top:9px" value="' + esc(ST.nameDraft || '') + '">';
      h += '<div class="row" style="gap:7px;margin-top:9px">' +
        '<button class="btn" id="rpStPlay" style="flex:1;padding:11px">' +
        (ST.playing ? 'Stop' : 'Play it back') + '</button>' +
        '<button class="btn primary" id="rpStKeep" style="flex:1;padding:11px">Keep</button></div>' +
        '<button class="btn" id="rpStBin" style="width:100%;padding:10px;margin-top:7px;color:var(--miss)">Discard</button>';
    }
    d.innerHTML = h;
    wire();
  }

  function elapsed() {
    return ST.activeMs + (ST.state === 'rec' ? Date.now() - ST.segT0 : 0);
  }

  function wire() {
    on($('rpStRec'), 'click', start);
    on($('rpStPause'), 'click', pauseResume);
    on($('rpStStop'), 'click', stop);
    on($('rpStPeek'), 'click', peek);
    on($('rpStPlay'), 'click', play);
    on($('rpStKeep'), 'click', keep);
    on($('rpStName'), 'input', function (e) { ST.nameDraft = e.target.value; });
    on($('rpStBin'), 'click', bin);
  }

  /* ---------------------------------------------------------------- */
  /* recording                                                         */
  /* ---------------------------------------------------------------- */
  function sampleNotes() {
    // 20 a second is plenty to draw a line from, and small enough to store
    ST.noteTimer = setInterval(function () {
      if (ST.state !== 'rec') return;
      var m = null;
      try {
        m = (typeof MIC !== 'undefined' && MIC.on && typeof smoothedMidi === 'function')
          ? smoothedMidi() : null;
      } catch (e) {}
      ST.notes.push({ t: +(elapsed() / 1000).toFixed(2), m: m == null ? null : +m.toFixed(2) });
    }, 50);
  }

  async function start() {
    if (typeof REC !== 'undefined' && REC.state !== 'idle') {
      return say('There is already a take running in My Music. Finish that one first.');
    }
    try {
      if (typeof MIC !== 'undefined' && !MIC.on && typeof startMic === 'function') await startMic();
    } catch (e) {
      return say('The microphone would not start: ' + (e.message || e));
    }
    if (typeof MIC === 'undefined' || !MIC.stream) return say('No microphone to record from.');

    var opts;
    try {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) opts = { mimeType: 'audio/webm;codecs=opus' };
      else if (MediaRecorder.isTypeSupported('audio/mp4')) opts = { mimeType: 'audio/mp4' };
    } catch (e) {}

    try {
      ST.rec = new MediaRecorder(MIC.stream, opts);
    } catch (e) {
      return say('This phone would not start a recording: ' + (e.message || e));
    }
    dropTake();
    ST.chunks = []; ST.notes = []; ST.activeMs = 0; ST.segT0 = Date.now(); ST.state = 'rec';
    ST.rec.ondataavailable = function (e) { if (e.data && e.data.size) ST.chunks.push(e.data); };
    ST.rec.onstop = function () {
      if (ST.noteTimer) { clearInterval(ST.noteTimer); ST.noteTimer = null; }
      ST.state = 'idle';
      if (!ST.chunks.length) { say('Nothing was recorded.'); ST.blob = null; draw(); return; }
      ST.blob = new Blob(ST.chunks, { type: (ST.rec && ST.rec.mimeType) || 'audio/webm' });
      draw();
    };
    try { ST.rec.start(); } catch (e) { ST.state = 'idle'; return say('Could not record: ' + (e.message || e)); }
    sampleNotes();
    draw();
  }

  /* The app learned this the hard way in v9.7: a phone can refuse pause and
     carry on recording. Ask the recorder what it is actually doing and say
     that, rather than setting our own flag and lying about it. */
  function pauseResume() {
    if (ST.state === 'rec') {
      try { ST.rec.requestData(); } catch (e) {}
      var paused = false;
      try { ST.rec.pause(); paused = (ST.rec.state === 'paused'); } catch (e) { paused = false; }
      if (!paused) return say('This phone would not pause — it is STILL RECORDING. Press Stop when you are done.');
      ST.activeMs += Date.now() - ST.segT0;
      ST.state = 'paused';
      /* requestData() delivers the audio a moment later, so the "listen back"
         button has nothing to offer at this instant. Draw again once it has
         landed. */
      setTimeout(draw, 300);
    } else if (ST.state === 'paused') {
      var going = false;
      try { ST.rec.resume(); going = (ST.rec.state === 'recording'); } catch (e) { going = false; }
      if (!going) return say('This phone would not start the take up again. Press Stop to keep what you have.');
      ST.segT0 = Date.now();
      ST.state = 'rec';
    }
    draw();
  }

  function stop() {
    if (ST.state === 'rec') ST.activeMs += Date.now() - ST.segT0;
    stopPlay();
    try { ST.rec.stop(); } catch (e) { ST.state = 'idle'; draw(); }
  }

  /* ================================================================ */
  /* THE PITCH LINE, DRAWN BACK                                        */
  /*                                                                   */
  /* Robert: "I wanna make sure that when you record a take on the     */
  /* pitch tracker, it tracks the notes on the map with the blue line. */
  /* Then when you listen back to it, or if you save it and then       */
  /* listen back to it, it also shows the notes, because that's        */
  /* what's important — to try to match the pitch."                    */
  /*                                                                   */
  /* The notes were always being stored with the audio. They were      */
  /* only ever drawn on the coach's phone. Hearing a take without      */
  /* seeing where you were is the half that does not teach you         */
  /* anything, so it is drawn here too, with a playhead that follows   */
  /* the audio — otherwise you can see the shape but not which bit of  */
  /* it you are listening to.                                          */
  /* ================================================================ */
  var LINE_H = 96;

  function noteName(m) {
    try { return midiName(Math.round(m)); } catch (e) { return ''; }
  }

  function lineBounds(notes) {
    var pts = (notes || []).filter(function (p) { return p && p.m != null; });
    if (pts.length < 2) return null;
    var ms = pts.map(function (p) { return p.m; });
    var lo = Math.min.apply(null, ms) - 1.5;
    var hi = Math.max.apply(null, ms) + 1.5;
    if (hi - lo < 7) { var mid = (hi + lo) / 2; lo = mid - 3.5; hi = mid + 3.5; }
    var last = notes[notes.length - 1];
    var dur = (last && last.t) || 1;
    return { lo: lo, hi: hi, dur: dur, n: pts.length };
  }

  /* An SVG the width of its box. The horizontal rules are semitones, named
     down the left, so "am I on the note" is a question you can answer by
     looking — which is the whole point of drawing it. */
  var LINES = {};   /* id -> notes, so playback can put them on the big map */
  ST.lineHtml = function (notes, id) {
    var b = lineBounds(notes);
    if (!b) return '';
    LINES[id || ''] = notes;
    var W = 300, H = LINE_H, PAD = 26;
    var y = function (m) { return H - ((m - b.lo) / (b.hi - b.lo)) * H; };
    var x = function (t) { return PAD + (t / b.dur) * (W - PAD); };

    var g = '', labels = '';
    var step = (b.hi - b.lo) > 18 ? 12 : ((b.hi - b.lo) > 10 ? 2 : 1);
    for (var m = Math.ceil(b.lo); m <= b.hi; m++) {
      if ((m - Math.ceil(b.lo)) % step) continue;
      var yy = y(m).toFixed(1);
      g += '<line x1="' + PAD + '" y1="' + yy + '" x2="' + W + '" y2="' + yy +
        '" stroke="var(--line)" stroke-width="0.6"/>';
      /* keep the name inside the box — the lowest rule sits on the floor and
         its label was being cut in half */
      var ly = Math.max(7, Math.min(H - 1.5, +yy + 3));
      labels += '<text x="2" y="' + ly.toFixed(1) + '" font-size="7.5" ' +
        'fill="var(--ink-faint)" font-weight="700">' + esc(noteName(m)) + '</text>';
    }

    var d = '', pen = false, prev = null;
    (notes || []).forEach(function (p) {
      if (p.m == null) { pen = false; prev = null; return; }
      var leap = prev && Math.abs(p.m - prev.m) > 6;
      d += (!pen || leap ? 'M' : 'L') + x(p.t).toFixed(1) + ' ' + y(p.m).toFixed(1) + ' ';
      pen = true; prev = p;
    });

    return '<svg data-pl="' + esc(id || '') + '" data-dur="' + b.dur +
      '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" ' +
      'style="width:100%;height:' + H + 'px;display:block;margin-top:9px;' +
      'background:var(--panel2);border-radius:9px">' +
      g + labels +
      '<path d="' + d + '" fill="none" stroke="var(--accent2)" stroke-width="2" ' +
      'stroke-linejoin="round" stroke-linecap="round"/>' +
      '<line class="rp-ph" x1="' + PAD + '" y1="0" x2="' + PAD + '" y2="' + H +
      '" stroke="var(--gold)" stroke-width="1.4" opacity="0"/></svg>';
  };

  /* Move the playhead with the audio. One loop at a time — a second Listen
     takes the loop over rather than leaving two running. */
  var follow = null;
  ST.followLine = function (svg, audio) {
    ST.unfollow();
    if (!svg || !audio) return;
    var ph = svg.querySelector('.rp-ph');
    if (!ph) return;
    var dur = +svg.getAttribute('data-dur') || 0;
    var W = 300, PAD = 26;
    follow = { svg: svg, audio: audio, raf: 0 };
    ST.overlay = { notes: LINES[svg.getAttribute('data-pl') || ''] || null, audio: audio };
    if (!over || over.audio !== audio) {
      var card = svg.closest ? svg.closest('.rp-card') : null;
      var tt = card && card.querySelector('.rp-ttl');
      over = { audio: audio, url: null, title: tt ? (tt.childNodes[0] && tt.childNodes[0].textContent || tt.textContent) : 'the take', mode: 'listen' };
    }
    try { playBar(); } catch (e) {}
    ph.setAttribute('opacity', '1');
    (function step() {
      if (!follow || follow.svg !== svg) return;
      var d = dur || audio.duration || 0;
      if (d > 0 && isFinite(d)) {
        var frac = Math.max(0, Math.min(1, (audio.currentTime || 0) / d));
        var px = (PAD + frac * (W - PAD)).toFixed(1);
        ph.setAttribute('x1', px); ph.setAttribute('x2', px);
      }
      if (audio.paused || audio.ended) { ph.setAttribute('opacity', '.35'); }
      else { ph.setAttribute('opacity', '1'); }
      follow.raf = requestAnimationFrame(step);
    })();
  };
  ST.unfollow = function () {
    if (follow && follow.raf) cancelAnimationFrame(follow.raf);
    follow = null;
    ST.overlay = null;
  };

  /* Robert, 13 Sep: "on the playback on the pitch tracker, show the notes
     on the main key map so they can sing over it — a different colour for
     the playback notes, keep the live vocals blue, so they can see where
     they are hitting in comparison."

     The tracker's own draw calls this after it has drawn the live line,
     handing over its scale, so the take is drawn to the very same pixels:
     now is the right edge, the past scrolls left. The take's own clock is
     the audio, so its line sits exactly where it was at that moment of the
     recording and yours sits where you are — the same x is the same
     instant. Gold for the take, blue for you. A dot at the edge marks the
     take's note right now, which is the one to aim at. */
  window.__rpOverlay = function (c2, W, H, now, pps, yOf) {
    if (ST.reading && window.RPFileMap && window.rpBoardNote) {
      var rs = RPFileMap.stateOf(ST.reading.id);
      rpBoardNote(c2, W, H, 'Reading the song \u2014 ' + RPFileMap.pct(rs) + '%',
                  'It starts by itself in a moment');
      return;
    }
    var o = ST.overlay;
    if (!o || !o.notes || !o.audio || o.audio.ended) return;
    var t0 = o.audio.currentTime || 0;
    var notes = o.notes;
    /* where this line's clock sits against the sound. A take's own pitch
       line was read 0.1s late by the microphone, so it goes back 0.1s; a
       note map built from a file was read 0.05s early, so it goes forward
       0.05s. The live blue line has already had the same 0.1s taken off it,
       which is why both cases now land on each other. Measured, not guessed
       — see the note beside rpMicLag in the build. */
    var lag = 0, ear = 0;
    try { ear = window.rpEarLag ? rpEarLag() : 0; } catch (e) { ear = 0; }
    try { lag = (window.rpNoteLag ? rpNoteLag(o.song || { notesFrom: o.from }) : 0) + ear; } catch (e) { lag = ear; }
    var shape = window.rpNoteShape ? rpNoteShape(notes) : 'line';
    c2.save();
    c2.strokeStyle = 'rgba(232,179,74,.95)';
    c2.shadowColor = 'rgba(232,179,74,.7)';
    c2.shadowBlur = 8;
    var cur = null, i, n, x, y;

    if (shape === 'bars') {
      /* Robert, 20 Sep: "gold straight diagonal lines appearing in sections."
         A note map is a list of held notes, not a traced line. Each one is a
         flat bar for as long as it is held, and nothing joins one to the
         next — the silence between two notes is not a slide between them. */
      var laneH = Math.abs(yOf(60) - yOf(61)) || 12;
      c2.lineCap = 'round';
      c2.lineWidth = Math.max(4, Math.min(12, laneH * 0.7));
      for (i = 0; i < notes.length; i++) {
        n = notes[i];
        if (!n || n.m == null) continue;
        x = W - (t0 - (n.t + lag)) * pps;
        var x2 = x + Math.max(2, (n.d || 0) * pps);
        if (x2 < -4 || x > W + 4) continue;
        y = yOf(n.m);
        c2.beginPath(); c2.moveTo(x, y); c2.lineTo(x2, y); c2.stroke();
        if (n.t + lag <= t0) cur = n;
      }
      c2.lineCap = 'butt';
    } else {
      /* measurement only, when a test asks: where each phrase's first point
         was drawn this frame, against the recording's own clock */
      var rec = window.__rpMeasure, near = rec ? [] : null;
      /* A point taken twenty times a second stands for the 50ms around it,
         so a phrase is drawn from half a step before its first point to
         half a step after its last - where the voice began and ended, not
         where the first sample happened to land. Measured 25 Sep: drawing
         from the first point put every phrase on average 25ms late. */
      var half = 0.025;
      if (notes.length > 1 && notes[1].t > notes[0].t) half = (notes[1].t - notes[0].t) / 2;
      c2.beginPath();
      var pen = false, prev = null;
      for (i = 0; i < notes.length; i++) {
        n = notes[i];
        if (n.m == null) { pen = false; prev = null; continue; }
        x = W - (t0 - (n.t + lag)) * pps;
        var runStart = (i === 0 || notes[i - 1].m == null);
        var runEnd = (i + 1 >= notes.length || notes[i + 1].m == null);
        if (near && runStart && Math.abs(x - W) < 80) {
          near.push([i, +(x - half * pps).toFixed(2)]);
        }
        if (x < -4 - half * pps || x > W + 4 + half * pps) { pen = false; prev = null; continue; }
        y = yOf(n.m);
        var leap = prev && Math.abs(n.m - prev.m) > 6;
        if (!pen || leap) {
          if (runStart) { c2.moveTo(x - half * pps, y); c2.lineTo(x, y); }
          else c2.moveTo(x, y);
        } else c2.lineTo(x, y);
        if (runEnd) c2.lineTo(x + half * pps, y);
        pen = true; prev = n;
        if (n.t + lag <= t0) cur = n;
      }
      c2.lineWidth = 2.5;
      c2.stroke();
      if (rec && rec.length < 40000) {
        rec.push({ s: 'pt', a: t0, p: performance.now(), edge: W, lag: lag, ear: ear, r: near });
      }
    }
    c2.shadowBlur = 0;
    c2.lineWidth = 1;
    if (cur && !o.audio.paused) {
      c2.beginPath();
      c2.arc(W - 5, yOf(cur.m), 5, 0, Math.PI * 2);
      c2.fillStyle = 'rgba(232,179,74,1)';
      c2.fill();
    }
    c2.restore();
    if (ST.catching && window.rpBoardNote) rpBoardNote(c2, W, H, 'Catching up\u2026', 'The song carries on in a moment');
  };

  /* ---------------------------------------------------------------- */
  /* listening back                                                    */
  /* ---------------------------------------------------------------- */
  function blobNow() {
    if (ST.blob) return ST.blob;
    if (!ST.chunks.length) return null;
    return new Blob(ST.chunks, { type: (ST.rec && ST.rec.mimeType) || 'audio/webm' });
  }
  function stopPlay() {
    /* only the pending take's own playback; a guide being sung over stays */
    if (follow && ST.audio && follow.audio === ST.audio) ST.unfollow();
    if (ST.audio) { try { ST.audio.pause(); } catch (e) {} ST.audio = null; }
    if (ST.url) { URL.revokeObjectURL(ST.url); ST.url = null; }
    ST.playing = false;
  }
  function peek() {
    var b = blobNow();
    if (!b) return say('Nothing to listen to yet.');
    stopPlay();
    claimSound('take-listen', function () { stopPlay(); draw(); });
    ST.url = URL.createObjectURL(b);
    ST.audio = new Audio(ST.url);
    ST.audio.play().catch(function () { say('The phone would not play it back.'); });
  }
  function play() {
    if (ST.playing) { stopPlay(); draw(); return; }
    var b = blobNow();
    if (!b) return say('Nothing to play.');
    stopPlay();
    /* Robert, 24 Sep: this kept playing when he walked to the Library, and a
       song there started on top of it. One owner of the sound now. */
    claimSound('take-listen', function () { stopPlay(); draw(); });
    ST.url = URL.createObjectURL(b);
    ST.audio = new Audio(ST.url);
    ST.audio.onended = function () { ST.playing = false; ST.unfollow(); draw(); };
    ST.audio.play().then(function () {
      ST.playing = true;
      draw();
      /* draw() rebuilt the panel, so the svg to follow is the new one */
      var d = $('rpStudio');
      var svg = d && d.querySelector('[data-pl="pending"]');
      if (svg) ST.followLine(svg, ST.audio);
    }).catch(function () { say('The phone would not play it back.'); });
    draw();
  }

  /* ---------------------------------------------------------------- */
  /* keep or bin                                                       */
  /* ---------------------------------------------------------------- */
  function dropTake() {
    stopPlay();
    ST.blob = null; ST.chunks = []; ST.notes = [];
  }

  function bin() {
    dropTake();
    ST.activeMs = 0;
    draw();
    say('Thrown away. Nothing was saved.');
  }

  function defaultTitle() {
    var d = new Date();
    return 'Take ' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
           String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }
  async function keep() {
    var b = blobNow();
    if (!b) return say('Nothing to keep.');
    var named = (ST.nameDraft || '').trim();
    ST.nameDraft = '';
    var song = {
      id: 'rec' + Date.now(), kind: 'recording',
      title: named || defaultTitle(),
      artist: 'My Recordings', blob: b, addedAt: Date.now(),
      key: null, lrc: null, duration: ST.activeMs / 1000,
      notes: ST.notes,                      // the pitch line, saved with the audio
      notesFrom: 'live',                    // read by the mic, so it reads late
      origin: ST.assign ? 'exercise' : 'tracker'   // where it was recorded
    };
    if (ST.assign) {                        // this one answers an assignment
      song.assignId = ST.assign.id;
      song.assignTitle = ST.assign.title;
      /* The build wraps dbPut and renames any exercise take to
         "<exercise> · <range> · <date>". That is right for a loose take and
         wrong here: two goes at the same assignment on the same day came out
         with identical names, which is exactly the pair Robert has to tell
         apart before he submits one. So we name it ourselves and set the tag
         the wrapper checks, which makes it stand down. */
      song.exTagged = true;
      song.exId = ST.assign.app_ex_id || null;
      song.exTitle = ST.assign.title;
      song.artist = 'Exercise takes';
      if (!named) song.title = ST.assign.title + ' · take ' + takeNoFor(ST.assign.id);
      song.autoTitle = song.title;
      try { song.exRange = midiName(RANGE.lo) + '\u2013' + midiName(RANGE.hi); } catch (e) {}
    }
    try {
      await dbPut('songs', song);
    } catch (e) {
      return say('Could not save it — storage may be full.');
    }
    try {
      LIB.songs.push(song);
      libRenderPlaylists(); libRender();
    } catch (e) {}
    dropTake();
    ST.activeMs = 0;
    draw();
    fillTakes();
    if (ST.assign) {
      say('Saved to this device. Not sent yet — submit the one you like.');
      try { if (window.RPWork) RPWork.refresh(); } catch (e) {}
    } else {
      say('Kept. It is in the Library, under Takes.');
    }
  }

  /* The assignment bar drives this same recorder rather than opening a
     second one. One microphone, one recorder — that rule has not changed. */
  ST.api = {
    start: start, stop: stop, keep: keep, bin: bin, play: play,
    pauseResume: pauseResume, blobNow: blobNow, elapsed: elapsed, fmt: fmt, draw: draw
  };
  ST.fillTakes = function () { try { fillTakes(); } catch (e) {} };

  /* ---------------------------------------------------------------- */
  /* sing over one of your takes                                       */
  /* ---------------------------------------------------------------- */
  function mountTakes() {
    var host = $('modeFree');
    if (!host || $('rpTakes')) return;
    var st = $('rpStudio');
    var d = document.createElement('div');
    d.id = 'rpTakes';
    d.className = 'panel';
    d.style.cssText = 'margin-top:10px;padding:12px';
    d.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<b style="font-size:13px">Your takes</b>' +
      '<button class="btn" id="rpTakesAll" style="padding:7px 11px;font-size:12px">All takes ›</button></div>' +
      '<div id="rpTakeList"></div>';
    st && st.parentNode ? st.parentNode.insertBefore(d, st.nextSibling) : host.appendChild(d);
    fillTakes();
  }

  function takes() {
    try {
      return (LIB.songs || []).filter(function (s) { return s.kind === 'recording' && s.blob; })
        .sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
    } catch (e) { return []; }
  }

  /* "take 1", "take 2" — counted per assignment, so the third go at the
     five-note scale is called the third go at the five-note scale. */
  function takeNoFor(id) {
    try {
      return (LIB.songs || []).filter(function (s) {
        return s.kind === 'recording' && s.assignId === id;
      }).length + 1;
    } catch (e) { return 1; }
  }

  /* Robert, 17 Sep: the tracker shows the newest take and a door to the
     Library's Takes page, organised by exercise, instead of a wall. */
  function fillTakes() {
    var box = $('rpTakeList');
    if (!box) return;
    /* Robert, 25 Sep: each screen shows the takes recorded on it */
    var list = takes().filter(function (s) {
      return !s.assignId && (!window.RPTakes || RPTakes.originOf(s) === 'tracker');
    });
    if (!list.length) { box.innerHTML = '<div class="rp-empty" style="padding:8px 2px">No takes yet.</div>'; }
    else if (window.RPTakes) {
      box.innerHTML = '<div class="measured" style="margin:6px 0 4px">Newest</div>' + RPTakes.rowHtml(list[0]) +
        (list.length > 1 ? '<div class="measured" style="margin-top:6px">' + (list.length - 1) + ' more in the Library.</div>' : '');
      RPTakes.wire(box);
    }
    on($('rpTakesAll'), 'click', function () {
      try { switchMode('lib'); } catch (e) {}
      setTimeout(function () { if (window.RPLib && RPLib.show) RPLib.show('recordings'); }, 150);
    });
  }

  /* Robert, 16 Sep: "Sing over it should do what Listen already does, plus
     my voice." It used to play the take through the tracker's track player
     and never set ST.overlay, so the big map never saw it. Now it sets the
     same overlay Listen sets — the take's notes in gold on the big map, the
     take's clock as the guide — and your voice draws over them in blue. The
     take's sound is off unless "Hear the take" is on; the clock runs either
     way. One bar under the map shows what is playing and stops it. */
  ST.hearTake = false;
  try { ST.hearTake = localStorage.getItem('rp_hear_take') === '1'; } catch (e) {}
  /* Robert, 16 Sep: "I can't change the volume of the take I'm singing over." */
  ST.takeVol = 0.8;
  try { var tv = localStorage.getItem('rp_take_vol'); if (tv != null && isFinite(+tv)) ST.takeVol = Math.max(0, Math.min(1, +tv)); } catch (e) {}
  var over = null;   /* { audio, url, title, mode } */
  function stopOver() {
    cancelCount();
    if (over) {
      try { if (over.audio.end) over.audio.end(); else over.audio.pause(); } catch (e) {}
      if (over.url) { try { URL.revokeObjectURL(over.url); } catch (e) {} }
      over = null;
    }
    ST.unfollow();
    var cv0 = $('rpSeekMap'); if (cv0 && cv0.parentElement) cv0.parentElement.removeChild(cv0);
    pinTracker();
    playBar();
  }
  ST.stopAll = function () {
    stopOver();
    try { if (window.RPSend && RPSend.stopListen) RPSend.stopListen(); } catch (e) {}
    playBar();
  };
  /* Robert, 25 Sep: "Robert's screenshot of All of Me still shows flat bars:
     that is the old-analyser map, not re-read." A song file is drawn as the
     line the app hears, never as the old bars. While it is being read the
     board says how far along it is, and the song starts by itself once the
     reading is eight seconds ahead of where the song begins.

     Robert, 25 Sep, later: he opened All of Me, left for another tab while
     it read, and it started playing in the background when the read
     finished. So a finished read only starts the song if the Pitch Tracker
     is still the screen showing AND the page is visible. Otherwise the song
     is simply ready: opening it again starts it at once. */
  function trackerShowing() {
    var m = $('modeFree');
    return !!(m && m.classList.contains('active')) && !document.hidden;
  }
  ST.showing = trackerShowing;
  function readThenLoad(song) {
    ST.stopAll();
    ST.reading = song;
    RPFileMap.ensure(song, true).catch(function () {
      if (ST.reading !== song) return;
      ST.reading = null;
      say('Could not read this song.');
    });
    var iv = setInterval(function () {
      if (ST.reading !== song) { clearInterval(iv); return; }
      var a = RPFileMap.aheadOf(song, 0);
      if (!(a.done || a.canStart)) return;
      clearInterval(iv);
      ST.reading = null;
      if (trackerShowing()) loadTake(song);
      else draw();
    }, 200);
  }
  /* Robert, 25 Sep: "Playback may start once the read is 8 seconds ahead of
     the playhead, and must stay at least 4 seconds ahead; if it falls
     behind, pause with 'Catching up…' rather than drawing nothing." It picks
     up again once the reading is 8 seconds ahead of where it stopped. */
  ST.catching = false;
  function catchUp() {
    var o = ST.overlay;
    /* only a song whose reading is under way can fall behind it */
    if (!o || !o.song || !o.audio || o.audio.ended || !window.RPFileMap ||
        !(ST.catching || RPFileMap.reading(o.song))) { ST.catching = false; return; }
    var a = RPFileMap.aheadOf(o.song, o.audio.currentTime || 0);
    if (!ST.catching) {
      if (!a.done && !a.ok && !o.audio.paused) {
        ST.catching = true;
        try { o.audio.pause(); } catch (e) {}
        playBar();
      }
    } else if ((a.done || a.canStart) && !document.hidden) {
      ST.catching = false;
      try { var pr = o.audio.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
      playBar();
    }
  }
  setInterval(catchUp, 50);

  function loadTake(s) {
    if (!s) return say('Keep a take first.');
    if (s.kind !== 'recording' && window.RPFileMap && RPFileMap.needsBuild(s)) {
      var ah = RPFileMap.aheadOf(s, 0);
      if (!(ah.done || ah.canStart)) return readThenLoad(s);
    }
    if (!s.notes || !s.notes.length) return say('That take has no notes with it, so there is nothing to sing over.');
    ST.stopAll();
    /* nothing starts while the page is hidden */
    if (!claimSound('sing-along', function () { try { stopOver(); } catch (e) {} })) return;
    (async function () { try { if (typeof MIC !== 'undefined' && !MIC.on && typeof enableMic === 'function') await enableMic(); } catch (e) {} })();
    try {
      var url = URL.createObjectURL(s.blob);
      var a = new Audio(url);
      a.muted = !ST.hearTake;
      try { a.volume = ST.takeVol; } catch (e) {}
      over = { audio: a, url: url, title: s.title, mode: 'over' };
      ST.overlay = { notes: s.notes, audio: a, song: s };
      pinTracker();
      a.onended = function () { if (over && over.audio === a) stopOver(); };
      /* Robert, 25 Sep: "A 3-2-1 countdown before a sing-along starts, the
         same as Learn a song." */
      countIn(function () {
        if (!over || over.audio !== a) return;
        a.play().catch(function () { if (!document.hidden) say('The phone would not play it.'); });
        playBar();
      });
      try { $('freeCanvas').scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    } catch (e) { say('Could not load that take.'); }
    playBar();
  }

  ST.singOver = loadTake;

  ST.counting = false;
  var countTok = 0;
  function countIn(then) {
    var tok = ++countTok, cv = $('freeCanvas'), el = $('rpPtCount');
    if (!el && cv && cv.parentElement) {
      el = document.createElement('div');
      el.id = 'rpPtCount';
      cv.parentElement.appendChild(el);
    }
    var n = 3;
    ST.counting = true;
    (function tick() {
      if (tok !== countTok) return;
      if (n > 0) {
        if (el) { el.style.display = 'flex'; el.textContent = String(n); }
        n--;
        setTimeout(tick, 1000);
        return;
      }
      if (el) el.style.display = 'none';
      ST.counting = false;
      then();
    })();
  }
  function cancelCount() {
    countTok++;
    ST.counting = false;
    var el = $('rpPtCount'); if (el) el.style.display = 'none';
  }

  /* Robert, 24 Sep: "Open in Pitch Tracker lands on the tracker but not
     ready - I had to tap the take again from the tracker, then press
     Record."

     Three places did the same thing: switch screen, then guess at 250ms and
     hope the panel had drawn and the microphone had opened. Neither was
     waited for, so on a slower phone he arrived at a screen with no Record
     button and no microphone. One way in instead, which does it in order
     and waits for the parts that can be waited for. */
  ST.openWith = async function (song) {
    try { switchMode('free'); } catch (e) {}
    mount(); mountTakes();                 /* Record exists before he looks */
    try {
      if (typeof MIC !== 'undefined' && !MIC.on && typeof enableMic === 'function') await enableMic();
    } catch (e) {}
    if (song) loadTake(song);
    draw();
    try { $('freeCanvas').scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    return ST.ready();
  };
  /* what "ready" means, so a test can ask rather than infer */
  ST.ready = function () {
    var rec = $('rpStRec');
    return {
      mic: !!(typeof MIC !== 'undefined' && MIC.on),
      loaded: !!(ST.overlay && ST.overlay.notes && ST.overlay.notes.length),
      canRecord: !!(rec && !rec.disabled && rec.offsetParent !== null)
    };
  };

  /* Robert, 16 Sep: a note map "played back as a guide". Same overlay as
     Sing over it, but the clock is a timer rather than a recording — an
     object that looks enough like an audio element for __rpOverlay and
     the bar (currentTime, paused, ended, pause). Nothing is heard. */
  function clockFor(dur) {
    var t0 = performance.now(), held = 0, c = { paused: false, ended: false, muted: true, _dur: dur || 0 };
    Object.defineProperty(c, 'currentTime', {
      get: function () {
        if (c.ended) return c._dur;
        if (c.paused) return held;
        var t = (performance.now() - t0) / 1000;
        if (c._dur && t > c._dur + 0.6) { c.ended = true; return c._dur; }
        return t;
      },
      set: function (v) { held = v || 0; t0 = performance.now() - held * 1000; c.ended = false; }
    });
    c.pause = function () { if (!c.paused) { held = c.currentTime; c.paused = true; } };
    c.play = function () { if (c.paused) { t0 = performance.now() - held * 1000; c.paused = false; } return Promise.resolve(); };
    c.end = function () { c.paused = true; c.ended = true; };
    return c;
  }
  ST.guide = function (notes, title, dur) {
    if (!notes || !notes.length) return say('That map has no notes.');
    ST.stopAll();
    (async function () { try { if (typeof MIC !== 'undefined' && !MIC.on && typeof enableMic === 'function') await enableMic(); } catch (e) {} })();
    var last = notes[notes.length - 1];
    var clock = clockFor(dur || (last && last.t) || 0);
    over = { audio: clock, url: null, title: title || 'the map', mode: 'guide' };
    /* a map played as a guide came out of buildNoteMap, so it reads early */
    ST.overlay = { notes: notes, audio: clock, from: 'file' };
    pinTracker();
    say('Guide: ' + (title || 'the map') + '. Gold is the map; blue is you now.');
    try { $('freeCanvas').scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
    playBar();
  };

  /* the bar under the big map: what is playing, a Stop, and the sound switch */
  function playBar() {
    var cv = $('freeCanvas');
    if (!cv || !cv.parentElement) return;
    var bar = $('rpPlayBar');
    var o = ST.overlay;
    var live = o && o.audio && !o.audio.ended;
    if (!live) { if (bar) bar.style.display = 'none'; return; }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'rpPlayBar';
      bar.className = 'row';
      bar.style.cssText = 'align-items:center;gap:8px;margin:8px 0 2px;flex-wrap:wrap';
      cv.parentElement.insertBefore(bar, cv.nextSibling);
    }
    var title = over ? over.title : 'the take';
    var mode = over && over.mode === 'over';
    var lead = over && over.mode === 'guide' ? 'Guide: ' : (mode ? 'Singing along with ' : 'Listening to ');
    var paused = !!o.audio.paused && !ST.counting;
    bar.dataset.paused = paused ? '1' : '0';
    /* Robert, 16 Sep: "still need a pause, restart and end button." */
    bar.innerHTML = '<div style="flex:1 1 100%;min-width:0;font-size:12.5px;font-weight:700">' +
        lead + '<span style="color:var(--gold)">' + esc(title) + '</span>' + (paused ? ' · paused' : '') + '</div>' +
      '<button class="btn' + (paused ? ' primary' : '') + '" id="rpPauseOver" style="padding:7px 12px;font-size:12px">' + (paused ? 'Resume' : 'Pause') + '</button>' +
      '<button class="btn" id="rpRestartOver" style="padding:7px 12px;font-size:12px">Restart</button>' +
      '<button class="btn danger" id="rpStopOver" style="padding:7px 12px;font-size:12px">Stop</button>';
    bar.style.display = '';
    seekMap();
    on($('rpStopOver'), 'click', function () { ST.stopAll(); say('Stopped.'); });
    on($('rpPauseOver'), 'click', function () {
      var a = ST.overlay && ST.overlay.audio; if (!a) return;
      ST.catching = false;              /* his own pause is his; catching up resumes only its own */
      if (ST.counting) { cancelCount(); setTimeout(playBar, 60); return; }
      if (a.paused) { try { var pr = a.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {} }
      else { try { a.pause(); } catch (e) {} }
      setTimeout(playBar, 60);
    });
    on($('rpRestartOver'), 'click', function () {
      var a = ST.overlay && ST.overlay.audio; if (!a) return;
      cancelCount();
      try { a.currentTime = 0; var pr = a.play(); if (pr && pr.catch) pr.catch(function () {}); } catch (e) {}
      setTimeout(playBar, 60);
    });
  }
  /* Robert, 17 Sep: "when I'm listening to a take I want control of where
     it plays from." The whole take is drawn under the bar with a line where
     playback is. Tap anywhere on it to play from there. */
  function seekDur() {
    var o = ST.overlay; if (!o) return 1;
    var d = 0;
    try { d = o.audio.duration; } catch (e) {}
    if (!(d > 0) || !isFinite(d)) { var n = o.notes[o.notes.length - 1]; d = (n && n.t) || 1; }
    return d;
  }
  function drawHead(cv) {
    var o = ST.overlay;
    if (!cv || !o || !o.notes || !window.RPMaps) return;
    RPMaps.draw(cv, { notes: o.notes, title: '' }, { height: 96 });
    var g = cv.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var W = cv.clientWidth || 360, H = 96;
    var t = 0; try { t = o.audio.currentTime || 0; } catch (e) {}
    var x = 34 + (Math.max(0, Math.min(1, t / seekDur()))) * (W - 40);
    g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(x, 4); g.lineTo(x, H - 18); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.92)';
    g.beginPath(); g.arc(x, 6, 3.5, 0, Math.PI * 2); g.fill();
  }
  function seekMap() {
    var bar = $('rpPlayBar');
    var o = ST.overlay;
    if (!bar || !o || !o.notes || !window.RPMaps) return;
    var cv = $('rpSeekMap');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.id = 'rpSeekMap';
      cv.style.cssText = 'display:block;width:100%;height:96px;border-radius:10px;border:1px solid var(--line);margin-top:8px;cursor:pointer;flex:1 1 100%';
      bar.appendChild(cv);
      cv.addEventListener('pointerdown', function (e) {
        var oo = ST.overlay; if (!oo || !oo.audio) return;
        var r = cv.getBoundingClientRect();
        var frac = Math.max(0, Math.min(1, (e.clientX - r.left - 34) / Math.max(1, r.width - 40)));
        try { oo.audio.currentTime = frac * seekDur(); } catch (err) {}
        try { if (oo.audio.paused && oo.audio.play) { var pr = oo.audio.play(); if (pr && pr.catch) pr.catch(function () {}); } } catch (err) {}
        setTimeout(playBar, 60);
      });
    } else if (cv.parentElement !== bar) { bar.appendChild(cv); }
    drawHead(cv);
  }
  setInterval(function () {
    var cv = $('rpSeekMap');
    if (cv && cv.offsetParent !== null && ST.overlay) drawHead(cv);
  }, 140);

  /* Listen (from the take list) sets the overlay too; the bar follows it */
  document.addEventListener('visibilitychange', function () {
    /* Robert, 16 Sep: "my phone is asleep and it's still playing." */
    if (document.hidden && ST.overlay && ST.overlay.audio && !ST.overlay.audio.paused) {
      try { ST.overlay.audio.pause(); } catch (e) {}
      setTimeout(playBar, 60);
    }
  });
  setInterval(function () {
    var bar = $('rpPlayBar');
    var o = ST.overlay, live = o && o.audio && !o.audio.ended && !o.audio.paused;
    if (live && (!bar || bar.style.display === 'none')) playBar();
    if (o && o.audio && bar && bar.style.display !== 'none' && bar.dataset.paused !== (o.audio.paused ? '1' : '0')) playBar();
    if (!live && bar && bar.style.display !== 'none' && !(o && o.audio && !o.audio.ended)) playBar();
    if (o && o.audio && o.audio.ended && over && over.mode === 'guide') stopOver();
  }, 400);

  /* ---------------------------------------------------------------- */
  /* a running clock while recording                                   */
  /* ---------------------------------------------------------------- */
  setInterval(function () {
    var t = $('rpStTime');
    if (t && (ST.state === 'rec' || ST.state === 'paused')) t.textContent = fmt(elapsed());
  }, 500);

  /* Robert wants the pitch tracker reachable from Train, where the practising
     happens, while the Sing menu keeps it as Free Sing. Same screen, two ways
     in — not two copies of it. */
  /* Robert, 17 Sep: this used to put a Pitch Tracker row at the top of
     Train. The Train rework replaced the layout it inserted into, so the
     row stopped appearing — and the Train tile's click handler was still
     reaching for this row's Open button, which is why that tile went
     nowhere. The Pitch Tracker is on the Sing tab now, so the row is gone
     rather than repaired. */
  function mountTrainEntry() { /* removed with the move to the Sing tab */ }


  /* Robert, 16 Sep: "Your takes" said nothing kept while the mini player
     was playing a take. The list was drawn once, at boot, before the
     library had loaded from the phone, and never again. Now it follows. */
  var takesSig = '';
  function refreshTakes() {
    var sig = '';
    try { sig = takes().map(function (s) { return s.id + ':' + (s.sentAt || ''); }).join(','); } catch (e) {}
    if (sig !== takesSig) { takesSig = sig; if ($('rpTakeList')) fillTakes(); }
  }
  function boot() {
    setInterval(function () { mount(); mountTakes(); refreshTakes(); pinTracker(); tidy(); }, 1200);
    mount(); mountTakes(); pinTracker(); tidy();   /* the old Train-tab entry row is gone: the Pitch Tracker tile is the way in */
    try { if (typeof libReady !== 'undefined' && libReady && libReady.then) libReady.then(function () { setTimeout(refreshTakes, 50); }); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 400);
})();

/* ======================================================================
   DuckDuckGo's browser and the microphone.

   Robert, 12 Sep: "I figured out what was going on with Briar's phone. It
   was when the app loaded on the browser, DuckDuckGo. But it worked on
   Chrome. It didn't work on DuckDuckGo. It always had the same screenshot
   I sent you last time about the mic."

   So the mic ladder was never the whole story. DuckDuckGo's own browser
   does not hand a web page the microphone the way Chrome and Safari do —
   its getUserMedia has been reported broken since 2022 and is still not
   right. Nothing this app does will change that.

   What we CAN stop doing is giving her the wrong advice. Until now every
   mic failure told her to close other apps and restart the phone, which is
   the same wrong turn as last time, in a new costume. If the browser is
   DuckDuckGo, say it is the browser and name the one that works.

   HONESTY NOTE: DuckDuckGo cannot be installed in the sandbox this was
   written in, so the FAILURE itself has not been reproduced here — only
   Robert's report of it. What has been tested is that this message is the
   one that appears when the browser identifies itself as DuckDuckGo.
   ====================================================================== */
(function () {
  'use strict';
  function isDDG() {
    try { return /DuckDuckGo\//i.test(navigator.userAgent || ''); } catch (e) { return false; }
  }
  window.RPIsDDG = isDDG;

  if (typeof window.micErrorHelp !== 'function') return;
  var orig = window.micErrorHelp;
  window.micErrorHelp = function (err) {
    if (isDDG()) {
      var where = 'this page';
      try { where = location.href.split('#')[0]; } catch (e) {}
      return {
        title: 'DuckDuckGo will not give the app the microphone',
        why: 'This is the DuckDuckGo browser, and it does not pass the microphone '
           + 'through to web pages properly. It is not your device and it is not the '
           + 'permissions — the same page works in Chrome or Safari.',
        steps: [
          'Open Chrome (Android) or Safari (iPhone).',
          'Go to ' + where,
          'Allow the microphone when it asks.',
          'Everything you have saved stays on the browser you saved it in, so if you '
          + 'have takes here, they will not follow you across.'
        ],
        name: (err && err.name) || 'DuckDuckGoBrowser',
        msg: (err && err.message) || ''
      };
    }
    return orig.apply(this, arguments);
  };
})();
