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

   The song half of idea bank #1 is NOT built, and the panel here says so.
   Recommending songs needs a catalogue of songs with their ranges in it.
   There is no openly licensed one — the apps that do this hold their own
   private databases — and the standing rule is permanent: never scrape or
   source lyrics or audio. So what is here answers the same question for
   the songs the app actually HAS the notes to, and stops there rather
   than guessing at the rest.
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
    try {
      live.lo = lo; live.hi = hi;
      if (typeof updateRangeDisp === 'function') updateRangeDisp();
    } catch (e) {}
    applying = false;
    return true;
  }
  R.apply = apply;

  function save(by) {
    var live = theRange();
    if (!live) return;
    var lo = Math.round(live.lo), hi = Math.round(live.hi);
    if (!isFinite(lo) || !isFinite(hi) || hi <= lo) return;
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
    else push(mine2);
  }

  /* ---- hook every place the range can change ----------------------- */
  (function hook() {
    function attach() {
      if (typeof updateRangeDisp !== 'function' || updateRangeDisp.__rp) return false;
      var prev = updateRangeDisp;
      var wrapped = function () {
        try { prev.apply(this, arguments); } catch (e) {}
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
  /* DOES IT FIT? — only for songs the app has the actual notes to.      */
  /* ================================================================== */
  function songSpan(s) {
    if (!s || !s.notes || !s.notes.length) return null;
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < s.notes.length; i++) {
      var m = s.notes[i].m;
      if (!isFinite(m)) continue;
      if (m < lo) lo = m;
      if (m > hi) hi = m;
    }
    if (!isFinite(lo) || !isFinite(hi)) return null;
    var t = s.transposeDefault || 0;
    return { lo: lo + t, hi: hi + t };
  }

  R.songs = function () {
    var out = [];
    try {
      if (typeof SONGS === 'undefined') return out;
      SONGS.forEach(function (s) {
        if (/^Exercise:/i.test(s.title || '')) return;   /* those are drills, not songs */
        var sp = songSpan(s);
        if (sp) out.push({ title: s.title, lo: sp.lo, hi: sp.hi, span: sp.hi - sp.lo });
      });
    } catch (e) {}
    return out;
  };

  /* How far the song has to move, in semitones, to sit inside your range.
     Returns null when it simply will not: the song is wider than you are. */
  R.fit = function (song, lo, hi) {
    if (song.span > (hi - lo)) return { impossible: true, short: song.span - (hi - lo) };
    var shift = 0;
    if (song.lo < lo) shift = lo - song.lo;
    else if (song.hi > hi) shift = hi - song.hi;
    return {
      impossible: false,
      shift: shift,
      roomLow: (song.lo + shift) - lo,
      roomHigh: hi - (song.hi + shift)
    };
  };

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

    var h = '<b style="font-size:18px">Your range</b>' +
      '<div style="font-size:34px;font-weight:900;color:var(--gold);margin-top:8px">' +
      esc(name(v.lo)) + ' – ' + esc(name(v.hi)) + '</div>' +
      '<div class="rp-sub" style="margin-top:2px">' + semis + ' semitones' +
      (v.by === 'preset'
        ? ' · picked from the list, not measured'
        : (v.at ? ' · sung and measured on ' + esc(when(v.at)) : '')) + '</div>';

    if (v.by === 'preset') {
      h += '<div class="rp-card" style="margin-top:12px;padding:12px;border-left:3px solid var(--gold)">' +
        '<div style="font-size:13px;line-height:1.55">This one came off the list. It is a fair ' +
        'starting point and the exercises will use it, but it is somebody else’s range with your ' +
        'name on it. Two minutes of singing gets you your own.</div></div>';
    }

    h += '<div class="measured" style="margin-top:12px">Every exercise ladders through this, so it is ' +
      'worth it being right. It is kept on this phone and on your account, and your coach can see it.</div>';

    h += '<button class="btn primary" id="rpRgTest" style="width:100%;padding:11px;margin-top:12px;' +
      'font-size:12.5px">Sing it and measure it</button>';

    /* -- the songs the app can actually answer for -- */
    var list = R.songs();
    h += '<div class="rp-lab" style="margin-top:20px">DOES IT FIT?</div>';
    if (!list.length) {
      h += '<div class="measured">No songs with note data on this phone yet.</div>';
    } else {
      list.forEach(function (s) {
        var f = R.fit(s, v.lo, v.hi);
        var line, tone;
        if (f.impossible) {
          line = 'Wider than you are by ' + f.short + ' semitone' + (f.short === 1 ? '' : 's') +
                 ' — it does not fit in any key.';
          tone = 'var(--miss)';
        } else if (f.shift === 0) {
          var bits = [];
          bits.push(f.roomLow === 0 ? 'its lowest note is your lowest note'
                                    : f.roomLow + ' spare at the bottom');
          bits.push(f.roomHigh === 0 ? 'its highest is your highest'
                                     : f.roomHigh + ' at the top');
          line = 'Fits as it is — ' + bits.join(', ') + '.';
          tone = 'var(--gold)';
        } else {
          line = 'Fits if you move it ' + Math.abs(f.shift) + ' semitone' +
                 (Math.abs(f.shift) === 1 ? '' : 's') + ' ' + (f.shift > 0 ? 'up' : 'down') +
                 ' — the app’s own transpose does that.';
          tone = 'var(--gold)';
        }
        h += '<div class="rp-card" style="padding:11px;margin-top:7px;border-left:3px solid ' + tone + '">' +
          '<div class="rp-ttl">' + esc(s.title) + '</div>' +
          '<div class="rp-sub">' + esc(name(s.lo)) + '–' + esc(name(s.hi)) + ' · ' + s.span +
          ' semitones</div>' +
          '<div style="font-size:12.5px;line-height:1.5;margin-top:5px">' + esc(line) + '</div></div>';
      });
    }

    h += '<div class="rp-card" style="margin-top:12px;padding:12px;border-left:3px solid var(--gold)">' +
      '<div style="font-size:12.5px;line-height:1.55">That is every song this app has the actual ' +
      'notes to — so every line above is worked out, not guessed. Telling you which <i>records</i> sit ' +
      'in your range needs a catalogue of songs with their ranges in it. There is no openly licensed ' +
      'one, the apps that do it keep their own private database, and this app does not take lyrics or ' +
      'audio from anywhere. So it is not built, rather than built badly.</div></div>';

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

  /* ---- the row in Profile ------------------------------------------ */
  function row() {
    var host = $('modeYou');
    if (!host) return;
    var v = R.get();
    if (!v) return;
    var d = $('rpRangeRow');
    var fresh = !d;
    if (fresh) {
      d = document.createElement('div');
      d.id = 'rpRangeRow';
      d.className = 'rp-card';
      d.style.cursor = 'pointer';
    }
    d.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<div><div class="rp-ttl">Your range</div>' +
      '<div class="rp-sub">' + esc(name(v.lo)) + '–' + esc(name(v.hi)) + ' · ' + (v.hi - v.lo) +
      ' semitones' + (v.by === 'preset' ? ' · picked, not measured'
                     : (v.at ? ' · measured ' + esc(when(v.at)) : '')) + '</div></div>' +
      '<div style="color:var(--ink-faint);font-size:20px">›</div></div>';
    if (fresh) {
      on(d, 'click', R.open);
      try { host.appendChild(d); } catch (e) {}
    }
  }
  setInterval(row, 1500);
  setTimeout(row, 1150);

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
