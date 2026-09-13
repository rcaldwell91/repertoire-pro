/* ======================================================================
   Repertoire Pro — what a coach teaches, and finding one who teaches it.

   Idea bank #5, in Robert's words: coaches differ by genre — classical,
   R&B, country, rock — and the exercises differ with them. So put
   categories on coaches, "and possibly at the skill level too: the coach
   who teaches runs, or screams."

   Two halves, and the order matters.

   The coach fills his in. Nothing is guessed from his name, his students
   or what he has assigned — a coach saying "I teach belting" is a claim
   he is making, and the app should not make it for him.

   The student searches. But a directory of people is a thing you can be
   put into without asking, so nobody appears in it until they tick
   "list me". A coach who only teaches the people he already knows stays
   invisible, keeps his code, and loses nothing.

   The search itself runs through find_coaches() on the server, which
   returns a name, a blurb and the tags — and deliberately not the email
   or the join code. Reading a profile row still requires being that
   person, their coach, their student, or mid-request.

   The skills list is the same list of words as the "I just want to be
   able to…" screen, on purpose. That screen tells somebody chasing rock
   screams to go and find a coach; this is where they land.
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
  function each(root, sel, fn) { if (root) root.querySelectorAll(sel).forEach(fn); }

  var F = window.RPFind = {};

  var GENRES = ['Pop', 'R&B', 'Rock', 'Metal', 'Country', 'Musical theatre',
                'Jazz', 'Classical', 'Gospel', 'Hip-hop', 'Folk', 'Worship'];

  /* the same words the goals screen uses, so the two ends meet */
  var SKILLS = ['Complete beginners', 'Higher notes', 'Runs and riffs', 'Vibrato',
                'Belting', 'Staying in tune', 'Breath', 'Screams and growls',
                'Harmony', 'Performing and nerves'];

  F.GENRES = GENRES;
  F.SKILLS = SKILLS;

  function arr(v) { return Object.prototype.toString.call(v) === '[object Array]' ? v : []; }

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
  F.shut = shut;

  function chip(label, on_, attr) {
    return '<button class="btn' + (on_ ? ' primary' : '') + '" ' + attr +
      ' style="padding:7px 11px;font-size:12px;margin:0 6px 6px 0">' + esc(label) + '</button>';
  }

  function tags(g, t) {
    var all = arr(g).concat(arr(t));
    if (!all.length) return '';
    return '<div style="margin-top:6px">' + all.map(function (x) {
      return '<span class="rp-tag" style="margin:0 5px 5px 0;display:inline-block">' +
        esc(x) + '</span>';
    }).join('') + '</div>';
  }
  F.tags = tags;

  /* ================================================================== */
  /* THE COACH'S SIDE                                                    */
  /* ================================================================== */
  F.edit = function () {
    var me = (window.RP && RP.profile) || {};
    var picked = { g: arr(me.genres).slice(), t: arr(me.teaches).slice() };
    var listed = !!me.listed;
    var blurb = me.blurb || '';

    function draw() {
      var h = '<b style="font-size:18px">What you teach</b>' +
        '<div class="measured" style="margin-top:8px">Your words, not the app’s. Nothing here is ' +
        'worked out from your students or what you have assigned — a coach saying what they teach ' +
        'is a claim they get to make themselves.</div>';

      h += '<div class="rp-lab" style="margin-top:16px">MUSIC</div><div style="margin-top:7px">';
      GENRES.forEach(function (x) {
        h += chip(x, picked.g.indexOf(x) >= 0, 'data-g="' + esc(x) + '"');
      });
      h += '</div>';

      h += '<div class="rp-lab" style="margin-top:12px">WHAT YOU ARE GOOD AT</div><div style="margin-top:7px">';
      SKILLS.forEach(function (x) {
        h += chip(x, picked.t.indexOf(x) >= 0, 'data-t="' + esc(x) + '"');
      });
      h += '</div>';

      h += '<div class="rp-lab" style="margin-top:12px">A LINE ABOUT YOU</div>' +
        '<textarea id="rpFbBlurb" class="rp-inp" rows="3" maxlength="240" style="margin-top:7px" ' +
        'placeholder="Two sentences. What a singer gets from working with you.">' +
        esc(blurb) + '</textarea>';

      h += '<div class="rp-card" style="margin-top:14px;padding:13px">' +
        '<div class="rp-ttl">Let singers find you</div>' +
        '<div class="rp-sub">Off, you are invisible — only people you give your code to, or who ' +
        'know your email, can reach you. On, your name, your line and these tags show up when ' +
        'somebody searches. Your email and your code never do, either way.</div>' +
        '<button class="btn' + (listed ? ' primary' : '') + '" id="rpFbList" style="width:100%;' +
        'padding:10px;margin-top:9px;font-size:12.5px">' +
        (listed ? 'You are listed · tap to come off' : 'Not listed · tap to go on') +
        '</button></div>';

      h += '<div id="rpFbMsg" class="measured" style="margin-top:10px"></div>' +
        '<div class="row" style="gap:7px;margin-top:8px;flex-wrap:nowrap">' +
        '<button class="btn" id="rpFbX" style="flex:1;padding:12px">Close</button>' +
        '<button class="btn primary" id="rpFbSave" style="flex:1;padding:12px">Save</button></div>';

      var box = sheet(h);
      each(box, '[data-g]', function (b) {
        on(b, 'click', function () {
          var v = b.dataset.g, i = picked.g.indexOf(v);
          if (i >= 0) picked.g.splice(i, 1); else picked.g.push(v);
          blurb = ($('rpFbBlurb') || {}).value || blurb;
          draw();
        });
      });
      each(box, '[data-t]', function (b) {
        on(b, 'click', function () {
          var v = b.dataset.t, i = picked.t.indexOf(v);
          if (i >= 0) picked.t.splice(i, 1); else picked.t.push(v);
          blurb = ($('rpFbBlurb') || {}).value || blurb;
          draw();
        });
      });
      on($('rpFbList'), 'click', function () {
        listed = !listed;
        blurb = ($('rpFbBlurb') || {}).value || blurb;
        draw();
      });
      on($('rpFbX'), 'click', shut);
      on($('rpFbSave'), 'click', function () {
        var msg = $('rpFbMsg'), btn = $('rpFbSave');
        blurb = (($('rpFbBlurb') || {}).value || '').trim();
        if (listed && !picked.g.length && !picked.t.length) {
          msg.textContent = 'Pick at least one thing first, or there is nothing to find you by.';
          msg.style.color = 'var(--miss)';
          return;
        }
        btn.disabled = true;
        msg.textContent = 'Saving…'; msg.style.color = 'var(--ink-dim)';
        RP.sb.from('profiles')
          .update({ genres: picked.g, teaches: picked.t, blurb: blurb, listed: listed })
          .eq('id', RP.user.id).select().then(function (r) {
            btn.disabled = false;
            if (r.error) {
              msg.textContent = r.error.message;
              msg.style.color = 'var(--miss)';
              return;
            }
            /* keep what the server actually stored, not what we sent */
            if (r.data && r.data[0]) RP.profile = r.data[0];
            shut();
            RP.toast(listed ? 'Saved. Singers can find you.' : 'Saved.');
            try { V10.renderCoach(); } catch (e) {}
          });
      });
    }
    draw();
  };

  /* one card for the coach's own screen */
  F.myCard = function () {
    var me = (window.RP && RP.profile) || {};
    var g = arr(me.genres), t = arr(me.teaches);
    var any = g.length || t.length;
    return '<div class="rp-card" id="rpFbCard" style="cursor:pointer;padding:12px;margin-top:12px">' +
      '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<div style="flex:1;min-width:0"><div class="rp-ttl">What you teach' +
      (me.listed ? '<span class="rp-tag">listed</span>' : '') + '</div>' +
      '<div class="rp-sub">' + (any
        ? (g.length ? g.join(', ') : 'no styles set') + ' · ' +
          (t.length ? t.join(', ') : 'no skills set')
        : 'Styles and skills. Singers can search by these.') + '</div></div>' +
      '<div style="color:var(--ink-faint);font-size:20px">›</div></div></div>';
  };

  /* ================================================================== */
  /* THE STUDENT'S SIDE                                                  */
  /* ================================================================== */
  var pick = { g: null, t: null };

  F.browse = function (skill) {
    if (skill) pick.t = skill;
    draw([], 'loading');
    load();
  };

  function load() {
    if (!window.RP || !RP.sb) return draw([], 'off');
    RP.sb.rpc('find_coaches', { p_genre: pick.g, p_skill: pick.t }).then(function (r) {
      if (r.error) return draw([], r.error.message);
      draw(r.data || [], null);
    });
  }

  function draw(list, state) {
    var h = '<b style="font-size:18px">Find a coach</b>' +
      '<div class="measured" style="margin-top:8px">Only coaches who have asked to be listed show up ' +
      'here. Tap one to ask them — they decide, and nothing happens until they say yes.</div>';

    h += '<div class="rp-lab" style="margin-top:14px">MUSIC</div><div style="margin-top:7px">';
    h += chip('Any', !pick.g, 'data-fg=""');
    GENRES.forEach(function (x) { h += chip(x, pick.g === x, 'data-fg="' + esc(x) + '"'); });
    h += '</div>';

    h += '<div class="rp-lab" style="margin-top:12px">SKILL</div><div style="margin-top:7px">';
    h += chip('Any', !pick.t, 'data-ft=""');
    SKILLS.forEach(function (x) { h += chip(x, pick.t === x, 'data-ft="' + esc(x) + '"'); });
    h += '</div>';

    h += '<div style="margin-top:16px">';
    if (state === 'loading') {
      h += '<div class="measured">Looking…</div>';
    } else if (state === 'off') {
      h += '<div class="measured">You need to be signed in to search.</div>';
    } else if (state) {
      h += '<div class="measured" style="color:var(--miss)">' + esc(state) + '</div>';
    } else if (!list.length) {
      h += '<div class="rp-card" style="padding:13px"><div class="rp-ttl">Nobody yet</div>' +
        '<div class="rp-sub">No listed coach matches that. This is a real answer, not a loading ' +
        'problem — the app will not pad the list out with people who are not there. If you ' +
        'already know a coach, ask them by email instead.</div></div>';
    } else {
      list.forEach(function (c) {
        h += '<div class="rp-card" style="padding:13px;margin-bottom:8px">' +
          '<div class="rp-ttl">' + esc(c.display_name) + '</div>' +
          (c.blurb ? '<div class="rp-sub">' + esc(c.blurb) + '</div>' : '') +
          tags(c.genres, c.teaches) +
          '<button class="btn primary" data-ask="' + esc(c.id) + '" style="width:100%;padding:10px;' +
          'margin-top:9px;font-size:12.5px">Ask ' + esc(String(c.display_name).split(' ')[0]) +
          ' to teach me</button></div>';
      });
    }
    h += '</div>';
    h += '<div id="rpFsMsg" class="measured" style="margin-top:4px"></div>' +
      '<button class="btn" id="rpFsX" style="width:100%;padding:12px;margin-top:10px">Close</button>';

    var box = sheet(h);
    on($('rpFsX'), 'click', shut);
    each(box, '[data-fg]', function (b) {
      on(b, 'click', function () { pick.g = b.dataset.fg || null; draw([], 'loading'); load(); });
    });
    each(box, '[data-ft]', function (b) {
      on(b, 'click', function () { pick.t = b.dataset.ft || null; draw([], 'loading'); load(); });
    });
    each(box, '[data-ask]', function (b) {
      on(b, 'click', function () {
        var msg = $('rpFsMsg');
        b.disabled = true; b.textContent = 'Asking…';
        RP.sb.rpc('request_coach_by_id', { p_id: b.dataset.ask, p_note: '' }).then(function (r) {
          if (r.error) {
            b.disabled = false; b.textContent = 'Ask';
            msg.textContent = r.error.message;
            msg.style.color = 'var(--miss)';
            return;
          }
          shut();
          RP.toast('Asked ' + r.data + '. It is on their phone now.');
          RP.refresh();
        });
      });
    });
  }
})();
