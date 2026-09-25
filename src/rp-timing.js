/* ======================================================================
   Repertoire Pro — timing.

   Briar, 13 Sep: the words light up out of step with the note bars, a
   held note seems to run into the next word, and the live mic feedback
   is late. Two delays are behind all of that, and the app had a fixed
   guess (100 ms) for one and nothing for the other:

   1. The phone plays sound LATER than the app schedules it. The browser
      reports how much (outputLatency). The chart and the words are now
      drawn where the sound has reached the ears — window.__rpHeardS,
      read by the base's chart (patch 22).
   2. The singer's voice reaches the app later still, through the mic.
      That is state.latencyMs, which scores and draws the voice earlier
      to make up for it. It now starts from the reported output delay
      plus 100 ms for the mic, instead of a flat 100, and the singer can
      set it by hand in Profile → Sound and microphone. A hand-set value
      is kept and wins over the automatic one.

   Nothing here can remove the delay you HEAR through headphones — that
   is the phone's own; Bluetooth adds the most.
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'rp_timing';
  var TM = window.RPTiming = {};
  var saved = null;
  try { var v = localStorage.getItem(KEY); if (v != null && v !== '' && isFinite(+v)) saved = +v; } catch (e) {}
  var autoMs = 100;
  window.__rpHeardS = 0;

  function outLat() {
    try { return window.rpEarLag ? rpEarLag() : 0; } catch (e) { return 0; }
  }
  function apply(ms) {
    try { state.latencyMs = ms; } catch (e) {}
    var r = $('rLat'), o = $('oLat');
    if (r && +r.value !== ms) r.value = ms;
    if (o) o.textContent = ms + ' ms';
    var m = $('rpTimingRange'), mo = $('rpTimingOut');
    if (m && +m.value !== ms) m.value = ms;
    if (mo) mo.textContent = ms + ' ms' + (saved == null ? ' · automatic' : '');
  }
  TM.auto = function () { return autoMs; };
  TM.get = function () { return saved != null ? saved : autoMs; };
  TM.set = function (ms) {
    ms = Math.max(0, Math.min(400, Math.round(ms / 10) * 10));
    saved = ms;
    try { localStorage.setItem(KEY, String(ms)); } catch (e) {}
    apply(ms);
  };
  TM.reset = function () {
    saved = null;
    try { localStorage.removeItem(KEY); } catch (e) {}
    apply(autoMs);
  };

  /* Robert, 25 Sep: show the output delay "in plain words in the Sound
     panel". It is what the phone reports, so it says so. */
  function hearLine(out) {
    var el = $('rpHearLine');
    if (!el) return;
    var ms = Math.round(out * 1000);
    el.textContent = ms > 0
      ? 'Your phone says it plays sound ' + ms + ' ms after the app sends it. Notes are drawn ' + ms +
        ' ms later to match, so they reach the bar when you hear them.'
      : 'Your phone has not said how long it takes to play sound, so notes are drawn as sent.';
  }
  function tick() {
    var out = outLat();
    hearLine(out);
    window.__rpHeardS = out;
    var a = Math.round((out * 1000 + 100) / 10) * 10;
    if (a !== autoMs) { autoMs = a; if (saved == null) apply(autoMs); }
  }

  /* the base's own slider (in the Sing settings) keeps working; a move
     there is a hand-set value too */
  function wire() {
    var r = $('rLat');
    if (r && !r.dataset.rpTiming) {
      r.dataset.rpTiming = '1';
      r.addEventListener('input', function (e) { TM.set(+e.target.value); });
    }
  }

  /* the Profile row: one slider, one line of what it is for, one reset */
  TM.row = function () {
    var d = $('rpTimingRow');
    if (d) return d;
    d = document.createElement('div');
    d.id = 'rpTimingRow';
    d.className = 'rp-card';
    d.style.padding = '13px';
    d.innerHTML =
      '<div class="rp-ttl">Timing</div>' +
      '<div class="rp-sub" style="margin-bottom:8px">If your voice shows up late on the note map, move this right. Early, move it left.</div>' +
      '<div class="rp-sub" id="rpHearLine" style="margin-bottom:8px"></div>' +
      '<label style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--ink-faint)">' +
        '<span>Mic delay</span><output id="rpTimingOut">100 ms</output></label>' +
      '<input type="range" id="rpTimingRange" min="0" max="400" value="100" step="10" style="width:100%">' +
      '<button class="btn ghost" id="rpTimingAuto" style="margin-top:8px;padding:8px 12px;font-size:12.5px">Back to automatic</button>';
    d.querySelector('#rpTimingRange').addEventListener('input', function (e) {
      TM.set(+e.target.value);
      var r = $('rLat'); if (r) { r.value = e.target.value; }
    });
    d.querySelector('#rpTimingAuto').addEventListener('click', TM.reset);
    return d;
  };

  function boot() {
    wire();
    apply(saved != null ? saved : autoMs);
    tick();
    setInterval(function () { tick(); wire(); }, 1000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
