/* ======================================================================
   Repertoire Pro — live vocals volume.

   Robert, 16 Sep: "I can't change the volume of my own voice coming back
   at me. Put a volume slider for it in the gear next to the Live vocals
   switch, and remember where I left it. If there's already a monitor
   level buried in the code, surface it."

   There is: MONITOR.vol in the base, fixed at 0.75 and read by
   monitorWire() every time the mic is wired. This slider sets that one
   number, applies it live, and keeps it in localStorage. Nothing else.
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'rep_monitor_vol';

  function apply(v) {
    try {
      MONITOR.vol = v;
      if (typeof monitorWire === 'function') monitorWire();
    } catch (e) {}
  }
  function saved() {
    try { var v = localStorage.getItem(KEY); return v == null ? null : Math.max(0, Math.min(1, +v)); } catch (e) { return null; }
  }

  function mount() {
    var sheet = $('quickSheet');
    if (!sheet || $('qMonVol')) return;
    var mon = $('qMonitor');
    if (!mon) return;
    var row = mon.parentElement;
    var d = document.createElement('div');
    d.className = 'ctl';
    d.style.cssText = 'background:transparent;border:0;padding:0;margin-top:10px';
    var v = saved(); if (v == null) { try { v = MONITOR.vol; } catch (e) { v = 0.75; } }
    d.innerHTML = '<label><span>Live vocals volume</span><output id="qMonVolOut">' + Math.round(v * 100) + '%</output></label>' +
      '<input type="range" id="qMonVol" min="0" max="100" value="' + Math.round(v * 100) + '" step="5">';
    row.parentElement.insertBefore(d, row);
    d.querySelector('#qMonVol').addEventListener('input', function (e) {
      var f = (+e.target.value) / 100;
      $('qMonVolOut').textContent = Math.round(f * 100) + '%';
      apply(f);
      try { localStorage.setItem(KEY, String(f)); } catch (err) {}
    });
  }

  function boot() {
    var v = saved();
    if (v != null) apply(v);
    mount();
    setInterval(mount, 1200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
