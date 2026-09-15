/* ======================================================================
   Repertoire Pro — scroll the chart back.

   Robert, 13 Sep: "when you're doing an exercise and you pause it, or
   after you've completed it, you should be able to scroll back and see
   the notes you've hit."

   Drag the chart to the right and it shows what came before; a pill says
   how far back you are and puts you back to now. Both charts get it —
   the exercise chart (beats) and the Pitch Tracker (seconds). The charts
   themselves read one number each, window.__rpScrollB / __rpScrollS,
   and subtract it from their clock; that is the whole of the patch to
   the base app. A new start clears it.
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  window.__rpScrollB = 0;   /* beats, the exercise chart */
  window.__rpScrollS = 0;   /* seconds, the Pitch Tracker */

  function pill(id, text, reset) {
    var d = $(id);
    if (!text) { if (d) d.style.display = 'none'; return; }
    if (!d) {
      d = document.createElement('button');
      d.id = id;
      d.className = 'btn primary';
      d.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);top:8px;padding:6px 12px;font-size:12px;z-index:5;white-space:nowrap';
      d.addEventListener('click', function (e) { e.stopPropagation(); reset(); });
    }
    d.textContent = text;
    d.style.display = '';
    return d;
  }

  function attach(canvasId, opts) {
    var cv = $(canvasId);
    if (!cv || cv.dataset.rpScroll) return;
    cv.dataset.rpScroll = '1';
    var wrap = cv.parentElement;
    if (wrap && getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    var down = null, moved = false;
    cv.style.touchAction = 'pan-y';
    cv.addEventListener('pointerdown', function (e) {
      if (opts.live()) return;                 /* not while it is running */
      down = { x: e.clientX, v: opts.get() }; moved = false;
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    });
    cv.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - down.x;
      if (Math.abs(dx) > 4) moved = true;
      var v = Math.max(0, Math.min(opts.max(), down.v + dx / opts.pxPer()));
      opts.set(v);
      opts.redraw();
      var p = pill(canvasId + 'Back', v > 0.01 ? '← ' + opts.label(v) + ' back · tap for now' : '', function () { opts.set(0); opts.redraw(); pill(canvasId + 'Back', ''); });
      if (p && !p.parentElement && wrap) wrap.appendChild(p);
    });
    var up = function () { down = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    /* a running chart means now — clear any old scroll and the pill */
    setInterval(function () {
      if (opts.live() && opts.get() !== 0) { opts.set(0); pill(canvasId + 'Back', ''); }
    }, 300);
  }

  var n = 0;
  var iv = setInterval(function () {
    if (!$('gameCanvas') || !$('freeCanvas')) { if (++n > 80) clearInterval(iv); return; }
    clearInterval(iv);
    /* the exercise chart: beats; ppb is what the chart last drew with */
    attach('gameCanvas', {
      live: function () { try { return !!(G.running && !T.paused); } catch (e) { return false; } },
      get: function () { return window.__rpScrollB; },
      set: function (v) { window.__rpScrollB = v; },
      /* Briar, 15 Sep: "only 4 notes, then it locks." G.lastBeat is only set
         when a run STOPS; paused, it was still 0, so the limit was 4 beats.
         Paused or stopped, the limit is where the run has got to. */
      max: function () { try { return Math.max(0, (G.running ? songBeat() : (G.lastBeat || 0)) + 1); } catch (e) { return 64; } },
      pxPer: function () { return window.__rpPpb || 60; },
      label: function (v) { return Math.round(v) + ' beats'; },
      redraw: function () { try { drawGame(); } catch (e) {} }
    });
    /* the Pitch Tracker: seconds; W/7 pixels per second, always */
    attach('freeCanvas', {
      live: function () { try { return typeof MIC !== 'undefined' && MIC.on && !window.__rpFreeHeld; } catch (e) { return true; } },
      get: function () { return window.__rpScrollS; },
      set: function (v) { window.__rpScrollS = v; },
      max: function () { try { return Math.max(0, FREE.trail.length ? (FREE.trail[FREE.trail.length - 1].t - FREE.trail[0].t) : 0); } catch (e) { return 60; } },
      pxPer: function () { var c = $('freeCanvas'); return (c ? c.clientWidth : 360) / 7; },
      label: function (v) { return Math.round(v) + ' seconds'; },
      redraw: function () {}
    });
  }, 250);
})();
