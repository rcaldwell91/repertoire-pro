/* ======================================================================
   Repertoire Pro — nothing starts until you press Start, and ending means
   ending.

   Robert, 1 Oct:
     "Every exercise run screen opens PAUSED, with one button: Start. The
      clock, mic, guide notes and siren glide begin only on that tap."
     "Routines never chain by themselves. When an exercise in a routine
      ends, show a screen with 'Next: [exercise name]' and two buttons:
      Start and End session. End session leaves the routine and goes back
      to where it was started."
     "Outside a routine, ending an exercise returns to that exercise's
      page. Nothing else starts."

   Every way an exercise starts - an exercise by its id, the three pitch
   games, the ear drills - comes through one door here first. The door is
   the exercise's screen, paused: its name, what it is, and Start. Inside a
   routine the same screen reads "Next: ..." and carries End session too.
   Nothing behind the door runs, plays or opens the microphone until Start
   is pressed.
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function strip(h) { return String(h || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(); }
  function vis(el) { return !!(el && el.offsetParent !== null); }

  var F = window.RPFlow = {
    passing: false,     /* true while Start is starting the thing behind the door */
    pending: null,      /* what the door on screen opens */
    cur: null,          /* what was last started through it */
    active: false,      /* something started through it has not ended yet */
    ending: false,      /* End session is stopping things: they are not "ended" */
    origin: 'train',    /* where the current routine was started from */
    lastResult: ''
  };

  function routine() { try { return V10.routineState || null; } catch (e) { return null; } }
  F.inRoutine = function () { var r = routine(); return !!(r && r.on); };
  function mode() { try { return state.mode; } catch (e) { return ''; } }

  /* ---- where a session was started from ------------------------------
     The screen the singer was on when they tapped: Home's Start, the
     Coach tab and Train's own cards all switch to Train a moment later,
     so it is read at the tap itself, before anything moves. */
  var tapMode = 'train';
  document.addEventListener('click', function () { var m = mode(); if (m) tapMode = m; }, true);
  function cameFrom() {
    return /^(home|train|coach|singhub|learn|lib|you)$/.test(tapMode) ? tapMode : 'train';
  }
  function goBack(to) {
    to = to || 'train';
    try { window.switchMode(to); } catch (e) {}
    if (to === 'train') { try { if (window.RPTrain && RPTrain.redraw) RPTrain.redraw(); } catch (e) {} }
    try { window.scrollTo(0, 0); } catch (e) {}
  }

  /* ---- what is on screen ---------------------------------------------- */
  var RUN = ['v10Guided', 'trainLadderBar', 'matchPanel', 'susPanel', 'v10Ear', 'rpIntervalPanel'];
  /* something is running: one of the exercise screens is up */
  F.running = function () {
    for (var i = 0; i < RUN.length; i++) if (vis($(RUN[i]))) return true;
    try { if (G.running) return true; } catch (e) {}
    return false;
  };
  F.gateUp = function () { return vis($('rpGate')); };
  function hideRun() {
    RUN.forEach(function (id) { var el = $(id); if (el && el.style.display !== 'none') el.style.display = 'none'; });
    var st = $('sharedStage');
    if (st && st.parentElement && st.parentElement.id === 'trainSlot') st.style.display = 'none';
  }

  /* ---- the door ------------------------------------------------------- */
  function panel() {
    var p = $('rpGate');
    if (p) return p;
    var slot = $('trainSlot') || $('modeTrain');
    if (!slot || !slot.parentElement) return null;
    p = document.createElement('div');
    p.id = 'rpGate';
    p.className = 'panel';
    p.style.display = 'none';
    slot.parentElement.insertBefore(p, slot);
    return p;
  }

  /* o: { kind: 'ex' | 'tool' | 'drill', key, title, what, start, tip } */
  F.gate = function (o) {
    var p = panel();
    if (!p || !o) return;
    F.pending = o;
    F.active = false;
    var r = routine(), inR = !!(r && r.on);
    var res = inR ? F.lastResult : '';
    F.lastResult = '';
    p.innerHTML =
      (inR ? '' : '<button class="pill backpill" id="rpGateBack">← Train</button>') +
      (res ? '<div class="rp-gate-res">' + esc(res) + '</div>' : '') +
      '<h3 id="rpGateTitle" style="margin:' + (inR ? '0' : '10px') + ' 0 4px">' +
        esc((inR && r.i > 0 ? 'Next: ' : '') + o.title) + '</h3>' +
      (o.what ? '<div class="rp-gate-what">' + esc(strip(o.what)) + '</div>' : '') +
      '<button class="btn primary" id="rpGateGo">Start</button>' +
      (inR ? '<button class="btn ghost" id="rpGateEnd">End session</button>' : '');
    hideRun();
    /* the session's own line ("step 2 of 7") sits above the card */
    var bar = $('rpSessionBar');
    if (bar && bar.parentElement === p.parentElement && (bar.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_PRECEDING)) {
      bar.parentElement.insertBefore(bar, p);
    }
    p.style.display = 'block';
    var sb = $('rpSessionEnd'); if (sb) sb.style.display = 'none';   /* one End session, on the card */
    $('rpGateGo').addEventListener('click', go);
    var b = $('rpGateBack');
    if (b) b.addEventListener('click', function () { F.pending = null; p.style.display = 'none'; goBack('train'); });
    var e = $('rpGateEnd');
    if (e) e.addEventListener('click', F.endSession);
    try { window.scrollTo(0, 0); } catch (err) {}
  };
  F.gateTip = function () { return F.gateUp() && F.pending ? (F.pending.tip || null) : null; };

  function go() {
    var o = F.pending;
    if (!o) return;
    F.pending = null;
    var p = $('rpGate'); if (p) p.style.display = 'none';
    var sb = $('rpSessionEnd'); if (sb) sb.style.display = '';
    try { if (window.RPTour && RPTour.running && RPTour.running()) RPTour.stop(); } catch (e) {}
    F.cur = o;
    F.active = true;
    F.passing = true;
    try { o.start(); } catch (e) {}
    F.passing = false;
  }
  F.start = go;

  /* ---- when something ends -------------------------------------------- */
  /* Robert: in a routine, the next step's door ("Next: ..."); outside one,
     back to the exercise's own page. Nothing starts either way. */
  F.ended = function (result) {
    if (F.ending || !F.active) return;
    F.active = false;
    if (F.inRoutine()) {
      if (result) F.lastResult = result;
      try { V10.nextRoutineStep(); } catch (e) {}
      return;
    }
    F.lastResult = '';
    var c = F.cur;
    if (!c) return;
    if (c.kind === 'ex' && window.RPTrain && RPTrain.detail) {
      hideRun();
      RPTrain.detail(c.key);
      return;
    }
    F.gate(c);   /* a game or a drill: its page is its own door */
  };

  F.sessionStart = function () { F.origin = cameFrom(); F.lastResult = ''; };
  function closeSession() {
    var p = $('rpGate'); if (p) p.style.display = 'none';
    var bar = $('rpSessionBar'); if (bar) bar.style.display = 'none';
    F.pending = null; F.active = false; F.lastResult = '';
  }
  /* the last step is done: back where the session began */
  F.sessionDone = function () { closeSession(); goBack(F.origin); };
  F.endSession = function () {
    var r = routine(); if (r) r.on = false;
    F.ending = true;
    try {
      ['gQuit', 'btnTrainStop', 'btnSusQuit', 'btnMatchQuit'].forEach(function (id) {
        var b = $(id); if (vis(b)) b.click();
      });
    } catch (e) {}
    F.ending = false;
    closeSession();
    goBack(F.origin);
  };

  /* ---- the three pitch games: their buttons go through the door ------- */
  var GAMES = {
    btnMatch: ['Match the note', 'A note plays. Sing it back and hold it. Ten notes.', 'match'],
    btnSustain: ['Hold a note', 'Hold one note steady for five seconds. Ten notes.', 'sustain'],
    rpIntervalGo: ['Hold the interval', 'A note plays. Sing the one a step above it, and hold it.', null]
  };
  function gameGate(id) {
    var g = GAMES[id];
    try {
      var t = (window.RPTrain && RPTrain.TOOLS || []).filter(function (x) { return x[0] === id; })[0];
      if (t) g = [t[1], t[2], g[2]];
    } catch (e) {}
    return { kind: 'tool', key: id, title: g[0], what: g[1], tip: g[2],
             start: function () { var b = $(id); if (b) b.click(); } };
  }
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var b = t.closest('#btnMatch, #btnSustain, #rpIntervalGo');
    if (!b) return;
    if (F.passing) { if (b.id === 'btnSustain') holdFirst(); return; }
    ev.stopImmediatePropagation();
    ev.preventDefault();
    F.gate(gameGate(b.id));
  }, true);

  /* Hold a note's screen has a Start of its own for each note. The first
     one is the Start just pressed, so it is pressed for him once the
     screen is up (it waits for the microphone first). */
  function holdFirst() {
    var n = 0;
    var iv = setInterval(function () {
      n++;
      var ready = false;
      try { ready = vis($('susPanel')) && TRAIN.kind === 'sustain' && !SUS.running; } catch (e) {}
      if (ready) { clearInterval(iv); var s = $('btnSusStart'); if (s) s.click(); }
      else if (n > 80) clearInterval(iv);
    }, 100);
  }

  /* ---- the ear drills ------------------------------------------------- */
  var DRILLS = {
    tonic: ['Sing the home note', 'A short tune plays. Sing the note it sounds finished on.'],
    degree: ['Name the degree', 'A key is set, then one note plays. Which one is it, 1 to 7?'],
    singdeg: ['Sing the degree', 'A key is set. Then sing the one it asks for.'],
    hilo: ['Higher or lower', 'Two notes. Which was higher? Listening only.']
  };
  (function wrapDrill() {
    if (!window.V10 || typeof V10.startDrill !== 'function') { setTimeout(wrapDrill, 300); return; }
    if (V10.startDrill.rpGated) return;
    var real = V10.startDrill;
    var w = function (kind) {
      if (F.passing) return real.apply(this, arguments);
      var d = DRILLS[kind] || [kind, ''];
      try {
        var t = (window.RPTrain && RPTrain.DRILLS || []).filter(function (x) { return x[0] === kind; })[0];
        if (t) d = [t[1], t[2]];
      } catch (e) {}
      F.gate({ kind: 'drill', key: kind, title: d[0], what: d[1], tip: 'ear',
               start: function () { real(kind); } });
    };
    w.rpGated = true;
    V10.startDrill = w;
  })();

  /* ---- the ways out of an exercise ------------------------------------ */
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!t || !t.closest || F.ending) return;
    var b = t.closest('#btnTrainStop, #btnSusQuit, #btnMatchQuit, #rpIvBack, #earQuit');
    if (!b) return;
    setTimeout(function () { F.ended(); }, 0);
  });
  /* a scale ladder that reaches its end inside a routine */
  (function wrapStop() {
    if (typeof window.stopRun !== 'function') { setTimeout(wrapStop, 300); return; }
    if (window.stopRun.rpFlowWrapped) return;
    var real = window.stopRun;
    var w = function (show) {
      var ladder = false;
      try { ladder = !!show && TRAIN.kind === 'ladder' && mode() === 'train'; } catch (e) {}
      var r = real.apply(this, arguments);
      if (ladder && F.inRoutine()) {
        var res = '';
        try { res = ($('resSub') || {}).textContent || ''; } catch (e) {}
        F.ended(res);
      }
      return r;
    };
    w.rpFlowWrapped = true;
    window.stopRun = w;
  })();

  (function css() {
    var s = document.createElement('style');
    s.textContent =
      '#rpGate .rp-gate-what{font-size:14px;line-height:1.5;color:var(--ink-dim);margin-top:4px}' +
      '#rpGate .rp-gate-res{font-size:13px;font-weight:800;color:var(--hit);margin:0 0 10px}' +
      '#rpGateGo{width:100%;padding:14px;font-size:16px;margin-top:16px}' +
      '#rpGateEnd{width:100%;padding:11px;margin-top:8px}';
    document.head.appendChild(s);
  })();
})();
