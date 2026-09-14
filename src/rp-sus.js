/* ======================================================================
   Repertoire Pro — keys under the Sustain Hold.

   Robert, 13 Sep: "on the sustain hold exercise I want to see keys like
   the piano exercise." And 14 Sep: "I want the keys to look and function
   just like the keyboard feature."

   So they are the keyboard's own keys — the same .kbd / .kbdkey markup
   and styles the Keyboard tool uses — an octave wide, centred on the note
   to hold. The note to hold is gold. The key you are singing lights the
   way it does on the Keyboard. Tap a key and it plays; tap and it becomes
   the note to hold, so you can pick your own note instead of the dealt
   one. It reads the same numbers the exercise scores with — SUS.target
   and the smoothed pitch — so it can never disagree with the "% steady".
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var raf = null, els = {}, lo = null, drawnTarget = null;
  var NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function black(m) { return [1, 3, 6, 8, 10].indexOf(((m % 12) + 12) % 12) >= 0; }
  function name(m) { try { return midiName(m); } catch (e) { return NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); } }

  function css() {
    if ($('rpSusCSS')) return;
    var s = document.createElement('style');
    s.id = 'rpSusCSS';
    s.textContent =
      '#rpSusKeys{height:120px;margin:10px auto 4px;max-width:460px;}' +
      '#rpSusKeys .kbdkey.white.target{background:linear-gradient(180deg,#f5d27a,#e8b34a);}' +
      '#rpSusKeys .kbdkey.white.target span{color:#1a1408;}' +
      '#rpSusKeys .kbdkey.black.target{background:#b8862c;}' +
      '#rpSusKeys .kbdkey.black.lit{background:#7c5cff;}' +
      '#rpSusHint{font-size:11.5px;color:var(--ink-faint);text-align:center;margin-bottom:6px;}';
    document.head.appendChild(s);
  }

  function ensure() {
    var panel = $('susPanel');
    if (!panel) return null;
    var k = $('rpSusKeys');
    if (k) return k;
    css();
    k = document.createElement('div');
    k.id = 'rpSusKeys';
    k.className = 'kbd';
    var hint = document.createElement('div');
    hint.id = 'rpSusHint';
    hint.textContent = 'Gold is the note to hold. Tap any key to hear it, or to hold that one instead.';
    var live = $('susLive');
    if (live && live.parentElement) { live.parentElement.insertBefore(k, live); live.parentElement.insertBefore(hint, live); }
    else { panel.appendChild(k); panel.appendChild(hint); }
    return k;
  }

  /* the keyboard's own key press: hear it, and make it the note to hold */
  function press(m) {
    try { if (typeof ensureCtx === 'function') ensureCtx(); } catch (e) {}
    try {
      var play = (window.V10 && V10.playRef) ? V10.playRef : window.playPiano;
      if (play) play(m, ctx.currentTime + 0.02, 1.0, guideGain, 0.7);
    } catch (e) {}
    try {
      if (typeof SUS !== 'undefined' && !SUS.running && m !== SUS.target) {
        SUS.target = m;
        var t = $('susTarget'); if (t) t.textContent = name(m);
        var r = $('susResult'); if (r) r.textContent = '';
      }
    } catch (e) {}
  }

  function build(target) {
    var host = ensure();
    if (!host) return;
    lo = target - 6;
    host.innerHTML = '';
    els = {};
    var notes = [];
    for (var m = lo; m <= target + 6; m++) notes.push(m);
    while (notes.length && black(notes[notes.length - 1])) notes.pop();
    while (notes.length && black(notes[0])) notes.shift();
    var whites = notes.filter(function (m) { return !black(m); });
    var wPct = 100 / whites.length, wi = 0;
    notes.forEach(function (m) {
      if (black(m)) return;
      var el = document.createElement('div');
      el.className = 'kbdkey white';
      el.style.left = (wi * wPct) + '%';
      el.style.width = wPct + '%';
      el.innerHTML = '<span>' + name(m) + '</span>';
      el.addEventListener('pointerdown', function (e) { e.preventDefault(); press(m); });
      host.appendChild(el); els[m] = el; wi++;
    });
    wi = 0;
    notes.forEach(function (m) {
      if (!black(m)) { wi++; return; }
      var el = document.createElement('div');
      el.className = 'kbdkey black';
      el.style.left = 'calc(' + (wi * wPct) + '% - ' + (wPct * 0.30) + '%)';
      el.style.width = (wPct * 0.60) + '%';
      el.addEventListener('pointerdown', function (e) { e.preventDefault(); press(m); });
      host.appendChild(el); els[m] = el;
    });
    drawnTarget = target;
  }

  function frame() {
    var panel = $('susPanel');
    if (!panel || panel.offsetParent === null) { raf = null; return; }
    var target = null, live = null;
    try { target = (typeof SUS !== 'undefined' && SUS.target != null) ? Math.round(SUS.target) : null; } catch (e) {}
    try { live = (typeof MIC !== 'undefined' && MIC.on && typeof smoothedMidi === 'function') ? smoothedMidi() : null; } catch (e) {}
    if (target == null) { raf = requestAnimationFrame(frame); return; }
    if (target !== drawnTarget || !$('rpSusKeys') || !Object.keys(els).length) build(target);

    var lit = null;
    if (live != null) {
      var d = live - target;
      d = ((d % 12) + 18) % 12 - 6;         /* fold to the strip so an octave slip still shows */
      lit = Math.round(target + d);
    }
    for (var k in els) {
      var m = +k;
      els[k].classList.toggle('target', m === target);
      els[k].classList.toggle('lit', lit != null && m === lit && m !== target);
      els[k].classList.toggle('down', lit != null && m === lit && m === target);
    }
    raf = requestAnimationFrame(frame);
  }

  setInterval(function () {
    var panel = $('susPanel');
    if (panel && panel.offsetParent !== null && !raf) raf = requestAnimationFrame(frame);
  }, 400);
})();
