/* ======================================================================
   Repertoire Pro — Home: today, from whoever is coaching you.

   Robert, 13 Sep. There were two fifteen-minute plans in two places — the
   Home "session" and the Coach tab's plan — and two things called Coach on
   one screen. His call: Home shows TODAY, and says who set it. If a human
   coach has set you work, that is today. If nobody has, Repertoire's own
   plan fills the gap and says so. Later, paying just changes who is
   allowed to set it; nothing here knows about money.

   The app's own coach is called "From Repertoire" everywhere now — named
   after what it is, not after a technology people have opinions about.
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

  var D = window.RPToday = {};

  function coachWork() {
    try {
      if (!window.RP || !RP.user || !RP.coach || !RP.dueOn) return null;
      var list = RP.dueOn(new Date(), RP.user.id);
      return list.length ? list : null;
    } catch (e) { return null; }
  }
  /* the whole name — "Ja Ronn" is two words, and cutting it to "Ja" is wrong */
  function firstName(p) { return String((p && p.display_name) || 'your coach').trim(); }

  /* Repertoire's own plan — the same one the Coach tab has always built,
     read from the same place, so the two can never disagree. */
  function ownPlan() {
    var P = null, plan = null;
    try { P = (window.V10 && V10.P) || null; } catch (e) {}
    try { plan = window.V10 && V10.planFor ? V10.planFor() : null; } catch (e) {}
    return { P: P, plan: plan };
  }

  /* the base app styles its big button by id, so ours needs the same look */
  (function css() {
    if ($('rpTodayCSS')) return;
    var st = document.createElement('style');
    st.id = 'rpTodayCSS';
    st.textContent = '#rpTodayGo{width:100%;border:0;border-radius:14px;padding:15px;font-size:16px;' +
      'font-weight:900;background:var(--grad);color:#fff;cursor:pointer;box-shadow:var(--glow);margin-top:6px}' +
      '#rpTodayGo:active{transform:scale(.985)}';
    document.head.appendChild(st);
  })();

  var lastSig = '';
  function draw(force) {
    var hero = document.querySelector('#modeHome .hero');
    if (!hero) return;
    var work = coachWork();
    var sig;
    if (work) {
      sig = 'c:' + work.map(function (w) { return w.a.id + (w.done ? '1' : '0'); }).join(',');
    } else {
      var op = ownPlan();
      sig = 'r:' + (op.plan ? (op.plan.warm && op.plan.warm.name) + '|' + (op.plan.focus && op.plan.focus.name) : 'none');
    }
    if (!force && sig === lastSig && $('rpToday')) return;
    lastSig = sig;

    /* the old pieces stay in the DOM, hidden — the base app still writes
       to them and must not find them gone */
    ['.kicker', '#heroMsg', '#heroSub', '.jsteps', '#btnJourney'].forEach(function (s) {
      var el = hero.querySelector(s); if (el) el.style.display = 'none';
    });

    var box = $('rpToday');
    if (!box) {
      box = document.createElement('div');
      box.id = 'rpToday';
      hero.insertBefore(box, hero.firstChild);
    }

    var h;
    if (work) {
      var open = work.filter(function (w) { return !w.done; });
      var who = firstName(RP.coach);
      h = '<div class="kicker">TODAY · FROM ' + esc(who.toUpperCase()) + '</div>' +
        '<h2 style="font-size:21px;margin:5px 0 3px">' +
        (open.length ? (open.length === 1 ? 'One thing from ' : open.length + ' things from ') + esc(who) + '.'
                     : 'All done for today.') + '</h2>' +
        '<div class="sub" style="font-size:12.5px;color:var(--ink-dim);font-weight:600">' +
        (open.length ? 'Tap it and the exercise opens already set up. Record, then send the one you like.'
                     : 'Everything ' + esc(who) + ' set for today is in. Sing for fun, or do Repertoire’s plan.') + '</div>';
      h += '<div style="margin:12px 0 4px">';
      work.forEach(function (w) {
        var a = w.a;
        h += '<div class="planstep" data-today-open="' + esc(a.id) + '" style="cursor:pointer">' +
          '<div class="pmin" style="color:' + (w.done ? 'var(--hit)' : 'var(--accent)') + '">' + (w.done ? '✓' : '→') + '</div>' +
          '<div><div class="pt">' + esc(a.title) + (a.cadence === 'daily' ? ' <span class="extag">every day</span>' : '') + '</div>' +
          (a.note ? '<div class="pd">“' + esc(a.note) + '”</div>' : '') + '</div></div>';
      });
      h += '</div>';
      h += open.length
        ? '<button id="rpTodayGo" data-today-open="' + esc(open[0].a.id) + '">Start: ' + esc(open[0].a.title) + '</button>'
        : '<button id="rpTodayGo" data-today-own="1">Repertoire’s plan · 15 min</button>';
    } else {
      var op2 = ownPlan(), plan = op2.plan;
      h = '<div class="kicker">TODAY · FROM REPERTOIRE</div>' +
        '<h2 style="font-size:21px;margin:5px 0 3px">About fifteen minutes.</h2>' +
        '<div class="sub" style="font-size:12.5px;color:var(--ink-dim);font-weight:600">' +
        (window.RP && RP.user && !RP.coach
          ? 'Nobody has set you work, so this is Repertoire’s own plan. Join a coach on the Coach tab and theirs goes here instead.'
          : 'Repertoire’s own plan, built from what it has measured. It changes as you do.') + '</div>';
      if (plan) {
        h += '<div style="margin:12px 0 4px">' +
          '<div class="planstep"><div class="pmin">2 min</div><div><div class="pt">Body and breath</div></div></div>' +
          '<div class="planstep"><div class="pmin">3 min</div><div><div class="pt">' + esc(plan.warm.name) + '</div></div></div>' +
          '<div class="planstep"><div class="pmin">4 min</div><div><div class="pt">' + esc(plan.focus.name) +
          ' <span class="extag" style="color:var(--accent)">TODAY’S ONE THING</span></div></div></div>' +
          '<div class="planstep"><div class="pmin">4 min</div><div><div class="pt">Put it into a song</div></div></div>' +
          '<div class="planstep"><div class="pmin">2 min</div><div><div class="pt">Cool down</div></div></div>' +
          '</div>';
      }
      h += '<button id="rpTodayGo" data-today-own="1">Start · 15 min</button>';
    }
    box.innerHTML = h;


    box.querySelectorAll('[data-today-open]').forEach(function (el) {
      on(el, 'click', function () {
        var a = (RP.assignments || []).filter(function (x) { return x.id === el.dataset.todayOpen; })[0];
        if (a && window.RPWork) RPWork.open(a);
      });
    });
    box.querySelectorAll('[data-today-own]').forEach(function (el) {
      on(el, 'click', D.startOwn);
    });
  }

  D.startOwn = function () {
    try { window.switchMode('train'); } catch (e) {}
    setTimeout(function () {
      try {
        var P = V10.P || {};
        var rt = P.quietDefault ? V10.ROUTINES.quiet : V10.ROUTINES[P.level || 1];
        V10.startRoutine(rt);
      } catch (e) {}
    }, 80);
  };
  D.draw = function () { draw(true); };

  setInterval(function () { draw(false); }, 1500);
  setTimeout(function () { draw(true); }, 800);
})();
