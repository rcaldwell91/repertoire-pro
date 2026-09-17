/* ======================================================================
   Repertoire Pro — doing an assignment.

   Robert, 12 Sep, describing what this should be:

     "When your coach assigns you an exercise or a warm up, that becomes,
      like, an assignment, its own thing. Then on my side, I click that
      assignment, and it's like, do this warmup. I press it. It's already
      gonna have the five note scale. I do that warm up, and I can save it
      to my phone. But still, it's its own card. And then I can submit it...
      I don't like that take, so I save it, but I don't hit submit. Do it
      again. That's a good one. I save and submit that one. It sends off.
      Now that assignment's checked off."

   So the ASSIGNMENT is the container, not the take. You never record a
   loose take and then go looking for an assignment to staple it to. You
   open the assignment, it takes you straight to the exercise the coach
   actually chose, and everything you record while you are in there belongs
   to that assignment from the moment you save it.

   This file is the bit that makes that possible across the whole app: a
   bar that stays pinned to the bottom of the screen while you are working
   on an assignment. The exercises live on three different engines (the
   note ladder, the sustained-note screen, and the guided timer), so a
   recorder built into any one of them would only work for a third of the
   assignments. The bar sits above all three.

   Saving and submitting are deliberately two different buttons. Saving is
   yours. Submitting is the only thing the coach ever sees.
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

  var W = window.RPWork = { current: null };

  function ST() { return window.RPStudio; }
  function api() { return window.RPStudio && RPStudio.api; }

  /* ------------------------------------------------------------------ */
  /* the takes kept against one assignment, newest first                 */
  /* ------------------------------------------------------------------ */
  W.takesFor = function (assignmentId) {
    try {
      return (LIB.songs || [])
        .filter(function (s) { return s.kind === 'recording' && s.blob && s.assignId === assignmentId; })
        .sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
    } catch (e) { return []; }
  };

  /* ------------------------------------------------------------------ */
  /* start working on one                                                */
  /* ------------------------------------------------------------------ */
  W.open = function (a) {
    if (!a) return;
    W.current = { id: a.id, title: a.title, note: a.note || '', app_ex_id: a.app_ex_id || null };

    var s = ST();
    if (s) s.assign = { id: a.id, title: a.title, app_ex_id: a.app_ex_id || null };

    /* Take them to the exercise the coach chose. The whole point is that
       they do not have to go and find it. */
    var ex = null;
    try { ex = a.app_ex_id && V10.exById ? V10.exById(a.app_ex_id) : null; } catch (e) {}
    if (ex) {
      try {
        window.switchMode('train');
        setTimeout(function () {
          try { V10.startEx(a.app_ex_id); } catch (e) {}
          draw();
        }, 90);
      } catch (e) {}
    } else {
      /* The coach wrote this one himself and did not attach an exercise.
         There is nothing to launch, so say so rather than opening the
         wrong screen — you still record it the same way. */
      try { window.switchMode('train'); } catch (e) {}
    }
    draw();
  };

  W.close = function () {
    var s = ST();
    if (s && s.state !== 'idle') return say('Stop the recording first.');
    W.current = null;
    if (s) s.assign = null;
    draw();
    try { if (window.RP && RP.refresh) RP.refresh(); } catch (e) {}
  };

  W.refresh = function () { draw(); };

  /* ------------------------------------------------------------------ */
  /* the pinned bar                                                      */
  /* ------------------------------------------------------------------ */
  function host() {
    var b = $('rpWorkBar');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'rpWorkBar';
    b.style.cssText =
      'position:fixed;left:0;right:0;z-index:60;display:none;' +
      'bottom:calc(66px + env(safe-area-inset-bottom,0px));' +
      'padding:0 10px;pointer-events:none';
    document.body.appendChild(b);
    return b;
  }

  function draw() {
    var b = host();
    var w = W.current;
    if (!w) { b.style.display = 'none'; b.innerHTML = ''; return; }

    var s = ST() || {};
    var kept = W.takesFor(w.id);
    var rec = s.state === 'rec';
    var paused = s.state === 'paused';
    var pending = !!(api() && api().blobNow());

    var h = '<div style="pointer-events:auto;max-width:560px;margin:0 auto;' +
      'background:var(--panel);border:1px solid var(--gold);border-radius:14px;' +
      'padding:10px 12px;box-shadow:0 8px 28px rgba(0,0,0,.5)">';

    h += '<div class="row" style="justify-content:space-between;align-items:center;gap:8px">' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:10.5px;font-weight:800;letter-spacing:1.2px;color:var(--ink-faint)">' +
      'WORKING ON</div>' +
      '<div style="font-size:13.5px;font-weight:800;white-space:nowrap;overflow:hidden;' +
      'text-overflow:ellipsis">' + esc(w.title) + '</div></div>' +
      '<button class="btn" id="rpWkX" style="padding:6px 10px;font-size:11.5px">Stop working on this</button></div>';

    if (rec || paused) {
      h += '<div class="row" style="gap:7px;margin-top:9px;flex-wrap:nowrap">' +
        '<div style="flex:0 0 auto;font-size:12px;font-weight:800;color:' +
        (rec ? 'var(--miss)' : 'var(--ink-dim)') + '">' +
        (rec ? '● ' : '⏸ ') + api().fmt(api().elapsed()) + '</div>' +
        '<button class="btn" id="rpWkPause" style="flex:1;padding:9px;font-size:12px">' +
        (rec ? 'Pause' : 'Carry on') + '</button>' +
        '<button class="btn primary" id="rpWkStop" style="flex:1;padding:9px;font-size:12px">Stop</button>' +
        '</div>';
    } else if (pending) {
      h += '<div class="row" style="gap:7px;margin-top:9px;flex-wrap:nowrap">' +
        '<button class="btn" id="rpWkPlay" style="flex:1;padding:9px;font-size:12px">' +
        (s.playing ? 'Stop' : 'Listen back') + '</button>' +
        '<button class="btn primary" id="rpWkSave" style="flex:1;padding:9px;font-size:12px">Save</button>' +
        '<button class="btn" id="rpWkBin" style="flex:0 0 auto;padding:9px 11px;font-size:12px;' +
        'color:var(--miss)">Bin</button></div>' +
        '<div class="measured" style="margin-top:7px;font-size:11.5px">Saving keeps it on this device. ' +
        'Nothing goes to your coach until you submit one.</div>';
    } else {
      h += '<button class="btn primary" id="rpWkRec" style="width:100%;padding:11px;margin-top:9px">' +
        (kept.length ? 'Record another take' : 'Record this') + '</button>';
      if (kept.length) {
        h += '<div class="measured" style="margin-top:7px;font-size:11.5px">' + kept.length +
          (kept.length === 1 ? ' take saved' : ' takes saved') +
          ' · submit the one you like from the Coach tab.</div>';
      }
    }

    h += '</div>';
    b.innerHTML = h;
    b.style.display = 'block';

    on($('rpWkX'), 'click', W.close);
    on($('rpWkRec'), 'click', function () { api().start(); setTimeout(draw, 300); });
    on($('rpWkStop'), 'click', function () { api().stop(); setTimeout(draw, 500); });
    on($('rpWkPause'), 'click', function () { api().pauseResume(); setTimeout(draw, 400); });
    on($('rpWkPlay'), 'click', function () { api().play(); setTimeout(draw, 300); });
    on($('rpWkBin'), 'click', function () { api().bin(); draw(); });
    on($('rpWkSave'), 'click', function () { api().keep().then(draw, draw); });
  }

  /* the clock has to move while it is recording */
  setInterval(function () {
    if (!W.current) return;
    var s = ST();
    if (s && (s.state === 'rec' || s.state === 'paused')) draw();
  }, 500);

  W.draw = draw;
})();
