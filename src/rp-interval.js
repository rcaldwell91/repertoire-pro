/* ======================================================================
   Repertoire Pro — Hold the interval.

   Robert asked for the keyboard and the hold put together as one
   exercise about intervals: a note plays, you are told how far to go,
   you sing that note and hold it. Ten of them, scored like Match the
   note, so it counts towards the week.

   The reference note is the app's own (piano by default). The keys
   underneath are the same keys as everywhere else: gold is the note to
   sing, and the key you are actually singing lights up.
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function name(m) { try { return midiName(m); } catch (e) { return String(m); } }

  var I = window.RPInterval = {};
  var S = { on: false, round: 0, total: 10, held: 0, from: 60, to: 64, step: 4,
            holding: 0, need: 2.5, phase: 'listen', raf: null };

  /* the ones worth a singer's time, up only: a whole step, a third, a
     fourth, a fifth, an octave */
  var STEPS = [[2, 'a whole step'], [4, 'a third'], [5, 'a fourth'], [7, 'a fifth'], [12, 'an octave']];

  function panel() {
    var p = $('rpIntervalPanel');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'rpIntervalPanel';
    p.className = 'panel';
    p.style.display = 'none';
    var slot = $('trainSlot') || $('modeTrain');
    slot.parentElement.insertBefore(p, slot);
    return p;
  }

  function draw() {
    var p = panel();
    p.innerHTML =
      '<div class="row" style="justify-content:space-between;align-items:center">' +
        '<button class="btn ghost" id="rpIvBack">‹ Exercises</button>' +
        '<div class="pill" id="rpIvRound">Note ' + Math.min(S.round, S.total) + ' of ' + S.total + '</div>' +
      '</div>' +
      '<div class="row" style="justify-content:space-between;align-items:center;margin-top:6px">' +
        '<h3 style="margin:0">Hold the interval</h3>' +
        '<div class="pill">Held: <b id="rpIvScore" style="color:var(--hit)">' + S.held + '</b></div>' +
      '</div>' +
      '<div style="text-align:center;margin-top:10px">' +
        '<div style="font-size:12px;color:var(--ink-dim);font-weight:700;letter-spacing:1px">SING <span id="rpIvWhat">' + esc(S.stepName || '') + '</span> ABOVE</div>' +
        '<div id="rpIvFrom" style="font-size:40px;font-weight:900;color:var(--ink-dim)">' + esc(name(S.from)) + '</div>' +
        '<div id="rpIvFb" style="font-size:16px;font-weight:700;min-height:24px;color:var(--ink-dim)">listen…</div>' +
        '<div class="micmeter" style="max-width:420px;margin:10px auto;height:14px"><i id="rpIvBar" style="width:0%"></i></div>' +
      '</div>' +
      '<div id="rpIvKeys" class="kbd" style="height:120px;margin:6px auto 4px;max-width:460px"></div>' +
      '<div class="row" style="justify-content:center;margin-top:8px">' +
        '<button class="btn" id="rpIvHear">Play it again</button>' +
        '<button class="btn ghost" id="rpIvSkip">Skip this one</button>' +
      '</div>' +
      '<div id="rpIvResult" style="font-size:17px;font-weight:800;margin-top:10px;min-height:24px;text-align:center"></div>' +
      '<div class="notice" style="margin-top:8px">The low note plays, then you sing the higher one and hold it. Gold is the note to sing.</div>';
    on($('rpIvBack'), 'click', I.quit);
    on($('rpIvHear'), 'click', playFrom);
    on($('rpIvSkip'), 'click', next);
    keys();
  }

  /* the same keys as the keyboard and the hold */
  function black(m) { return [1, 3, 6, 8, 10].indexOf(((m % 12) + 12) % 12) >= 0; }
  var els = {}, lo = null;
  function keys() {
    var host = $('rpIvKeys');
    if (!host) return;
    lo = S.to - 6;
    host.innerHTML = ''; els = {};
    var notes = [];
    for (var m = lo; m <= S.to + 6; m++) notes.push(m);
    while (notes.length && black(notes[notes.length - 1])) notes.pop();
    while (notes.length && black(notes[0])) notes.shift();
    var whites = notes.filter(function (m) { return !black(m); });
    var wPct = 100 / whites.length, wi = 0;
    notes.forEach(function (m) {
      if (black(m)) return;
      var el = document.createElement('div');
      el.className = 'kbdkey white';
      el.style.left = (wi * wPct) + '%'; el.style.width = wPct + '%';
      el.innerHTML = '<span>' + esc(name(m)) + '</span>';
      host.appendChild(el); els[m] = el; wi++;
    });
    wi = 0;
    notes.forEach(function (m) {
      if (!black(m)) { wi++; return; }
      var el = document.createElement('div');
      el.className = 'kbdkey black';
      el.style.left = 'calc(' + (wi * wPct) + '% - ' + (wPct * 0.30) + '%)';
      el.style.width = (wPct * 0.60) + '%';
      host.appendChild(el); els[m] = el;
    });
  }

  function playFrom() {
    try {
      if (typeof ensureCtx === 'function') ensureCtx();
      var play = (window.V10 && V10.playRef) ? V10.playRef : window.playPiano;
      play(S.from, ctx.currentTime + 0.05, 1.3, guideGain, 0.75);
    } catch (e) {}
    S.phase = 'sing';
    var f = $('rpIvFb'); if (f) { f.textContent = 'now sing ' + S.stepName + ' above it'; f.style.color = 'var(--ink-dim)'; }
  }

  function next() {
    S.round++;
    if (S.round > S.total) return done();
    var r = $('rpIvRound'); if (r) r.textContent = 'Note ' + S.round + ' of ' + S.total;
    var pick = STEPS[Math.floor(Math.random() * STEPS.length)];
    S.step = pick[0]; S.stepName = pick[1];
    var loR = 57, hiR = 69;
    try { loR = Math.round(RANGE.lo); hiR = Math.round(RANGE.hi); } catch (e) {}
    var top = Math.max(loR + 1, hiR - S.step);
    S.from = loR + Math.floor(Math.random() * Math.max(1, top - loR + 1));
    S.to = S.from + S.step;
    S.holding = 0;
    var w = $('rpIvWhat'); if (w) w.textContent = S.stepName;
    var fr = $('rpIvFrom'); if (fr) fr.textContent = name(S.from);
    var res = $('rpIvResult'); if (res) res.textContent = '';
    keys();
    setTimeout(playFrom, 250);
  }

  function done() {
    S.on = false;
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }
    var f = $('rpIvFb'); if (f) f.textContent = '';
    var r = $('rpIvRound'); if (r) r.textContent = 'Done';
    var res = $('rpIvResult');
    if (res) res.textContent = 'Held ' + S.held + ' of ' + S.total + '.' +
      (S.held >= 8 ? ' Your ear knows the distance.' : S.held >= 5 ? ' Halfway there.' : ' Try the whole steps and fifths first.');
    try { if (window.RP && RP.logResult) RP.logResult({ kind: 'ear', label: 'Hold the interval', score: S.held, out_of: S.total }); } catch (e) {}
    try { V10.markPractised('Hold the interval'); } catch (e) {}
  }

  function frame() {
    if (!S.on) { S.raf = null; return; }
    var um = null;
    try { um = (MIC.on && typeof smoothedMidi === 'function') ? smoothedMidi() : null; } catch (e) {}
    var lit = null;
    if (um != null) {
      var d = um - S.to;
      d = ((d % 12) + 18) % 12 - 6;
      lit = Math.round(S.to + d);
      var okNow = Math.abs(d * 100) <= 50;
      if (S.phase === 'sing' && okNow) S.holding += 1 / 60; else if (!okNow) S.holding = Math.max(0, S.holding - 1 / 90);
      var f = $('rpIvFb');
      if (f && S.phase === 'sing') {
        f.textContent = okNow ? '✓ hold it…' : (d > 0 ? '↓ a bit high · you: ' + name(Math.round(um)) : '↑ a bit low · you: ' + name(Math.round(um)));
        f.style.color = okNow ? 'var(--hit)' : 'var(--gold)';
      }
    }
    var bar = $('rpIvBar');
    if (bar) bar.style.width = Math.min(100, S.holding / S.need * 100) + '%';
    for (var k in els) {
      var m = +k;
      els[k].classList.toggle('lit', lit != null && m === lit && m !== S.to);
      els[k].style.background = (m === S.to) ? (black(m) ? '#b8862c' : 'linear-gradient(180deg,#f5d27a,#e8b34a)') : '';
    }
    if (S.phase === 'sing' && S.holding >= S.need) {
      S.held++;
      var sc = $('rpIvScore'); if (sc) sc.textContent = S.held;
      var res = $('rpIvResult'); if (res) res.textContent = '✓ ' + name(S.to) + ' — ' + S.stepName + ' above ' + name(S.from);
      S.phase = 'listen'; S.holding = 0;
      try { playDing(); } catch (e) {}
      setTimeout(function () { if (S.on) next(); }, 1200);
    }
    S.raf = requestAnimationFrame(frame);
  }

  I.start = function () {
    (async function () {
      try { if (typeof MIC !== 'undefined' && !MIC.on && typeof enableMic === 'function') await enableMic(); } catch (e) {}
      try { if (typeof ensureCtx === 'function') ensureCtx(); } catch (e) {}
      try { TRAIN.kind = 'interval'; } catch (e) {}
      document.querySelectorAll('#v10TrainHost, #rangePanel, #rpTrainTop').forEach(function (el) { el.style.display = 'none'; });
      S.on = true; S.round = 0; S.held = 0; S.phase = 'listen';
      draw();
      panel().style.display = 'block';
      next();
      if (!S.raf) S.raf = requestAnimationFrame(frame);
    })();
  };
  I.quit = function () {
    S.on = false;
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; }
    var p = $('rpIntervalPanel'); if (p) p.style.display = 'none';
    try { TRAIN.kind = null; } catch (e) {}
    document.querySelectorAll('#v10TrainHost, #rangePanel, #rpTrainTop').forEach(function (el) { el.style.display = ''; });
    try { if (window.RPTrain && RPTrain.redraw) RPTrain.redraw(); } catch (e) {}
  };
  I.running = function () { return !!S.on; };

  /* a hidden button so the Train list can launch it the way it launches
     the others */
  function mount() {
    if ($('rpIntervalGo')) return;
    var b = document.createElement('button');
    b.id = 'rpIntervalGo';
    b.style.display = 'none';
    b.addEventListener('click', I.start);
    (document.getElementById('modeTrain') || document.body).appendChild(b);
  }
  setInterval(mount, 1200);
  setTimeout(mount, 600);
})();
