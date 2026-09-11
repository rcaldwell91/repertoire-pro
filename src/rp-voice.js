/* ======================================================================
   Repertoire Pro — FREE SING.

   A different feature from the Pitch Tracker, not another door into it.
   Nothing here tracks your notes, scores you, or tells your coach anything.
   You sing, you put a bit of colour on your voice, you keep it if you like
   it. That is the whole idea.

   Four effects, all of them real Web Audio, all of them adjustable while you
   sing and afterwards:  Compressor · EQ · Echo · Reverb.

   Deliberately NOT here, and not by accident — pitch correction, layers and
   backing beats. Robert: "that's phase two, the BandLab-type thing. This is
   just for fun." A pitch-correction slider in a singing app that promises
   honest measurement is also a contradiction we would have to unpick later.

   The recording is kept DRY — your actual voice — with the effect settings
   saved beside it. So the effects stay changeable afterwards and the take
   never quietly becomes a lie about how you sang.
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
  function say(m) { if (window.RP && RP.toast) RP.toast(m); }

  var V = window.RPVoice = {
    fx: { comp: 'moderate', eq: 'flat', echo: 'off', verb: 'room' },
    monitor: false,
    built: false, nodes: null,
    rec: null, chunks: [], state: 'idle', activeMs: 0, segT0: 0,
    blob: null, playEl: null, playSrc: null, playing: false
  };
  try {
    var saved = JSON.parse(localStorage.getItem('rp_fx') || 'null');
    if (saved) V.fx = Object.assign(V.fx, saved);
  } catch (e) {}
  function saveFx() { try { localStorage.setItem('rp_fx', JSON.stringify(V.fx)); } catch (e) {} }

  /* ---------------------------------------------------------------- */
  /* the presets                                                       */
  /* ---------------------------------------------------------------- */
  var COMP = {
    off:      { label: 'Off',      on: false },
    gentle:   { label: 'Gentle',   on: true, threshold: -18, ratio: 3,  knee: 12, attack: 0.006, release: 0.25 },
    moderate: { label: 'Moderate', on: true, threshold: -24, ratio: 6,  knee: 9,  attack: 0.004, release: 0.20 },
    strong:   { label: 'Strong',   on: true, threshold: -32, ratio: 12, knee: 6,  attack: 0.003, release: 0.15 }
  };
  var EQ = {
    flat:      { label: 'Flat',      low: 0,  mid: 0,   high: 0 },
    warm:      { label: 'Warm',      low: 4,  mid: -2,  high: -3 },
    bright:    { label: 'Bright',    low: -2, mid: 1.5, high: 5 },
    telephone: { label: 'Telephone', low: -18, mid: 8,  high: -20 }
  };
  var ECHO = {
    off:    { label: 'Off',     wet: 0 },
    slap:   { label: 'Slap',    time: 0.11, fb: 0.15, wet: 0.28 },
    eighth: { label: 'Eighth',  time: 0.25, fb: 0.32, wet: 0.30 },
    long:   { label: 'Long',    time: 0.45, fb: 0.45, wet: 0.32 }
  };
  var VERB = {
    off:   { label: 'Off',        wet: 0 },
    room:  { label: 'Room',       secs: 0.9, decay: 3.2, wet: 0.20 },
    club:  { label: 'Small club', secs: 1.7, decay: 2.6, wet: 0.28 },
    hall:  { label: 'Hall',       secs: 3.0, decay: 2.0, wet: 0.34 }
  };

  /* A reverb needs an impulse to convolve with. Rather than ship an audio
     file — the build is one self-contained page — make one: noise that dies
     away. It is the oldest trick there is and it sounds perfectly good. */
  function impulse(ac, secs, decay) {
    var n = Math.max(1, Math.floor(ac.sampleRate * secs));
    var buf = ac.createBuffer(2, n, ac.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < n; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
      }
    }
    return buf;
  }

  /* ---------------------------------------------------------------- */
  /* the chain                                                         */
  /* ---------------------------------------------------------------- */
  function build(ac) {
    var comp = ac.createDynamicsCompressor();
    var low = ac.createBiquadFilter();  low.type = 'lowshelf';  low.frequency.value = 220;
    var mid = ac.createBiquadFilter();  mid.type = 'peaking';   mid.frequency.value = 2200; mid.Q.value = 1;
    var high = ac.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 6000;

    var dry = ac.createGain();
    var delay = ac.createDelay(1.5);
    var fb = ac.createGain();
    var echoWet = ac.createGain();
    var conv = ac.createConvolver();
    var verbWet = ac.createGain();
    var out = ac.createGain(); out.gain.value = 1;

    comp.connect(low); low.connect(mid); mid.connect(high);
    high.connect(dry); dry.connect(out);
    high.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(echoWet); echoWet.connect(out);
    high.connect(conv); conv.connect(verbWet); verbWet.connect(out);

    return { input: comp, comp: comp, low: low, mid: mid, high: high,
             delay: delay, fb: fb, echoWet: echoWet, conv: conv, verbWet: verbWet, out: out };
  }

  function applyFx(n, ac) {
    var c = COMP[V.fx.comp] || COMP.off;
    if (c.on) {
      n.comp.threshold.value = c.threshold; n.comp.ratio.value = c.ratio;
      n.comp.knee.value = c.knee; n.comp.attack.value = c.attack; n.comp.release.value = c.release;
    } else {
      n.comp.threshold.value = 0; n.comp.ratio.value = 1; n.comp.knee.value = 0;
    }
    var e = EQ[V.fx.eq] || EQ.flat;
    n.low.gain.value = e.low; n.mid.gain.value = e.mid; n.high.gain.value = e.high;

    var d = ECHO[V.fx.echo] || ECHO.off;
    n.delay.delayTime.value = d.time || 0.25;
    n.fb.gain.value = d.fb || 0;
    n.echoWet.gain.value = d.wet || 0;

    var r = VERB[V.fx.verb] || VERB.off;
    n.verbWet.gain.value = r.wet || 0;
    if (r.wet > 0) {
      var key = r.secs + ':' + r.decay + ':' + ac.sampleRate;
      if (n._irKey !== key) { n.conv.buffer = impulse(ac, r.secs, r.decay); n._irKey = key; }
    }
  }

  window.__applyForTest = applyFx;

  function live() {
    if (typeof ctx === 'undefined' || !ctx) return null;
    if (!V.nodes) { V.nodes = build(ctx); V.built = true; }
    applyFx(V.nodes, ctx);
    return V.nodes;
  }

  function wireMonitor() {
    var n = live();
    if (!n || typeof MIC === 'undefined' || !MIC.src) return;
    try { MIC.src.connect(n.input); } catch (e) {}
    try { n.out.disconnect(); } catch (e) {}
    if (V.monitor) { try { n.out.connect(ctx.destination); } catch (e) {} }
  }

  /* ---------------------------------------------------------------- */
  /* the screen                                                        */
  /* ---------------------------------------------------------------- */
  function ensureScreen() {
    if ($('modeVoice')) return $('modeVoice');
    var home = $('modeHome');
    if (!home || !home.parentElement) return null;
    var d = document.createElement('div');
    d.id = 'modeVoice';
    d.className = 'mode';
    home.parentElement.insertBefore(d, home.nextSibling);
    return d;
  }

  function seg(group, map, cur) {
    var h = '<div class="rp-fxrow">';
    Object.keys(map).forEach(function (k) {
      h += '<button class="rp-fxbtn' + (cur === k ? ' on' : '') + '" data-fx="' + group + '" data-val="' + k + '">' +
        esc(map[k].label) + '</button>';
    });
    return h + '</div>';
  }

  function render() {
    var host = $('modeVoice');
    if (!host) return;
    var h = '<button class="pill backpill" id="rpVoiceBack">← Sing menu</button>';
    h += '<h1 style="margin:0 0 2px">Free Sing</h1>';
    h += '<div class="rp-sub" style="margin:0 0 12px">Just sing. Nothing here is measured, scored, or ' +
      'sent anywhere. Put some colour on your voice and enjoy it.</div>';

    h += '<div class="panel" style="padding:12px">' +
      '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<b style="font-size:13px">Hear yourself</b>' +
      '<button class="btn' + (V.monitor ? ' primary' : '') + '" id="rpVMon" style="padding:8px 13px;font-size:12.5px">' +
      (V.monitor ? 'On' : 'Off') + '</button></div>' +
      '<div class="notice" style="margin-top:7px">Headphones only — through the speaker this will squeal. ' +
      'There is a small delay on a phone; that is the phone, not you.</div></div>';

    h += '<div class="panel" style="margin-top:10px;padding:12px">' +
      '<div class="rp-lab">COMPRESSOR</div>' + seg('comp', COMP, V.fx.comp) +
      '<div class="rp-lab" style="margin-top:12px">EQ</div>' + seg('eq', EQ, V.fx.eq) +
      '<div class="rp-lab" style="margin-top:12px">ECHO</div>' + seg('echo', ECHO, V.fx.echo) +
      '<div class="rp-lab" style="margin-top:12px">REVERB</div>' + seg('verb', VERB, V.fx.verb) +
      '</div>';

    h += '<div class="panel" style="margin-top:10px;padding:12px" id="rpVRecBox">' + recHtml() + '</div>';

    host.innerHTML = h;
    on($('rpVoiceBack'), 'click', function () { try { switchMode('singhub'); } catch (e) {} });
    on($('rpVMon'), 'click', toggleMonitor);
    host.querySelectorAll('[data-fx]').forEach(function (b) {
      on(b, 'click', function () {
        V.fx[b.dataset.fx] = b.dataset.val;
        saveFx();
        wireMonitor();
        render();
      });
    });
    wireRec();
  }

  function recHtml() {
    var h = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<b style="font-size:13px">Record</b>' +
      '<span id="rpVTime" style="font-size:12px;font-weight:800;color:var(--ink-dim)">' + fmt(elapsed()) + '</span></div>';
    if (V.state === 'idle' && !V.blob) {
      h += '<div class="notice" style="margin:7px 0 10px">Your voice is kept as you sang it. The effects ' +
        'stay adjustable afterwards.</div>' +
        '<button class="btn primary" id="rpVRec" style="width:100%;padding:12px">' +
        '<svg class="ic"><use href="#i-mic"/></svg> Record</button>';
    } else if (V.state === 'rec' || V.state === 'paused') {
      h += '<div class="notice" style="margin:7px 0 10px">' +
        (V.state === 'rec' ? 'Recording.' : 'Paused.') + '</div>' +
        '<div class="row" style="gap:7px">' +
        '<button class="btn' + (V.state === 'rec' ? '' : ' primary') + '" id="rpVPause" style="flex:1;padding:11px">' +
        (V.state === 'rec' ? 'Pause' : 'Keep going') + '</button>' +
        '<button class="btn" id="rpVStop" style="flex:1;padding:11px">Stop</button></div>';
    } else {
      h += '<div class="notice" style="margin:7px 0 10px">' + fmt(V.activeMs) +
        ' recorded. Playing it back runs it through the effects above — change them and play it again.</div>' +
        '<div class="row" style="gap:7px">' +
        '<button class="btn" id="rpVPlay" style="flex:1;padding:11px">' + (V.playing ? 'Stop' : 'Play it back') + '</button>' +
        '<button class="btn primary" id="rpVKeep" style="flex:1;padding:11px">Keep</button></div>' +
        '<button class="btn" id="rpVBin" style="width:100%;padding:10px;margin-top:7px;color:var(--miss)">Discard</button>';
    }
    return h;
  }
  function redrawRec() {
    var b = $('rpVRecBox');
    if (!b) return;
    b.innerHTML = recHtml();
    wireRec();
  }
  function wireRec() {
    on($('rpVRec'), 'click', start);
    on($('rpVPause'), 'click', pauseResume);
    on($('rpVStop'), 'click', stop);
    on($('rpVPlay'), 'click', play);
    on($('rpVKeep'), 'click', keep);
    on($('rpVBin'), 'click', bin);
  }

  function fmt(ms) {
    var s = Math.round(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function elapsed() { return V.activeMs + (V.state === 'rec' ? Date.now() - V.segT0 : 0); }

  /* ---------------------------------------------------------------- */
  /* monitoring                                                        */
  /* ---------------------------------------------------------------- */
  async function toggleMonitor() {
    if (!V.monitor) {
      try {
        if (typeof MIC !== 'undefined' && !MIC.on && typeof startMic === 'function') await startMic();
      } catch (e) { return say('The microphone would not start: ' + (e.message || e)); }
      if (typeof MIC === 'undefined' || !MIC.src) return say('No microphone yet.');
      V.monitor = true;
    } else {
      V.monitor = false;
    }
    wireMonitor();
    render();
  }

  /* ---------------------------------------------------------------- */
  /* recording — dry, always                                           */
  /* ---------------------------------------------------------------- */
  async function start() {
    if (typeof REC !== 'undefined' && REC.state !== 'idle') {
      return say('There is already a take running in My Music. Finish that one first.');
    }
    if (window.RPStudio && RPStudio.state !== 'idle') {
      return say('The Pitch Tracker is recording. Stop that one first.');
    }
    try {
      if (typeof MIC !== 'undefined' && !MIC.on && typeof startMic === 'function') await startMic();
    } catch (e) { return say('The microphone would not start: ' + (e.message || e)); }
    if (typeof MIC === 'undefined' || !MIC.stream) return say('No microphone to record from.');
    wireMonitor();

    var opts;
    try {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) opts = { mimeType: 'audio/webm;codecs=opus' };
      else if (MediaRecorder.isTypeSupported('audio/mp4')) opts = { mimeType: 'audio/mp4' };
    } catch (e) {}
    try { V.rec = new MediaRecorder(MIC.stream, opts); }
    catch (e) { return say('This phone would not start a recording: ' + (e.message || e)); }

    drop();
    V.chunks = []; V.activeMs = 0; V.segT0 = Date.now(); V.state = 'rec';
    V.rec.ondataavailable = function (e) { if (e.data && e.data.size) V.chunks.push(e.data); };
    V.rec.onstop = function () {
      V.state = 'idle';
      if (!V.chunks.length) { say('Nothing was recorded.'); V.blob = null; redrawRec(); return; }
      V.blob = new Blob(V.chunks, { type: (V.rec && V.rec.mimeType) || 'audio/webm' });
      redrawRec();
    };
    try { V.rec.start(); } catch (e) { V.state = 'idle'; return say('Could not record: ' + (e.message || e)); }
    redrawRec();
  }

  function pauseResume() {
    if (V.state === 'rec') {
      try { V.rec.requestData(); } catch (e) {}
      var paused = false;
      try { V.rec.pause(); paused = (V.rec.state === 'paused'); } catch (e) { paused = false; }
      if (!paused) return say('This phone would not pause — it is STILL RECORDING. Press Stop when you are done.');
      V.activeMs += Date.now() - V.segT0;
      V.state = 'paused';
    } else if (V.state === 'paused') {
      var going = false;
      try { V.rec.resume(); going = (V.rec.state === 'recording'); } catch (e) { going = false; }
      if (!going) return say('This phone would not start it up again. Press Stop to keep what you have.');
      V.segT0 = Date.now();
      V.state = 'rec';
    }
    redrawRec();
  }

  function stop() {
    if (V.state === 'rec') V.activeMs += Date.now() - V.segT0;
    stopPlay();
    try { V.rec.stop(); } catch (e) { V.state = 'idle'; redrawRec(); }
  }

  /* Playback goes through the SAME chain, so changing a preset and pressing
     play again is how you audition an effect on your own take. */
  function stopPlay() {
    if (V.playEl) { try { V.playEl.pause(); } catch (e) {} }
    if (V.playSrc) { try { V.playSrc.disconnect(); } catch (e) {} V.playSrc = null; }
    if (V.playEl && V.playEl._url) { URL.revokeObjectURL(V.playEl._url); }
    V.playEl = null; V.playing = false;
  }
  function play() {
    if (V.playing) { stopPlay(); redrawRec(); return; }
    if (!V.blob) return say('Nothing to play.');
    var n = live();
    if (!n) return say('Sound is not running yet — tap Hear yourself once.');
    stopPlay();
    var a = new Audio();
    a._url = URL.createObjectURL(V.blob);
    a.src = a._url;
    a.onended = function () { V.playing = false; redrawRec(); };
    try {
      V.playSrc = ctx.createMediaElementSource(a);
      V.playSrc.connect(n.input);
      try { n.out.disconnect(); } catch (e) {}
      n.out.connect(ctx.destination);       // you must hear the playback
    } catch (e) {
      a.play(); V.playEl = a; V.playing = true; redrawRec();
      return say('Playing it dry — this phone would not run it through the effects.');
    }
    V.playEl = a;
    a.play().then(function () { V.playing = true; redrawRec(); })
      .catch(function () { say('The phone would not play it back.'); });
    redrawRec();
  }

  function drop() { stopPlay(); V.blob = null; V.chunks = []; }
  function bin() { drop(); V.activeMs = 0; redrawRec(); say('Thrown away.'); }

  async function keep() {
    if (!V.blob) return say('Nothing to keep.');
    var d = new Date();
    var song = {
      id: 'sing' + Date.now(), kind: 'recording',
      title: 'Free Sing ' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
             String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'),
      artist: 'My Recordings', blob: V.blob, addedAt: Date.now(),
      key: null, lrc: null, duration: V.activeMs / 1000,
      fx: JSON.parse(JSON.stringify(V.fx))     // what it sounded like, kept beside it
    };
    try { await dbPut('songs', song); }
    catch (e) { return say('Could not save it — storage may be full.'); }
    try { LIB.songs.push(song); libRenderPlaylists(); libRender(); } catch (e) {}
    drop(); V.activeMs = 0; redrawRec();
    say('Kept, in My Recordings.');
  }

  setInterval(function () {
    var t = $('rpVTime');
    if (t && (V.state === 'rec' || V.state === 'paused')) t.textContent = fmt(elapsed());
  }, 500);

  /* ---------------------------------------------------------------- */
  /* its own mode, alongside the app's                                 */
  /* ---------------------------------------------------------------- */
  function install() {
    if (window.__rpVoiceMode) return;
    if (typeof window.switchMode !== 'function') return;
    window.__rpVoiceMode = true;
    var prev = window.switchMode;
    window.switchMode = function (m) {
      if (m === 'voice') {
        try { prev('singhub'); } catch (e) {}
        document.querySelectorAll('.mode').forEach(function (el) { el.classList.remove('active'); });
        var el = ensureScreen();
        if (el) el.classList.add('active');
        try { state.mode = 'voice'; } catch (e) {}
        var nav = $('navSing'); 
        document.querySelectorAll('.bottomnav button').forEach(function (b) { b.classList.remove('active'); });
        if (nav) nav.classList.add('active');
        render();
        window.scrollTo(0, 0);
        return;
      }
      /* The app switches modes from a fixed map that knows nothing about this
         screen, so it would never take the 'active' class off it — leaving
         Free Sing and the Pitch Tracker both on at once. Stand ours down
         before handing over. */
      var mine = $('modeVoice');
      if (mine) mine.classList.remove('active');
      if (V.monitor) { V.monitor = false; wireMonitor(); }
      stopPlay();
      return prev.apply(this, arguments);
    };
  }

  (function css() {
    var s = document.createElement('style');
    s.textContent =
      '.rp-fxrow{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;}' +
      '.rp-fxbtn{flex:1;min-width:72px;padding:9px 6px;font-size:12px;font-weight:800;border-radius:10px;' +
      'border:1px solid var(--line);background:var(--panel2);color:var(--ink-dim);cursor:pointer;font-family:inherit;}' +
      '.rp-fxbtn.on{background:var(--accent);border-color:var(--accent);color:#fff;}';
    document.head.appendChild(s);
  })();

  function boot() { install(); ensureScreen(); setInterval(install, 1500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 500);
})();
