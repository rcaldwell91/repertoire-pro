/* ======================================================================
   Repertoire Pro — the phone's back button.

   Briar, 13 Sep: pressing back on any page took her all the way out to
   Google, and she had to click her way back to where she was. The app
   never put anything in the browser's history, so "back" meant "leave".

   Every screen change now leaves a footprint in the history. Back walks
   the footprints: a page goes back to the tab it came from, a running
   exercise is left the way its own Done button leaves it, a tab goes
   back to the tab before it — and the very first screen stays put, so
   back never leaves the app by accident. Forward is left alone.
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var stack = [];          /* ['home', 'train', 'page:cat:breath', ...] */
  var applying = false;    /* true while we are the ones navigating */
  var seeded = false;
  window.RPBack = { stack: function () { return stack.slice(); } };

  function current() {
    try {
      if (window.RPPage && RPPage.isOpen()) return 'page';
      if (typeof state !== 'undefined' && state.mode) return state.mode;
    } catch (e) {}
    return 'home';
  }
  function push(key) {
    if (applying) return;
    /* a tab change stands any open page down, so its footprint goes too */
    if (key !== 'page') while (stack.length && stack[stack.length - 1] === 'page') stack.pop();
    if (stack.length && stack[stack.length - 1] === key) return;
    stack.push(key);
    if (stack.length > 40) stack.shift();
    try { history.pushState({ rp: key, n: stack.length }, ''); } catch (e) {}
  }

  /* something is running on the Train tab — leave it the way its own
     button would, and stay on the tab */
  function leaveRunning() {
    var ids = ['gQuit', 'btnTrainStop', 'btnSusQuit', 'btnMatchQuit', 'btnKbdBack'];
    for (var i = 0; i < ids.length; i++) {
      var b = $(ids[i]);
      if (b && b.offsetParent !== null) { b.click(); return true; }
    }
    return false;
  }

  function goBack() {
    applying = true;
    try {
      /* a sheet on top closes first */
      var o = $('rpSheet');
      if (o && o.style.display !== 'none' && o.innerHTML) { o.style.display = 'none'; o.innerHTML = ''; return; }
      /* the tour or a tip */
      if (window.RPTour && RPTour.running()) { RPTour.stop(); return; }
      if (window.RPPage && RPPage.isOpen()) { RPPage.back(); stack.pop(); return; }
      if (leaveRunning()) return;   /* still on the same tab: its footprint stays */
      stack.pop();
      var prev = stack.length ? stack[stack.length - 1] : 'home';
      if (prev === 'page') prev = 'home';
      try { window.switchMode(prev); } catch (e) {}
    } finally {
      setTimeout(function () { applying = false; }, 60);
    }
  }

  window.addEventListener('popstate', function () {
    /* the browser has already stepped back one entry; put one back so the
       next press is ours again, then do our own going-back */
    if (!seeded) return;
    try { history.pushState({ rp: 'hold' }, ''); } catch (e) {}
    goBack();
  });

  /* seed one entry so the first press never leaves the site */
  var n = 0;
  var iv = setInterval(function () {
    if (typeof window.switchMode !== 'function') { if (++n > 50) clearInterval(iv); return; }
    clearInterval(iv);
    try { history.replaceState({ rp: 'root' }, ''); history.pushState({ rp: 'home' }, ''); } catch (e) {}
    stack = ['home'];
    seeded = true;
    var prev = window.switchMode;
    window.switchMode = function (m) {
      var r = prev.apply(this, arguments);
      push(m === 'page' ? 'page' : m);
      return r;
    };
    if (window.RPPage) {
      var open = RPPage.open;
      RPPage.open = function (o) { var r = open.apply(this, arguments); push('page'); return r; };
    }
  }, 200);
})();
