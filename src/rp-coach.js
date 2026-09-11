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
    h += '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<b style="font-size:15px">From ' + esc(coach.display_name) + '</b>' +
      '<button class="btn" id="rpSendTake" style="padding:7px 11px;font-size:12px">Send a take</button></div>';

    if (!open.length && !done.length) {
      h += '<div class="rp-empty">Nothing assigned yet. When ' + esc(coach.display_name) +
        ' sets something on his phone it lands here — you will not need to refresh.</div>';
    }

    open.forEach(function (a) {
      var ex = a.app_ex_id && V10.exById ? V10.exById(a.app_ex_id) : null;
      h += '<div class="rp-card hot"><div class="rp-ttl">' + esc(a.title) + '</div>';
      if (a.note) h += '<div class="rp-sub">' + esc(a.note) + '</div>';
      h += '<div class="row" style="margin-top:9px;gap:7px">';
      if (ex) h += '<button class="btn primary" data-start="' + esc(a.app_ex_id) +
        '" style="padding:8px 13px;font-size:12.5px">Start</button>';
      h += '<button class="btn" data-done="' + esc(a.id) + '" style="padding:8px 13px;font-size:12.5px">Mark done</button>';
      h += '</div></div>';
    });

    if (done.length) {
      h += '<div class="rp-lab" style="margin-top:14px">DONE</div>';
      done.slice(0, 6).forEach(function (a) {
        h += '<div class="rp-card rp-done"><div class="rp-ttl">' + esc(a.title) +
          '<span class="rp-tag">' + ago(a.done_at) + '</span></div></div>';
      });
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

  function wireStudentChannel(host) {
    each(host, '[data-start]', function (b) {
      on(b, 'click', function () {
        var id = b.dataset.start;
        try {
          window.switchMode('train');
          setTimeout(function () { V10.startEx(id); }, 80);
        } catch (e) { fail(e); }
      });
    });
    each(host, '[data-done]', function (b) {
      on(b, 'click', function () {
        b.disabled = true;
        RP.sb.from('assignments').update({ done_at: new Date().toISOString() })
          .eq('id', b.dataset.done).then(function (r) {
            if (r.error) { b.disabled = false; return fail(r.error); }
            RP.refresh();
          });
      });
    });
    on($('rpCodeGo'), 'click', joinByCode);
    on($('rpCode'), 'keydown', function (e) { if (e.key === 'Enter') joinByCode(); });
    on($('rpSendTake'), 'click', sendTakeSheet);
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

  function sendTakeSheet() {
    var open = RP.assignments.filter(function (a) { return !a.done_at; });
    var h = '<b style="font-size:16px">Send a take</b>' +
      '<div class="measured" style="margin-top:6px">Tell ' + esc(RP.coach.display_name) +
      ' what you worked on and how it went. Audio upload is not built yet — this is the note that goes with it.</div>';
    h += '<div style="margin-top:14px"><label class="rp-lab">WHAT WAS IT</label>' +
      '<input id="rpTkT" class="rp-inp" placeholder="' + esc(open.length ? open[0].title : 'Straw phonation') + '"></div>';
    h += '<div style="margin-top:12px"><label class="rp-lab">HOW IT WENT</label>' +
      '<textarea id="rpTkN" class="rp-inp" rows="4" placeholder="Where it felt easy, where it fell apart."></textarea></div>';
    h += '<button class="btn primary" id="rpTkGo" style="width:100%;padding:13px;margin-top:14px">Send it</button>' +
      '<button class="btn" id="rpX" style="width:100%;padding:11px;margin-top:8px">Close</button>';
    var box = sheet(h);
    closeBtn(box);
    on($('rpTkGo'), 'click', function () {
      var t = ($('rpTkT').value || '').trim() || (open.length ? open[0].title : 'A take');
      var n = ($('rpTkN').value || '').trim();
      RP.sb.from('takes').insert({
        student_id: RP.user.id, coach_id: RP.coach.id,
        assignment_id: open.length ? open[0].id : null, title: t, note: n
      }).then(function (r) {
        if (r.error) return fail(r.error);
        RP.closeSheet(); RP.toast('Sent to ' + RP.coach.display_name); RP.refresh();
      });
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
      h += '<div class="rp-card' + (a.done_at ? ' rp-done' : ' hot') + '">' +
        '<div class="row" style="justify-content:space-between;align-items:flex-start">' +
        '<div style="flex:1;min-width:0"><div class="rp-ttl">' + esc(a.title) +
        (a.done_at ? '<span class="rp-tag">done</span>' : '') + '</div>' +
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
    var h = '<b style="font-size:16px">Assign to ' + esc(s ? s.display_name : '') + '</b>';
    h += '<div class="rp-lab" style="margin-top:14px">FROM YOUR EXERCISES</div><div id="rpPick">';
    if (!RP.exercises.length) {
      h += '<div class="rp-empty" style="padding:6px 2px">Your set is empty — add one under Exercises.</div>';
    }
    RP.exercises.forEach(function (e) {
      h += '<div class="rp-card" data-pick="' + esc(e.id) + '" style="cursor:pointer;padding:10px">' +
        '<div class="rp-ttl">' + esc(e.title) + '</div></div>';
    });
    h += '</div>';
    h += '<div class="rp-lab" style="margin-top:16px">OR WRITE ONE</div>' +
      '<input id="rpAsT" class="rp-inp" placeholder="Straw into a glass, 2 minutes">' +
      '<div style="margin-top:10px"><label class="rp-lab">A NOTE FOR THEM</label>' +
      '<textarea id="rpAsN" class="rp-inp" rows="3" placeholder="Optional — what to watch for."></textarea></div>' +
      '<button class="btn primary" id="rpAsGo" style="width:100%;padding:13px;margin-top:14px">Assign it</button>' +
      '<button class="btn" id="rpX" style="width:100%;padding:11px;margin-top:8px">Close</button>';
    var box = sheet(h);
    closeBtn(box);

    var chosen = null;
    each(box, '[data-pick]', function (c) {
      on(c, 'click', function () {
        chosen = RP.exercises.find(function (e) { return e.id === c.dataset.pick; });
        each(box, '[data-pick]', function (o) { o.classList.remove('hot'); });
        c.classList.add('hot');
        $('rpAsT').value = chosen.title;
        if (!$('rpAsN').value) $('rpAsN').value = chosen.instructions || '';
      });
    });

    on($('rpAsGo'), 'click', function () {
      var title = ($('rpAsT').value || '').trim() || (chosen ? chosen.title : '');
      if (!title) return RP.toast('Pick one, or write a title.');
      var row = {
        coach_id: RP.user.id, student_id: studentId, title: title,
        note: ($('rpAsN').value || '').trim(),
        exercise_id: chosen ? chosen.id : null,
        app_ex_id: chosen ? chosen.app_ex_id : null
      };
      $('rpAsGo').disabled = true;
      RP.sb.from('assignments').insert(row).then(function (r) {
        if (r.error) { $('rpAsGo').disabled = false; return fail(r.error); }
        RP.closeSheet();
        RP.toast('Assigned to ' + (s ? s.display_name.split(' ')[0] : 'them'));
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
        h += '<div class="rp-card hot"><div class="rp-ttl">' + esc(nameOf(i.o.student_id)) +
          ' sent a take<span class="rp-tag">' + ago(i.at) + '</span></div>' +
          '<div class="rp-sub"><b>' + esc(i.o.title) + '</b>' + (i.o.note ? ' — ' + esc(i.o.note) : '') + '</div>';
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
