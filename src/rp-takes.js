/* ======================================================================
   Repertoire Pro — takes, in the Library.

   Robert, 17 Sep: "The takes should have their own list or page in the
   library. We need to be able to name them when we save them and rename
   them whenever we want. In the pitch tracker, 'takes' takes you to the
   takes page in the library, because after a while users will have too
   many to list right there. The takes page is organised by exercise."

   The Library's Takes view lists every take under the thing it was
   recorded on — Pitch Tracker, Free Sing, Song Trainer, or the exercise
   by name — newest first. A row: name, length, day, a play button; tap
   the row and the take has its own page: the note map if it has one,
   Open in Pitch Tracker, Listen, Note map, Rename, Send to coach, Download,
   Delete. Nothing here plays audio itself; it hands to the app's own
   player (libPlayAt) so the mini player and Now playing stay the truth.
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
  function say(t) { try { if (window.RP && RP.toast) RP.toast(t); } catch (e) {} }
  var T = window.RPTakes = {};

  function all() {
    try {
      return (LIB.songs || []).filter(function (s) { return s.kind === 'recording' && s.blob; })
        .sort(function (a, b) { return (b.addedAt || 0) - (a.addedAt || 0); });
    } catch (e) { return []; }
  }
  T.all = all;
  T.get = function (id) { return all().filter(function (s) { return s.id === id; })[0] || null; };

  /* where it was recorded: the exercise by name, or the screen */
  T.groupOf = function (s) {
    if (s.exTitle) return s.exTitle;
    if (s.assignTitle) return s.assignTitle;
    if (s.notes && s.notes.length) return 'Pitch Tracker';
    if (s.fx || /^sing/.test(s.id || '')) return 'Free Sing';
    return 'Learn a song';
  };
  T.groups = function () {
    var g = {}, order = [];
    all().forEach(function (s) {
      var k = T.groupOf(s);
      if (!g[k]) { g[k] = []; order.push(k); }
      g[k].push(s);
    });
    return order.map(function (k) { return { name: k, takes: g[k] }; });
  };

  function fmt(sec) { sec = Math.max(0, Math.round(sec || 0)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function day(ts) {
    if (!ts) return '';
    var d = new Date(ts), now = new Date();
    var one = 86400000, diff = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / one);
    if (diff <= 0) return 'today';
    if (diff === 1) return 'yesterday';
    if (diff < 7) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    return (d.getMonth() + 1) + '/' + d.getDate();
  }
  T.fmt = fmt; T.day = day;

  T.rowHtml = function (s) {
    /* Robert, 17 Sep: "a take he can't sing over" is a bug, not a
       nice-to-have. The two things he would want to do with it live on the
       row, in plain words. */
    return '<div class="rp-take" data-take="' + esc(s.id) + '">' +
      '<div class="ic"><svg class="ic"><use href="#i-mic"/></svg></div>' +
      '<div class="t"><b>' + esc(s.title) + (s.sentAt ? '<span class="rp-tag">sent</span>' : '') + '</b>' +
      '<span>' + fmt(s.duration) + ' · ' + day(s.addedAt) + (s.notes && s.notes.length ? ' · notes' : '') + '</span>' +
      '<span class="rp-doers">' +
        '<button class="rp-do" data-learn="' + esc(s.id) + '">Learn this song</button>' +
        '<button class="rp-do" data-over="' + esc(s.id) + '">Open in Pitch Tracker</button>' +
      '</span></div>' +
      '<button class="pl" data-play="' + esc(s.id) + '" title="Play">▶</button>' +
      '<span class="chev">›</span></div>';
  };

  function css() {
    if ($('rpTakesCSS')) return;
    var st = document.createElement('style');
    st.id = 'rpTakesCSS';
    st.textContent =
      '.rp-take{display:flex;align-items:center;gap:10px;padding:10px 4px;border-top:1px solid var(--line);cursor:pointer}' +
      '.rp-take:first-child{border-top:0}' +
      '.rp-doers{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}' +
      '.rp-do{border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:999px;padding:5px 11px;font-size:11.5px;font-weight:800;cursor:pointer}' +
      '.rp-do:active{transform:scale(.97)}' +
      '.rp-take .ic{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#7c5cff,#ec4899);flex:none;display:flex;align-items:center;justify-content:center}' +
      '.rp-take .ic .ic{width:18px;height:18px;color:#fff}' +
      '.rp-take .t{flex:1;min-width:0}.rp-take .t b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.rp-take .t span{font-size:11.5px;color:var(--ink-faint)}' +
      '.rp-take .pl{width:34px;height:34px;border-radius:50%;background:var(--panel2);border:1px solid var(--line);color:var(--ink);flex:none;font-size:13px;cursor:pointer}' +
      '.rp-take .chev{color:var(--ink-faint);font-size:18px}' +
      '.rp-takes-h{font-size:11px;font-weight:800;letter-spacing:.6px;color:var(--ink-faint);margin:16px 4px 4px}';
    document.head.appendChild(st);
  }

  /* the Library's Takes view */
  T.listHtml = function () {
    css();
    var gs = T.groups();
    if (!gs.length) return '<div class="measured" style="margin-top:12px">No takes yet. Record one on the Pitch Tracker, in Free Sing, or on an exercise.</div>';
    var h = '';
    gs.forEach(function (g) {
      h += '<div class="rp-takes-h">' + esc(g.name.toUpperCase()) + ' · ' + g.takes.length + '</div><div class="rp-card" style="padding:4px 10px">';
      g.takes.forEach(function (s) { h += T.rowHtml(s); });
      h += '</div>';
    });
    return h;
  };
  T.wire = function (root) {
    root.querySelectorAll('[data-play]').forEach(function (b) {
      on(b, 'click', function (ev) { ev.stopPropagation(); var s = T.get(b.dataset.play); if (s) T.play(s); });
    });
    root.querySelectorAll('[data-learn]').forEach(function (b) {
      on(b, 'click', function (ev) {
        ev.stopPropagation();
        var s = T.get(b.dataset.learn);
        if (!s) return;
        try { switchMode('song'); } catch (e) {}
        setTimeout(function () {
          if (window.RPLearnSong) { RPLearnSong.reset(); RPLearnSong.open(s); }
          else try { console.warn('RP: RPLearnSong is not loaded'); } catch (e) {}
        }, 260);
      });
    });
    root.querySelectorAll('[data-over]').forEach(function (b) {
      on(b, 'click', function (ev) {
        ev.stopPropagation();
        var s = T.get(b.dataset.over);
        if (!s) return;
        if (window.RPStudio && RPStudio.openWith) RPStudio.openWith(s);
        else try { console.warn('RP: RPStudio.openWith is not there'); } catch (e) {}
      });
    });
    root.querySelectorAll('[data-take]').forEach(function (r) {
      on(r, 'click', function () { T.open(r.dataset.take); });
    });
  };
  T.play = function (s) {
    try { if (window.RPStudio && RPStudio.stopAll) RPStudio.stopAll(); } catch (e) {}
    try { libPlayAt([s], 0); } catch (e) { say('Could not play it.'); }
  };

  /* rename and delete, through the app's own store */
  T.rename = function (s, title) {
    title = (title || '').trim();
    if (!title) return;
    s.title = title; s.autoTitle = null;
    return dbPut('songs', s).then(function () { try { libRender(); libRenderPlaylists(); } catch (e) {} });
  };
  T.remove = function (s) {
    return dbDel('songs', s.id).then(function () {
      try { LIB.songs = LIB.songs.filter(function (x) { return x.id !== s.id; }); libRenderPlaylists(); libRender(); } catch (e) {}
    });
  };

  /* the take's own page */
  T.open = function (id) {
    var s = T.get(id);
    if (!s || !window.RPPage) return;
    var hasNotes = !!(s.notes && s.notes.length);
    var h = '<div class="rp-sub" style="margin:-6px 0 10px">' + esc(T.groupOf(s)) + ' · ' + fmt(s.duration) + ' · ' + day(s.addedAt) +
      (s.sentAt ? ' · sent to your coach' : '') + '</div>' +
      (hasNotes ? '<canvas id="rpTakeCv" style="display:block;width:100%;border-radius:12px;border:1px solid var(--line)"></canvas>' +
        '<div class="measured" style="margin-top:6px">The notes you sang. Gold lines are C.</div>' : '') +
      (hasNotes ? '<button class="btn primary" id="rpTkOver" style="width:100%;padding:13px;margin-top:12px;font-size:14px">Open in Pitch Tracker</button>' : '') +
      '<div class="row" style="gap:6px;margin-top:8px">' +
      '<button class="btn" id="rpTkPlay" style="flex:1;padding:10px;font-size:12.5px">Listen</button>' +
      (hasNotes ? '<button class="btn" id="rpTkMap" style="flex:1;padding:10px;font-size:12.5px">Note map</button>' : '') +
      '<button class="btn" id="rpTkSend" style="flex:1;padding:10px;font-size:12.5px">' + (s.sentAt ? 'Send again' : 'Send to coach') + '</button></div>' +
      '<div class="row" style="gap:6px;margin-top:6px">' +
      '<button class="btn" id="rpTkName" style="flex:1;padding:10px;font-size:12.5px">Rename</button>' +
      '<button class="btn" id="rpTkDl" style="flex:1;padding:10px;font-size:12.5px">Download</button>' +
      '<button class="btn danger ghost" id="rpTkDel" style="flex:1;padding:10px;font-size:12.5px">Delete</button></div>';
    RPPage.open({ key: 'take:' + id, title: s.title, html: h, backLabel: 'Takes',
      back: function () { try { switchMode('lib'); if (window.RPLib && RPLib.show) RPLib.show('recordings'); } catch (e) {} },
      wire: function (root) {
        var cv = root.querySelector('#rpTakeCv');
        if (cv && window.RPMaps) RPMaps.draw(cv, { notes: s.notes, title: '' }, { height: 220 });
        on(root.querySelector('#rpTkOver'), 'click', function () {
          if (window.RPStudio && RPStudio.openWith) RPStudio.openWith(s);
        });
        on(root.querySelector('#rpTkPlay'), 'click', function () { T.play(s); });
        on(root.querySelector('#rpTkMap'), 'click', function () { if (window.RPMaps) RPMaps.fromTake(s); });
        on(root.querySelector('#rpTkSend'), 'click', function (ev) {
          if (!window.RPSend) return;
          if (!RPSend.canSend()) return say(window.RP && RP.user ? 'No coach yet — put their code in on the Coach tab.' : 'Sign in first, then you can send it to your coach.');
          RPSend.send(s, '', ev.currentTarget);
        });
        on(root.querySelector('#rpTkName'), 'click', function () {
          var t = prompt('Name this take', s.title);
          if (t && t.trim() && t.trim() !== s.title) { T.rename(s, t).then(function () { say('Renamed.'); T.open(s.id); }); }
        });
        on(root.querySelector('#rpTkDl'), 'click', function () { if (window.RPSend) RPSend.download(s); });
        on(root.querySelector('#rpTkDel'), 'click', function () {
          if (!confirm('Delete this take? It cannot be undone.')) return;
          T.remove(s).then(function () { say('Deleted.'); try { RPPage.back(); } catch (e) {} try { if (window.RPLib) RPLib.draw(); } catch (e) {} try { if (window.RPStudio) RPStudio.fillTakes(); } catch (e) {} });
        });
      } });
    setTimeout(function () { var cv = $('rpTakeCv'); if (cv && window.RPMaps) RPMaps.draw(cv, { notes: s.notes, title: '' }, { height: 220 }); }, 60);
  };
})();
