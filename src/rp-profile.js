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
    { key: 'account', icon: 'i-user',      title: 'Account',           sub: 'Your name, your email and your password.',
      folds: ['Account'], cards: [] },
    { key: 'voice',   icon: 'i-mic',       title: 'Your voice',        sub: 'Your range, and how hard the exercises are.',
      folds: ['Your voice'], cards: ['rpRangePanelHolder', 'rpRangeLine', 'rpTestRow', 'rpTalkRow'] },
    { key: 'progress',icon: 'i-bar-chart', title: 'Progress',          sub: 'Days practised, and where your points came from.',
      folds: ['Practice'], cards: ['rpPointsRow', 'rpLevelRow'] },
    { key: 'plan',    icon: 'i-compass',   title: 'Your plan',         sub: 'What Repertoire works on with you, and when. Change any of it here.',
      folds: [], cards: ['rpPlanHolder'] },
    { key: 'sound',   icon: 'i-volume',    title: 'Sound and microphone', sub: 'Volume, headphones and the microphone.',
      folds: ['Sound', 'Reference notes', 'Microphone'], cards: ['rpSoundRow', 'rpTimingRow'] },
    { key: 'look',    icon: 'i-settings',  title: 'How it looks, and how much it explains', sub: 'Light or dark, and long or short wording.',
      folds: ['Appearance'], cards: ['rpDoseRow'] },
    { key: 'help',    icon: 'i-book',      title: 'Help',              sub: 'A tour of the app, and a guide with pictures.',
      folds: ['About'], cards: ['rpHelpRow', 'rpGuideRow', 'rpExRow'] }
  ];

  function foldNamed(name) {
    var all = document.querySelectorAll('#youSlots details.pfold, #rpProfileHolders details.pfold');
    for (var i = 0; i < all.length; i++) {
      var sp = all[i].querySelector('summary span');
      if (sp && (sp.textContent || '').trim().replace(/\s+/g, ' ').indexOf(name) === 0) return all[i];
    }
    return null;
  }

  /* Robert, 17 Sep: "points are never defined anywhere." Here is what
     earns one, in the same words the level page uses. */
  function pointsRow() {
    var d = document.createElement('div');
    d.id = 'rpPointsRow';
    d.className = 'rp-card';
    d.style.padding = '13px';
    d.innerHTML = '<div class="rp-ttl">What earns a point</div>' +
      '<div class="rp-sub" style="margin-bottom:8px">Points count what you did, not how well you sang.</div>' +
      '<div style="font-size:13px;line-height:1.7">' +
      '<div>A warm-up or exercise finished · <b>10</b></div>' +
      '<div>An ear drill · <b>10</b></div>' +
      '<div>A note held to the end · <b>10</b></div>' +
      '<div>A theory star · <b>15</b></div>' +
      '<div>The word of the day, right first time · <b>5</b></div>' +
      '<div>A take sent to your coach · <b>25</b></div>' +
      '<div>Any day you practised at all · <b>20</b></div>' +
      '</div>';
    var host = $('rpProfileHolders') || $('modeYou');
    if (host) host.appendChild(d);
    return d;
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
        /* Briar, 15 Sep: five "Your voice" rows stacked up. The base rebuilds
           its folds when a level button is tapped; the new one was moved in
           beside the old ones instead of in their place. Newest wins. */
        var fresh = null, all = document.querySelectorAll('#youSlots details.pfold');
        for (var i = 0; i < all.length; i++) {
          var sp = all[i].querySelector('summary span');
          if (sp && (sp.textContent || '').trim().replace(/\s+/g, ' ').indexOf(name) === 0) { fresh = all[i]; break; }
        }
        if (fresh) {
          Array.prototype.slice.call(box.querySelectorAll('details.pfold')).forEach(function (d) {
            var sp = d.querySelector('summary span');
            if (sp && (sp.textContent || '').trim().replace(/\s+/g, ' ').indexOf(name) === 0) d.remove();
          });
          box.appendChild(fresh);
          fresh.open = true;
          if (name === 'Your voice') tidyVoice(fresh);
        }
      });
      g.cards.forEach(function (id) {
        var c = $(id);
        if (!c && id === 'rpTimingRow' && window.RPTiming) c = RPTiming.row();
        if (!c && id === 'rpPointsRow') c = pointsRow();
        if (!c && id === 'rpRangeLine' && window.RPRange && RPRange.lineNode) c = RPRange.lineNode();
        if (c && c.parentElement !== box) {
          if (id === 'rpRangePanelHolder' || id === 'rpSoundRow') box.insertBefore(c, box.firstChild); else box.appendChild(c);
        }
      });
    });
  }

  /* the base's own "Your voice" fold repeats the range the panel above it
     already shows, and tells you to test it on the Train tab — which is no
     longer where it is */
  function tidyVoice(f) {
    var sm = f.querySelector('summary'); if (sm) sm.style.display = 'none';
    var pr = f.querySelector('.prow'); if (pr) pr.style.display = 'none';
    /* Robert, 17 Sep: this was the third explanation of the same thing on
       one page, and the only one that said "ladders through it". The range
       card above owns the explanation now, and the sentence is out of the
       template as well, so there is nothing left here to hide. */
  }
  /* while a Profile page is open, a rebuilt fold is picked up straight away */
  setInterval(function () {
    try { if (window.RPPage && RPPage.isOpen() && document.querySelector('#youSlots details.pfold')) gather(); } catch (e) {}
  }, 600);

  /* Robert's audit: the Help page said "About" twice — the fold's summary
     and the heading inside it — and showed a version string. */
  function tidyAbout(f) {
    var sm = f.querySelector('summary'); if (sm) sm.style.display = 'none';
    f.querySelectorAll('b').forEach(function (b) {
      if ((b.textContent || '').trim() === 'About') b.style.display = 'none';
    });
    var v = f.querySelector('#youVer');
    if (v && v.parentElement) {
      var n = v.parentElement;
      n.innerHTML = n.innerHTML.replace(/Version\s*<b[^>]*id="youVer"[^>]*>[^<]*<\/b><br>\s*/i, '');
    }
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
    if (key === 'voice') { var f = foldNamed('Your voice'); if (f) tidyVoice(f); }
    if (key === 'help') { var fa = foldNamed('About'); if (fa) { fa.open = true; tidyAbout(fa); } }
    if (key === 'plan') {
      var ph = $('rpPlanHolder');
      if (ph) { ph.style.display = ''; ph.querySelectorAll('.panel').forEach(function (p) { p.style.display = ''; p.style.marginTop = '10px'; }); }
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
    /* Robert, 17 Sep: this line said A2–A4 on an account that had never
       sung a note. A2–A4 is base.html's built-in default, not anybody's
       range, so until it is measured this row has to say so. */
    if (v && rg) {
      try {
        var done = !window.RPRange || RPRange.measured();
        v.textContent = !done ? 'Not measured yet · tap to sing it'
          : midiName(rg.lo) + '–' + midiName(rg.hi) +
            (rg.by === 'preset' ? ' · picked, not sung' : rg.at ? ' · sung and measured' : '');
      } catch (e) {}
    }
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
