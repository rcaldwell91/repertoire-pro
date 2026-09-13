/* ======================================================================
   Repertoire Pro — the Profile tab, the Sing-tab way.

   Robert, 13 Sep: "too many options on one page. These need to be put
   into categories." Six tiles. Each opens a page holding the real rows
   the app already built — the base's own settings panels and the cards
   the cloud layer adds — moved in and moved back, wiring intact.

   Your vocal range moves here from the Train tab. "I'm not gonna be
   testing my vocal range often." It is offered when you sign up.
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

  var PR = window.RPProfile = {};

  var GROUPS = [
    { key: 'account', icon: 'i-user',      title: 'Account',           sub: 'Who you are signed in as.',
      folds: ['Account'], cards: [] },
    { key: 'voice',   icon: 'i-mic',       title: 'Your voice',        sub: 'Your range, and where you are.',
      folds: ['Your voice'], cards: ['rpRangePanelHolder', 'rpTestRow', 'rpTalkRow'] },
    { key: 'progress',icon: 'i-bar-chart', title: 'Progress',          sub: 'Days practised, and your level.',
      folds: ['Practice'], cards: ['rpLevelRow'] },
    { key: 'sound',   icon: 'i-volume',    title: 'Sound and microphone', sub: 'Testing, troubleshooting, the mic.',
      folds: ['Sound', 'Reference notes', 'Microphone'], cards: [] },
    { key: 'look',    icon: 'i-settings',  title: 'Look and words',    sub: 'Light or dark, and how much extra.',
      folds: ['Appearance'], cards: ['rpDoseRow'] },
    { key: 'help',    icon: 'i-book',      title: 'Help',              sub: 'The tour, the guide, and about.',
      folds: ['About'], cards: ['rpHelpRow'] }
  ];

  function foldNamed(name) {
    var all = document.querySelectorAll('#youSlots details.pfold, #rpProfileHolders details.pfold');
    for (var i = 0; i < all.length; i++) {
      var sp = all[i].querySelector('summary span');
      if (sp && (sp.textContent || '').trim().replace(/\s+/g, ' ').indexOf(name) === 0) return all[i];
    }
    return null;
  }

  /* the range panel comes from the Train tab — rp-train hands it over */
  PR.takeRange = function (panel) {
    var hold = holder('rpRangePanelHolder');
    if (!hold) return;
    hold.appendChild(panel);
    panel.style.display = 'block';
    panel.style.marginTop = '10px';
  };

  function holders() {
    var h = $('rpProfileHolders');
    if (!h) {
      h = document.createElement('div');
      h.id = 'rpProfileHolders';
      h.style.display = 'none';
      var mode = $('modeYou'); if (!mode) return null;
      mode.appendChild(h);
    }
    return h;
  }
  function holder(id) {
    var hs = holders(); if (!hs) return null;
    var d = $(id);
    if (!d) { d = document.createElement('div'); d.id = id; hs.appendChild(d); }
    return d;
  }

  /* pull every row into its group's holder (folds and cards alike) */
  function gather() {
    GROUPS.forEach(function (g) {
      var box = holder('rpPG_' + g.key);
      if (!box) return;
      g.folds.forEach(function (name) {
        var f = foldNamed(name);
        if (f && f.parentElement !== box) box.appendChild(f);
      });
      g.cards.forEach(function (id) {
        var c = $(id);
        if (c && c.parentElement !== box) {
          if (id === 'rpRangePanelHolder') box.insertBefore(c, box.firstChild); else box.appendChild(c);
        }
      });
    });
  }

  PR.open = function (key) {
    var g = GROUPS.filter(function (x) { return x.key === key; })[0];
    if (!g || !window.RPPage) return;
    gather();
    var box = holder('rpPG_' + key);
    if (!box) return;
    /* folds open by default on a page — the page is the fold now */
    box.querySelectorAll('details.pfold').forEach(function (d) { d.open = true; });
    var rp = $('rangePanel'); if (rp && key === 'voice') rp.style.display = 'block';
    if (key === 'voice') {
      /* the base's own "Your voice" fold repeats the range the panel above
         it already shows, and tells you to test it on the Train tab — which
         is no longer where it is */
      var f = foldNamed('Your voice');
      if (f) {
        var sm = f.querySelector('summary'); if (sm) sm.style.display = 'none';
        var pr = f.querySelector('.prow'); if (pr) pr.style.display = 'none';
        var nt = f.querySelector('.notice'); if (nt) nt.textContent = 'Test it above and every exercise ladders through it instead of guessing.';
      }
    }
    RPPage.open({ key: 'profile:' + key, title: g.title, sub: g.sub, node: box, backLabel: 'Profile' });
  };

  function draw() {
    var mode = $('modeYou');
    if (!mode || $('rpProfileTop')) return;
    var top = document.createElement('div');
    top.id = 'rpProfileTop';
    var h1 = mode.querySelector('h1');
    var intro = h1 ? h1.nextElementSibling : null;
    top.innerHTML = RPPage.tiles(GROUPS.map(function (g) {
      return { icon: g.icon, title: g.title, sub: g.sub, data: 'data-pg="' + g.key + '"' };
    }));
    var slots = $('youSlots');
    mode.insertBefore(top, slots || null);
    top.querySelectorAll('[data-pg]').forEach(function (t) {
      on(t, 'click', function () { PR.open(t.dataset.pg); });
    });
  }

  /* the summary lines on the tiles should say something true and current */
  function refresh() {
    var top = $('rpProfileTop'); if (!top) return;
    var me = null; try { me = window.RP && RP.user && RP.profile ? RP.profile : null; } catch (e) {}
    var t = top.querySelector('[data-pg="account"] p'); if (t) t.textContent = me ? (me.display_name || me.email) : 'Not signed in — tap to sign in.';
    var rg = null; try { rg = window.RPRange ? RPRange.get() : null; } catch (e) {}
    var v = top.querySelector('[data-pg="voice"] p');
    if (v && rg) { try { v.textContent = midiName(rg.lo) + '–' + midiName(rg.hi) + (rg.by === 'preset' ? ' · picked, not sung' : rg.at ? ' · sung and measured' : ''); } catch (e) {} }
    var lv = $('rpLevelRow'); var p = top.querySelector('[data-pg="progress"] p');
    if (lv && p) { var tt = lv.querySelector('.rp-ttl'); if (tt) p.textContent = tt.textContent; }
  }

  var ticks = 0;
  var iv = setInterval(function () {
    ticks++;
    if (!$('modeYou') || !$('youSlots') || !window.RPPage) { if (ticks > 80) clearInterval(iv); return; }
    draw();
    gather();
    refresh();
  }, 600);
})();
