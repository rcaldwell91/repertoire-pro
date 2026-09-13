/* ======================================================================
   Repertoire Pro — the walkthrough.

   Robert, 13 Sep: "I should not have to sit next to Briar or Ja Ronn and
   walk them through it. The app has to do that itself."

   Two things live here. THE TOUR: a ring around a real button on the real
   screen, an arrow, one sentence, Next. One idea per step. Skip is always
   on the card, the rest of the screen is never blocked — the dark part is
   click-through — and it comes back from Profile whenever you want. A
   singer and a coach get different tours, chosen by who is signed in.
   THE GUIDE: "How to use Repertoire", pictures of the real screens with
   arrows on them and short words underneath.

   Writing rule for every sentence in here: plain words a non-musician
   understands, and if it does not change what the reader does next, it
   is cut.
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
  function vis(el) { return !!(el && el.offsetParent !== null); }
  function signedIn() { try { return !!(window.RP && RP.user && RP.profile); } catch (e) { return false; } }
  function hasCoach() { try { return !!(window.RP && RP.coach); } catch (e) { return false; } }
  function isCoach() { try { return !!(window.RP && RP.isCoachFace && RP.isCoachFace()); } catch (e) { return false; } }
  function first(sel, root) {
    var list = (root || document).querySelectorAll(sel);
    for (var i = 0; i < list.length; i++) if (vis(list[i])) return list[i];
    return null;
  }

  var T = window.RPTour = {};

  /* ------------------------------------------------------------------ */
  /* THE STEPS. `find` returns the real element or null; `text` is the   */
  /* one sentence. `mode` is the tab it lives on.                        */
  /* ------------------------------------------------------------------ */
  var STUDENT = [
    /* Robert, 13 Sep: "walk me through what this app is for, what I get
       out of it, how to use it." The first and last cards answer the first
       two; everything between is the third. */
    { mode: 'home', find: null,
      text: 'Repertoire is a singing coach in your pocket: fifteen minutes a day, and your real coach\u2019s work when you have one.' },
    /* Nothing on the screen to point at for this one — it is about the
       thing in your hand, not a button — so it is a plain card, no ring. */
    { mode: 'home', find: null,
      text: 'Put headphones in first — through the speaker the app squeals.' },
    { mode: 'home', find: function () { return $('rpAccount'); },
      text: function () {
        return signedIn() ? 'Your account — your name, and where you sign out.'
                          : 'Make an account here so a coach can find you.';
      } },
    { mode: 'home', find: function () { return $('rpTodayGo') || $('btnJourney'); },
      text: 'Every day, press this — fifteen minutes, from whoever is coaching you.' },
    { mode: 'train', find: function () { return first('#rpTrainTop [data-exstart], #rpTrainTop [data-drill]'); },
      text: 'Want one thing? Pick what to work on up top, then Start.' },
    { mode: 'train', find: function () { return $('rpTileTracker'); },
      text: 'The Pitch Tracker draws the notes you sing as you sing them — and records a take.' },
    { mode: 'singhub', find: function () { return $('shFree'); },
      text: 'Free Sing is for fun — a bit of echo, something to watch, nothing measured or sent.' },
    { mode: 'coach', find: function () {
        return $('rpChannel') || $('rpCode') || first('#modeCoach .notice');
      },
      text: function () {
        if (hasCoach()) return 'What your coach sets you lands here — tap it, record, send the take you like.';
        return 'Got a coach? Their code goes in here, and what they set you shows up here.';
      } },
    { mode: 'you', find: function () { return first('#rpProfileTop [data-pg="voice"]'); },
      text: 'Your range lives here. Sing it once and every exercise fits your voice.' },
    { mode: 'you', find: function () { return first('#rpProfileTop [data-pg="help"]'); },
      text: 'Lost? This tour and a guide with pictures live here.' },
    { mode: 'home', find: null,
      text: 'What you get: do the fifteen minutes most days and the app keeps count — of the days, and of what you can do now that you could not.' }
  ];

  var COACH = [
    { mode: 'coach', find: function () { return first('#modeCoach .rp-sub b'); },
      text: 'Read this code to a student and you are paired.' },
    { mode: 'coach', find: function () { return $('rpAddStu'); },
      text: 'Or add them yourself, by email.' },
    { mode: 'coach', find: function () { return first('#modeCoach [data-stu]') || $('rpAddStu'); },
      text: function () {
        return first('#modeCoach [data-stu]')
          ? 'Tap a student to see their week and set them work.'
          : 'When a student joins they appear here — tap them to set work.';
      } },
    { mode: 'coach', find: function () { return first('#modeCoach [data-tab="inbox"]'); },
      text: 'Their takes and messages land here.' },
    { mode: 'coach', find: function () { return first('#modeCoach [data-tab="exercises"]'); },
      text: 'Your exercise set — edit it, or write your own.' },
    { mode: 'coach', find: function () { return $('rpToStudent'); },
      text: 'You are a singer too — your own practice is here.' }
  ];

  /* ------------------------------------------------------------------ */
  var run = null;   /* { steps, i, kind } while a tour is on */
  var KEY = { student: 'rp_tour_student', coach: 'rp_tour_coach' };
  function done(kind) { try { return localStorage.getItem(KEY[kind]) === 'done'; } catch (e) { return false; } }
  function markDone(kind) { try { localStorage.setItem(KEY[kind], 'done'); } catch (e) {} }
  T.done = done;

  function css() {
    if ($('rpTourCSS')) return;
    var s = document.createElement('style');
    s.id = 'rpTourCSS';
    s.textContent =
      '#rpTourDim{position:fixed;inset:0;z-index:640;pointer-events:none;}' +
      '#rpTourRing{position:absolute;border:2px solid var(--gold);border-radius:12px;' +
        'box-shadow:0 0 0 9999px rgba(0,0,0,.62);pointer-events:none;transition:all .18s ease;}' +
      '#rpTourArrow{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;}' +
      '#rpTourCard{position:fixed;left:14px;right:14px;z-index:641;background:var(--panel);' +
        'border:1px solid var(--gold);border-radius:16px;padding:14px 14px 12px;' +
        'box-shadow:0 12px 40px rgba(0,0,0,.5);pointer-events:auto;}' +
      '#rpTourCard .n{font-size:10.5px;font-weight:900;letter-spacing:1.5px;color:var(--ink-faint);}' +
      '#rpTourCard .t{font-size:15px;line-height:1.45;font-weight:700;margin-top:5px;}' +
      '#rpTourCard .b{display:flex;gap:8px;margin-top:12px;align-items:center;}' +
      '#rpTourCard .b .sk{background:none;border:0;color:var(--ink-dim);font-weight:700;' +
        'font-size:13px;padding:10px 6px;cursor:pointer;}' +
      '#rpTourCard .b .nx{margin-left:auto;padding:10px 18px;font-size:13.5px;}';
    document.head.appendChild(s);
  }

  function ensure() {
    css();
    if (!$('rpTourDim')) {
      var d = document.createElement('div');
      d.id = 'rpTourDim';
      d.innerHTML = '<div id="rpTourRing"></div>' +
        '<svg id="rpTourArrow"><defs><marker id="rpTourHead" markerWidth="8" markerHeight="8" ' +
        'refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--gold)"/></marker></defs>' +
        '<path id="rpTourLine" d="" stroke="var(--gold)" stroke-width="2.5" fill="none" ' +
        'marker-end="url(#rpTourHead)" stroke-linecap="round"/></svg>';
      document.body.appendChild(d);
      var c = document.createElement('div');
      c.id = 'rpTourCard';
      document.body.appendChild(c);
    }
  }

  function teardown() {
    var d = $('rpTourDim'), c = $('rpTourCard');
    if (d) d.parentElement.removeChild(d);
    if (c) c.parentElement.removeChild(c);
    window.removeEventListener('resize', relayout);
    window.removeEventListener('scroll', relayout, true);
    document.removeEventListener('click', onAnyClick, true);
    document.removeEventListener('keydown', onKey);
  }

  function end(kind) {
    if (run) markDone(run.kind);
    run = null;
    teardown();
  }
  T.stop = function () { end(); };

  function onKey(e) { if (e.key === 'Escape') end(); }
  function onAnyClick(e) {
    /* The dark part is click-through on purpose — the app is never
       blocked. If they tapped the app, the screen may have changed under
       us, so look again. */
    var c = $('rpTourCard');
    if (c && c.contains(e.target)) return;
    setTimeout(relayout, 320);
  }

  var layoutTimer = null;
  function relayout() {
    if (!run) return;
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(place, 40);
  }

  function step() { return run ? run.steps[run.i] : null; }

  function place() {
    var st = step();
    if (!st) return;
    var el = st.find ? st.find() : null;
    var ring = $('rpTourRing'), card = $('rpTourCard'), line = $('rpTourLine');
    if (!ring || !card) return;
    if (!el || !vis(el)) {
      /* the thing we point at is not on this screen any more (they tapped
         away) — hide the ring, keep the card, so Next still works */
      ring.style.display = 'none';
      line.setAttribute('d', '');
      card.style.top = '';
      card.style.bottom = '86px';
      return;
    }
    var r = el.getBoundingClientRect();
    var pad = 6;
    ring.style.display = 'block';
    ring.style.left = (r.left - pad) + 'px';
    ring.style.top = (r.top - pad) + 'px';
    ring.style.width = (r.width + pad * 2) + 'px';
    ring.style.height = (r.height + pad * 2) + 'px';

    /* card goes wherever the target is not */
    var H = window.innerHeight;
    var targetLow = (r.top + r.height / 2) > H * 0.5;
    card.style.top = targetLow ? '64px' : '';
    card.style.bottom = targetLow ? '' : '86px';

    var cr = card.getBoundingClientRect();
    var x1 = Math.min(Math.max(r.left + r.width / 2, cr.left + 30), cr.right - 30);
    var y1 = targetLow ? cr.bottom : cr.top;
    var x2 = r.left + r.width / 2;
    var y2 = targetLow ? r.top - pad - 4 : r.bottom + pad + 4;
    var midY = (y1 + y2) / 2;
    line.setAttribute('d', 'M' + x1 + ',' + y1 + ' C' + x1 + ',' + midY + ' ' + x2 + ',' + midY + ' ' + x2 + ',' + y2);
  }

  function show() {
    var st = step();
    if (!st) return end();
    ensure();
    var card = $('rpTourCard');
    var n = run.i + 1, total = run.steps.length;
    var text = typeof st.text === 'function' ? st.text() : st.text;
    card.innerHTML = '<div class="n">' + n + ' OF ' + total + '</div>' +
      '<div class="t">' + esc(text) + '</div>' +
      '<div class="b"><button class="sk" id="rpTourSkip">Skip the tour</button>' +
      '<button class="btn primary nx" id="rpTourNext">' + (n === total ? 'Done' : 'Next') + '</button></div>';
    on($('rpTourSkip'), 'click', function () { end(); });
    on($('rpTourNext'), 'click', function () { T.next(); });

    /* go to the right tab, let it draw, then point */
    try {
      var want = st.mode;
      var active = document.querySelector('.mode.active');
      var map = { home: 'modeHome', train: 'modeTrain', learn: 'modeLearn', singhub: 'modeSing',
                  coach: 'modeCoach', lib: 'modeLib', you: 'modeYou' };
      if (want && (!active || active.id !== map[want])) window.switchMode(want);
    } catch (e) {}
    setTimeout(function () {
      var el = st.find ? st.find() : null;
      if (el && vis(el)) { try { el.scrollIntoView({ block: 'center', behavior: 'instant' }); } catch (e) { el.scrollIntoView(); } }
      setTimeout(place, 60);
    }, 380);
  }

  T.next = function () {
    if (!run) return;
    run.i++;
    if (run.i >= run.steps.length) return end();
    show();
  };

  T.start = function (kind) {
    kind = kind || (isCoach() ? 'coach' : 'student');
    if (run) teardown();
    run = { kind: kind, steps: kind === 'coach' ? COACH : STUDENT, i: 0 };
    /* nothing in the way */
    try { var o = $('rpSheet'); if (o) { o.style.display = 'none'; o.innerHTML = ''; } } catch (e) {}
    ensure();
    window.addEventListener('resize', relayout);
    window.addEventListener('scroll', relayout, true);
    document.addEventListener('click', onAnyClick, true);
    document.addEventListener('keydown', onKey);
    show();
  };
  T.running = function () { return !!run; };

  /* ------------------------------------------------------------------ */
  /* WHEN IT STARTS ON ITS OWN                                           */
  /* Singer: first open, once the app is drawn and nothing else is up.   */
  /* Coach: the first time the Coach tab is open with the teaching side  */
  /* showing, after they switched teaching on.                           */
  /* ------------------------------------------------------------------ */
  var sheetUp = function () { var o = $('rpSheet'); return !!(o && o.style.display !== 'none' && o.innerHTML); };
  var ticks = 0;
  var auto = setInterval(function () {
    ticks++;
    if (run) return;
    if (ticks < 3) return;                        /* let the app finish drawing */
    if (sheetUp()) return;
    if (!done('student') && !isCoach()) { T.start('student'); return; }
    if (isCoach() && !done('coach')) {
      var m = $('modeCoach');
      if (m && m.classList.contains('active') && $('rpAddStu')) T.start('coach');
    }
  }, 700);

  /* ================================================================== */
  /* THE GUIDE — "How to use Repertoire"                                  */
  /* ================================================================== */
  function pic(file, alt) {
    return '<div style="margin-top:8px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel2)">' +
      '<img src="help/' + file + '" alt="' + esc(alt) + '" style="display:block;width:100%;height:auto" ' +
      'onerror="this.parentElement.innerHTML=\'<div class=measured style=padding:10px>The picture did not load — you are probably offline. The words below still apply.</div>\'">' +
      '</div>';
  }
  function sec(title, file, words) {
    return '<div style="margin-top:20px"><div class="rp-ttl" style="font-size:15px">' + esc(title) + '</div>' +
      pic(file, title) +
      '<div style="font-size:13.5px;line-height:1.55;margin-top:8px">' + words + '</div></div>';
  }

  T.help = function () {
    var o = $('rpSheet');
    if (!o) {
      o = document.createElement('div');
      o.id = 'rpSheet';
      o.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.7);' +
        'display:flex;align-items:flex-end;justify-content:center;overflow-y:auto';
      document.body.appendChild(o);
    }
    var coach = isCoach();
    var h = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<b style="font-size:19px">How to use Repertoire</b>' +
      '<button class="btn" id="rpHelpX" style="padding:7px 12px;font-size:12px">Close</button></div>' +
      '<div class="measured" style="margin-top:6px">Real pictures of the app, with the thing to press marked.</div>' +
      '<div class="row" style="gap:7px;margin-top:12px;flex-wrap:nowrap">' +
      '<button class="btn primary" id="rpHelpTour" style="flex:1;padding:11px;font-size:12.5px">Show me round</button>' +
      (coach ? '<button class="btn" id="rpHelpTourC" style="flex:1;padding:11px;font-size:12.5px">The coach tour</button>' : '') +
      '</div>';

    h += '<div class="rp-lab" style="margin-top:22px">FIRST TIME</div>';
    h += sec('1. Headphones in', '01-headphones.jpg',
      'Wired ones if you have them. Through the speaker the app hears itself and squeals. ' +
      'Then make an account with the button at the top right — a coach can only find you if you have one.');
    h += sec('2. Find your range', '02-range.jpg',
      'Profile, <b>Your voice</b>, <b>Test my range</b>. Sing your lowest comfortable note, then your highest. ' +
      'Every exercise from then on is built around what you sang. It is offered when you sign up.');

    h += '<div class="rp-lab" style="margin-top:22px">EVERY DAY</div>';
    h += sec('3. Today', '03-today.jpg',
      'Home. One button, about fifteen minutes. It says who set it — your coach, or Repertoire itself when nobody has.');
    h += sec('4. One exercise', '04-exercise.jpg',
      'Train tab. Pick what to work on and your level at the top, then <b>Start</b> on the one it gives you. ' +
      'Or tap a category for the whole list.');
    h += sec('5. See your notes', '13-tracker.jpg',
      'Train tab, <b>Pitch Tracker</b>. It draws every note you sing as you sing it, and can record a take with the notes kept.');
    h += sec('6. Sing something', '05-sing.jpg',
      'Sing tab, <b>Free Sing</b>. A bit of echo, something to watch. Nothing is scored, nothing is sent.');

    h += '<div class="rp-lab" style="margin-top:22px">WITH A COACH</div>';
    h += sec('7. Join your coach', '06-coach.jpg',
      'Coach tab. They read you a six-character code; you type it in and press <b>Join</b>. Or find them by what they teach.');
    h += sec('8. What they set you', '07-assignment.jpg',
      'It appears here the moment they set it. Tap it and the exercise opens, already set up.');
    h += sec('9. Record, then send the one you like', '08-record.jpg',
      '<b>Save</b> keeps a take on your phone. <b>Submit</b> sends it to your coach and ticks the work off. Nothing leaves your phone until you press Submit.');

    h += '<div class="rp-lab" style="margin-top:22px">GET THE MOST OUT OF IT</div>' +
      '<div class="rp-card" style="margin-top:8px;padding:12px;font-size:13.5px;line-height:1.6">' +
      '<b>Practise days, not minutes.</b> Ten minutes today and ten tomorrow beats an hour on Sunday. The app counts days.<br>' +
      '<b>Warm up before you sing.</b> The daily session does it for you. If you skip to a song, do a lip trill first.<br>' +
      '<b>Send a take to your coach.</b> One a week is plenty. Send the one you like, not the first one.<br>' +
      '<b>If people can hear you, use Quiet session.</b> Train tab. Hums, hisses and straws — nobody will know.</div>';

    if (coach) {
      h += '<div class="rp-lab" style="margin-top:22px">FOR COACHES</div>';
      h += sec('Your code and your students', '10-coach-students.jpg',
        'Read a student your code and they join themselves, or press <b>Add student</b> and use their email.');
      h += sec('Set them work', '11-coach-assign.jpg',
        'Tap a student, press <b>Assign</b>, pick any exercise, once or every day. It opens on their phone already set up.');
      h += sec('Their takes', '12-coach-inbox.jpg',
        'Inbox. Every take they submit, with the notes drawn on it, and their messages.');
    }

    h += '<button class="btn" id="rpHelpX2" style="width:100%;padding:12px;margin-top:18px">Close</button>';

    o.innerHTML = '<div style="background:var(--panel);border:1px solid var(--line);' +
      'border-radius:18px 18px 0 0;width:100%;max-width:560px;padding:20px 16px ' +
      'calc(24px + env(safe-area-inset-bottom,0px));max-height:96vh;overflow-y:auto">' + h + '</div>';
    o.style.display = 'flex';
    function shut() { o.style.display = 'none'; o.innerHTML = ''; }
    on($('rpHelpX'), 'click', shut);
    on($('rpHelpX2'), 'click', shut);
    on($('rpHelpTour'), 'click', function () { shut(); T.start('student'); });
    on($('rpHelpTourC'), 'click', function () { shut(); T.start('coach'); });
  };

  /* ---- the way in, from Profile ------------------------------------- */
  function row() {
    var host = $('modeYou');
    if (!host) return;
    var d = $('rpHelpRow');
    if (d) return;
    d = document.createElement('div');
    d.id = 'rpHelpRow';
    d.className = 'rp-card';
    d.style.cursor = 'pointer';
    d.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<div><div class="rp-ttl">Help — how to use Repertoire</div>' +
      '<div class="rp-sub">Show me round again, and a guide with pictures</div></div>' +
      '<div style="color:var(--ink-faint);font-size:20px">›</div></div>';
    on(d, 'click', T.help);
    host.appendChild(d);   /* rp-profile moves it into the Help page */
  }
  setInterval(row, 1500);
  setTimeout(row, 900);
})();
