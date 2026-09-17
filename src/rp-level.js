/* ======================================================================
   Repertoire Pro — levels.

   Robert, 13 Sep: "do the levels and gamify the app through warm ups,
   exercises, trivia, and theory. Don't make it like too much, let's try to
   lean on the subtle side. That's not the main point of the app, it's just
   an additional subconscious psychological driver."

   ----------------------------------------------------------------------
   THE ONE DECISION THIS FILE RESTS ON
   ----------------------------------------------------------------------
   A level here is HOW MUCH YOU HAVE DONE. It is not how good you are.

   That distinction is the only reason this can exist in an app that has
   refused, everywhere else, to put a number on screen it did not measure.
   "How good are you" is a real question with a real answer and the app
   already has one — the placement test, which measures steadiness in per
   cent and pitch in cents. Inventing a second, vaguer answer and dressing
   it up as progress would be exactly the fake XP bar the to-do doc warned
   about in September.

   So: every single point below is a count of something that actually
   happened and is written down in the results table. Nothing is awarded
   for opening the app, for looking at a screen, or for "engagement". Tap
   the level and it shows you the arithmetic.

   ----------------------------------------------------------------------
   AND IT STAYS QUIET
   ----------------------------------------------------------------------
   Subtle was the instruction and subtle is the design: one small line on
   Home, one row in Profile, and a single toast on the day you actually
   move up. No bar filling on every tap, no confetti, no streak that
   scolds you for missing Tuesday. If somebody never looks at it, the app
   is unchanged.
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

  var L = window.RPLevel = {};

  /* ------------------------------------------------------------------ */
  /* WHAT A POINT IS WORTH                                               */
  /*                                                                     */
  /* These weights are judgements, not measurements, so they live in one */
  /* place where they can be argued with — same rule as the placement    */
  /* thresholds. The ordering is the argument: a day you turned up at    */
  /* all is worth more than any single drill, and a take you actually    */
  /* sent your coach is worth more than either, because it is the        */
  /* hardest thing to do and the easiest to avoid.                       */
  /* ------------------------------------------------------------------ */
  var WORTH = {
    practice: 10,     // a warm-up or exercise finished
    ear: 10,          // an ear drill run
    sustain: 10,      // a note held to the end
    star: 15,         // a theory star, counted at your best per game
    trivia: 5,        // the word of the day, right first time
    submitted: 25,    // a take sent to your coach
    day: 20           // any day you did something at all
  };

  /* Names for what you have put in, NOT for how well you sing. Nothing
     here claims an ability, because none of it measures one. */
  var NAMES = ['', 'Day one', 'Getting going', 'Turning up', 'Regular',
               'In the habit', 'Committed', 'Dedicated', 'Relentless'];
  var STEPS = [0, 60, 150, 300, 520, 820, 1200, 1700];

  function dayKey(d) {
    d = new Date(d);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ------------------------------------------------------------------ */
  /* the arithmetic, kept open                                           */
  /* ------------------------------------------------------------------ */
  L.count = function (studentId) {
    var uid = studentId || ((window.RP && RP.user) ? RP.user.id : null);
    var rs = (window.RP && RP.results ? RP.results : [])
      .filter(function (r) { return !uid || r.student_id === uid; });

    var n = { practice: 0, ear: 0, sustain: 0, trivia: 0 };
    var best = {}, days = {};
    rs.forEach(function (r) {
      if (r.kind === 'game') {
        if (r.score != null) best[r.label] = Math.max(best[r.label] || 0, r.score);
      } else if (n[r.kind] != null) {
        n[r.kind]++;
      }
      if (r.created_at) days[dayKey(r.created_at)] = true;
    });
    var stars = Object.keys(best).reduce(function (a, k) { return a + best[k]; }, 0);

    var submitted = (window.RP && RP.takes ? RP.takes : []).filter(function (t) {
      return (!uid || t.student_id === uid) && t.assignment_id;
    }).length;

    var dayCount = Object.keys(days).length;

    var lines = [
      { n: n.practice, worth: WORTH.practice, what: 'warm-up or exercise finished', each: 'warm-ups and exercises' },
      { n: n.ear,      worth: WORTH.ear,      what: 'ear drill',                    each: 'ear drills' },
      { n: n.sustain,  worth: WORTH.sustain,  what: 'note held to the end',         each: 'notes held' },
      { n: stars,      worth: WORTH.star,     what: 'theory star',                  each: 'theory stars' },
      { n: n.trivia,   worth: WORTH.trivia,   what: 'word of the day',              each: 'words of the day' },
      { n: submitted,  worth: WORTH.submitted,what: 'take sent to your coach',      each: 'takes sent to your coach' },
      { n: dayCount,   worth: WORTH.day,      what: 'day you practised',            each: 'days you practised' }
    ].filter(function (x) { return x.n > 0; });

    var points = lines.reduce(function (a, x) { return a + x.n * x.worth; }, 0);

    var lvl = 1;
    for (var i = 0; i < STEPS.length; i++) if (points >= STEPS[i]) lvl = i + 1;
    var name = NAMES[Math.min(lvl, NAMES.length - 1)] || 'Relentless';
    var next = STEPS[lvl] != null ? STEPS[lvl] : null;

    return {
      points: points, level: lvl, name: name,
      next: next, toGo: next == null ? null : next - points,
      lines: lines, days: dayCount
    };
  };

  /* A coach looking at a student wants this too — it is the one number that
     tells "cannot do it" apart from "has not been doing it". Same arithmetic,
     pointed at somebody else's results. */
  RP.levelFor = function (studentId) { return L.count(studentId); };

  /* ------------------------------------------------------------------ */
  /* the quiet part: notice a level change, say it once                  */
  /* ------------------------------------------------------------------ */
  function seen() {
    try { return +(localStorage.getItem('rp_level_seen') || 0); } catch (e) { return 0; }
  }
  function remember(l) {
    try { localStorage.setItem('rp_level_seen', String(l)); } catch (e) {}
  }
  L.checkMoved = function () {
    var c = L.count();
    var was = seen();
    if (!was) { remember(c.level); return; }        // first run: no fanfare
    if (c.level > was) {
      remember(c.level);
      try {
        if (window.RP && RP.toast) {
          RP.toast('Level ' + c.level + ' — ' + c.name + '. That is ' + c.points + ' points of work.');
        }
      } catch (e) {}
    } else if (c.level < was) {
      remember(c.level);                            // data cleared; no announcement
    }
  };

  /* ------------------------------------------------------------------ */
  /* the breakdown — the whole point of being allowed to do this at all  */
  /* ------------------------------------------------------------------ */
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

  L.open = function () {
    var c = L.count();
    var h = '<div class="rp-lab">LEVEL ' + c.level + '</div>' +
      '<b style="font-size:22px;display:block;margin-top:2px">' + esc(c.name) + '</b>' +
      '<div class="measured" style="margin-top:8px">This is <b>how much you have done</b>. ' +
      'It is not how good you are — that is the test, and it measures rather than counts.</div>';

    if (!c.lines.length) {
      h += '<div class="rp-empty" style="margin-top:14px">Nothing counted yet. Do a warm-up, an ear ' +
        'drill or the word of the day and it starts adding up.</div>';
    } else {
      h += '<div class="rp-lab" style="margin-top:18px">WHERE THE ' + c.points + ' CAME FROM</div>';
      c.lines.forEach(function (x) {
        h += '<div class="row" style="justify-content:space-between;align-items:baseline;' +
          'padding:7px 0;border-bottom:1px solid var(--line)">' +
          '<div style="font-size:13px"><b>' + x.n + '</b> ' +
          esc(x.n === 1 ? x.what : x.each) + '</div>' +
          '<div style="font-size:12px;color:var(--ink-dim)">' + x.n + ' × ' + x.worth +
          ' = <b style="color:var(--gold)">' + (x.n * x.worth) + '</b></div></div>';
      });
      h += '<div class="row" style="justify-content:space-between;margin-top:9px">' +
        '<b style="font-size:14px">Total</b>' +
        '<b style="font-size:14px;color:var(--gold)">' + c.points + '</b></div>';
    }

    if (c.next != null) {
      h += '<div class="measured" style="margin-top:14px">' + c.toGo + ' more and you are ' +
        esc(NAMES[Math.min(c.level + 1, NAMES.length - 1)]) + '.</div>';
    }

    h += '<div class="measured" style="margin-top:14px;font-size:11.5px">Every point above is a ' +
      'count of something you actually did and the app wrote down. Nothing is awarded for opening ' +
      'the app or looking at a screen.</div>';
    h += '<button class="btn" id="rpLvX" style="width:100%;padding:12px;margin-top:16px">Close</button>';
    sheet(h);
    on($('rpLvX'), 'click', shut);
  };

  /* ------------------------------------------------------------------ */
  /* where it shows: one line on Home, one row in Profile. That is all.  */
  /* ------------------------------------------------------------------ */
  function mountHome() {
    var host = $('modeHome');
    if (!host) return;
    var c = L.count();
    var d = $('rpLevelLine');
    var fresh = !d;
    if (fresh) {
      d = document.createElement('div');
      d.id = 'rpLevelLine';
      d.style.cssText = 'display:flex;align-items:center;gap:8px;margin:2px 0 12px;cursor:pointer;' +
        'font-size:12px;color:var(--ink-dim)';
    }
    d.innerHTML = '<span style="font-weight:900;color:var(--gold);font-size:12.5px">Level ' +
      c.level + '</span>' +
      '<span style="font-weight:700">' + esc(c.name) + '</span>' +
      '<span style="opacity:.6">· ' + c.points + ' points</span>' +
      '<span style="opacity:.6;margin-left:auto">' + (c.points ? 'what counts ›' : 'how points work ›') + '</span>';
    if (fresh) {
      on(d, 'click', L.open);
      try { host.insertBefore(d, host.firstChild); } catch (e) {}
    }
  }

  function mountProfile() {
    var host = $('modeYou');
    if (!host) return;
    var c = L.count();
    var d = $('rpLevelRow');
    var fresh = !d;
    if (fresh) {
      d = document.createElement('div');
      d.id = 'rpLevelRow';
      d.className = 'rp-card';
      d.style.cursor = 'pointer';
    }
    d.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<div style="flex:1;min-width:0"><div class="rp-ttl">Level ' + c.level + ' · ' + esc(c.name) + '</div>' +
      '<div class="rp-sub">' + c.points + ' points of work' +
      (c.toGo != null ? ' · ' + c.toGo + ' to the next' : '') + '</div></div>' +
      '<div style="color:var(--ink-faint);font-size:20px">›</div></div>';
    if (fresh) {
      on(d, 'click', L.open);
      try { host.appendChild(d); } catch (e) {}
    }
  }

  setInterval(function () { mountHome(); mountProfile(); }, 1500);
  setTimeout(function () { mountHome(); mountProfile(); L.checkMoved(); }, 1200);

  /* and after anything that could have earned a point */
  var lastPoints = -1;
  setInterval(function () {
    var p = L.count().points;
    if (p !== lastPoints) {
      lastPoints = p;
      mountHome(); mountProfile();
      L.checkMoved();
    }
  }, 3000);
})();
