/* ======================================================================
   Repertoire Pro — your range, kept.

   Idea bank #1 is "songs that sit in their range". Before any of that can
   mean anything, the app has to know what your range IS — and it did not.

   Watched in a real browser on the 13th: pick Soprano (C4–C6), reload the
   page, and it says A2–A4 again. RANGE was a plain object in memory and
   nothing ever wrote it down. So the range test measured something real,
   showed it once, and threw it away — and every exercise since laddered
   through a default baritone range that was nobody's.

   Kept three ways now: on the phone, so it survives a reload; on the
   account, so it follows you to a new phone and your coach can see what
   he is writing exercises for; and with the DATE and HOW, because "sung
   and measured on the 13th" and "picked off a list" are not the same
   claim and the app should not blur them.

   Song suggestions and recommendations are PARKED, at Robert's word on
   13 Sep. Nothing here suggests anything. This file keeps one number that
   the app had been throwing away, and shows it.
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

  var R = window.RPRange = {};
  var KEY = 'rp_range';
  var applying = false;     /* stops our own restore from saving itself back */
  var nextBy = 'test';      /* a preset flips this for one change */

  function nowIso() { return new Date().toISOString(); }

  function theRange() {
    try { return (typeof RANGE !== 'undefined') ? RANGE : null; } catch (e) { return null; }
  }
  function name(m) {
    try { return midiName(m); } catch (e) { return String(m); }
  }

  /* ---- what is written down ---------------------------------------- */
  function readLocal() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      if (!v || !isFinite(v.lo) || !isFinite(v.hi) || v.hi <= v.lo) return null;
      return v;
    } catch (e) { return null; }
  }
  function writeLocal(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
  }

  R.get = function () {
    var v = readLocal();
    var live = theRange();
    if (v) return v;
    if (live) return { lo: live.lo, hi: live.hi, at: null, by: null };
    return null;
  };

  /* Robert, 18 Sep: "Profile > Your voice reads A2\u2013A4 on an account that
     has never sung a note." A2\u2013A4 is base.html's built-in default RANGE.
     Nothing is written down until the test runs or a preset is picked, so
     an empty store IS the answer to "has this ever been measured". */
  R.measured = function () { return !!readLocal(); };
  var UNTESTED = 'Not measured yet';

  /* Is this pair one of the presets in the dropdown? Then the singer chose
     it rather than sang it, and it should not be reported as measured. */
  function looksPicked(lo, hi) {
    var sel = $('rangePreset');
    if (!sel) return false;
    for (var i = 0; i < sel.options.length; i++) {
      var v = sel.options[i].value;
      if (!v) continue;
      var p = v.split(',');
      if (+p[0] === lo && +p[1] === hi) return true;
    }
    return false;
  }

  function apply(lo, hi) {
    var live = theRange();
    if (!live) return false;
    applying = true;
    seen = { lo: lo, hi: hi };
    try {
      live.lo = lo; live.hi = hi;
      if (typeof updateRangeDisp === 'function') updateRangeDisp();
    } catch (e) {}
    applying = false;
    return true;
  }
  R.apply = apply;

  /* The app calls updateRangeDisp() every time the Train tab opens, with
     whatever RANGE holds — on a fresh phone that is its built-in A2–A4.
     The first version saved that as "sung and measured", which was a lie
     on screen for anyone who had never sung a note. So: remember what the
     range was when we last looked, and only write when it actually moves. */
  var seen = null;
  function save(by) {
    var live = theRange();
    if (!live) return;
    var lo = Math.round(live.lo), hi = Math.round(live.hi);
    if (!isFinite(lo) || !isFinite(hi) || hi <= lo) return;
    /* Robert, 17 Sep: his phone measured F3–A♯5 and the app still said
       A2–A4. The first time this ran was the END of the test, on a phone
       that had never opened the Train tab: "seen" was empty, so it took the
       measured range as the starting point and saved nothing. Now the
       starting point is read at boot, so the first real change is kept. */
    if (!seen) { seen = { lo: lo, hi: hi }; if (!readLocal()) return; }
    if (seen.lo === lo && seen.hi === hi) return;            /* nothing moved */
    seen = { lo: lo, hi: hi };
    var prev = readLocal();
    if (prev && prev.lo === lo && prev.hi === hi) return;   /* nothing changed */
    var v = { lo: lo, hi: hi, at: nowIso(), by: by || (looksPicked(lo, hi) ? 'preset' : 'test') };
    writeLocal(v);
    push(v);
  }

  /* ---- the account copy -------------------------------------------- */
  function signedIn() {
    try { return !!(window.RP && RP.sb && RP.user && RP.profile); } catch (e) { return false; }
  }
  function push(v) {
    if (!signedIn()) return;
    RP.sb.from('profiles')
      .update({ range_lo: v.lo, range_hi: v.hi, range_at: v.at, range_by: v.by })
      .eq('id', RP.user.id).select().then(function (r) {
        if (!r.error && r.data && r.data[0]) RP.profile = r.data[0];
      });
  }

  /* When you sign in on a new phone the account copy is the one that knows
     anything. When you sang into THIS phone more recently, it is not.
     Whichever is newer wins, and the other one is brought up to date. */
  var pulled = false;
  function pull() {
    if (pulled || !signedIn()) return;
    var p = RP.profile;
    if (p.range_lo == null || p.range_hi == null) {
      pulled = true;
      var mine = readLocal();
      if (mine) push(mine);          /* the account had nothing; give it ours */
      return;
    }
    pulled = true;
    var theirs = { lo: p.range_lo, hi: p.range_hi, at: p.range_at, by: p.range_by || 'test' };
    var mine2 = readLocal();
    var newer = (!mine2 || !mine2.at) ? theirs
              : (!theirs.at ? mine2
              : (new Date(theirs.at) > new Date(mine2.at) ? theirs : mine2));
    if (newer === theirs) { writeLocal(theirs); apply(theirs.lo, theirs.hi); }
    else if (mine2 && mine2.at && (!theirs.at || theirs.lo !== mine2.lo || theirs.hi !== mine2.hi)) push(mine2);
    else push(mine2);
  }

  /* ---- hook every place the range can change ----------------------- */
  (function primeSeen() {
    var n = 0, iv = setInterval(function () {
      var live = null; try { live = theRange(); } catch (e) {}
      if (live && isFinite(live.lo) && isFinite(live.hi)) { if (!seen) seen = { lo: Math.round(live.lo), hi: Math.round(live.hi) }; clearInterval(iv); }
      else if (++n > 60) clearInterval(iv);
    }, 100);
  })();
  (function hook() {
    function attach() {
      if (typeof updateRangeDisp !== 'function' || updateRangeDisp.__rp) return false;
      var prev = updateRangeDisp;
      var wrapped = function () {
        try { prev.apply(this, arguments); } catch (e) {}
        try { untestedDisp(); } catch (e) {}
        if (applying) return;
        try { save(nextBy); } catch (e) {}
        nextBy = 'test';
      };
      wrapped.__rp = 1;
      window.updateRangeDisp = wrapped;
      return true;
    }
    if (!attach()) {
      var n = 0;
      var iv = setInterval(function () { if (attach() || ++n > 40) clearInterval(iv); }, 300);
    }
  })();

  /* The preset dropdown is the one path that is a choice, not a measurement,
     and the label has to be right — "sung and measured" is a claim.
     A listener on the <select> itself fires in registration order, and the
     base app registered first, so ours ran after the save had already gone
     out saying "measured". Capture on the document runs on the way DOWN,
     before anything on the element. */
  document.addEventListener('change', function (e) {
    try {
      if (e.target && e.target.id === 'rangePreset' && e.target.value) nextBy = 'preset';
    } catch (err) {}
  }, true);

  /* restore whatever this phone already knew, as early as there is
     something to restore it into */
  (function restore() {
    var n = 0;
    var iv = setInterval(function () {
      var v = readLocal();
      if (!theRange() || ++n > 60) { clearInterval(iv); return; }
      if (v && apply(v.lo, v.hi)) clearInterval(iv);
      else if (!v) clearInterval(iv);
    }, 200);
  })();
  setInterval(pull, 1500);

  /* ================================================================== */
  function sheet(html) {
    var o = $('rpSheet');
    if (!o) {
      o = document.createElement('div');
      o.id = 'rpSheet';
      o.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.7);' +
        'display:flex;align-items:flex-end;justify-content:center;overflow-y:auto';
      document.body.appendChild(o);
    }
    o.innerHTML = '<div style="background:var(--panel);border:1px solid var(--line);' +
      'border-radius:18px 18px 0 0;width:100%;max-width:560px;padding:20px 16px ' +
      'calc(24px + env(safe-area-inset-bottom,0px));max-height:94vh;overflow-y:auto">' + html + '</div>';
    o.style.display = 'flex';
    return o.firstChild;
  }
  function shut() { var o = $('rpSheet'); if (o) { o.style.display = 'none'; o.innerHTML = ''; } }

  function when(at) {
    if (!at) return '';
    try {
      var d = new Date(at);
      var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      return d.getDate() + ' ' + M[d.getMonth()];
    } catch (e) { return ''; }
  }

  R.open = function () {
    var v = R.get();
    if (!v) return;
    var semis = v.hi - v.lo;

    var h = '<b style="font-size:18px">Your range</b>';
    if (!R.measured()) {
      h += '<div style="font-size:24px;font-weight:900;color:var(--gold);margin-top:8px">' +
        UNTESTED + '</div>' +
        '<div class="rp-sub" style="margin-top:2px">The exercises are using a starting range ' +
        'until you sing your own.</div>';
    } else {
      h += '<div style="font-size:34px;font-weight:900;color:var(--gold);margin-top:8px">' +
        esc(name(v.lo)) + ' – ' + esc(name(v.hi)) + '</div>' +
        '<div class="rp-sub" style="margin-top:2px">' + semis + ' semitones' +
        (v.by === 'preset'
          ? ' · picked from the list, not measured'
          : (v.at ? ' · sung and measured on ' + esc(when(v.at)) : '')) + '</div>';
    }

    if (R.measured() && v.by === 'preset') {
      h += '<div class="rp-card" style="margin-top:12px;padding:12px;border-left:3px solid var(--gold)">' +
        '<div style="font-size:13px;line-height:1.55">This one came off the list. It is a fair ' +
        'starting point and the exercises will use it, but it is somebody else’s range with your ' +
        'name on it. Two minutes of singing gets you your own.</div></div>';
    }

    h += '<div class="measured" style="margin-top:12px">Every exercise is built around this, so it is worth getting right. Your coach can see it.</div>';

    h += '<button class="btn primary" id="rpRgTest" style="width:100%;padding:11px;margin-top:12px;' +
      'font-size:12.5px">Sing it and measure it</button>';

    h += '<button class="btn" id="rpRgX" style="width:100%;padding:12px;margin-top:12px">Close</button>';
    sheet(h);
    on($('rpRgX'), 'click', shut);
    on($('rpRgTest'), 'click', function () {
      shut();
      try { window.switchMode('train'); } catch (e) {}
      setTimeout(function () {
        var b = $('btnRangeTest');
        if (b) { b.scrollIntoView({ block: 'center' }); b.click(); }
      }, 250);
    });
  };

  /* ------------------------------------------------------------------ */
  /* Profile already HAS a "Your voice" row. Two rows about one range is
     one too many, and the one that was there was wrong: buildProfile()
     runs once ever (it bails on host.dataset.v10) and reads the range off
     the screen at that moment — which is before anything has been
     restored. So it sat there saying A2–A4 while the Train tab said
     C3–C5. Keep the row people already look at, and keep it true.        */
  /* ------------------------------------------------------------------ */
  function voiceFold() {
    var host = $('youSlots');
    if (!host) return null;
    var all = host.querySelectorAll('details.pfold');
    for (var i = 0; i < all.length; i++) {
      var s0 = all[i].querySelector('summary span');
      if (s0 && /^Your voice/i.test((s0.textContent || '').trim())) return all[i];
    }
    return null;
  }

  function row() {
    var d = voiceFold();
    if (!d) return;
    var v = R.get();
    if (!v) return;
    var txt = R.measured() ? name(v.lo) + ' \u2013 ' + name(v.hi) : UNTESTED;

    var sub = d.querySelector('summary .psub');
    if (sub && sub.textContent !== txt) sub.textContent = txt;
    var pv = d.querySelector('.prow .pv');
    if (pv && pv.textContent !== txt) pv.textContent = txt;

    var line = d.querySelector('#rpRangeLine');
    if (!line) {
      line = document.createElement('div');
      line.id = 'rpRangeLine';
      line.className = 'rp-card';
      line.style.cssText = 'padding:11px;margin-top:10px;cursor:pointer';
      var body = d.querySelector('.pfoldin');
      if (!body) return;
      body.appendChild(line);
      on(line, 'click', R.open);
    }
    /* the notes themselves are already on the two lines above this one, so
       this row carries the thing they do not: where the number came from */
    var head = !R.measured() ? UNTESTED
             : (v.by === 'preset' ? 'Picked from the list, not measured'
             : (v.at ? 'Sung and measured ' + when(v.at) : 'Measured'));
    var sub = !R.measured()
      ? 'Two minutes of singing sets it. Until then the exercises use a starting range.'
      : (v.hi - v.lo) + ' semitones \u00b7 kept on this device and on your account';
    line.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<div><div class="rp-ttl">' + esc(head) + '</div>' +
      '<div class="rp-sub">' + esc(sub) + '</div></div>' +
      '<div style="color:var(--ink-faint);font-size:20px">\u203a</div></div>';
  }
  function untestedDisp() {
    var d = $('rangeDisp'), sb = $('rangeSub');
    if (!d) return;
    if (R.measured()) { d.style.fontSize = ''; return; }
    d.textContent = UNTESTED;
    d.style.fontSize = '22px';
    if (sb) sb.textContent = 'Sing your lowest and your highest note once, and every exercise ' +
      'fits your voice. Until then it uses a starting range.';
  }
  setInterval(function () { row(); untestedDisp(); }, 1500);
  setTimeout(function () { row(); untestedDisp(); }, 1150);

  /* ---- one line for the coach, on his student's screen -------------- */
  R.lineFor = function (p) {
    if (!p || p.range_lo == null || p.range_hi == null) return '';
    var by = p.range_by === 'preset' ? 'picked from the list' : 'sung and measured';
    return '<div class="rp-card" style="padding:11px;margin-top:8px">' +
      '<div class="rp-lab">THEIR RANGE</div>' +
      '<div style="font-size:19px;font-weight:900;color:var(--gold);margin-top:3px">' +
      esc(name(p.range_lo)) + ' – ' + esc(name(p.range_hi)) + '</div>' +
      '<div class="rp-sub">' + (p.range_hi - p.range_lo) + ' semitones · ' + by +
      (p.range_at ? ' · ' + esc(when(p.range_at)) : '') + '</div></div>';
  };
})();
