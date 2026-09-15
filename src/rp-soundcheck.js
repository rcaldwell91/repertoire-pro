/* ======================================================================
   Repertoire Pro — sound check.

   Briar, 15 Sep, could not tell whether her headphones were the problem.
   One button, one note, one question: did you hear it? It sits on Home
   under Today, and at the top of Profile → Sound and microphone. The note
   is the app's own reference sound, so what you hear here is what every
   exercise plays.
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var SC = window.RPSound = {};

  SC.check = function () {
    try { if (typeof ensureCtx === 'function') ensureCtx(); } catch (e) {}
    try {
      if (typeof ctx !== 'undefined' && ctx && ctx.state === 'suspended') ctx.resume();
      var play = (window.V10 && V10.playRef) ? V10.playRef : window.playPiano;
      if (play) play(60, ctx.currentTime + 0.05, 1.2, guideGain, 0.8);
      return true;
    } catch (e) { return false; }
  };

  function card(id) {
    var d = document.createElement('div');
    d.id = id;
    d.className = 'rp-card';
    d.style.cssText = 'padding:12px;margin-top:10px';
    d.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center;gap:10px">' +
      '<div style="flex:1;min-width:0"><div class="rp-ttl">Sound check</div>' +
      '<div class="rp-sub" data-sc-msg>Not sure your headphones work? Play a note.</div></div>' +
      '<button class="btn primary" data-sc-go style="padding:9px 14px;font-size:12.5px;flex:none">Play a note</button></div>';
    var msg = d.querySelector('[data-sc-msg]');
    d.querySelector('[data-sc-go]').addEventListener('click', function (ev) {
      ev.stopPropagation();
      var ok = SC.check();
      msg.textContent = ok
        ? 'Heard a note? Your headphones are fine. Nothing? Turn the volume up, then check the plug or the Bluetooth connection.'
        : 'The phone would not play sound. Tap once more, and check the volume.';
      setTimeout(function () { msg.textContent = 'Not sure your headphones work? Play a note.'; }, 9000);
    });
    return d;
  }

  function mount() {
    /* Home, under Today */
    var today = $('rpToday');
    if (today && !$('rpSoundHome')) {
      try { today.parentElement.insertBefore(card('rpSoundHome'), today.nextSibling); } catch (e) {}
    }
    /* Profile → Sound and microphone: rp-profile picks this row up by id */
    if (!$('rpSoundRow')) {
      var host = $('modeYou');
      if (host) host.appendChild(card('rpSoundRow'));
    }
  }
  setInterval(mount, 1200);
  setTimeout(mount, 700);
})();
