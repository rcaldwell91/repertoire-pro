/* ======================================================================
   Repertoire Pro — cloud layer (accounts, coach↔student, live assignments)

   This sits ON TOP of v10.1. It touches nothing in the build below it.
   With nobody signed in the app behaves exactly as it did before: this
   module adds a "Sign in" button and otherwise stays out of the way.

   Everything here talks to Supabase with the PUBLISHABLE key only.
   Row-level security in the database is the whole of the protection —
   there is no secret in this file and there must never be one.
   ====================================================================== */
(function () {
  'use strict';

  var SB_URL = 'https://ovafsbloyrlwrolqtcat.supabase.co';
  var SB_KEY = 'sb_publishable_WmDlaoUkUMerztbTXdMCuA_chfdxXsw';
  var SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

  var RP = window.RP = {
    ready: false, sb: null, user: null, profile: null,
    coach: null,            // the student's coach profile, if linked
    students: [],           // a coach's students
    assignments: [],        // student: mine · coach: everything I set
    exercises: [],          // a coach's own set
    takes: [], messages: [],
    face: 'auto',           // 'auto' | 'student' — a coach can look at the student app
    err: ''
  };

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function qsa(root, sel, fn) { (root || document).querySelectorAll(sel).forEach(fn); }

  /* ---------------------------------------------------------------- */
  /* toast                                                             */
  /* ---------------------------------------------------------------- */
  function toast(msg, ms) {
    var t = $('rpToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'rpToast';
      t.style.cssText = 'position:fixed;left:12px;right:12px;bottom:78px;z-index:400;' +
        'background:var(--panel2);border:1px solid var(--line);border-left:4px solid var(--gold);' +
        'color:var(--ink);padding:12px 14px;border-radius:12px;font-size:13.5px;font-weight:700;' +
        'box-shadow:0 8px 28px rgba(0,0,0,.4);display:none;max-width:520px;margin:0 auto';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.style.display = 'none'; }, ms || 4200);
  }
  RP.toast = toast;

  /* ---------------------------------------------------------------- */
  /* loading the SDK — if it will not load we stay local-only          */
  /* ---------------------------------------------------------------- */
  function loadSDK() {
    return new Promise(function (res, rej) {
      if (window.supabase && window.supabase.createClient) return res();
      var s = document.createElement('script');
      s.src = SDK;
      s.onload = function () {
        (window.supabase && window.supabase.createClient) ? res() : rej(new Error('sdk shape'));
      };
      s.onerror = function () { rej(new Error('sdk offline')); };
      document.head.appendChild(s);
    });
  }

  /* ---------------------------------------------------------------- */
  /* account button in the header                                      */
  /* ---------------------------------------------------------------- */
  function mountHeaderButton() {
    if ($('rpAccount')) return;
    var head = document.querySelector('header');
    if (!head) return;
    var b = document.createElement('button');
    b.id = 'rpAccount';
    b.className = 'btn';
    b.style.cssText = 'padding:7px 11px;font-size:12px;margin-right:6px';
    b.textContent = 'Sign in';
    on(b, 'click', function () { RP.user ? openAccount() : openAuth(); });
    var pill = $('micPillTop');
    pill ? head.insertBefore(b, pill) : head.appendChild(b);
    syncHeaderButton();
  }
  function syncHeaderButton() {
    var b = $('rpAccount');
    if (!b) return;
    if (RP.user && RP.profile) {
      b.textContent = (RP.profile.display_name || 'Account').split(' ')[0];
      b.style.borderColor = 'var(--gold)';
      b.style.color = 'var(--gold)';
    } else {
      b.textContent = 'Sign in';
      b.style.borderColor = '';
      b.style.color = '';
    }
  }

  /* ---------------------------------------------------------------- */
  /* the sign-in / sign-up sheet                                       */
  /* ---------------------------------------------------------------- */
  function sheet(html) {
    var o = $('rpSheet');
    if (!o) {
      o = document.createElement('div');
      o.id = 'rpSheet';
      o.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.62);' +
        'display:flex;align-items:flex-end;justify-content:center;overflow-y:auto';
      document.body.appendChild(o);
      on(o, 'click', function (e) { if (e.target === o) closeSheet(); });
    }
    o.innerHTML = '<div style="background:var(--panel);border:1px solid var(--line);' +
      'border-radius:18px 18px 0 0;width:100%;max-width:560px;padding:18px 16px ' +
      'calc(22px + env(safe-area-inset-bottom,0px));max-height:94vh;overflow-y:auto">' + html + '</div>';
    o.style.display = 'flex';
    return o.firstChild;
  }
  function closeSheet() { var o = $('rpSheet'); if (o) { o.style.display = 'none'; o.innerHTML = ''; } }
  RP.closeSheet = closeSheet;

  var authTab = 'up';
  function openAuth() {
    if (!RP.ready) {
      sheet('<b style="font-size:16px">Accounts are offline</b>' +
        '<div class="measured" style="margin-top:8px">' + esc(RP.err || 'Could not reach the account service.') +
        ' The rest of the app works normally without an account.</div>' +
        '<button class="btn" id="rpX" style="margin-top:14px;width:100%;padding:11px">Close</button>');
      on($('rpX'), 'click', closeSheet);
      return;
    }
    var up = authTab === 'up';
    var h = '<div class="row" style="gap:8px;margin-bottom:14px">' +
      '<button class="btn' + (up ? ' primary' : '') + '" id="rpTabUp" style="flex:1;padding:10px">Sign up</button>' +
      '<button class="btn' + (up ? '' : ' primary') + '" id="rpTabIn" style="flex:1;padding:10px">Sign in</button></div>';

    if (up) {
      h += '<label class="lab">YOUR NAME</label>' +
        '<input id="rpName" class="inp" placeholder="Lyon" style="width:100%;margin-bottom:10px">';
    }
    h += '<label class="lab">EMAIL</label>' +
      '<input id="rpEmail" class="inp" type="email" autocomplete="email" inputmode="email" ' +
      'autocapitalize="off" spellcheck="false" placeholder="you@example.com" style="width:100%;margin-bottom:10px">' +
      '<label class="lab">PASSWORD</label>' +
      '<input id="rpPass" class="inp" type="password" autocomplete="' + (up ? 'new-password' : 'current-password') +
      '" placeholder="At least 6 characters" style="width:100%;margin-bottom:12px">';

    if (up) {
      h += '<div class="row" style="align-items:center;gap:10px;margin-bottom:14px">' +
        '<button class="btn" id="rpRole" data-role="student" style="padding:9px 12px;font-size:12.5px">I am a student</button>' +
        '<div class="measured" style="margin:0">Tap to switch. Ja Ronn taps this to <b>I am a coach</b>.</div></div>';
    }

    h += '<button class="btn primary" id="rpGo" style="width:100%;padding:13px;font-size:14px">' +
      (up ? 'Create my account' : 'Sign in') + '</button>';
    h += '<div style="text-align:center;margin:12px 0 8px;color:var(--ink-faint);font-size:12px">or</div>';
    h += '<button class="btn" id="rpLink" style="width:100%;padding:12px">Email me a sign-in link</button>';
    h += '<div id="rpMsg" class="measured" style="margin-top:12px"></div>';
    h += '<button class="btn" id="rpX" style="margin-top:10px;width:100%;padding:11px">Close</button>';

    var box = sheet(h);
    on($('rpTabUp'), 'click', function () { authTab = 'up'; openAuth(); });
    on($('rpTabIn'), 'click', function () { authTab = 'in'; openAuth(); });
    on($('rpX'), 'click', closeSheet);
    var roleBtn = $('rpRole');
    on(roleBtn, 'click', function () {
      var coach = roleBtn.dataset.role === 'student';
      roleBtn.dataset.role = coach ? 'coach' : 'student';
      roleBtn.textContent = coach ? 'I am a coach' : 'I am a student';
      roleBtn.classList.toggle('primary', coach);
    });
    on($('rpGo'), 'click', function () { authTab === 'up' ? doSignUp() : doSignIn(); });
    on($('rpLink'), 'click', doMagicLink);
    box.querySelectorAll('input').forEach(function (i) {
      on(i, 'keydown', function (e) { if (e.key === 'Enter') $('rpGo').click(); });
    });
  }
  RP.openAuth = openAuth;

  function msg(t, bad) {
    var m = $('rpMsg');
    if (m) { m.innerHTML = esc(t); m.style.color = bad ? 'var(--miss)' : 'var(--ink-dim)'; }
  }

  function doSignUp() {
    var name = ($('rpName') || {}).value || '';
    var email = ($('rpEmail').value || '').trim();
    var pass = $('rpPass').value || '';
    var role = ($('rpRole') || {}).dataset ? $('rpRole').dataset.role : 'student';
    if (!email || !pass) return msg('Email and password, please.', true);
    if (pass.length < 6) return msg('Password needs at least 6 characters.', true);
    msg('Creating your account…');
    RP.sb.auth.signUp({
      email: email, password: pass,
      options: { data: { display_name: name.trim() || email.split('@')[0], role: role },
                 emailRedirectTo: location.href.split('#')[0] }
    }).then(function (r) {
      if (r.error) return msg(r.error.message, true);
      if (!r.data.session) {
        return msg('Account made, but it wants an email confirmation before you can sign in. ' +
                   'Tell Robert — one switch in Supabase turns that off.', true);
      }
      closeSheet();
      toast('Signed in as ' + (name || email));
    }).catch(function (e) { msg(String(e.message || e), true); });
  }

  function doSignIn() {
    var email = ($('rpEmail').value || '').trim();
    var pass = $('rpPass').value || '';
    if (!email || !pass) return msg('Email and password, please.', true);
    msg('Signing in…');
    RP.sb.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
      if (r.error) return msg(r.error.message, true);
      closeSheet();
    }).catch(function (e) { msg(String(e.message || e), true); });
  }

  function doMagicLink() {
    var email = ($('rpEmail').value || '').trim();
    if (!email) return msg('Put your email in first, then tap this.', true);
    msg('Sending…');
    RP.sb.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: location.href.split('#')[0],
                 shouldCreateUser: authTab === 'up' }
    }).then(function (r) {
      msg(r.error ? r.error.message : 'Link sent. Open it on this phone and you are in.', !!r.error);
    }).catch(function (e) { msg(String(e.message || e), true); });
  }

  function openAccount() {
    var p = RP.profile || {};
    var h = '<b style="font-size:16px">' + esc(p.display_name || 'Account') + '</b>' +
      '<div class="measured" style="margin-top:6px">' + esc(p.email || '') + ' · ' +
      (p.role === 'coach' ? 'Coach' : 'Student') + '</div>';
    if (p.role === 'coach') {
      h += '<div class="row" style="gap:8px;margin-top:14px">' +
        '<button class="btn' + (RP.face === 'auto' ? ' primary' : '') + '" id="rpFaceC" style="flex:1;padding:10px">Coach view</button>' +
        '<button class="btn' + (RP.face === 'student' ? ' primary' : '') + '" id="rpFaceS" style="flex:1;padding:10px">Student view</button></div>' +
        '<div class="measured" style="margin-top:8px">Coaches are learners too — the student view gives you the AI coach for your own practice.</div>';
    }
    h += '<button class="btn" id="rpOut" style="margin-top:16px;width:100%;padding:12px">Sign out</button>';
    h += '<button class="btn" id="rpX" style="margin-top:8px;width:100%;padding:11px">Close</button>';
    sheet(h);
    on($('rpX'), 'click', closeSheet);
    on($('rpFaceC'), 'click', function () { setFace('auto'); closeSheet(); });
    on($('rpFaceS'), 'click', function () { setFace('student'); closeSheet(); });
    on($('rpOut'), 'click', function () {
      RP.sb.auth.signOut().then(function () { closeSheet(); toast('Signed out. The app still works.'); });
    });
  }

  function setFace(f) {
    RP.face = f;
    try { localStorage.setItem('rp_face', f); } catch (e) {}
    rerender();
  }
  try { RP.face = localStorage.getItem('rp_face') || 'auto'; } catch (e) {}

  /* ---------------------------------------------------------------- */
  /* data                                                              */
  /* ---------------------------------------------------------------- */
  function isCoachFace() {
    return !!(RP.profile && RP.profile.role === 'coach' && RP.face !== 'student');
  }
  RP.isCoachFace = isCoachFace;

  function loadAll() {
    if (!RP.user) return Promise.resolve();
    var uid = RP.user.id;
    var sb = RP.sb;
    return sb.from('profiles').select('*').eq('id', uid).maybeSingle().then(function (r) {
      RP.profile = r.data || RP.profile;
      if (!RP.profile) {
        // the trigger should have made this; if it did not, make it here.
        var md = (RP.user.user_metadata || {});
        return sb.from('profiles').insert({
          id: uid, display_name: md.display_name || (RP.user.email || '').split('@')[0],
          email: RP.user.email || '', role: md.role === 'coach' ? 'coach' : 'student'
        }).select().maybeSingle().then(function (r2) { RP.profile = r2.data; });
      }
    }).then(function () {
      if (!RP.profile) return;
      if (RP.profile.role === 'coach') return loadCoach(uid);
      return loadStudent(uid);
    }).then(syncHeaderButton);
  }

  function loadStudent(uid) {
    var sb = RP.sb;
    return Promise.all([
      sb.from('coach_students').select('coach_id').eq('student_id', uid),
      sb.from('assignments').select('*').eq('student_id', uid).order('created_at', { ascending: false }),
      sb.from('messages').select('*').or('to_id.eq.' + uid + ',from_id.eq.' + uid).order('created_at', { ascending: false }).limit(50),
      sb.from('takes').select('*').eq('student_id', uid).order('created_at', { ascending: false }).limit(50)
    ]).then(function (r) {
      RP.assignments = r[1].data || [];
      RP.messages = r[2].data || [];
      RP.takes = r[3].data || [];
      var link = (r[0].data || [])[0];
      if (!link) { RP.coach = null; return; }
      return sb.from('profiles').select('*').eq('id', link.coach_id).maybeSingle()
        .then(function (c) { RP.coach = c.data || null; });
    });
  }

  function loadCoach(uid) {
    var sb = RP.sb;
    return Promise.all([
      sb.from('coach_students').select('student_id').eq('coach_id', uid),
      sb.from('exercises').select('*').eq('coach_id', uid).order('sort').order('created_at'),
      sb.from('assignments').select('*').eq('coach_id', uid).order('created_at', { ascending: false }),
      sb.from('takes').select('*').eq('coach_id', uid).order('created_at', { ascending: false }).limit(50),
      sb.from('messages').select('*').or('to_id.eq.' + uid + ',from_id.eq.' + uid).order('created_at', { ascending: false }).limit(50)
    ]).then(function (r) {
      RP.exercises = r[1].data || [];
      RP.assignments = r[2].data || [];
      RP.takes = r[3].data || [];
      RP.messages = r[4].data || [];
      var ids = (r[0].data || []).map(function (x) { return x.student_id; });
      if (!ids.length) { RP.students = []; return; }
      return sb.from('profiles').select('*').in('id', ids)
        .then(function (p) { RP.students = p.data || []; });
    }).then(function () {
      if (!RP.exercises.length) return seedExercises(uid);
    });
  }

  /* A coach starts with a set drawn from the app's own exercises — real ones,
     not invented — which he can then edit, add to, or throw away. */
  function seedExercises(uid) {
    var EX = (window.V10 && window.V10.EX) || [];
    var want = ['straw', 'liptrill', 'hum', 'mum', 'hiss', 'farinelli', 'siren', 'mee'];
    var picks = [];
    want.forEach(function (id) {
      var e = EX.find(function (x) { return x.id === id; });
      if (e) picks.push(e);
    });
    if (picks.length < 6) {
      EX.filter(function (e) { return e.level === 1 && picks.indexOf(e) < 0; })
        .slice(0, 8 - picks.length).forEach(function (e) { picks.push(e); });
    }
    if (!picks.length) return;
    var rows = picks.map(function (e, i) {
      return {
        coach_id: uid, title: e.name, app_ex_id: e.id, pillar: e.pillar || 'warmup', sort: i,
        instructions: String(e.what || '').replace(/<[^>]+>/g, '')
      };
    });
    return RP.sb.from('exercises').insert(rows).select().then(function (r) {
      RP.exercises = r.data || [];
    });
  }

  /* ---------------------------------------------------------------- */
  /* live sync                                                         */
  /* ---------------------------------------------------------------- */
  var channel = null;
  function subscribe() {
    if (!RP.user) return;
    unsubscribe();
    var uid = RP.user.id;
    var coach = RP.profile && RP.profile.role === 'coach';
    var ch = RP.sb.channel('rp-' + uid);

    if (coach) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'takes', filter: 'coach_id=eq.' + uid },
        function (p) { bump('take', p); });
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'coach_students', filter: 'coach_id=eq.' + uid },
        function () { refresh(); });
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: 'coach_id=eq.' + uid },
        function () { refresh(); });
    } else {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: 'student_id=eq.' + uid },
        function (p) { bump('assignment', p); });
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'coach_students', filter: 'student_id=eq.' + uid },
        function () { refresh(); });
    }
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'to_id=eq.' + uid },
      function (p) { bump('message', p); });

    ch.subscribe(function (st) { RP.channelState = st; });
    channel = ch;
  }
  function unsubscribe() {
    if (channel) { try { RP.sb.removeChannel(channel); } catch (e) {} channel = null; }
  }

  function bump(kind, payload) {
    refresh().then(function () {
      var n = payload && payload.new;
      if (kind === 'assignment' && payload.eventType === 'INSERT' && n) {
        toast((RP.coach ? RP.coach.display_name : 'Your coach') + ' assigned you: ' + n.title);
      } else if (kind === 'take' && payload.eventType === 'INSERT' && n) {
        toast('New take: ' + (n.title || 'from a student'));
      } else if (kind === 'message' && n) {
        toast('New message');
      }
    });
  }

  var refreshing = null;
  function refresh() {
    if (refreshing) return refreshing;
    refreshing = loadAll().then(function () { refreshing = null; rerender(); })
      .catch(function () { refreshing = null; });
    return refreshing;
  }
  RP.refresh = refresh;

  // refresh-on-open, so a phone that slept still shows the truth
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && RP.user) refresh();
  });

  function rerender() {
    syncHeaderButton();
    try {
      if (window.state && window.state.mode === 'coach' && window.V10 && window.V10.renderCoach) {
        window.V10.renderCoach();
      }
    } catch (e) {}
  }

  /* ---------------------------------------------------------------- */
  /* boot                                                              */
  /* ---------------------------------------------------------------- */
  function start() {
    mountHeaderButton();
    loadSDK().then(function () {
      RP.sb = window.supabase.createClient(SB_URL, SB_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
      RP.ready = true;
      RP.sb.auth.onAuthStateChange(function (ev, session) {
        RP.user = session ? session.user : null;
        if (!RP.user) {
          RP.profile = null; RP.coach = null; RP.students = [];
          RP.assignments = []; RP.exercises = []; RP.takes = []; RP.messages = [];
          unsubscribe(); syncHeaderButton(); rerender();
          return;
        }
        loadAll().then(function () { subscribe(); rerender(); });
      });
      return RP.sb.auth.getSession();
    }).then(function (r) {
      if (r && r.data && r.data.session) {
        RP.user = r.data.session.user;
        return loadAll().then(function () { subscribe(); rerender(); });
      }
    }).catch(function (e) {
      RP.err = String((e && e.message) || e);
      RP.ready = false;
      syncHeaderButton();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); });
  } else {
    setTimeout(start, 0);
  }
})();
