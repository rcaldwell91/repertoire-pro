/* ======================================================================
   Repertoire Pro — keys under the Sustain Hold.

   Robert, 13 Sep: "on the sustain hold exercise I want to see keys like
   the piano exercise. I think a visual will help."

   A strip of keys an octave wide, centred on the note to hold. The key to
   hold is lit; a dot rides along the strip where your voice actually is,
   green inside the window the exercise scores, gold outside it. It reads
   the same numbers the exercise itself uses — SUS.target and the smoothed
   pitch — so it can never disagree with the "% steady" you are given.
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var raf = null;
  var NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function black(m) { return [1, 3, 6, 8, 10].indexOf(((m % 12) + 12) % 12) >= 0; }
  function name(m) { try { return midiName(m); } catch (e) { return NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); } }

  function ensure() {
    var panel = $('susPanel');
    if (!panel) return null;
    var c = $('rpSusKeys');
    if (c) return c;
    c = document.createElement('canvas');
    c.id = 'rpSusKeys';
    c.style.cssText = 'display:block;width:100%;height:96px;margin:10px auto 2px;max-width:420px;border-radius:10px';
    var live = $('susLive');
    if (live && live.parentElement) live.parentElement.insertBefore(c, live);
    else panel.appendChild(c);
    return c;
  }

  function frame() {
    var panel = $('susPanel');
    if (!panel || panel.offsetParent === null) { raf = null; return; }
    var cv = ensure();
    if (!cv) { raf = null; return; }
    var W = cv.clientWidth || 360, H = 96;
    if (cv.width !== W * 2 || cv.height !== H * 2) { cv.width = W * 2; cv.height = H * 2; }
    var g = cv.getContext('2d');
    g.setTransform(2, 0, 0, 2, 0, 0);
    g.clearRect(0, 0, W, H);

    var target = null, live = null;
    try { target = (typeof SUS !== 'undefined' && SUS.target != null) ? Math.round(SUS.target) : null; } catch (e) {}
    try { live = (typeof MIC !== 'undefined' && MIC.on && typeof smoothedMidi === 'function') ? smoothedMidi() : null; } catch (e) {}
    if (target == null) { raf = requestAnimationFrame(frame); return; }

    var lo = target - 6, hi = target + 6;          /* thirteen keys, the target in the middle */
    var n = hi - lo + 1, kw = W / n;
    var pad = 6;
    for (var m = lo; m <= hi; m++) {
      var x = (m - lo) * kw;
      var isT = m === target, isB = black(m);
      g.fillStyle = isT ? 'rgba(232,179,74,.95)' : (isB ? 'rgba(255,255,255,.10)' : 'rgba(255,255,255,.22)');
      g.beginPath();
      g.roundRect ? g.roundRect(x + 1.5, pad, kw - 3, H - pad * 2 - 16, 5) : g.rect(x + 1.5, pad, kw - 3, H - pad * 2 - 16);
      g.fill();
      if (isT || !isB) {
        g.fillStyle = isT ? '#1a1408' : 'rgba(255,255,255,.7)';
        g.font = (isT ? '800 ' : '600 ') + '10.5px system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText(name(m), x + kw / 2, H - 22);
      }
    }
    g.fillStyle = 'rgba(255,255,255,.55)';
    g.font = '700 10px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(live == null ? 'sing, and your note appears here' : 'you: ' + name(Math.round(live)), W / 2, H - 6);

    if (live != null) {
      /* fold to the strip so an octave slip still shows where it lands */
      var d = live - target;
      d = ((d % 12) + 18) % 12 - 6;
      var shown = target + d;
      var x2 = (shown - lo + 0.5) * kw;
      var cents = Math.abs(d * 100);
      var ok = cents <= 35;
      g.beginPath();
      g.arc(x2, (H - 16) / 2, 7, 0, Math.PI * 2);
      g.fillStyle = ok ? 'rgba(74,222,128,.95)' : 'rgba(232,179,74,.95)';
      g.shadowColor = g.fillStyle; g.shadowBlur = 12;
      g.fill();
      g.shadowBlur = 0;
    }
    raf = requestAnimationFrame(frame);
  }

  setInterval(function () {
    var panel = $('susPanel');
    if (panel && panel.offsetParent !== null && !raf) raf = requestAnimationFrame(frame);
  }, 400);
})();
