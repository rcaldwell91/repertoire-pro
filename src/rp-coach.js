/* ======================================================================
   Repertoire Pro — the Coach tab, two faces.

   Student's face  = the AI coach already in v10.1, with your human coach's
                     channel sitting on top of it.
   Teacher's face  = Students · Exercises · Inbox.
   Which one you see depends on who is signed in.

   With nobody signed in this renders the v10.1 Coach tab untouched, plus a
   single line offering an account.
   ====================================================================== */
(function () {
  'use strict';
  var RP = window.RP;
  var V10 = window.V10;
  if (!RP || !V10 || !V10.renderCoach) return;

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function each(root, sel, fn) { if (root) root.querySelectorAll(sel).forEach(fn); }

  /* ---------------------------------------------------------------- */
  /* styles                                                            */
  /* ---------------------------------------------------------------- */
  (function css() {
    if ($('rpCSS')) return;
    var s = document.createElement('style');
    s.id = 'rpCSS';
    s.textContent =
      '.rp-inp{background:var(--panel2);border:1px solid var(--line);color:var(--ink);' +
      'border-radius:11px;padding:12px 12px;font-size:15px;font-family:inherit;width:100%;}' +
      '.rp-inp:focus{outline:0;border-color:var(--gold);}' +
      '.rp-lab{display:block;font-size:10.5px;font-weight:800;letter-spacing:.6px;' +
      'color:var(--ink-faint);margin:0 0 5px;}' +
      '.rp-card{background:var(--panel);border:1px solid var(--line);border-radius:13px;' +
      'padding:12px;margin-top:9px;}' +
      '.rp-card.hot{border-left:3px solid var(--gold);}' +
      '.rp-ttl{font-size:13.5px;font-weight:800;}' +
      '.rp-sub{font-size:11.5px;color:var(--ink-dim);margin-top:3px;line-height:1.45;}' +
      '.rp-seg{display:flex;gap:7px;margin:12px 0 4px;}' +
      '.rp-seg button{flex:1;padding:10px 6px;font-size:12.5px;font-weight:800;border-radius:11px;' +
      'border:1px solid var(--line);background:var(--panel);color:var(--ink-dim);cursor:pointer;font-family:inherit;}' +
      '.rp-seg button.on{background:var(--gold);border-color:var(--gold);color:#231a00;}' +
      '.rp-done{opacity:.55;}' +
      '.rp-tag{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.5px;' +
      'padding:2px 7px;border-radius:999px;background:var(--panel2);color:var(--ink-faint);margin-left:6px;}' +
      '.rp-empty{font-size:12.5px;color:var(--ink-faint);line-height:1.5;padding:14px 2px;}' +
      /* A coach brings his own colours. Ja Ronn: brown, gold and burnt orange,
         off the That \'70s FLOW poster. Scoped to the coach\'s side of the tab
         so the rest of the app keeps the Repertoire palette. */
      '.rp-brand{--gold:#e0a94a;--gold-deep:#a9691f;--accent:#c1521d;}' +
      '.rp-brand .rp-seg button.on{background:#c1521d;border-color:#c1521d;color:#fff;}' +
      '.rp-brand .rp-card.hot{border-left-color:#e0a94a;}' +
      '.rp-brand button.btn.primary{background:linear-gradient(135deg,#a9691f 0%,#c1521d 55%,#e0a94a 100%);color:#fff;}' +
      '.rp-brandbar{height:4px;border-radius:3px;margin:2px 0 10px;' +
        'background:linear-gradient(90deg,#6b3f1d 0%,#c1521d 48%,#e0a94a 100%);}';
    document.head.appendChild(s);
  })();

  /* ---------------------------------------------------------------- */
  /* small helpers                                                     */
  /* ---------------------------------------------------------------- */
  function sheet(html) {
    var o = $('rpSheet');
    if (!o) {
      o = document.createElement('div');
      o.id = 'rpSheet';
      o.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.62);' +
        'display:flex;align-items:flex-end;justify-content:center;overflow-y:auto';
      document.body.appendChild(o);
      on(o, 'click', function (e) { if (e.target === o) RP.closeSheet(); });
    }
    o.innerHTML = '<div style="background:var(--panel);border:1px solid var(--line);' +
      'border-radius:18px 18px 0 0;width:100%;max-width:560px;padding:18px 16px ' +
      'calc(22px + env(safe-area-inset-bottom,0px));max-height:94vh;overflow-y:auto">' + html + '</div>';
    o.style.display = 'flex';
    return o.firstChild;
  }
  function closeBtn(box) { on(box.querySelector('#rpX'), 'click', RP.closeSheet); }
  function fail(e) { RP.toast((e && e.message) ? e.message : String(e)); }
  function ago(iso) {
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
  /* The note line that travelled with the take. Same rule as the big chart:
     break the line where the voice was not there, rather than drawing a
     slide nobody sang. */
  function notesSvg(notes) {
    var pts = (notes || []).filter(function (p) { return p && p.m != null; });
    if (pts.length < 4) return '';
    var lo = Math.min.apply(null, pts.map(function (p) { return p.m; })) - 1;
    var hi = Math.max.apply(null, pts.map(function (p) { return p.m; })) + 1;
    if (hi - lo < 6) { var mid = (hi + lo) / 2; lo = mid - 3; hi = mid + 3; }
    var t1 = notes[notes.length - 1].t || 1;
    var W = 300, H = 64;
    var d = '', pen = false, prev = null;
    notes.forEach(function (p) {
      if (p.m == null) { pen = false; prev = null; return; }
      var x = (p.t / t1) * W;
      var y = H - ((p.m - lo) / (hi - lo)) * H;
      var leap = prev && Math.abs(p.m - prev.m) > 6;
      d += (!pen || leap ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
      pen = true; prev = p;
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" ' +
      'style="width:100%;height:64px;display:block;margin-top:8px;background:var(--panel2);' +
      'border-radius:8px"><path d="' + d + '" fill="none" stroke="var(--accent2)" ' +
      'stroke-width="2" stroke-linejoin="round"/></svg>';
  }

  function noteRange(notes) {
    var pts = (notes || []).filter(function (p) { return p && p.m != null; });
    if (!pts.length) return '';
    var lo = Math.round(Math.min.apply(null, pts.map(function (p) { return p.m; })));
    var hi = Math.round(Math.max.apply(null, pts.map(function (p) { return p.m; })));
    var nm = function (m) {
      try { return V10.midiName ? V10.midiName(m) : (window.midiName ? midiName(m) : m); }
      catch (e) { return m; }
    };
    return nm(lo) + ' to ' + nm(hi);
  }

  function nameOf(id) {
    if (RP.profile && RP.profile.id === id) return 'You';
    if (RP.coach && RP.coach.id === id) return RP.coach.display_name;
    var s = RP.students.find(function (x) { return x.id === id; });
    return s ? s.display_name : 'Someone';
  }

  /* ================================================================ */
  /* STUDENT'S FACE — the coach's channel, above the AI coach          */
  /* ================================================================ */
  function studentChannel() {
    var coach = RP.coach;
    var mine = RP.assignments.filter(function (a) { return a.student_id === RP.user.id; });
    var open = mine.filter(function (a) { return !a.done_at; });
    var done = mine.filter(function (a) { return a.done_at; });

    var h = '<div class="panel rp-brand" style="margin-bottom:14px;border-left:3px solid #e0a94a">' +
      '<div class="rp-brandbar"></div>';
    if (!coach) {
      h += '<b style="font-size:15px">Your coach</b>' +
        '<div class="rp-sub" style="margin-top:6px">Got a coach? Ask them for their code and put it in ' +
        'here. Six letters and numbers.</div>' +
        '<div class="row" style="margin-top:10px;gap:7px;flex-wrap:nowrap">' +
        '<input id="rpCode" class="rp-inp" placeholder="ABC123" maxlength="6" autocapitalize="characters" ' +
        'autocomplete="off" spellcheck="false" style="flex:1;letter-spacing:3px;font-weight:800;text-transform:uppercase">' +
        '<button class="btn primary" id="rpCodeGo" style="padding:11px 15px">Join</button></div>' +
        '<div id="rpCodeMsg" class="measured" style="margin-top:8px"></div>' +
        '<div class="measured" style="margin-top:10px">No coach? Everything below is yours anyway — the ' +
        'app coaches you itself.</div>';
      h += '</div>';
      return h;
    }
    h += weekCss();
    h += '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<b style="font-size:15px">From ' + esc(coach.display_name) + '</b>' +
      '<span class="rp-sub" style="margin:0">' + (open.length ? open.length + ' to do' : 'all done') +
      '</span></div>';

    h += weekStrip(RP.user.id);

    if (pickedDay) {
      /* ONE DAY. What you are supposed to do today, and nothing else. */
      var dl = dueOn(new Date(pickedDay + 'T12:00:00'), RP.user.id);
      var isToday = pickedDay === dkey(new Date());
      h += '<div class="rp-lab" style="margin-top:14px">' +
        (isToday ? 'TODAY' : dayLabel(pickedDay)) + '</div>';
      if (!dl.length) {
        h += '<div class="rp-empty">Nothing set for that day.</div>';
      } else {
        dl.forEach(function (x) {
          h += x.done && !isToday ? doneCard(x.a, pickedDay) : assignmentCard(x.a, pickedDay);
        });
      }
      h += '<button class="btn" data-day="' + esc(pickedDay) + '" ' +
        'style="width:100%;padding:10px;margin-top:10px;font-size:12px">Show the whole week</button>';
    } else {
      if (!open.length && !done.length) {
        h += '<div class="rp-empty">Nothing assigned yet. When ' + esc(coach.display_name) +
          ' sets something on his phone it lands here — you will not need to refresh.</div>';
      }
      open.forEach(function (a) { h += assignmentCard(a, null); });
      if (done.length) {
        h += '<div class="rp-lab" style="margin-top:14px">DONE</div>';
        done.slice(0, 6).forEach(function (a) { h += doneCard(a, null); });
      }
    }

    if (RP.scorecardHTML) h += RP.scorecardHTML(RP.user.id, 'you');

    var inbox = RP.messages.filter(function (m) { return m.from_id === coach.id || m.to_id === coach.id; });
    h += '<div class="rp-lab" style="margin-top:16px">MESSAGES</div>';
    if (!inbox.length) h += '<div class="rp-empty" style="padding:6px 2px">Nothing yet.</div>';
    inbox.slice(0, 8).forEach(function (m) {
      h += '<div class="rp-card"><div class="rp-sub" style="margin:0"><b>' + esc(nameOf(m.from_id)) +
        '</b> · ' + ago(m.created_at) + '</div><div style="font-size:13px;margin-top:4px">' +
        esc(m.body) + '</div></div>';
    });
    h += '<div class="row" style="margin-top:10px;gap:7px;flex-wrap:nowrap">' +
      '<input id="rpMsgIn" class="rp-inp" placeholder="Message ' + esc(coach.display_name) + '" style="flex:1">' +
      '<button class="btn primary" id="rpMsgGo" style="padding:11px 14px">Send</button></div>';
    h += '</div>';
    return h;
  }

  /* ================================================================ */
  /* THE WEEK                                                          */
  /*                                                                   */
  /* Robert, 12 Sep: "when you open up the calendar, it just shows a   */
  /* week at a time. It can either show the day — what you're supposed */
  /* to do the day — or the week at a time so you can see what your    */
  /* progress is for that week."                                       */
  /*                                                                   */
  /* A DAILY assignment is due every day from the day it was set. A    */
  /* ONE-OFF is due on the day it was set and stays due until it is    */
  /* done. Whether a day was done is NOT a stored flag — it is read    */
  /* off the takes actually submitted that day. So the week can only   */
  /* ever show work that really happened, which is the same rule as    */
  /* everything else in here.                                          */
  /* ================================================================ */
  var weekOffset = 0;       // 0 = this week, -1 = last week
  var pickedDay = null;     // yyyy-mm-dd, or null for "the whole week"

  function dkey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }
  function startOfWeek(off) {
    var n = new Date();
    n.setHours(0, 0, 0, 0);
    n.setDate(n.getDate() - n.getDay() + (off * 7));   // Sunday-first, as the app already draws it
    return n;
  }
  function weekDays(off) {
    var s0 = startOfWeek(off), out = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(s0.getTime());
      d.setDate(s0.getDate() + i);
      out.push(d);
    }
    return out;
  }

  /* every take this student has submitted, by the day it was submitted */
  function submittedOn(dayK, assignmentId) {
    return (RP.takes || []).some(function (t) {
      return t.assignment_id === assignmentId && dkey(new Date(t.created_at)) === dayK;
    });
  }

  /* what is due on one day, for one student */
  function dueOn(d, studentId) {
    var k = dkey(d);
    var today = dkey(new Date());
    var future = k > today;
    return (RP.assignments || []).filter(function (a) {
      if (a.student_id !== studentId) return false;
      var made = dkey(new Date(a.created_at));
      if (made > k) return false;                       // not set yet on that day
      if (a.cadence === 'daily') return !a.done_at || dkey(new Date(a.done_at)) >= k;
      if (a.done_at) return made === k || dkey(new Date(a.done_at)) === k;
      return made === k || (k === today);               // still open: sits on today too
    }).map(function (a) {
      return { a: a, done: a.cadence === 'daily'
        ? submittedOn(k, a.id)
        : (!!a.done_at && dkey(new Date(a.done_at)) <= k), future: future };
    });
  }

  /* One source of truth for "how much of this week is done", so the week
     strip and the scorecard cannot disagree with each other on the same
     screen — which they did: the strip said 2 of 2 and the card said 1 of 2,
     because the card was counting assignments that are FINISHED FOREVER and a
     daily one never is. Both now count days of work due and days done. */
  RP.weekProgress = function (studentId, offset) {
    var today = dkey(new Date()), due = 0, done = 0;
    weekDays(offset == null ? weekOffset : offset).forEach(function (d) {
      if (dkey(d) > today) return;         // days that have not happened are not owed
      var l = dueOn(d, studentId);
      due += l.length;
      done += l.filter(function (x) { return x.done; }).length;
    });
    return { due: due, done: done };
  };

  /* how many days of a daily assignment this week actually happened */
  RP.dailyDays = function (assignment) {
    var today = dkey(new Date()), due = 0, done = 0;
    weekDays(weekOffset).forEach(function (d) {
      var k = dkey(d);
      if (k > today) return;
      if (dkey(new Date(assignment.created_at)) > k) return;
      due++;
      if (submittedOn(k, assignment.id)) done++;
    });
    return { due: due, done: done };
  };

  function weekStrip(studentId) {
    var days = weekDays(weekOffset);
    var today = dkey(new Date());
    var h = '<div class="rp-wk">';
    days.forEach(function (d) {
      var k = dkey(d);
      var list = dueOn(d, studentId);
      var done = list.filter(function (x) { return x.done; }).length;
      var cls = 'rp-wd';
      if (k === today) cls += ' today';
      if (pickedDay === k) cls += ' picked';
      if (list.length && done === list.length) cls += ' all';
      else if (done) cls += ' some';
      h += '<button class="' + cls + '" data-day="' + k + '">' +
        '<span class="rp-wdn">' + 'SMTWTFS'[d.getDay()] + '</span>' +
        '<span class="rp-wdd">' + d.getDate() + '</span>' +
        '<span class="rp-wdc">' + (list.length ? done + '/' + list.length : '\u00b7') + '</span>' +
        '</button>';
    });
    h += '</div>';

    var total = 0, got = 0;
    days.forEach(function (d) {
      if (dkey(d) > today) return;                      // do not count days that have not happened
      var l = dueOn(d, studentId);
      total += l.length;
      got += l.filter(function (x) { return x.done; }).length;
    });
    h += '<div class="row" style="justify-content:space-between;align-items:center;margin-top:8px">' +
      '<button class="btn" data-wk="-1" style="padding:6px 10px;font-size:11.5px">\u2039 Last week</button>' +
      '<div class="rp-sub" style="margin:0;text-align:center;flex:1">' +
      (total ? got + ' of ' + total + ' done so far this week' : 'Nothing set for this week yet') +
      '</div>' +
      (weekOffset < 0
        ? '<button class="btn" data-wk="1" style="padding:6px 10px;font-size:11.5px">This week \u203a</button>'
        : '<span style="width:64px"></span>') +
      '</div>';
    return h;
  }

  function weekCss() {
    if ($('rpWkCss')) return '';
    return '<style id="rpWkCss">' +
      '.rp-wk{display:flex;gap:4px;margin-top:10px}' +
      '.rp-wd{flex:1;min-width:0;background:var(--panel2);border:1px solid var(--line);' +
      'border-radius:9px;padding:7px 2px;display:flex;flex-direction:column;align-items:center;' +
      'gap:2px;cursor:pointer;color:var(--ink-dim)}' +
      '.rp-wd.today{border-color:var(--gold)}' +
      '.rp-wd.picked{background:var(--gold);color:#1a1207}' +
      '.rp-wd.some{color:var(--gold)}' +
      '.rp-wd.all{color:var(--hit)}' +
      '.rp-wd.picked.some,.rp-wd.picked.all{color:#1a1207}' +
      '.rp-wdn{font-size:9.5px;font-weight:800;letter-spacing:.5px;opacity:.75}' +
      '.rp-wdd{font-size:14px;font-weight:900;color:var(--ink)}' +
      '.rp-wd.picked .rp-wdd{color:#1a1207}' +
      '.rp-wdc{font-size:9px;font-weight:800}' +
      '</style>';
  }

  function wireWeek(host, onChange) {
    each(host, '[data-day]', function (b) {
      on(b, 'click', function () {
        pickedDay = (pickedDay === b.dataset.day) ? null : b.dataset.day;
        onChange();
      });
    });
    each(host, '[data-wk]', function (b) {
      on(b, 'click', function () {
        weekOffset += (+b.dataset.wk);
        if (weekOffset > 0) weekOffset = 0;
        pickedDay = null;
        onChange();
      });
    });
  }

  function dayLabel(k) {
    var d = new Date(k + 'T12:00:00');
    return ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][d.getDay()] +
      ' ' + d.getDate();
  }

  function doneCard(a, dayK) {
    var kept = window.RPWork ? RPWork.takesFor(a.id) : [];
    if (dayK) kept = kept.filter(function (t) { return dkey(new Date(t.addedAt || Date.now())) === dayK; });
    var h = '<div class="rp-card rp-done"><div class="rp-ttl">' + esc(a.title) +
      '<span class="rp-tag">' + (a.cadence === 'daily' ? 'done that day' : ago(a.done_at)) + '</span></div>';
    /* Ticking it off must not make your own recordings disappear. They are
       yours; the card is just where they live. */
    kept.forEach(function (t) {
      h += '<div class="row" style="gap:6px;margin-top:7px;flex-wrap:nowrap;align-items:center">' +
        '<div style="flex:1;min-width:0;font-size:12px;font-weight:700;white-space:nowrap;' +
        'overflow:hidden;text-overflow:ellipsis">' + esc(t.title) +
        (t.sentAt ? ' \u00b7 submitted' : '') + '</div>' +
        '<button class="btn" data-ahear="' + esc(t.id) + '" style="padding:6px 10px;font-size:11.5px">Listen</button>' +
        '<button class="btn" data-adl="' + esc(t.id) + '" style="padding:6px 10px;font-size:11.5px">Save</button>' +
        '</div>';
    });
    return h + '</div>';
  }

  /* ------------------------------------------------------------------ */
  /* ONE ASSIGNMENT = ONE CARD, with its own takes on it.                */
  /*                                                                      */
  /* Robert: "it's its own thing and has a take that's attached to that.  */
  /* So I'm not recording an individual take and then now trying to       */
  /* assign... when I submit it, select the assignment."                  */
  /*                                                                      */
  /* Which is why there is no assignment picker anywhere in here. You     */
  /* open the card, it puts you in the exercise the coach chose, and      */
  /* every take you save while you are there is already this card's.      */
  /* ------------------------------------------------------------------ */
  function assignmentCard(a, dayK) {
    var ex = null;
    try { ex = a.app_ex_id && V10.exById ? V10.exById(a.app_ex_id) : null; } catch (e) {}
    var mine = window.RPWork ? RPWork.takesFor(a.id) : [];
    var working = !!(window.RPWork && RPWork.current && RPWork.current.id === a.id);
    var daily = a.cadence === 'daily';
    var todayK = dkey(new Date());
    var sentToday = daily && submittedOn(dayK || todayK, a.id);

    var h = '<div class="rp-card hot"><div class="rp-ttl">' + esc(a.title) +
      (daily ? '<span class="rp-tag">every day</span>' : '') +
      (sentToday ? '<span class="rp-tag">sent</span>' : '') +
      (working ? '<span class="rp-tag">doing it now</span>' : '') + '</div>';
    if (a.note) h += '<div class="rp-sub">' + esc(a.note) + '</div>';
    if (ex) {
      h += '<div class="rp-sub" style="margin-top:4px">Opens ' + esc(ex.name) +
        (ex.syl ? ' on <b>' + esc(ex.syl) + '</b>' : '') + '.</div>';
    } else {
      h += '<div class="rp-sub" style="margin-top:4px">' + esc(coachName()) +
        ' wrote this one out — there is no exercise screen for it, so record it as you do it.</div>';
    }

    if (daily) {
      h += '<div class="rp-sub" style="margin-top:4px">' +
        (sentToday ? 'Sent for this day. Do it again if you want — only the day counts.'
                   : 'Every day. Sending one take ticks off that day, not the whole thing.') +
        '</div>';
    }

    h += '<button class="btn primary" data-work="' + esc(a.id) + '" ' +
      'style="width:100%;padding:11px;margin-top:9px">' +
      (working ? 'Back to it' : (mine.length ? 'Have another go' : 'Do it')) + '</button>';

    if (mine.length) {
      h += '<div class="rp-lab" style="margin-top:12px">YOUR TAKES · ON THIS PHONE</div>';
      mine.forEach(function (t) {
        var svg = (t.notes && t.notes.length && window.RPStudio && RPStudio.lineHtml)
          ? RPStudio.lineHtml(t.notes, t.id) : '';
        h += '<div class="rp-card" style="padding:10px;margin-top:7px">' +
          '<div class="rp-ttl" style="font-size:13px">' + esc(t.title) +
          (t.sentAt ? '<span class="rp-tag">submitted</span>' : '') + '</div>' +
          svg +
          '<div class="row" style="gap:6px;margin-top:7px;flex-wrap:nowrap">' +
          '<button class="btn" data-ahear="' + esc(t.id) + '" style="flex:1;padding:8px;font-size:12px">Listen</button>' +
          '<button class="btn" data-adl="' + esc(t.id) + '" style="flex:1;padding:8px;font-size:12px">Download</button>' +
          (t.sentAt
            ? '<button class="btn" disabled style="flex:1;padding:8px;font-size:12px;opacity:.55">Sent</button>'
            : '<button class="btn primary" data-asub="' + esc(t.id) + '" style="flex:1;padding:8px;font-size:12px">Submit</button>') +
          '</div></div>';
      });
      h += '<div class="measured" style="margin-top:8px;font-size:11.5px">Saved takes stay on your ' +
        'phone whether you submit them or not. Submitting sends that one take to ' + esc(coachName()) +
        (daily ? ' and ticks off that day.' : ' and ticks this off.') + '</div>';
    }

    h += '</div>';
    return h;
  }

  function coachName() { return (RP.coach && RP.coach.display_name) || 'Your coach'; }

  function findMyTake(id) {
    try {
      return (LIB.songs || []).find(function (s) { return s.id === id; });
    } catch (e) { return null; }
  }

  function wireAssignmentCards(host) {
    each(host, '[data-work]', function (b) {
      on(b, 'click', function () {
        var a = (RP.assignments || []).find(function (x) { return x.id === b.dataset.work; });
        if (!a) return;
        if (!window.RPWork) return fail(new Error('The assignment recorder did not load.'));
        RPWork.open(a);
      });
    });
    each(host, '[data-ahear]', function (b) {
      on(b, 'click', function () {
        var t = findMyTake(b.dataset.ahear);
        if (!t) return;
        try {
          if (wireAssignmentCards._a) { wireAssignmentCards._a.pause(); URL.revokeObjectURL(wireAssignmentCards._u); }
          wireAssignmentCards._u = URL.createObjectURL(t.blob);
          var au = new Audio(wireAssignmentCards._u);
          wireAssignmentCards._a = au;
          au.play().catch(function () { RP.toast('The phone would not play it.'); });
          var svg = host.querySelector('[data-pl="' +
            (window.CSS && CSS.escape ? CSS.escape(t.id) : t.id) + '"]');
          if (svg && window.RPStudio && RPStudio.followLine) RPStudio.followLine(svg, au);
        } catch (e) { RP.toast('Could not play that one.'); }
      });
    });
    each(host, '[data-adl]', function (b) {
      on(b, 'click', function () {
        var t = findMyTake(b.dataset.adl);
        if (t && window.RPSend) RPSend.download(t);
      });
    });
    each(host, '[data-asub]', function (b) {
      on(b, 'click', async function () {
        var t = findMyTake(b.dataset.asub);
        if (!t) return;
        if (!window.RPSend) return fail(new Error('The send layer did not load.'));
        b.disabled = true; b.textContent = 'Sending…';
        var okd = await RPSend.send(t, '', null, t.assignId);
        if (!okd) { b.disabled = false; b.textContent = 'Submit'; }
        RP.refresh();
      });
    });
  }

  function wireStudentChannel(host) {
    wireAssignmentCards(host);
    wireWeek(host, function () { if (RP.rerender) RP.rerender(); });
    on($('rpCodeGo'), 'click', joinByCode);
    on($('rpCode'), 'keydown', function (e) { if (e.key === 'Enter') joinByCode(); });
    on($('rpMsgGo'), 'click', function () {
      var i = $('rpMsgIn');
      var body = (i.value || '').trim();
      if (!body || !RP.coach) return;
      i.value = '';
      RP.sb.from('messages').insert({ from_id: RP.user.id, to_id: RP.coach.id, body: body })
        .then(function (r) { r.error ? fail(r.error) : RP.refresh(); });
    });
    on($('rpMsgIn'), 'keydown', function (e) { if (e.key === 'Enter') $('rpMsgGo').click(); });
  }

  function joinByCode() {
    var i = $('rpCode'), m = $('rpCodeMsg');
    var code = (i.value || '').trim().toUpperCase();
    if (code.length < 6) { m.textContent = 'It is six characters.'; m.style.color = 'var(--miss)'; return; }
    m.textContent = 'Checking…'; m.style.color = 'var(--ink-dim)';
    $('rpCodeGo').disabled = true;
    RP.sb.rpc('join_with_code', { p_code: code }).then(function (r) {
      $('rpCodeGo').disabled = false;
      if (r.error) {
        m.textContent = /did not match/.test(r.error.message)
          ? 'That code did not match a coach. Check it and try again.' : r.error.message;
        m.style.color = 'var(--miss)';
        return;
      }
      RP.toast(r.data + ' is now your coach.');
      RP.refresh();
    });
  }

  /* ================================================================ */
  /* TEACHER'S FACE                                                    */
  /* ================================================================ */
  var tab = 'students';
  var openStudent = null;

  function renderTeacher() {
    var host = $('modeCoach');
    if (!host) return;
    var me = RP.profile;

    var h = '<div class="rp-brandbar"></div>' +
      '<div class="row" style="justify-content:space-between;align-items:flex-start">' +
      '<div><h1 style="margin:0 0 2px">Coach</h1>' +
      '<div class="rp-sub" style="margin:0">' + esc(me.display_name) +
      (me.coach_code ? ' · code <b style="letter-spacing:2px;color:var(--gold)">' +
        esc(me.coach_code) + '</b>' : '') + '</div></div>' +
      '<button class="btn" id="rpToStudent" style="padding:7px 11px;font-size:12px">My practice</button></div>';

    h += '<div class="rp-seg">' +
      '<button data-tab="students" class="' + (tab === 'students' ? 'on' : '') + '">Students</button>' +
      '<button data-tab="exercises" class="' + (tab === 'exercises' ? 'on' : '') + '">Exercises</button>' +
      '<button data-tab="inbox" class="' + (tab === 'inbox' ? 'on' : '') + '">Inbox' +
      (RP.takes.length ? '<span class="rp-tag">' + RP.takes.length + '</span>' : '') + '</button></div>';

    if (tab === 'students') h += openStudent ? studentDetail() : studentList();
    else if (tab === 'exercises') h += exerciseList();
    else h += inbox();

    host.innerHTML = h;
    host.classList.add('rp-brand');

    each(host, '[data-tab]', function (b) {
      on(b, 'click', function () { tab = b.dataset.tab; openStudent = null; renderTeacher(); });
    });
    on($('rpToStudent'), 'click', function () {
      RP.face = 'student';
      try { localStorage.setItem('rp_face', 'student'); } catch (e) {}
      V10.renderCoach();
      RP.toast('Student view. Switch back from your name in the header.');
    });

    if (tab === 'students') openStudent ? wireStudentDetail(host) : wireStudentList(host);
    else if (tab === 'exercises') wireExercises(host);
    else wireInbox(host);
  }

  /* ---- students ---- */
  function studentList() {
    var h = '<div class="row" style="justify-content:space-between;align-items:center;margin-top:12px">' +
      '<b style="font-size:14px">Your students</b>' +
      '<button class="btn primary" id="rpAddStu" style="padding:8px 13px;font-size:12.5px">Add student</button></div>';
    if (!RP.students.length) {
      h += '<div class="rp-empty">Nobody yet. ' +
        ((RP.profile || {}).coach_code
          ? 'Read a student your code — <b style="letter-spacing:2px;color:var(--gold)">' +
            esc(RP.profile.coach_code) + '</b> — and they join themselves, or tap <b>Add student</b>.'
          : 'Tap <b>Add student</b> to take someone on.') + '</div>';
      return h;
    }
    RP.students.forEach(function (s) {
      var mine = RP.assignments.filter(function (a) { return a.student_id === s.id; });
      var open = mine.filter(function (a) { return !a.done_at; }).length;
      h += '<div class="rp-card" data-stu="' + esc(s.id) + '" style="cursor:pointer">' +
        '<div class="row" style="justify-content:space-between;align-items:center">' +
        '<div><div class="rp-ttl">' + esc(s.display_name) + '</div>' +
        '<div class="rp-sub">' + open + ' open · ' + (mine.length - open) + ' done' +
        (RP.scorecard ? ' · ' + RP.scorecard(s.id).daysThisWeek + '/7 days' : '') + '</div></div>' +
        '<div style="color:var(--ink-faint);font-size:20px">›</div></div></div>';
    });
    return h;
  }
  function wireStudentList(host) {
    each(host, '[data-stu]', function (c) {
      on(c, 'click', function () { openStudent = c.dataset.stu; renderTeacher(); });
    });
    on($('rpAddStu'), 'click', addStudentSheet);
  }

  function addStudentSheet() {
    var h = '<b style="font-size:16px">Add a student</b>' +
      '<div class="measured" style="margin-top:6px">' +
      ((RP.profile || {}).coach_code
        ? 'Or just read them your code — <b style="letter-spacing:2px">' +
          esc(RP.profile.coach_code) + '</b> — and they join themselves. '
        : '') +
      'Everyone who has signed up:</div><div id="rpStuList" class="rp-empty">Loading…</div>' +
      '<button class="btn" id="rpX" style="width:100%;padding:11px;margin-top:10px">Close</button>';
    var box = sheet(h);
    closeBtn(box);
    RP.sb.from('profiles').select('*').order('created_at')
      .then(function (r) {
        var have = RP.students.map(function (s) { return s.id; });
        var list = (r.data || []).filter(function (p) { return have.indexOf(p.id) < 0 && p.id !== RP.user.id; });
        var el = $('rpStuList');
        if (!el) return;
        if (!list.length) {
          el.innerHTML = 'Nobody new. Everyone who has signed up is already on your list.';
          return;
        }
        el.className = '';
        el.innerHTML = list.map(function (p) {
          return '<div class="rp-card" data-add="' + esc(p.id) + '" style="cursor:pointer">' +
            '<div class="rp-ttl">' + esc(p.display_name) + '</div>' +
            '<div class="rp-sub">' + esc(p.email) + '</div></div>';
        }).join('');
        each(el, '[data-add]', function (c) {
          on(c, 'click', function () {
            c.style.opacity = '.5';
            RP.sb.from('coach_students').insert({ coach_id: RP.user.id, student_id: c.dataset.add })
              .then(function (r2) {
                if (r2.error) { c.style.opacity = ''; return fail(r2.error); }
                RP.closeSheet(); RP.toast('Added'); RP.refresh();
              });
          });
        });
      });
  }

  function studentDetail() {
    var s = RP.students.find(function (x) { return x.id === openStudent; });
    if (!s) { openStudent = null; return studentList(); }
    var mine = RP.assignments.filter(function (a) { return a.student_id === s.id; });
    var takes = RP.takes.filter(function (t) { return t.student_id === s.id; });

    var h = '<div class="row" style="justify-content:space-between;align-items:center;margin-top:12px">' +
      '<button class="btn" id="rpBack" style="padding:7px 11px;font-size:12px">‹ Students</button>' +
      '<button class="btn primary" id="rpAssign" style="padding:8px 13px;font-size:12.5px">Assign</button></div>';
    h += '<h2 style="margin:12px 0 2px;font-size:19px">' + esc(s.display_name) + '</h2>';
    h += '<div class="rp-sub" style="margin:0 0 4px">' + esc(s.email) + '</div>';

    // How they answered on first open. This is the most useful thing on the
    // screen before he has met them: it tells him how to talk to them.
    var W = { plain: 'Music words lose them — keep it plain.',
              some: 'Knows some music words.',
              technical: 'Comfortable with the proper terms.' };
    var E = { 1: 'New to singing', 2: 'Has sung a bit', 3: 'Has sung a lot' };
    if (s.words || s.experience) {
      h += '<div class="rp-card hot" style="margin-top:12px;padding:11px">' +
        '<div class="rp-lab">HOW TO TALK TO THEM</div>' +
        '<div class="rp-ttl" style="font-weight:700;font-size:13px">' +
        esc(E[s.experience] || '') + '. ' + esc(W[s.words] || '') + '</div>' +
        '<div class="rp-sub">Their own answer when they opened the app.</div></div>';
    }

    h += '<div class="rp-lab" style="margin-top:16px">THIS WEEK</div>';
    if (!mine.length) h += '<div class="rp-empty" style="padding:6px 2px">Nothing set yet.</div>';
    mine.forEach(function (a) {
      /* A daily assignment never gets a tick, so showing one would be a
         tick that never comes. Show the days instead — that is the thing
         Ja Ronn actually wants to know. */
      var dd = (a.cadence === 'daily' && RP.dailyDays) ? RP.dailyDays(a) : null;
      h += '<div class="rp-card' + (a.done_at ? ' rp-done' : ' hot') + '">' +
        '<div class="row" style="justify-content:space-between;align-items:flex-start">' +
        '<div style="flex:1;min-width:0"><div class="rp-ttl">' + esc(a.title) +
        (a.cadence === 'daily' ? '<span class="rp-tag">every day</span>' : '') +
        (a.done_at ? '<span class="rp-tag">done</span>' : '') + '</div>' +
        (dd ? '<div class="rp-sub" style="margin:3px 0 0"><b>' + dd.done + ' of ' + dd.due +
              '</b> day' + (dd.due === 1 ? '' : 's') + ' this week</div>' : '') +
        (a.note ? '<div class="rp-sub">' + esc(a.note) + '</div>' : '') + '</div>' +
        '<button class="btn" data-drop="' + esc(a.id) + '" style="padding:6px 10px;font-size:11.5px">Drop</button>' +
        '</div></div>';
    });

    if (RP.scorecardHTML) h += RP.scorecardHTML(s.id, 'them');

    h += '<div class="rp-lab" style="margin-top:18px">TAKES</div>';
    if (!takes.length) h += '<div class="rp-empty" style="padding:6px 2px">None sent yet.</div>';
    takes.slice(0, 10).forEach(function (t) {
      h += '<div class="rp-card"><div class="rp-ttl">' + esc(t.title) +
        '<span class="rp-tag">' + ago(t.created_at) + '</span></div>' +
        (t.note ? '<div class="rp-sub">' + esc(t.note) + '</div>' : '');
      if (t.audio_path) {
        h += '<button class="btn" data-hear="' + esc(t.id) + '" style="margin-top:8px;padding:8px 13px;font-size:12.5px">Listen</button>';
      }
      if (t.notes && t.notes.length) {
        h += '<div class="rp-sub" style="margin-top:7px">Sang ' + esc(noteRange(t.notes)) + '</div>' +
             notesSvg(t.notes);
      }
      h += '</div>';
    });

    h += '<div class="row" style="margin-top:14px;gap:7px;flex-wrap:nowrap">' +
      '<input id="rpDMIn" class="rp-inp" placeholder="Message ' + esc(s.display_name.split(' ')[0]) + '" style="flex:1">' +
      '<button class="btn primary" id="rpDMGo" style="padding:11px 14px">Send</button></div>';
    return h;
  }

  function wireStudentDetail(host) {
    wireTakeAudio(host);
    on($('rpBack'), 'click', function () { openStudent = null; renderTeacher(); });
    on($('rpAssign'), 'click', function () { assignSheet(openStudent); });
    each(host, '[data-drop]', function (b) {
      on(b, 'click', function () {
        b.disabled = true;
        RP.sb.from('assignments').delete().eq('id', b.dataset.drop).then(function (r) {
          if (r.error) { b.disabled = false; return fail(r.error); }
          RP.refresh();
        });
      });
    });
    on($('rpDMGo'), 'click', function () {
      var i = $('rpDMIn'); var body = (i.value || '').trim();
      if (!body) return;
      i.value = '';
      RP.sb.from('messages').insert({ from_id: RP.user.id, to_id: openStudent, body: body })
        .then(function (r) { r.error ? fail(r.error) : RP.refresh(); });
    });
    on($('rpDMIn'), 'keydown', function (e) { if (e.key === 'Enter') $('rpDMGo').click(); });
  }

  function assignSheet(studentId) {
    var s = RP.students.find(function (x) { return x.id === studentId; });
    /* One assign in four silently did nothing during testing and could not be
       reproduced. The shape of that failure — a sheet that opens fine and an
       insert that never lands — is what an unset studentId looks like, since
       a background refresh can reset which student is open underneath a sheet
       that is already up. Rather than guess at the cause, refuse to open a
       sheet that cannot possibly work, and say why. */
    if (!studentId || !s) {
      RP.toast('Lost track of which student that was — open them again.');
      return;
    }
    var h = '<b style="font-size:16px">Assign to ' + esc(s ? s.display_name : '') + '</b>' +
      '<div class="measured" style="margin-top:6px">Pick the exercise and it opens on their phone ' +
      'already set up — they will not have to go and find it.</div>';
    h += '<div class="rp-lab" style="margin-top:14px">FROM YOUR EXERCISES</div><div id="rpPick">';
    if (!RP.exercises.length) {
      h += '<div class="rp-empty" style="padding:6px 2px">Your set is empty — add one under Exercises.</div>';
    }
    RP.exercises.forEach(function (e) {
      h += '<div class="rp-card" data-pick="' + esc(e.id) + '" style="cursor:pointer;padding:10px">' +
        '<div class="rp-ttl">' + esc(e.title) +
        (e.app_ex_id ? '' : '<span class="rp-tag">no screen</span>') + '</div></div>';
    });
    h += '</div>';

    /* Robert's example was the five-note major scale. That is one of the
       app's own exercises, and until now a coach could only assign from the
       eight seeded into his set — anything else had to be typed as a title,
       which left the student with a card that opened nothing. The whole
       library is the thing to assign from. */
    h += '<div class="rp-lab" style="margin-top:16px">OR ANY EXERCISE IN THE APP</div>' +
      '<input id="rpAsFind" class="rp-inp" placeholder="Search — five note, straw, sirens…" ' +
      'autocomplete="off" spellcheck="false">' +
      '<div id="rpAsHits" style="margin-top:8px"></div>';

    h += '<div class="rp-lab" style="margin-top:16px">HOW OFTEN</div>' +
      '<div class="row" style="gap:8px;margin-top:6px">' +
      '<button class="btn primary" data-cad="once" style="flex:1;padding:11px">Just once</button>' +
      '<button class="btn" data-cad="daily" style="flex:1;padding:11px">Every day</button></div>' +
      '<div id="rpCadWhy" class="measured" style="margin-top:6px;font-size:11.5px">' +
      'They do it, they send you a take, it is done.</div>';

    h += '<div class="rp-lab" style="margin-top:16px">OR WRITE ONE</div>' +
      '<input id="rpAsT" class="rp-inp" placeholder="Straw into a glass, 2 minutes">' +
      '<div style="margin-top:10px"><label class="rp-lab">A NOTE FOR THEM</label>' +
      '<textarea id="rpAsN" class="rp-inp" rows="3" placeholder="Optional — what to watch for."></textarea></div>' +
      '<button class="btn primary" id="rpAsGo" style="width:100%;padding:13px;margin-top:14px">Assign it</button>' +
      '<div id="rpAsMsg" class="measured" style="margin-top:8px"></div>' +
      '<button class="btn" id="rpX" style="width:100%;padding:11px;margin-top:8px">Close</button>';
    var box = sheet(h);
    closeBtn(box);

    var chosen = null;      // one of the coach's own exercise rows
    var chosenApp = null;   // or one straight out of the app's library

    function clearMarks() {
      each(box, '[data-pick]', function (o) { o.classList.remove('hot'); });
      each(box, '[data-app]', function (o) { o.classList.remove('hot'); });
    }

    each(box, '[data-pick]', function (c) {
      on(c, 'click', function () {
        chosen = RP.exercises.find(function (e) { return e.id === c.dataset.pick; });
        chosenApp = null;
        clearMarks();
        c.classList.add('hot');
        $('rpAsT').value = chosen.title;
        if (!$('rpAsN').value) $('rpAsN').value = chosen.instructions || '';
      });
    });

    /* search the app's exercises */
    function plain(t) { return String(t == null ? '' : t).replace(/<[^>]+>/g, ''); }

    /* A coach types "five note major scale", not "1-2-3-4-5-4-3-2-1". The
       shapes get the words people actually say for them, so the search finds
       Mum and Mee — the exercises that ARE the five-note scale — and not only
       the one with "five" in its name. */
    var SHAPE = {
      five:   'five note major scale five-note 12345 up and down',
      down5:  'five note descending five-tone coming down',
      down3:  'three note descending short',
      arp:    'arpeggio triad one three five',
      oct:    'octave arpeggio one three five eight',
      octrep: 'octave repeated top',
      nine:   'nine tone long scale',
      oct15:  'octave and a half wide siren'
    };
    function hits(q) {
      var all = [];
      try { all = (window.V10 && V10.EX) || []; } catch (e) {}
      q = q.trim().toLowerCase();
      return all.filter(function (e) {
        if (!e.engine) return false;
        var pat = '', shape = '';
        try {
          pat = (e.engine.pattern && V10.PATTERNS[e.engine.pattern])
            ? V10.PATTERNS[e.engine.pattern].label : '';
          shape = SHAPE[e.engine.pattern] || '';
        } catch (err) {}
        var hay = (e.name + ' ' + (e.syl || '') + ' ' + (e.pillar || '') + ' ' + pat + ' ' +
                   shape + ' ' + plain(e.what || '')).toLowerCase();
        /* every word has to be in there, so "five note" is not the same as "five" */
        return !q || q.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0; });
      }).slice(0, 8);
    }
    function drawHits() {
      var wrap = $('rpAsHits');
      if (!wrap) return;
      var q = ($('rpAsFind') || {}).value || '';
      var list = hits(q);
      if (!list.length) {
        wrap.innerHTML = '<div class="rp-empty" style="padding:6px 2px">Nothing matches that.</div>';
        return;
      }
      var hh = '';
      list.forEach(function (e) {
        var pat = '';
        try { pat = (e.engine.pattern && V10.PATTERNS[e.engine.pattern])
          ? V10.PATTERNS[e.engine.pattern].label : ''; } catch (err) {}
        hh += '<div class="rp-card" data-app="' + esc(e.id) + '" style="cursor:pointer;padding:10px">' +
          '<div class="rp-ttl">' + esc(e.name) + '</div>' +
          '<div class="rp-sub" style="margin:3px 0 0">' +
          esc(pat || (e.syl ? 'on ' + e.syl : (e.pillar || ''))) + '</div></div>';
      });
      wrap.innerHTML = hh;
      each(wrap, '[data-app]', function (c) {
        on(c, 'click', function () {
          chosenApp = V10.exById(c.dataset.app);
          chosen = null;
          clearMarks();
          c.classList.add('hot');
          $('rpAsT').value = chosenApp.name;
          if (!$('rpAsN').value) $('rpAsN').value = plain(chosenApp.what || '');
        });
      });
    }
    on($('rpAsFind'), 'input', drawHits);
    drawHits();

    var cadence = 'once';
    each(box, '[data-cad]', function (b) {
      on(b, 'click', function () {
        cadence = b.dataset.cad;
        each(box, '[data-cad]', function (o) { o.classList.toggle('primary', o.dataset.cad === cadence); });
        var w = $('rpCadWhy');
        if (w) w.textContent = cadence === 'daily'
          ? 'It shows up on their week, every day, until you take it off. Each day counts on its own.'
          : 'They do it, they send you a take, it is done.';
      });
    });

    on($('rpAsGo'), 'click', function () {
      var title = ($('rpAsT').value || '').trim() ||
        (chosen ? chosen.title : (chosenApp ? chosenApp.name : ''));
      if (!title) return RP.toast('Pick one, or write a title.');
      var row = {
        coach_id: RP.user.id, student_id: studentId, title: title,
        note: ($('rpAsN').value || '').trim(),
        exercise_id: chosen ? chosen.id : null,
        app_ex_id: chosenApp ? chosenApp.id : (chosen ? chosen.app_ex_id : null),
        cadence: cadence
      };
      $('rpAsGo').disabled = true;
      var m = $('rpAsMsg');
      if (m) { m.textContent = 'Sending it over\u2026'; m.style.color = 'var(--ink-dim)'; }
      /* The error goes on the sheet, not only into a toast. A toast that is
         missed is the same as no message at all, and this is the one action
         the whole coaching side rests on. */
      RP.sb.from('assignments').insert(row).select().then(function (r) {
        if (r.error || !r.data || !r.data.length) {
          $('rpAsGo').disabled = false;
          var why = (r.error && r.error.message) || 'the database accepted nothing back';
          if (m) { m.textContent = 'It did not send: ' + why; m.style.color = 'var(--miss)'; }
          return fail(r.error || new Error(why));
        }
        /* The insert handed the row straight back, so the screen can be right
           immediately and does not depend on the refresh that follows landing.
           That is what went wrong for Robert: the assign worked, the refresh
           after it did not, and the list stayed as it was. */
        RP.assignments = [r.data[0]].concat(RP.assignments || []);
        RP.closeSheet();
        RP.toast('Assigned to ' + s.display_name.split(' ')[0]);
        if (RP.rerender) RP.rerender();
        RP.refresh();
      });
    });
  }

  /* ---- exercises ---- */
  function exerciseList() {
    var h = '<div class="row" style="justify-content:space-between;align-items:center;margin-top:12px">' +
      '<b style="font-size:14px">Your exercises</b>' +
      '<button class="btn primary" id="rpAddEx" style="padding:8px 13px;font-size:12.5px">Add</button></div>' +
      '<div class="measured" style="margin-top:6px">Started from the app\'s own set. Edit any of them, ' +
      'or write your own — these are what you assign from.</div>';
    RP.exercises.forEach(function (e) {
      h += '<div class="rp-card" data-ex="' + esc(e.id) + '" style="cursor:pointer">' +
        '<div class="row" style="justify-content:space-between;align-items:center">' +
        '<div style="flex:1;min-width:0"><div class="rp-ttl">' + esc(e.title) +
        (e.app_ex_id ? '<span class="rp-tag">in app</span>' : '') + '</div>' +
        (e.instructions ? '<div class="rp-sub">' + esc(e.instructions) + '</div>' : '') + '</div>' +
        '<div style="color:var(--ink-faint);font-size:20px">›</div></div></div>';
    });
    if (!RP.exercises.length) h += '<div class="rp-empty">Empty. Tap <b>Add</b>.</div>';
    return h;
  }
  function wireExercises(host) {
    on($('rpAddEx'), 'click', function () { exSheet(null); });
    each(host, '[data-ex]', function (c) {
      on(c, 'click', function () {
        exSheet(RP.exercises.find(function (e) { return e.id === c.dataset.ex; }));
      });
    });
  }
  function exSheet(ex) {
    var h = '<b style="font-size:16px">' + (ex ? 'Edit exercise' : 'New exercise') + '</b>';
    h += '<div style="margin-top:14px"><label class="rp-lab">NAME</label>' +
      '<input id="rpExT" class="rp-inp" value="' + esc(ex ? ex.title : '') + '" placeholder="Lip trill on a five-note"></div>';
    h += '<div style="margin-top:12px"><label class="rp-lab">HOW TO DO IT</label>' +
      '<textarea id="rpExN" class="rp-inp" rows="5">' + esc(ex ? ex.instructions : '') + '</textarea></div>';
    h += '<button class="btn primary" id="rpExGo" style="width:100%;padding:13px;margin-top:14px">Save</button>';
    if (ex) h += '<button class="btn" id="rpExDel" style="width:100%;padding:11px;margin-top:8px;color:var(--miss)">Delete</button>';
    h += '<button class="btn" id="rpX" style="width:100%;padding:11px;margin-top:8px">Close</button>';
    var box = sheet(h);
    closeBtn(box);
    on($('rpExGo'), 'click', function () {
      var t = ($('rpExT').value || '').trim();
      if (!t) return RP.toast('It needs a name.');
      var body = { title: t, instructions: ($('rpExN').value || '').trim() };
      var q = ex
        ? RP.sb.from('exercises').update(body).eq('id', ex.id)
        : RP.sb.from('exercises').insert(Object.assign({ coach_id: RP.user.id, sort: RP.exercises.length }, body));
      q.then(function (r) { r.error ? fail(r.error) : (RP.closeSheet(), RP.refresh()); });
    });
    on($('rpExDel'), 'click', function () {
      RP.sb.from('exercises').delete().eq('id', ex.id)
        .then(function (r) { r.error ? fail(r.error) : (RP.closeSheet(), RP.refresh()); });
    });
  }

  /* ---- inbox ---- */
  function inbox() {
    var items = [];
    RP.takes.forEach(function (t) { items.push({ at: t.created_at, kind: 'take', o: t }); });
    RP.messages.forEach(function (m) { items.push({ at: m.created_at, kind: 'msg', o: m }); });
    items.sort(function (a, b) { return new Date(b.at) - new Date(a.at); });

    var h = '<div style="margin-top:12px"></div>';
    if (!items.length) return h + '<div class="rp-empty">Nothing yet. Takes your students send, and ' +
      'messages, both land here.</div>';
    items.slice(0, 40).forEach(function (i) {
      if (i.kind === 'take') {
        /* Which assignment it answers, said on the card. The coach set it; he
           should not have to work out what came back against what. */
        var forA = null;
        if (i.o.assignment_id) {
          forA = (RP.assignments || []).find(function (x) { return x.id === i.o.assignment_id; });
        }
        h += '<div class="rp-card hot"><div class="rp-ttl">' + esc(nameOf(i.o.student_id)) +
          (forA ? ' answered an assignment' : ' sent a take') +
          '<span class="rp-tag">' + ago(i.at) + '</span></div>';
        if (forA) {
          h += '<div class="rp-sub" style="margin:3px 0 0">You set: <b>' + esc(forA.title) + '</b></div>';
        }
        h += '<div class="rp-sub"><b>' + esc(i.o.title) + '</b>' + (i.o.note ? ' — ' + esc(i.o.note) : '') + '</div>';
        if (i.o.audio_path) {
          h += '<button class="btn" data-hear="' + esc(i.o.id) + '" style="margin-top:8px;padding:8px 13px;font-size:12.5px">Listen</button>';
        }
        if (i.o.notes && i.o.notes.length) {
          h += '<div class="rp-sub" style="margin-top:7px">Sang ' + esc(noteRange(i.o.notes)) + '</div>' +
               notesSvg(i.o.notes);
        }
        h += '</div>';
      } else {
        h += '<div class="rp-card"><div class="rp-sub" style="margin:0"><b>' + esc(nameOf(i.o.from_id)) +
          '</b> · ' + ago(i.at) + '</div><div style="font-size:13px;margin-top:4px">' + esc(i.o.body) + '</div></div>';
      }
    });
    return h;
  }
  function wireTakeAudio(host) {
    if (!host) return;
    each(host, '[data-hear]', function (b) {
      on(b, 'click', async function () {
        var t = (RP.takes || []).find(function (x) { return x.id === b.dataset.hear; });
        if (!t || !t.audio_path) return RP.toast('No audio on that one.');
        b.disabled = true; b.textContent = 'Loading…';
        var url = window.RPSend ? await RPSend.playable(t.audio_path) : null;
        b.disabled = false; b.textContent = 'Listen';
        if (!url) return RP.toast('Could not fetch that take.');
        try {
          if (wireTakeAudio._a) wireTakeAudio._a.pause();
          var a = new Audio(url);
          wireTakeAudio._a = a;
          a.play().catch(function () { RP.toast('The phone would not play it.'); });
        } catch (e) { RP.toast('Could not play it.'); }
      });
    });
  }

  function wireInbox(host) { wireTakeAudio(host); }

  /* ================================================================ */
  /* the switch                                                        */
  /* ================================================================ */
  var orig = V10.renderCoach;

  V10.renderCoach = function () {
    if (RP.isCoachFace && RP.isCoachFace()) return renderTeacher();
    orig.apply(this, arguments);
    var host = $('modeCoach');
    if (!host) return;
    host.classList.remove('rp-brand');
    if (RP.user && RP.profile) {
      var d = document.createElement('div');
      d.id = 'rpChannel';
      d.innerHTML = studentChannel();
      host.insertBefore(d, host.firstChild);
      wireStudentChannel(host);
    } else {
      var n = document.createElement('div');
      n.className = 'notice';
      n.style.cssText = 'margin:0 0 12px;padding:11px 12px;border:1px solid var(--line);border-radius:12px';
      n.innerHTML = 'Working with a real coach? <b>Sign in</b> and their week appears here. ' +
        'Everything below works without an account.';
      host.insertBefore(n, host.firstChild);
    }
  };

  /* The v10 Coach tab re-renders itself from its own closure when you change
     a goal or a dial, which would wipe the channel above it. Put it back. */
  var mo = new MutationObserver(function () {
    var host = $('modeCoach');
    if (!host || !host.classList.contains('active')) return;
    if (RP.isCoachFace && RP.isCoachFace()) return;
    if (!RP.user || !RP.profile) return;
    if ($('rpChannel')) return;
    var d = document.createElement('div');
    d.id = 'rpChannel';
    d.innerHTML = studentChannel();
    host.insertBefore(d, host.firstChild);
    wireStudentChannel(host);
  });
  function watch() {
    var host = $('modeCoach');
    if (host) mo.observe(host, { childList: true });
    else setTimeout(watch, 400);
  }
  watch();

  RP.renderTeacher = renderTeacher;
})();
