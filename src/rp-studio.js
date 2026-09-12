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
    t.innerHTML = '<h1 style="margin:0 0 2px">Pitch Tracker</h1>' +
      '<div class="rp-sub" style="margin:0 0 12px">Every note you sing, measured. Record a take and ' +
      'the notes are kept with it.</div>';
    if (back && back.parentNode === host) host.insertBefore(t, back.nextSibling);
    else host.insertBefore(t, host.firstChild);
  }

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
      h += '<div class="notice" style="margin:8px 0 10px">Sing. Nothing is saved until you say so.</div>' +
        '<button class="btn primary" id="rpStRec" style="width:100%;padding:12px">' +
        '<svg class="ic"><use href="#i-mic"/></svg> Record</button>';
    } else if (ST.state === 'rec' || ST.state === 'paused') {
      h += '<div class="notice" style="margin:8px 0 10px">' +
        (ST.state === 'rec' ? 'Recording. Pause any time — it stays one take.'
                            : 'Paused. Listen back, keep going, or stop and decide.') + '</div>';
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
      h += '<div class="notice" style="margin:8px 0 10px">' + fmt(ST.activeMs) +
        ' recorded' + (n ? ', with the pitch line' : '') + '. Keep it or throw it away.</div>';
      h += '<div class="row" style="gap:7px">' +
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

  /* ---------------------------------------------------------------- */
  /* listening back                                                    */
  /* ---------------------------------------------------------------- */
  function blobNow() {
    if (ST.blob) return ST.blob;
    if (!ST.chunks.length) return null;
    return new Blob(ST.chunks, { type: (ST.rec && ST.rec.mimeType) || 'audio/webm' });
  }
  function stopPlay() {
    if (ST.audio) { try { ST.audio.pause(); } catch (e) {} ST.audio = null; }
    if (ST.url) { URL.revokeObjectURL(ST.url); ST.url = null; }
    ST.playing = false;
  }
  function peek() {
    var b = blobNow();
    if (!b) return say('Nothing to listen to yet.');
    stopPlay();
    ST.url = URL.createObjectURL(b);
    ST.audio = new Audio(ST.url);
    ST.audio.play().catch(function () { say('The phone would not play it back.'); });
  }
  function play() {
    if (ST.playing) { stopPlay(); draw(); return; }
    var b = blobNow();
    if (!b) return say('Nothing to play.');
    stopPlay();
    ST.url = URL.createObjectURL(b);
    ST.audio = new Audio(ST.url);
    ST.audio.onended = function () { ST.playing = false; draw(); };
    ST.audio.play().then(function () { ST.playing = true; draw(); })
      .catch(function () { say('The phone would not play it back.'); });
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

  async function keep() {
    var b = blobNow();
    if (!b) return say('Nothing to keep.');
    var d = new Date();
    var song = {
      id: 'rec' + Date.now(), kind: 'recording',
      title: 'Take ' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
             String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
      artist: 'My Recordings', blob: b, addedAt: Date.now(),
      key: null, lrc: null, duration: ST.activeMs / 1000,
      notes: ST.notes                       // the pitch line, saved with the audio
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
      song.title = ST.assign.title + ' · take ' + takeNoFor(ST.assign.id);
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
      say('Saved to your phone. Not sent yet — submit the one you like.');
      try { if (window.RPWork) RPWork.refresh(); } catch (e) {}
    } else {
      say('Kept, in My Recordings.');
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
    d.innerHTML = '<b style="font-size:13px">Your takes</b>' +
      '<div class="notice" style="margin:8px 0 9px">Sing over one, keep it on your phone, or send it ' +
      'to your coach — the notes go with it, so he sees where you were as well as hears it.</div>' +
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

  function fillTakes() {
    var box = $('rpTakeList');
    if (!box || !window.RPSend) return;
    box.innerHTML = RPSend.listHtml('pitch');
    RPSend.wireList(box, 'pitch', loadTake);
  }

  function loadTake(s) {
    if (!s) return say('Keep a take first.');
    var a = $('freeAudio');
    if (!a) return;
    try {
      if (a._rpUrl) URL.revokeObjectURL(a._rpUrl);
      a._rpUrl = URL.createObjectURL(s.blob);
      a.src = a._rpUrl;
      a.play().catch(function () {});
      say('Playing ' + s.title + '. Sing along and watch your line.');
    } catch (e) { say('Could not load that take.'); }
  }

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
  function mountTrainEntry() {
    var host = $('modeTrain');
    if (!host || $('rpTrainPitch')) return;
    var d = document.createElement('div');
    d.id = 'rpTrainPitch';
    d.className = 'exrow';
    d.style.cursor = 'pointer';
    d.innerHTML = '<div class="exhead">' +
      '<div class="exname">Pitch Tracker</div>' +
      '<button class="btn primary" id="rpTrainPitchGo" style="padding:7px 12px;font-size:12px">Open</button>' +
      '</div>' +
      '<div class="exsyl" style="margin-top:6px;font-weight:600">Your voice on the keys, live — and record a take.</div>' +
      '<div class="measured">Sing anything. Watch the line. Record it, listen back, keep it or bin it.</div>';
    host.insertBefore(d, host.firstChild);
    on($('rpTrainPitchGo'), 'click', function (e) {
      e.stopPropagation();
      try { switchMode('free'); } catch (err) {}
    });
    on(d, 'click', function () { try { switchMode('free'); } catch (err) {} });
  }

  function boot() {
    setInterval(function () { mount(); mountTakes(); mountTrainEntry(); }, 1200);
    mount(); mountTakes(); mountTrainEntry();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 400);
})();
