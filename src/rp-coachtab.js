/* ======================================================================
   Repertoire Pro — the Coach tab, split up.

   Robert, 17 Sep: "Coach is one enormous screen holding ten unrelated
   things. Break it up." He approved the layout: the tab is about the
   person who teaches you, and nothing else. What Repertoire decides for
   you — what to work on, how much it chooses, when and where you
   practise, what it can and cannot measure — moves to Profile, under
   "Your plan". The fifteen-minute plan itself already lives on Home, so
   the copy of it that sat here is gone.

   Nothing is rewritten: the base still builds those panels, and this
   moves them. One set of controls, one place.
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function text(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  var KEEP = /^This week/;                       /* stays on the Coach tab */
  var PLAN = /^(What I want to work on|How much should the app decide|When and where|What the app can and cannot tell you)/;
  var DROP = /^(Working with a real coach)/;

  function holder() {
    var h = $('rpPlanHolder');
    if (h) return h;
    var host = $('modeYou');
    if (!host) return null;
    h = document.createElement('div');
    h.id = 'rpPlanHolder';
    h.style.display = 'none';
    host.appendChild(h);
    return h;
  }

  function heading(el) {
    var b = el.querySelector('b, h1, h3');
    return b ? text(b) : text(el).slice(0, 40);
  }

  function tidy() {
    var host = $('modeCoach');
    if (!host || !host.classList.contains('active')) return;
    try { if (window.RP && RP.isCoachFace && RP.isCoachFace()) return; } catch (e) {}
    var box = holder();
    Array.prototype.slice.call(host.children).forEach(function (el) {
      if (el.id === 'rpChannel' || el.id === 'rpCoachTop') return;
      if (el.tagName === 'H1') { el.style.display = 'none'; return; }
      if (el.classList.contains('notice') && !el.dataset.rpKeep) {
        /* the line under the old heading, and the signed-out hint */
        if (/plan for you|changes as you do/i.test(text(el))) { el.style.display = 'none'; return; }
        return;
      }
      /* Robert, 17 Sep: the same five steps and the same Start button were
         printed on Home and here. Home owns today; this tab is the coach. */
      if (el.classList.contains('plan')) { el.style.display = 'none'; return; }
      if (!el.classList.contains('panel')) return;
      var head = heading(el);
      if (KEEP.test(head)) { el.style.display = ''; return; }
      if (DROP.test(head)) { el.style.display = 'none'; return; }
      if (PLAN.test(head)) { if (box && el.parentElement !== box) box.appendChild(el); return; }
      /* the plan itself — Home has it */
      if (/Today · about|Today &middot; about/i.test(text(el).slice(0, 40))) { el.style.display = 'none'; return; }
    });
    header();
  }

  /* the tab's own heading: who this is about */
  function header() {
    var host = $('modeCoach');
    if (!host) return;
    var t = $('rpCoachTop');
    if (!t) {
      t = document.createElement('div');
      t.id = 'rpCoachTop';
      host.insertBefore(t, host.firstChild);
    }
    var coach = null;
    try { coach = window.RP && RP.coach; } catch (e) {}
    var name = coach ? coach.display_name : null;
    var sig = name || 'none';
    if (t.dataset.sig === sig) return;
    t.dataset.sig = sig;
    t.innerHTML = '<h1 style="margin:0 0 2px">' + (name ? 'From ' + esc(name) : 'Coach') + '</h1>' +
      '<div class="rp-sub" style="margin:0 0 12px">' +
      (name ? 'What they set you, and what you have sent them.'
            : 'A real person who sets your work and listens to your takes.') + '</div>';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  setInterval(tidy, 700);
  setTimeout(tidy, 900);
  window.RPCoachTab = { tidy: tidy };
})();
