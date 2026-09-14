/* ======================================================================
   Repertoire Pro — one press, one note.

   Briar, 14 Sep: "when you hit play note again twice by accident it
   plays the note twice at the same time." The buttons that play a
   reference note now ignore a second press while the first is still
   sounding. Nothing else about them changes.
   ====================================================================== */
(function () {
  'use strict';
  var IDS = { earReplay: 1400, btnSusHear: 1400, btnMatchReplay: 1400, gHear: 1400 };
  var last = {};
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('button') : null;
    if (!b || !IDS[b.id]) return;
    var now = Date.now();
    if (last[b.id] && now - last[b.id] < IDS[b.id]) { e.stopPropagation(); e.preventDefault(); return; }
    last[b.id] = now;
  }, true);
})();
