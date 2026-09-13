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
    takes: [], messages: [], results: [],
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
  /* The header was a flex row with space-between and four separate children,
     so the gear ended up floating on its own between the logo and the rest —
     centred on nothing. Everything that is not the logo now sits in one group
     pinned to the right, which is where a row of controls belongs. */
  function tidyHeader() {
    var head = document.querySelector('header');
    if (!head) return null;
    var group = head.querySelector('.rp-headtools');
    if (group) return group;
    var logo = head.querySelector('.logo');
    group = document.createElement('div');
    group.className = 'rp-headtools';
    group.style.cssText = 'display:flex;align-items:center;gap:6px;margin-left:auto;flex-wrap:nowrap';
    Array.prototype.slice.call(head.children).forEach(function (el) {
      if (el !== logo) group.appendChild(el);
    });
    head.appendChild(group);
    // the old per-button margins fought the gap
    group.querySelectorAll('.btn, .pill').forEach(function (el) { el.style.marginRight = '0'; });
    return group;
  }

  function mountHeaderButton() {
    if ($('rpAccount')) return;
    var head = document.querySelector('header');
    if (!head) return;
    var group = tidyHeader();
    var b = document.createElement('button');
    b.id = 'rpAccount';
    b.className = 'btn';
    b.style.cssText = 'padding:7px 11px;font-size:12px';
    b.textContent = 'Sign in';
    on(b, 'click', function () { RP.user ? openAccount() : openAuth(); });
    (group || head).appendChild(b);
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
  function sheetEl() { return $('rpSheet'); }
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
        /* This said "Lyon" — a placeholder, so it showed ROBERT'S name to every
           person who ever opened the sign-up box, looking for all the world
           like the browser had filled it in for them. A placeholder should
           say what to type, not name a stranger. */
        '<input id="rpName" class="inp" placeholder="First name is fine" autocomplete="name" ' +
        'style="width:100%;margin-bottom:4px">' +
        '<div class="measured" style="margin-bottom:10px;font-size:11.5px">This is what your coach ' +
        'sees, so use the name he knows you by.</div>';
    }
    h += '<label class="lab">EMAIL</label>' +
      '<input id="rpEmail" class="inp" type="email" autocomplete="email" inputmode="email" ' +
      'autocapitalize="off" spellcheck="false" placeholder="you@example.com" style="width:100%;margin-bottom:10px">' +
      '<label class="lab">PASSWORD</label>' +
      '<input id="rpPass" class="inp" type="password" autocomplete="' + (up ? 'new-password' : 'current-password') +
      '" placeholder="At least 6 characters" style="width:100%;margin-bottom:12px">';

    if (up) {
      h += '<div class="measured" style="margin-bottom:14px">That is all. If you teach, you switch ' +
        'that on afterwards from your name at the top — you stay a singer either way.</div>';
    }

    h += '<button class="btn primary" id="rpGo" style="width:100%;padding:13px;font-size:14px">' +
      (up ? 'Create my account' : 'Sign in') + '</button>';
    if (!up) {
      h += '<button class="btn" id="rpForgot" style="width:100%;padding:11px;margin-top:8px;' +
        'font-size:12.5px">I have forgotten my password</button>';
    }
    h += '<div style="text-align:center;margin:12px 0 8px;color:var(--ink-faint);font-size:12px">or</div>';
    h += '<button class="btn" id="rpLink" style="width:100%;padding:12px">Email me a sign-in link</button>';
    h += '<div id="rpMsg" class="measured" style="margin-top:12px"></div>';
    h += '<button class="btn" id="rpX" style="margin-top:10px;width:100%;padding:11px">Close</button>';

    var box = sheet(h);
    on($('rpTabUp'), 'click', function () { authTab = 'up'; openAuth(); });
    on($('rpTabIn'), 'click', function () { authTab = 'in'; openAuth(); });
    on($('rpX'), 'click', closeSheet);
    on($('rpGo'), 'click', function () { authTab === 'up' ? doSignUp() : doSignIn(); });
    on($('rpLink'), 'click', doMagicLink);
    on($('rpForgot'), 'click', doForgot);
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
    var name = (($('rpName') || {}).value || '').trim();
    var email = ($('rpEmail').value || '').trim();
    var pass = $('rpPass').value || '';
    /* It used to fall back to the email prefix, which is how Robert ended up
       called "lyonxdewitt" on his coach's phone. A name his coach recognises
       is worth one more required box. */
    if (!name) {
      msg('Your name, please — it is what your coach will see.', true);
      try { $('rpName').focus(); } catch (e) {}
      return;
    }
    if (name.length < 2) return msg('That is a bit short for a name.', true);
    if (!email || !pass) return msg('Email and password, please.', true);
    if (pass.length < 6) return msg('Password needs at least 6 characters.', true);
    msg('Creating your account…');
    RP.sb.auth.signUp({
      email: email, password: pass,
      options: { data: { display_name: name },
                 emailRedirectTo: location.href.split('#')[0] }
    }).then(function (r) {
      if (r.error) return msg(r.error.message, true);
      if (!r.data.session) {
        return msg('Account made, but it wants an email confirmation before you can sign in. ' +
                   'Tell Robert — one switch in Supabase turns that off.', true);
      }
      closeSheet();
      toast('Signed in as ' + (name || email));
      /* The six questions live here now — with making an account, not with
         opening the app. Offered, not forced; there is a "Not now". */
      setTimeout(function () {
        try { if (window.RPPlain && !RPPlain.asked()) RPPlain.ask(0); } catch (e) {}
      }, 1100);
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

  /* Until now there was no way back from a forgotten password — not a bad
     screen, NO screen. Anyone who forgot theirs was locked out of their own
     account for good, and the only fix was deleting the account. Supabase has
     always been able to send the email; nothing ever asked it to. */
  /* Supabase limits how often it will email the same address, and returns
     "For security purposes, you can only request this after 6 seconds." Robert
     saw that in red under the button after asking for a sign-in link straight
     after a password reset, and he is right that it reads like the app is
     broken: it names a rule nobody agreed to, in a colour that means error,
     for something that is not an error. It is one email already on its way.

     So: say that, count it down, and put the button back when it is over. */
  function waitSeconds(m) {
    var x = /after (\d+) second/i.exec(m || '');
    return x ? +x[1] : 0;
  }
  function isRateLimit(m) {
    return /only request this after|rate limit|too many requests/i.test(m || '');
  }
  function holdButton(btn, secs, label) {
    if (!btn) return;
    var text = btn.textContent;
    btn.disabled = true;
    var left = secs;
    (function tick() {
      if (!btn.isConnected) return;
      btn.textContent = label + ' (' + left + ')';
      if (left <= 0) { btn.disabled = false; btn.textContent = text; return; }
      left--;
      setTimeout(tick, 1000);
    })();
  }

  function doForgot() {
    var email = ($('rpEmail').value || '').trim();
    if (!email) {
      msg('Put your email address in above first, then tap this again.', true);
      try { $('rpEmail').focus(); } catch (e) {}
      return;
    }
    msg('Sending\u2026');
    RP.sb.auth.resetPasswordForEmail(email, {
      redirectTo: location.href.split('#')[0]
    }).then(function (r) {
      if (r.error) {
        var m = String(r.error.message || '');
        if (isRateLimit(m)) {
          var w = waitSeconds(m) || 15;
          holdButton($('rpForgot'), w, 'I have forgotten my password');
          return msg('One is already on its way — give it ' + w + ' seconds before asking again. ' +
                     'Check your spam folder too; the first one often lands there.');
        }
        if (/invalid/i.test(m) && /email/i.test(m)) {
          return msg('That address was refused as undeliverable. Check it for a typo.', true);
        }
        return msg(m, true);
      }
      /* Deliberately does not say whether that address has an account: that
         would tell a stranger who is signed up here. */
      msg('If there is an account for ' + email + ', a reset link is on its way. ' +
          'Open it on this phone and you can choose a new password.');
    }).catch(function (e) { msg(String(e.message || e), true); });
  }

  /* Coming back from that email. Supabase puts the session in the URL and
     fires PASSWORD_RECOVERY; at that point the person is signed in but has to
     be given somewhere to type the new one, or they just land on the app with
     no idea anything happened. */
  function newPasswordSheet() {
    var h = '<b style="font-size:16px">Choose a new password</b>' +
      '<div class="measured" style="margin-top:6px">You are signed in from the link. ' +
      'Set a password you will remember and this is done.</div>' +
      '<label class="lab" style="margin-top:14px;display:block">NEW PASSWORD</label>' +
      '<input id="rpNewPw" class="inp" type="password" autocomplete="new-password" ' +
      'placeholder="At least 6 characters" style="width:100%;margin-bottom:10px">' +
      '<label class="lab">AND AGAIN</label>' +
      '<input id="rpNewPw2" class="inp" type="password" autocomplete="new-password" ' +
      'style="width:100%;margin-bottom:12px">' +
      '<button class="btn primary" id="rpPwGo" style="width:100%;padding:13px">Save it</button>' +
      '<div id="rpPwMsg" class="measured" style="margin-top:10px"></div>' +
      '<button class="btn" id="rpX" style="width:100%;padding:11px;margin-top:8px">Not now</button>';
    sheet(h);
    on($('rpX'), 'click', closeSheet);
    function save() {
      var a = $('rpNewPw').value || '', b = $('rpNewPw2').value || '', m = $('rpPwMsg');
      function bad(t) { m.textContent = t; m.style.color = 'var(--miss)'; }
      if (a.length < 6) return bad('Six characters or more, please.');
      if (a !== b) return bad('Those two do not match.');
      $('rpPwGo').disabled = true;
      m.textContent = 'Saving\u2026'; m.style.color = 'var(--ink-dim)';
      RP.sb.auth.updateUser({ password: a }).then(function (r) {
        $('rpPwGo').disabled = false;
        if (r.error) return bad(r.error.message);
        closeSheet();
        toast('New password saved. You are signed in.');
      });
    }
    on($('rpPwGo'), 'click', save);
    on($('rpNewPw2'), 'keydown', function (e) { if (e.key === 'Enter') save(); });
  }
  RP.newPasswordSheet = newPasswordSheet;

  function doMagicLink() {
    var email = ($('rpEmail').value || '').trim();
    if (!email) return msg('Put your email in first, then tap this.', true);
    msg('Sending…');
    RP.sb.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: location.href.split('#')[0],
                 shouldCreateUser: authTab === 'up' }
    }).then(function (r) {
      if (!r.error) {
        return msg('Link sent. Open it on this phone and you are in. ' +
                   'If it is not there in a minute, check your spam folder.');
      }
      var m = String(r.error.message || '');
      if (isRateLimit(m)) {
        var w = waitSeconds(m) || 15;
        holdButton($('rpLink'), w, 'Email me a sign-in link');
        return msg('An email has just gone to that address — give it ' + w +
                   ' seconds before asking for another.');
      }
      if (/invalid/i.test(m) && /email/i.test(m)) {
        return msg('That address was refused as undeliverable. Check it for a typo.', true);
      }
      msg(m, true);
    }).catch(function (e) { msg(String(e.message || e), true); });
  }

  /* ------------------------------------------------------------------ */
  /* PROFILE'S "ACCOUNT" ROW.                                            */
  /* v10.1 had one before accounts existed: a name you typed that stayed  */
  /* on the phone, under a sentence saying "there is no account, no      */
  /* server and no sign-in". Both are now false, and a signed-in person   */
  /* saw two accounts on one screen — the real one at the top right and   */
  /* a fake one in Profile saying "Not set". That name was read by        */
  /* nothing else in the app, so the row now shows the real account and   */
  /* opens it. base.html is not modified; this rewrites the row it built. */
  /* ------------------------------------------------------------------ */
  var acctSig = '';
  function accountRow() {
    var host = $('youSlots');
    if (!host) return;
    var fold = null;
    var all = host.querySelectorAll('details.pfold');
    for (var i = 0; i < all.length; i++) {
      var sp = all[i].querySelector('summary span');
      if (sp && /^Account/i.test((sp.textContent || '').trim())) { fold = all[i]; break; }
    }
    if (!fold) return;
    var me = RP.user && RP.profile ? RP.profile : null;
    var sig = me ? 'in:' + (me.display_name || '') + ':' + (me.email || '') + ':' + (me.is_coach ? 'c' : 's') : 'out';
    if (sig === acctSig && fold.dataset.rp) return;
    acctSig = sig;
    fold.dataset.rp = '1';
    var sub = fold.querySelector('summary .psub');
    if (sub) sub.textContent = me ? (me.display_name || me.email || 'Signed in') : 'Not signed in';
    var body = fold.querySelector('.pfoldin');
    if (!body) return;
    if (me) {
      body.innerHTML = '<div class="prow" style="border-top:0"><span class="pk">Name</span><span class="pv">' +
          esc(me.display_name || '\u2014') + '</span></div>' +
        '<div class="prow"><span class="pk">Email</span><span class="pv">' + esc(me.email || '') + '</span></div>' +
        (me.is_coach ? '<div class="prow"><span class="pk">Teaching</span><span class="pv">on \u00b7 code ' +
          esc(me.coach_code || '') + '</span></div>' : '') +
        '<div class="measured" style="margin-top:8px">Your name is what your coach sees. Change it, switch teaching on, ' +
          'or sign out from here.</div>' +
        '<button class="btn" id="rpAcctOpen" style="width:100%;padding:11px;margin-top:10px;font-size:12.5px">Open my account</button>';
    } else {
      body.innerHTML = '<div class="measured">Not signed in. A coach can only find you if you have an account, and ' +
          'your range and your takes only follow you to a new phone with one. Everything else works without.</div>' +
        '<button class="btn primary" id="rpAcctOpen" style="width:100%;padding:11px;margin-top:10px;font-size:12.5px">Sign in or make an account</button>';
    }
    on($('rpAcctOpen'), 'click', function () { (RP.user && RP.profile) ? openAccount() : openAuth(); });
  }
  setInterval(accountRow, 1500);
  setTimeout(accountRow, 1300);

  function openAccount() {
    var p = RP.profile || {};
    var h = '<b style="font-size:16px">' + esc(p.display_name || 'Account') + '</b>' +
      '<div class="measured" style="margin-top:6px">' + esc(p.email || '') +
      (p.is_coach ? ' · teaching' : '') + '</div>';

    /* Requiring a name at sign-up only helps people who have not signed up
       yet. Robert's own account was made before that and is still called
       "lyonxdewitt" on his coach's phone, and deleting the account to fix a
       name is not a thing anyone should have to do. */
    h += '<div class="rp-card" style="margin-top:14px;padding:11px">' +
      '<label class="rp-lab">THE NAME YOUR COACH SEES</label>' +
      '<div class="row" style="gap:7px;margin-top:6px;flex-wrap:nowrap">' +
      '<input id="rpNewName" class="rp-inp" style="flex:1" maxlength="40" ' +
      'autocomplete="name" value="' + esc(p.display_name || '') + '">' +
      '<button class="btn primary" id="rpNameGo" style="padding:11px 15px">Save</button></div>' +
      '<div id="rpNameMsg" class="measured" style="margin-top:7px"></div></div>';

    if (p.is_coach) {
      h += '<div class="rp-card hot" style="margin-top:14px"><div class="rp-lab">YOUR COACH CODE</div>' +
        '<div style="font-size:31px;font-weight:900;letter-spacing:3px">' + esc(p.coach_code || '') + '</div>' +
        '<div class="rp-sub">Read this out to a student. They enter it in their Coach tab and you are paired.</div></div>';
    } else {
      h += '<button class="btn" id="rpBeCoach" style="margin-top:14px;width:100%;padding:12px">I teach singing</button>' +
        '<div class="measured" style="margin-top:6px">Turns on the teaching side. You keep everything you ' +
        'have as a singer — coaches practise too.</div>';
    }
    if (p.is_coach) {
      var mine = p.theme == null || p.theme === '' ? 'inflow' : p.theme;
      h += '<div class="rp-card" style="margin-top:14px;padding:11px">' +
        '<div class="rp-lab">YOUR COLOURS</div>' +
        '<div class="measured" style="margin:5px 0 9px">What you see, and what the students you ' +
        'sign up see if they ask for your look.</div>';
      RP.THEMES.forEach(function (x) {
        var on = (x.id || 'repertoire') === (mine || 'repertoire');
        h += '<button class="btn' + (on ? ' primary' : '') + '" data-theme="' + esc(x.id) +
          '" style="width:100%;padding:10px;margin-bottom:6px;text-align:left">' +
          '<b>' + esc(x.name) + '</b> \u00b7 <span style="font-weight:600;opacity:.8">' +
          esc(x.note) + '</span></button>';
      });
      h += '</div>';
    }

    if (p.is_coach) {
      h += '<div class="row" style="gap:8px;margin-top:14px">' +
        '<button class="btn' + (RP.face === 'auto' ? ' primary' : '') + '" id="rpFaceC" style="flex:1;padding:10px">Coach view</button>' +
        '<button class="btn' + (RP.face === 'student' ? ' primary' : '') + '" id="rpFaceS" style="flex:1;padding:10px">Student view</button></div>' +
        '<div class="measured" style="margin-top:8px">Coaches are learners too — the student view gives you the AI coach for your own practice.</div>';
    }
    if (RP.coach) {
      h += '<div class="rp-card" style="margin-top:14px">' +
        '<div class="row" style="justify-content:space-between;align-items:center;gap:10px">' +
        '<div style="flex:1;min-width:0"><div class="rp-ttl">' + esc(RP.coach.display_name) + '\u2019s colours</div>' +
        '<div class="rp-sub">Off by default. Repertoire looks like Repertoire unless you want their look.</div></div>' +
        '<button class="btn' + (RP.useCoachColours ? ' primary' : '') + '" id="rpCoachCol" ' +
        'style="padding:9px 14px;font-size:12.5px">' + (RP.useCoachColours ? 'On' : 'Off') + '</button></div></div>';
    }
    h += '<button class="btn" id="rpOut" style="margin-top:16px;width:100%;padding:12px">Sign out</button>';
    h += '<button class="btn" id="rpX" style="margin-top:8px;width:100%;padding:11px">Close</button>';
    sheet(h);
    on($('rpX'), 'click', closeSheet);
    on($('rpNameGo'), 'click', saveName);
    (sheetEl() || document).querySelectorAll('[data-theme]').forEach(function (b) {
      on(b, 'click', function () {
        var t = b.dataset.theme;
        RP.sb.from('profiles').update({ theme: t }).eq('id', RP.user.id).then(function (r) {
          if (r.error) return toast(r.error.message);
          RP.profile.theme = t;
          brand();
          RP.refresh().then(function () { openAccount(); });
        });
      });
    });
    on($('rpNewName'), 'keydown', function (e) { if (e.key === 'Enter') saveName(); });
    on($('rpFaceC'), 'click', function () { setFace('auto'); closeSheet(); });
    on($('rpFaceS'), 'click', function () { setFace('student'); closeSheet(); });
    on($('rpCoachCol'), 'click', function () {
      RP.setCoachColours(!RP.useCoachColours);
      openAccount();
    });
    on($('rpBeCoach'), 'click', function () {
      var b = $('rpBeCoach');
      b.disabled = true; b.textContent = 'Switching it on…';
      RP.sb.rpc('become_coach').then(function (r) {
        if (r.error) { b.disabled = false; b.textContent = 'I teach singing'; return RP.toast(r.error.message); }
        RP.refresh().then(function () { openAccount(); RP.toast('Your code is ' + r.data); });
      });
    });
    on($('rpOut'), 'click', function () {
      RP.sb.auth.signOut().then(function () { closeSheet(); toast('Signed out. The app still works.'); });
    });
  }

  function saveName() {
    var i = $('rpNewName'), m = $('rpNameMsg'), b = $('rpNameGo');
    var name = (i.value || '').trim();
    if (name.length < 2) {
      m.textContent = 'That is a bit short for a name.';
      m.style.color = 'var(--miss)';
      return;
    }
    if (name === (RP.profile && RP.profile.display_name)) {
      m.textContent = 'That is already your name.';
      m.style.color = 'var(--ink-dim)';
      return;
    }
    b.disabled = true;
    m.textContent = 'Saving…'; m.style.color = 'var(--ink-dim)';
    RP.sb.from('profiles').update({ display_name: name }).eq('id', RP.user.id)
      .then(function (r) {
        b.disabled = false;
        if (r.error) {
          m.textContent = r.error.message;
          m.style.color = 'var(--miss)';
          return;
        }
        /* The profiles row is what everyone else reads, so that is what had to
           change. The auth record keeps its own copy of the name; bring it
           along so a fresh sign-in does not put the old one back. */
        try { RP.sb.auth.updateUser({ data: { display_name: name } }); } catch (e) {}
        RP.refresh().then(function () {
          openAccount();
          toast('You are ' + name + ' now.');
        });
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
    return !!(RP.profile && RP.profile.is_coach && RP.face !== 'student');
  }
  RP.isCoachFace = isCoachFace;

  /* A query that FAILED and a query that found NOTHING are not the same
     thing, and `r.data || []` read them as the same thing. One dropped
     request during a refresh therefore blanked the screen: "Nothing assigned
     yet" on a phone with six assignments on it. Keep what we had, and mark
     the load as incomplete so the app can say so rather than quietly lie. */
  var loadOk = true;
  function rows(r, keep) {
    if (!r || r.error) { loadOk = false; return keep || []; }
    return r.data || [];
  }

  /* Somebody with a request open is not your coach and not your student, so
     they are in none of the loaded lists — and the profiles table is shut, so
     their name cannot just be looked up. The policy lets the two of you read
     each other while a request is pending; this is the bit that actually goes
     and does it. Without it both sides read "Someone", which is a poor way to
     ask a stranger to teach you. */
  RP.people = RP.people || {};
  function learnNames(ids) {
    var want = (ids || []).filter(function (id) { return id && !RP.people[id]; });
    if (!want.length) return;
    RP.sb.from('profiles').select('id,display_name,email').in('id', want)
      .then(function (r) {
        (r.data || []).forEach(function (p) { RP.people[p.id] = p; });
        if (r.data && r.data.length) { try { rerender(); } catch (e) {} }
      });
  }

  function loadAll() {
    if (!RP.user) return Promise.resolve();
    loadOk = true;
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
      // Everyone is a singer, so the singer's side always loads. If you also
      // teach, the teaching side loads on top of it.
      return loadStudent(uid).then(function () {
        if (RP.profile.is_coach) return loadCoach(uid);
        RP.students = []; RP.exercises = [];
      });
    }).then(function () { brand(); syncHeaderButton(); });
  }

  function loadStudent(uid) {
    var sb = RP.sb;
    return Promise.all([
      sb.from('coach_students').select('coach_id').eq('student_id', uid),
      sb.from('assignments').select('*').eq('student_id', uid).order('created_at', { ascending: false }),
      sb.from('messages').select('*').or('to_id.eq.' + uid + ',from_id.eq.' + uid).order('created_at', { ascending: false }).limit(50),
      sb.from('takes').select('*').eq('student_id', uid).order('created_at', { ascending: false }).limit(50),
      sb.from('results').select('*').eq('student_id', uid).order('created_at', { ascending: false }).limit(300),
      sb.from('coach_requests').select('*').eq('student_id', uid).order('created_at', { ascending: false }),
      sb.from('coach_students').select('*').eq('student_id', uid)
    ]).then(function (r) {
      RP.assignments = rows(r[1], RP.assignments);
      RP.messages    = rows(r[2], RP.messages);
      RP.takes       = rows(r[3], RP.takes);
      RP.results     = rows(r[4], RP.results);
      RP.myRequests  = rows(r[5], RP.myRequests);
      learnNames((RP.myRequests || []).map(function (x) { return x.coach_id; }));
      RP.myPairing = ((r[6] && r[6].data) || [])[0] || RP.myPairing || null;
      if (r[0] && r[0].error) { loadOk = false; return; }   // keep the coach we had
      var link = (r[0].data || [])[0];
      if (!link) { RP.coach = null; return; }
      return sb.from('profiles').select('*').eq('id', link.coach_id).maybeSingle()
        .then(function (c) {
          RP.coach = c.data || null;
          if (!RP.coach) return;
          /* his ladder, so the student can see the rung above the one they
             are on rather than just a bare name with no context */
          return sb.from('coach_levels').select('*').eq('coach_id', RP.coach.id)
            .order('sort').order('created_at')
            .then(function (l) { RP.coachLevels = rows(l, RP.coachLevels); });
        });
    });
  }

  function loadCoach(uid) {
    var sb = RP.sb;
    return Promise.all([
      sb.from('coach_students').select('student_id').eq('coach_id', uid),
      sb.from('exercises').select('*').eq('coach_id', uid).order('sort').order('created_at'),
      sb.from('assignments').select('*').eq('coach_id', uid).order('created_at', { ascending: false }),
      sb.from('takes').select('*').eq('coach_id', uid).order('created_at', { ascending: false }).limit(50),
      sb.from('messages').select('*').or('to_id.eq.' + uid + ',from_id.eq.' + uid).order('created_at', { ascending: false }).limit(50),
      sb.from('coach_requests').select('*').eq('coach_id', uid).eq('status', 'pending').order('created_at'),
      sb.from('coach_levels').select('*').eq('coach_id', uid).order('sort').order('created_at'),
      sb.from('coach_students').select('*').eq('coach_id', uid)
    ]).then(function (r) {
      RP.requests  = rows(r[5], RP.requests);
      RP.levels    = rows(r[6], RP.levels);
      RP.pairings  = rows(r[7], RP.pairings);
      learnNames((RP.requests || []).map(function (x) { return x.student_id; }));
      RP.exercises = rows(r[1], RP.exercises);
      // keep the singer's own rows loaded a moment ago, and add the ones we set
      RP.assignments = merge(RP.assignments, rows(r[2], []));
      RP.takes       = merge(RP.takes,       rows(r[3], []));
      RP.messages    = merge(RP.messages,    rows(r[4], []));
      if (r[0] && r[0].error) { loadOk = false; return; }   // keep the students we had
      var ids = (r[0].data || []).map(function (x) { return x.student_id; });
      if (!ids.length) { RP.students = []; RP.results = []; return; }
      return Promise.all([
        sb.from('profiles').select('*').in('id', ids),
        sb.from('results').select('*').in('student_id', ids).order('created_at', { ascending: false }).limit(600)
      ]).then(function (p) {
        RP.students = rows(p[0], RP.students);
        RP.results = merge(RP.results, rows(p[1], []));
      });
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
  function merge(a, b) {
    var seen = {}, out = [];
    (a || []).concat(b || []).forEach(function (r) {
      var k = r.id || JSON.stringify(r);
      if (seen[k]) return;
      seen[k] = 1; out.push(r);
    });
    return out;
  }

  var channel = null;
  var channelFor = null;          // the uid + coach flag the open channel was built for
  function subscribe() {
    if (!RP.user) return;
    unsubscribe();
    var uid = RP.user.id;
    var coach = !!(RP.profile && RP.profile.is_coach);
    channelFor = uid + '|' + coach;
    var ch = RP.sb.channel('rp-' + uid);

    // the singer's side, for everybody — coaches practise too
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: 'student_id=eq.' + uid },
      function (p) { bump('assignment', p); });
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'coach_students', filter: 'student_id=eq.' + uid },
      function () { refresh(); });
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'coach_requests', filter: 'student_id=eq.' + uid },
      function () { refresh(); });

    if (coach) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'takes', filter: 'coach_id=eq.' + uid },
        function (p) { bump('take', p); });
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'coach_students', filter: 'coach_id=eq.' + uid },
        function () { refresh(); });
      /* somebody asking to be taught should land on his phone the moment they
         ask, the same as everything else here */
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'coach_requests', filter: 'coach_id=eq.' + uid },
        function (p) { bump('request', p); });
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'coach_levels', filter: 'coach_id=eq.' + uid },
        function () { refresh(); });
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'assignments', filter: 'coach_id=eq.' + uid },
        function () { refresh(); });
      ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'results' },
        function () { refresh(); });
    }
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: 'to_id=eq.' + uid },
      function (p) { bump('message', p); });

    ch.subscribe(function (st) { RP.channelState = st; });
    channel = ch;
  }
  function unsubscribe() {
    if (channel) { try { RP.sb.removeChannel(channel); } catch (e) {} channel = null; }
    channelFor = null;
  }

  /* The coach-side listeners — a student pairing with you, a take arriving,
     an assignment changing — are only attached when the channel is built AND
     you are already a coach. subscribe() ran once, at sign-in.

     So anyone who signed up and THEN tapped "I teach singing" spent the rest
     of that session with no coach listeners at all. Ja Ronn reads his code
     out, his student types it in, and his phone shows nothing until he
     reloads the page. Same for takes landing and assignments changing. That
     is the one feature this whole thing rests on, and it was off for exactly
     the person it matters to on exactly the day he starts.

     So: after any reload of the data, if what the channel was built for no
     longer matches who you now are, build it again. */
  function resubscribeIfNeeded() {
    if (!RP.user) return;
    var want = RP.user.id + '|' + !!(RP.profile && RP.profile.is_coach);
    if (channelFor !== want) subscribe();
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
      } else if (kind === 'request' && payload.eventType === 'INSERT' && n) {
        toast('Somebody has asked you to teach them.');
      }
    });
  }

  /* Everything the app measures comes through here. Signed out, nothing
     leaves the phone — the app keeps its own local record as it always did. */
  /* The local copy used to be the object we SENT, which has no created_at —
     the database fills that in. So a result you had just earned came back
     with no date on it, and anything that reads a date off it quietly failed:
     the scorecard's "days practised" counted it under an invalid day, and the
     placement test could not see it at all. Keep what the database actually
     stored, not what we asked it to store. */
  RP.logResult = function (row) {
    try {
      if (!RP.user || !RP.sb || !RP.profile) return;
      var r = { student_id: RP.user.id, coach_id: RP.coach ? RP.coach.id : null };
      Object.keys(row || {}).forEach(function (k) { if (row[k] != null) r[k] = row[k]; });
      return RP.sb.from('results').insert(r).select().then(function (x) {
        if (x.error) return;
        var saved = (x.data && x.data[0]) || null;
        if (!saved) { saved = r; saved.created_at = new Date().toISOString(); }
        RP.results.unshift(saved);
        try { rerender(); } catch (e) {}
        return saved;
      });
    } catch (e) {}
  };

  var refreshing = null;
  /* What Robert hit: he pressed Assign, the app said "Assigned to Lyon", and
     the list did not change. The insert had worked. The refresh that follows
     it had not — and a failed refresh did nothing at all, so the screen sat
     there showing the truth from a moment ago and said nothing about it.
     Silence that looks like success is the failure mode this whole app is
     supposed to refuse.

     So: try again, and if it still will not load, SAY SO on screen. */
  function refresh() {
    if (refreshing) return refreshing;
    refreshing = loadAll()
      .then(function () { return loadOk ? true : retryOnce(); })
      .catch(function () { return retryOnce(); })
      .then(function (good) {
        refreshing = null;
        RP.stale = !good;
        resubscribeIfNeeded();
        rerender();
        showStale();
      });
    return refreshing;
  }

  function retryOnce() {
    return new Promise(function (res) { setTimeout(res, 1200); })
      .then(function () { return loadAll(); })
      .then(function () { return loadOk; })
      .catch(function () { return false; });
  }

  /* One line, at the top, only when it is true. It clears itself the moment a
     load succeeds. */
  function showStale() {
    var b = $('rpStale');
    if (!RP.stale) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('div');
      b.id = 'rpStale';
      b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:70;padding:9px 12px;' +
        'background:var(--miss);color:#fff;font-size:12.5px;font-weight:700;text-align:center;' +
        'cursor:pointer';
      b.textContent = 'Could not reach the server — this screen may be out of date. Tap to try again.';
      b.addEventListener('click', function () {
        b.textContent = 'Trying…';
        refresh();
      });
      document.body.appendChild(b);
    }
  }
  RP.showStale = showStale;
  RP.refresh = refresh;

  // refresh-on-open, so a phone that slept still shows the truth
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && RP.user) refresh();
  });

  /* Whose colours am I looking at?
       · A coach sees his own brand. It is his app as much as anyone's.
       · A student keeps REPERTOIRE unless they ask for their coach's look.
         Robert: "I like our colours the way they are, I don't want them to
         change." So this is off until someone turns it on, per person, per
         phone — never done to them.
     Signed out is always Repertoire. */
  try { RP.useCoachColours = localStorage.getItem('rp_coachcolours') === '1'; } catch (e) {}

  /* A coach's colours belong to the coach. Until now there was only one set,
     so every coach who switched teaching on got In Flow's brown and gold —
     Ja Ronn's brand, on another coach's students' phones. */
  RP.THEMES = [
    { id: 'inflow', name: 'In Flow', note: 'Brown, gold and burnt orange.' },
    { id: 'deep',   name: 'Deep',    note: 'Blue-green and copper.' },
    { id: '',       name: 'Repertoire', note: 'The app\u2019s own colours. No branding.' }
  ];

  function brand() {
    var t = 'repertoire';
    if (RP.profile && RP.profile.is_coach) t = RP.profile.theme || 'inflow';
    else if (RP.coach && RP.useCoachColours) t = RP.coach.theme || 'inflow';
    var b = document.body;
    RP.THEMES.forEach(function (x) {
      if (x.id) b.classList.toggle('rp-brand-' + x.id, t === x.id);
    });
  }
  RP.brand = brand;

  RP.setCoachColours = function (on) {
    RP.useCoachColours = !!on;
    try { localStorage.setItem('rp_coachcolours', on ? '1' : '0'); } catch (e) {}
    brand();
    rerender();
  };

  function rerender() {
    brand();
    syncHeaderButton();
    /* `state` is a top-level const in the build, so window.state is undefined
       and this used to never fire — an assignment arriving live raised the
       toast but left the list exactly as it was until you navigated away and
       back. That is the one thing the whole live-sync idea rests on. */
    try {
      var mode = (typeof state !== 'undefined' && state) ? state.mode : null;
      if (mode === 'coach' && window.V10 && V10.renderCoach) V10.renderCoach();
    } catch (e) {}
  }

  RP.rerender = rerender;   // so this path can actually be tested

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
        if (ev === 'PASSWORD_RECOVERY') {
          /* after the data has loaded, or the sheet opens over a blank app */
          loadAll().then(function () {
            subscribe(); rerender(); newPasswordSheet();
          });
          return;
        }
        if (!RP.user) {
          RP.profile = null; RP.coach = null; RP.students = []; RP.requests = []; RP.myRequests = []; RP.levels = []; RP.coachLevels = []; RP.pairings = []; RP.myPairing = null;
          RP.assignments = []; RP.exercises = []; RP.takes = []; RP.messages = []; RP.results = [];
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
