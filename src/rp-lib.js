/* ======================================================================
   Repertoire Pro — the Library, shaped like Spotify's.

   Robert, 13 Sep, with screenshots: "the layout and functionality of your
   Spotify library."

   What that means on his screen, and what is built here: a title row with
   search and a plus; a row of type chips; a Recents control that sorts;
   rows with square artwork, a name, and one grey line under it; playlists
   that open as their own page with the art, the count, a big play button
   and the tracks; a mini player pinned above the tab bar; and a full
   now-playing screen behind it.

   Nothing about playback is reimplemented. The app already has a queue,
   shuffle, repeat, seeking, lyrics and media keys, all wired to real
   buttons inside #playerBar. That bar is hidden and its buttons are
   clicked — so there is one playback engine, not two that can disagree.
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
  function lib() { try { return (typeof LIB !== 'undefined') ? LIB : null; } catch (e) { return null; } }
  function audio() { try { return (typeof libAudio !== 'undefined') ? libAudio : null; } catch (e) { return null; } }
  function tfmt(s) { try { return fmtT(s); } catch (e) { return '–:––'; } }
  function tap(id) { var b = $(id); if (b) b.click(); }

  var L = window.RPLib = {};
  var chip = 'all';                 /* all | songs | recordings | playlists */
  var sortBy = 'recent';            /* recent | az */
  var grid = false;
  var searching = false;
  try {
    sortBy = localStorage.getItem('rp_lib_sort') || 'recent';
    grid = localStorage.getItem('rp_lib_grid') === '1';
  } catch (e) {}

  /* ---- artwork ------------------------------------------------------ */
  function hue(s) {
    var h = 0, t = String(s || '');
    for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    return h % 360;
  }
  function art(title, icon, size) {
    var a = hue(title), b = (a + 48) % 360;
    return '<div class="rp-art" style="width:' + size + 'px;height:' + size + 'px;' +
      'background:linear-gradient(145deg,hsl(' + a + ',62%,46%),hsl(' + b + ',58%,32%))">' +
      '<svg class="ic" style="width:' + Math.round(size * 0.42) + 'px;height:' + Math.round(size * 0.42) + 'px">' +
      '<use href="#' + icon + '"/></svg></div>';
  }
  function mosaic(songs, size) {
    if (!songs || songs.length < 4) return art((songs && songs[0] && songs[0].title) || 'playlist', 'i-music', size);
    var h = '<div class="rp-art rp-mos" style="width:' + size + 'px;height:' + size + 'px">';
    songs.slice(0, 4).forEach(function (s) {
      var a = hue(s.title), b = (a + 48) % 360;
      h += '<i style="background:linear-gradient(145deg,hsl(' + a + ',62%,46%),hsl(' + b + ',58%,32%))"></i>';
    });
    return h + '</div>';
  }

  /* ---- the data the chips describe ---------------------------------- */
  function songs() { var o = lib(); return (o && o.songs) || []; }
  function plists() { var o = lib(); return (o && o.playlists) || []; }
  function recs() { return songs().filter(function (s) { return s.kind === 'recording'; }); }
  function owned() { return songs().filter(function (s) { return s.kind !== 'recording'; }); }
  function plSongs(p) {
    return (p.songIds || []).map(function (id) {
      return songs().filter(function (s) { return s.id === id; })[0];
    }).filter(Boolean);
  }
  function when(s) { return s.addedAt || 0; }
  function sortList(list) {
    var l = list.slice();
    if (sortBy === 'az') l.sort(function (a, b) { return (a.title || '').toLowerCase() < (b.title || '').toLowerCase() ? -1 : 1; });
    else l.sort(function (a, b) { return when(b) - when(a); });
    return l;
  }

  /* ---- CSS ---------------------------------------------------------- */
  function css() {
    if ($('rpLibCSS')) return;
    var s = document.createElement('style');
    s.id = 'rpLibCSS';
    s.textContent =
      '.rp-art{border-radius:6px;display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden}' +
      '.rp-art .ic{color:rgba(255,255,255,.92)}' +
      '.rp-mos{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:0}' +
      '.rp-mos i{display:block}' +
      '.rp-lrow{display:flex;align-items:center;gap:12px;padding:8px 2px;cursor:pointer}' +
      '.rp-lrow .lt{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '.rp-lrow .ls{font-size:12.5px;color:var(--ink-faint);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}' +
      '.rp-lrow .lm{flex:1;min-width:0}' +
      '.rp-lrow.on .lt{color:var(--accent)}' +
      '.rp-lgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}' +
      '.rp-lgrid .rp-lrow{flex-direction:column;align-items:flex-start;gap:7px}' +
      '.rp-lgrid .rp-lrow .rp-art{width:100%!important;height:auto!important;aspect-ratio:1}' +
      '.rp-lgrid .rp-lrow .lm{width:100%}' +
      '.rp-lgrid .rp-lrow .chev{display:none}' +   /* the whole tile is the tap target */

      /* the real list, restyled into Spotify rows */
      '#libList .librow{border-bottom:0;padding:8px 2px;gap:12px}' +
      /* the app's own grey placeholder thumbnail — ours is the real one now */
      '#libList .librow .libart{display:none}' +
      '#libList .librow .meta .t{font-size:15px;font-weight:700}' +
      '#libList .librow .meta .a{font-size:12.5px;color:var(--ink-faint);font-weight:600;margin-top:2px}' +
      '#libList .librow .rp-tray{display:none;flex-wrap:wrap;gap:4px;width:100%;order:9;padding:2px 0 8px}' +
      '#libList .librow.rp-open .rp-tray{display:flex}' +
      '#libList .librow{flex-wrap:wrap}' +
      '.rp-dots{background:none;border:0;color:var(--ink-faint);font-size:19px;padding:4px 8px;cursor:pointer;flex:none;line-height:1}' +
      /* mini player */
      '#rpMini{position:fixed;left:8px;right:8px;bottom:calc(62px + env(safe-area-inset-bottom,0px));z-index:58;' +
        'background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:8px 10px;' +
        'display:flex;align-items:center;gap:10px;box-shadow:0 6px 22px rgba(0,0,0,.45);cursor:pointer}' +
      '#rpMini .mt{flex:1;min-width:0}' +
      '#rpMini .mt b{display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#rpMini .mt span{display:block;font-size:11.5px;color:var(--ink-faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
      '#rpMini .mp{background:none;border:0;color:var(--ink);font-size:20px;padding:2px 6px;cursor:pointer;flex:none}' +
      '#rpMini .mbar{position:absolute;left:10px;right:10px;bottom:3px;height:2px;background:var(--line);border-radius:2px;overflow:hidden}' +
      '#rpMini .mbar i{display:block;height:100%;background:var(--ink-dim);width:0}' +
      /* now playing */
      '.rp-np{display:flex;flex-direction:column;align-items:center;text-align:center}' +
      '.rp-np .rp-art{width:min(78vw,320px);height:min(78vw,320px);border-radius:10px;margin:6px 0 18px}' +
      '.rp-npt{font-size:23px;font-weight:900;line-height:1.2}' +
      '.rp-npa{font-size:14px;color:var(--ink-faint);font-weight:700;margin-top:4px}' +
      '.rp-tr{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:18px;width:100%}' +
      '.rp-tr button{background:none;border:0;color:var(--ink);cursor:pointer;padding:8px}' +
      '.rp-tr .big{background:var(--ink);color:var(--bg);width:64px;height:64px;border-radius:50%;display:flex;' +
        'align-items:center;justify-content:center}' +
      '.rp-tr .big .ic{width:26px;height:26px;color:var(--bg)}' +
      '.rp-tr .sm .ic{width:19px;height:19px}' +
      '.rp-tr .sm.on .ic{color:var(--accent)}' +
      '.rp-seek{width:100%;margin-top:20px}' +
      '.rp-times{display:flex;justify-content:space-between;font-size:11.5px;color:var(--ink-faint);font-weight:700;margin-top:2px}';
    document.head.appendChild(s);
  }

  /* ---- rows --------------------------------------------------------- */
  function row(o) {
    return '<div class="rp-lrow' + (o.on ? ' on' : '') + '" ' + (o.data || '') + '>' +
      (o.art || art(o.title, o.icon || 'i-music', grid ? 120 : 52)) +
      '<div class="lm"><div class="lt">' + esc(o.title) + '</div>' +
      '<div class="ls">' + esc(o.sub) + '</div></div>' +
      (o.chev === false ? '' : '<div class="chev" style="color:var(--ink-faint);font-size:17px">›</div>') +
      '</div>';
  }

  /* ================================================================== */
  /* THE TAB                                                             */
  /* ================================================================== */
  function listPanel() {
    /* the app's real list and the take filters, kept together */
    var p = $('rpLibListPanel');
    if (!p) {
      p = document.createElement('div');
      p.id = 'rpLibListPanel';
      var host = $('modeLib');
      if (host) host.appendChild(p);
    }
    var bar = $('v10LibBar'), list = $('libList');
    if (bar && bar.parentElement !== p) p.appendChild(bar);
    if (list && list.parentElement !== p) p.appendChild(list);
    return p;
  }

  function hideBaseChrome() {
    var mode = $('modeLib');
    if (!mode) return;
    Array.prototype.slice.call(mode.children).forEach(function (el) {
      if (el.id === 'rpLibTop' || el.id === 'rpLibListPanel') return;
      if (el.id === 'playerBar') { el.style.display = 'none'; return; }
      if (el.classList && el.classList.contains('panel')) {
        /* the karaoke stage has to stay — it is a real screen */
        if (el.querySelector('#libKarBox') || el.id === 'libKarBox') return;
        el.style.display = 'none';
      }
    });
    var e = $('libEmpty'); if (e && e.parentElement && e.parentElement.id !== 'rpLibTop') e.style.display = 'none';
  }

  function setList(id) {
    var o = lib(); if (!o) return;
    o.listId = id;
    var sel = $('plSel');
    if (sel && [].some.call(sel.options, function (x) { return x.value === id; })) sel.value = id;
    try { libRender(); } catch (e) {}
    /* The take filters (All / Exercises / Practice) are only redrawn when the
       whole tab is switched to, so changing the chip left them blank and
       hidden. They belong to the Recordings view — redraw them with it. */
    try { V10.renderLibFilters(); } catch (e) {}
  }

  L.show = function (c) { chip = c; L.draw(); try { window.scrollTo(0, 0); } catch (e) {} };
  L.draw = function () {
    var mode = $('modeLib');
    if (!mode) return;
    css();
    hideBaseChrome();
    var top = $('rpLibTop');
    if (!top) {
      top = document.createElement('div');
      top.id = 'rpLibTop';
      mode.insertBefore(top, mode.firstChild);
    }
    var CHIPS = [['all', 'All'], ['songs', 'Songs'], ['recordings', 'Takes'], ['maps', 'Note maps'], ['playlists', 'Playlists']];
    var h = '<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px">' +
      '<h1 style="margin:0">Your Library</h1>' +
      '<div class="row" style="gap:4px;flex:none">' +
      '<button class="rp-dots" id="rpLibSearch" title="Search"><svg class="ic" style="width:20px;height:20px"><use href="#i-search"/></svg></button>' +
      '<button class="rp-dots" id="rpLibPlus" title="Add"><svg class="ic" style="width:20px;height:20px"><use href="#i-plus"/></svg></button>' +
      '</div></div>';

    if (searching) {
      h += '<input id="rpLibQ" class="rp-inp" placeholder="Search your library…" style="width:100%;margin-bottom:10px">';
    }

    h += '<div class="segrow">';
    CHIPS.forEach(function (c) {
      h += '<button class="seg' + (chip === c[0] ? ' on' : '') + '" data-chip="' + c[0] + '">' + c[1] + '</button>';
    });
    h += '</div>';

    h += '<div class="row" style="justify-content:space-between;align-items:center;margin:12px 2px 8px">' +
      '<button class="rp-dots" id="rpLibSort" style="font-size:13px;font-weight:800;color:var(--ink);padding:2px 0">' +
      '⇅ ' + (sortBy === 'az' ? 'A–Z' : 'Recents') + '</button>' +
      '<button class="rp-dots" id="rpLibGrid" title="Grid or list">' + (grid ? '☰' : '▦') + '</button></div>';

    var body = '';
    var cur = (lib() || {}).cur;
    if (chip === 'all' || chip === 'playlists') {
      if (chip === 'all') {
        body += row({ title: 'All songs', sub: 'Everything you own · ' + owned().length, icon: 'i-music', data: 'data-pin="all"' });
        body += row({ title: 'Takes', sub: 'Everything you have recorded · ' + recs().length, icon: 'i-mic', data: 'data-pin="recordings"' });
        if (window.RPMaps) body += row({ title: 'Note maps', sub: 'Saved from a take · ' + RPMaps.list().length, icon: 'i-activity', data: 'data-pin="maps"' });
      }
      plists().forEach(function (p) {
        var ss = plSongs(p);
        body += row({ title: p.name, sub: 'Playlist · ' + ss.length + (ss.length === 1 ? ' song' : ' songs'),
          art: mosaic(ss, grid ? 120 : 52), data: 'data-pl="' + esc(p.id) + '"' });
      });
      if (chip === 'playlists' && !plists().length) {
        body += '<div class="measured" style="margin-top:10px">No playlists yet. Make one with the ＋ at the top.</div>';
      }
      body = '<div class="' + (grid ? 'rp-lgrid' : '') + '">' + body + '</div>';
    }
    if (chip === 'maps') {
      body = '<div class="' + (grid ? 'rp-lgrid' : '') + '">' + (window.RPMaps ? RPMaps.rowsHtml(row, grid) : '') + '</div>';
    }
    /* Robert, 17 Sep: takes get their own list, organised by exercise */
    if (chip === 'recordings' && window.RPTakes) {
      body = RPTakes.listHtml();
    }
    h += '<div id="rpLibBody">' + body + '</div>';

    if (chip === 'all') {
      h += '<div class="measured" style="margin-top:14px">' + songs().length + ' item' + (songs().length === 1 ? '' : 's') +
        ' on this phone. Songs and takes stay on the phone they were made on; a take you send to your coach reaches them.' +
        (owned().length ? '' : ' Add songs you own with the ＋, or record a take.') + '</div>';
    }
    top.innerHTML = h;

    /* the real list belongs under the chrome for Songs and Recordings */
    var panel = listPanel();
    if (chip === 'recordings' && window.RPTakes) {
      panel.style.display = 'none';
      RPTakes.wire(top);
    } else if (chip === 'songs' || chip === 'recordings') {
      panel.style.display = '';
      setList(chip === 'songs' ? 'all' : 'recordings');
      var q = $('rpLibQ');
      if (q) { q.value = ($('libSearch') || {}).value || ''; }
    } else {
      panel.style.display = 'none';
    }

    on($('rpLibSearch'), 'click', function () { searching = !searching; L.draw(); var q = $('rpLibQ'); if (q) q.focus(); });
    on($('rpLibPlus'), 'click', L.addSheet);
    on($('rpLibSort'), 'click', function () {
      sortBy = sortBy === 'az' ? 'recent' : 'az';
      try { localStorage.setItem('rp_lib_sort', sortBy); } catch (e) {}
      L.draw();
    });
    on($('rpLibGrid'), 'click', function () {
      grid = !grid;
      try { localStorage.setItem('rp_lib_grid', grid ? '1' : '0'); } catch (e) {}
      L.draw();
    });
    on($('rpLibQ'), 'input', function () {
      var s = $('libSearch');
      if (s) { s.value = $('rpLibQ').value; s.dispatchEvent(new Event('input')); }
    });
    top.querySelectorAll('[data-chip]').forEach(function (b) {
      on(b, 'click', function () { chip = b.dataset.chip; L.draw(); });
    });
    top.querySelectorAll('[data-pin]').forEach(function (b) {
      on(b, 'click', function () { chip = b.dataset.pin === 'all' ? 'songs' : b.dataset.pin; L.draw(); window.scrollTo(0, 0); });
    });
    top.querySelectorAll('[data-map]').forEach(function (b) {
      on(b, 'click', function () { if (window.RPMaps) RPMaps.open(b.dataset.map); });
    });
    top.querySelectorAll('[data-pl]').forEach(function (b) {
      on(b, 'click', function () { L.playlist(b.dataset.pl); });
    });
  };

  /* ---- the + sheet --------------------------------------------------- */
  L.addSheet = function () {
    var o = $('rpSheet');
    if (!o) {
      o = document.createElement('div');
      o.id = 'rpSheet';
      o.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.7);' +
        'display:flex;align-items:flex-end;justify-content:center;overflow-y:auto';
      document.body.appendChild(o);
    }
    o.innerHTML = '<div style="background:var(--panel);border:1px solid var(--line);border-radius:18px 18px 0 0;' +
      'width:100%;max-width:560px;padding:20px 16px calc(24px + env(safe-area-inset-bottom,0px))">' +
      '<b style="font-size:18px">Add to your library</b>' +
      '<button class="btn" id="rpAddFiles" style="width:100%;padding:13px;margin-top:14px;text-align:left">' +
      '<b>Songs from this phone</b><div class="rp-sub" style="margin:2px 0 0">MP3, M4A or WAV you already own.</div></button>' +
      '<button class="btn" id="rpAddRec" style="width:100%;padding:13px;margin-top:8px;text-align:left">' +
      '<b>Record something</b><div class="rp-sub" style="margin:2px 0 0">Straight into your recordings.</div></button>' +
      '<button class="btn" id="rpAddPl" style="width:100%;padding:13px;margin-top:8px;text-align:left">' +
      '<b>New playlist</b><div class="rp-sub" style="margin:2px 0 0">Group songs however you like.</div></button>' +
            '<button class="btn" id="rpAddX" style="width:100%;padding:12px;margin-top:14px">Close</button></div>';
    o.style.display = 'flex';
    function shut() { o.style.display = 'none'; o.innerHTML = ''; }
    on($('rpAddX'), 'click', shut);
    on($('rpAddFiles'), 'click', function () { shut(); tap('libAdd'); });
    on($('rpAddRec'), 'click', function () { shut(); tap('btnRec'); });
    on($('rpAddPl'), 'click', function () {
      shut(); tap('btnNewPl');
      /* land where the new one actually is, or it looks like nothing happened */
      setTimeout(function () { chip = 'playlists'; L.draw(); window.scrollTo(0, 0); }, 500);
    });
    on($('rpAddBuy'), 'click', function () { shut(); tap('btnAmz'); });
  };

  /* ================================================================== */
  /* A PLAYLIST'S PAGE                                                   */
  /* ================================================================== */
  L.playlist = function (id) {
    var p = plists().filter(function (x) { return x.id === id; })[0];
    if (!p || !window.RPPage) return;
    var ss = plSongs(p);
    var total = ss.reduce(function (a, s) { return a + (s.duration || 0); }, 0);
    var mins = Math.round(total / 60);
    var h = '<div style="text-align:center;margin-bottom:16px">' + mosaic(ss, 190) .replace('class="rp-art', 'style="margin:0 auto" class="rp-art') +
      '<div style="font-size:24px;font-weight:900;margin-top:14px">' + esc(p.name) + '</div>' +
      '<div class="rp-sub" style="margin-top:3px">' + ss.length + (ss.length === 1 ? ' song' : ' songs') +
      (mins ? ' · about ' + mins + ' min' : '') + '</div></div>';
    h += '<div class="row" style="gap:8px;justify-content:center;margin-bottom:14px">' +
      '<button class="btn" id="rpPlShuffle" style="padding:11px 16px;font-size:12.5px">Shuffle</button>' +
      '<button class="btn primary" id="rpPlPlay" style="padding:11px 22px;font-size:14px">Play</button></div>';
    h += '<div class="row" style="gap:7px;margin-bottom:6px;flex-wrap:nowrap">' +
      '<button class="btn" data-plact="add" style="flex:1;padding:9px;font-size:12px">＋ Add</button>' +
      '<button class="btn" data-plact="rename" style="flex:1;padding:9px;font-size:12px">Rename</button>' +
      '<button class="btn" data-plact="sort" style="flex:1;padding:9px;font-size:12px">⇅ Sort</button>' +
      '<button class="btn" data-plact="del" style="flex:1;padding:9px;font-size:12px;color:var(--miss)">Delete</button></div>';
    if (!ss.length) h += '<div class="measured" style="margin-top:12px">Nothing in this one yet. ＋ Add puts songs in.</div>';

    setList(p.id);
    var panel = listPanel();
    panel.style.display = '';
    RPPage.open({ key: 'pl:' + id, backLabel: 'Library', html: h, node: panel,
      back: function () { try { window.switchMode('lib'); } catch (e) {} setTimeout(L.draw, 60); } });

    on($('rpPlPlay'), 'click', function () { if (ss.length) { try { libPlayAt(ss, 0); } catch (e) {} } });
    on($('rpPlShuffle'), 'click', function () {
      if (!ss.length) return;
      var o = lib();
      if (o && !o.shuffle) tap('pbShuffle');
      try { libPlayAt(ss, Math.floor(Math.random() * ss.length)); } catch (e) {}
    });
    (RPPage.body() || document).querySelectorAll('[data-plact]').forEach(function (b) {
      on(b, 'click', function () { L.plAction(b.dataset.plact, p); });
    });
  };

  L.plAction = function (what, p) {
    if (what === 'sort') {
      sortBy = sortBy === 'az' ? 'recent' : 'az';
      try { localStorage.setItem('rp_lib_sort', sortBy); } catch (e) {}
      p.songIds = sortList(plSongs(p)).map(function (s) { return s.id; });
      try { dbPut('playlists', p); } catch (e) {}
      L.playlist(p.id);
      return;
    }
    if (what === 'rename') {
      var n = prompt('Name this playlist:', p.name);
      if (!n || !n.trim()) return;
      p.name = n.trim();
      try { dbPut('playlists', p); } catch (e) {}
      try { libRenderPlaylists(); } catch (e) {}
      L.playlist(p.id);
      return;
    }
    if (what === 'del') {
      if (!confirm('Delete the playlist "' + p.name + '"? The songs stay in your library.')) return;
      var o = lib();
      o.playlists = o.playlists.filter(function (x) { return x.id !== p.id; });
      try { dbDel('playlists', p.id); } catch (e) {}
      setList('all');
      try { libRenderPlaylists(); } catch (e) {}
      RPPage.back();
      setTimeout(L.draw, 80);
      return;
    }
    /* add */
    var pool = owned().concat(recs()).filter(function (s) { return (p.songIds || []).indexOf(s.id) < 0; });
    if (!pool.length) return alert('Everything in your library is already in this playlist.');
    var o2 = $('rpSheet');
    if (!o2) {
      o2 = document.createElement('div');
      o2.id = 'rpSheet';
      o2.style.cssText = 'position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.7);' +
        'display:flex;align-items:flex-end;justify-content:center;overflow-y:auto';
      document.body.appendChild(o2);
    }
    var hh = '<b style="font-size:18px">Add to ' + esc(p.name) + '</b>' +
      '<div class="measured" style="margin-top:6px">Tap any of them.</div><div style="margin-top:12px">';
    pool.forEach(function (s) {
      hh += '<div class="rp-lrow" data-add="' + esc(s.id) + '">' + art(s.title, s.kind === 'recording' ? 'i-mic' : 'i-music', 44) +
        '<div class="lm"><div class="lt">' + esc(s.title) + '</div><div class="ls">' + esc(s.artist || '') + '</div></div>' +
        '<div style="color:var(--accent);font-size:20px">＋</div></div>';
    });
    hh += '</div><button class="btn" id="rpPlAddX" style="width:100%;padding:12px;margin-top:12px">Done</button>';
    o2.innerHTML = '<div style="background:var(--panel);border:1px solid var(--line);border-radius:18px 18px 0 0;' +
      'width:100%;max-width:560px;padding:20px 16px calc(24px + env(safe-area-inset-bottom,0px));max-height:90vh;overflow-y:auto">' + hh + '</div>';
    o2.style.display = 'flex';
    on($('rpPlAddX'), 'click', function () { o2.style.display = 'none'; o2.innerHTML = ''; L.playlist(p.id); });
    o2.querySelectorAll('[data-add]').forEach(function (b) {
      on(b, 'click', function () {
        if ((p.songIds || []).indexOf(b.dataset.add) < 0) {
          p.songIds = (p.songIds || []).concat([b.dataset.add]);
          try { dbPut('playlists', p); } catch (e) {}
        }
        b.style.opacity = '.4';
        b.querySelector('div:last-child').textContent = '✓';
        try { libRenderPlaylists(); } catch (e) {}
      });
    });
  };

  /* ================================================================== */
  /* THE MINI PLAYER, AND NOW PLAYING                                    */
  /* ================================================================== */
  function playing() {
    var a = audio();
    return !!(a && !a.paused && !a.ended);
  }
  function mini() {
    var o = lib();
    var cur = o && o.cur;
    var m = $('rpMini');
    /* not behind the full player — that is the same thing twice */
    var full = !!(window.RPPage && RPPage.isOpen('np'));
    if (!cur || full) { if (m) m.style.display = 'none'; return; }
    if (!m) {
      m = document.createElement('div');
      m.id = 'rpMini';
      document.body.appendChild(m);
      m.innerHTML = '<div id="rpMiniArt"></div><div class="mt"><b id="rpMiniT"></b><span id="rpMiniA"></span></div>' +
        '<button class="mp" id="rpMiniP"><svg class="ic" style="width:20px;height:20px"><use href="#i-play"/></svg></button>' +
        '<div class="mbar"><i id="rpMiniBar"></i></div>';
      on(m, 'click', function (ev) { if (ev.target.closest('#rpMiniP')) return; L.nowPlaying(); });
      on($('rpMiniP'), 'click', function (ev) { ev.stopPropagation(); tap('pbPlay'); setTimeout(mini, 60); });
    }
    m.style.display = 'flex';
    m.style.position = 'fixed';
    var a = $('rpMiniArt');
    if (a && a.dataset.for !== cur.id) { a.innerHTML = art(cur.title, cur.kind === 'recording' ? 'i-mic' : 'i-music', 40); a.dataset.for = cur.id; }
    var t = $('rpMiniT'), ar = $('rpMiniA');
    if (t && t.textContent !== cur.title) t.textContent = cur.title;
    if (ar) ar.textContent = cur.artist || (cur.kind === 'recording' ? 'Your recording' : '');
    var p = $('rpMiniP');
    if (p) p.innerHTML = '<svg class="ic" style="width:20px;height:20px"><use href="#i-' + (playing() ? 'pause' : 'play') + '"/></svg>';
    var au = audio(), bar = $('rpMiniBar');
    if (bar && au && au.duration) bar.style.width = (au.currentTime / au.duration * 100) + '%';
  }

  L.nowPlaying = function () {
    var o = lib(); var cur = o && o.cur;
    if (!cur || !window.RPPage) return;
    var h = '<div class="rp-np">' + art(cur.title, cur.kind === 'recording' ? 'i-mic' : 'i-music', 300) +
      '<div class="rp-npt" id="rpNpT">' + esc(cur.title) + '</div>' +
      '<div class="rp-npa" id="rpNpA">' + esc(cur.artist || (cur.kind === 'recording' ? 'Your recording' : '')) + '</div>' +
      '<input type="range" class="rp-seek" id="rpNpSeek" min="0" max="1000" value="0">' +
      '<div class="rp-times" style="width:100%"><span id="rpNpNow">0:00</span><span id="rpNpEnd">0:00</span></div>' +
      '<div class="rp-tr">' +
      '<button class="sm" id="rpNpShuf"><svg class="ic"><use href="#i-shuffle"/></svg></button>' +
      '<button id="rpNpPrev"><svg class="ic" style="width:26px;height:26px"><use href="#i-skip-back"/></svg></button>' +
      '<button class="big" id="rpNpPlay"><svg class="ic"><use href="#i-play"/></svg></button>' +
      '<button id="rpNpNext"><svg class="ic" style="width:26px;height:26px"><use href="#i-skip-forward"/></svg></button>' +
      '<button class="sm" id="rpNpRep"><svg class="ic"><use href="#i-repeat"/></svg></button>' +
      '</div>' +
      '<div class="measured" id="rpNpLyric" style="margin-top:20px;min-height:20px"></div>' +
      '</div>';
    RPPage.open({ key: 'np', backLabel: 'Back', html: h });
    on($('rpNpPlay'), 'click', function () { tap('pbPlay'); });
    on($('rpNpPrev'), 'click', function () { tap('pbPrev'); });
    on($('rpNpNext'), 'click', function () { tap('pbNext'); });
    on($('rpNpShuf'), 'click', function () { tap('pbShuffle'); npTick(); });
    on($('rpNpRep'), 'click', function () { tap('pbRepeat'); npTick(); });
    on($('rpNpSeek'), 'input', function () {
      var s = $('libSeek');
      if (s) { s.value = $('rpNpSeek').value; s.dispatchEvent(new Event('input')); }
    });
    npTick();
  };

  var seekHeld = false;
  function npTick() {
    if (!window.RPPage || !RPPage.isOpen('np')) return;
    var o = lib(), cur = o && o.cur, au = audio();
    if (!cur) { RPPage.back(); return; }
    var t = $('rpNpT'); if (t && t.textContent !== cur.title) { RPPage.back(); L.nowPlaying(); return; }
    var pl = $('rpNpPlay');
    if (pl) pl.innerHTML = '<svg class="ic"><use href="#i-' + (playing() ? 'pause' : 'play') + '"/></svg>';
    var sh = $('rpNpShuf'); if (sh) sh.classList.toggle('on', !!(o && o.shuffle));
    var rp = $('rpNpRep'); if (rp) rp.classList.toggle('on', !!(o && o.repeat));
    if (au && au.duration) {
      if (!seekHeld) { var s = $('rpNpSeek'); if (s) s.value = Math.round(au.currentTime / au.duration * 1000); }
      var n = $('rpNpNow'), e = $('rpNpEnd');
      if (n) n.textContent = tfmt(au.currentTime);
      if (e) e.textContent = tfmt(au.duration);
    }
    var ly = $('rpNpLyric'), src = $('libLyric');
    if (ly && src) ly.textContent = src.textContent || '';
  }
  document.addEventListener('pointerdown', function (e) { if (e.target && e.target.id === 'rpNpSeek') seekHeld = true; }, true);
  document.addEventListener('pointerup', function () { seekHeld = false; }, true);

  /* ================================================================== */
  /* the real rows: artwork on the left, the icon buttons behind a ⋯     */
  /* ================================================================== */
  function decorate() {
    var box = $('libList');
    if (!box) return;
    var list = [];
    try { list = visibleSongs(); } catch (e) {}
    Array.prototype.slice.call(box.children).forEach(function (r, i) {
      var s = list[i];
      if (!s) return;
      if (!r.querySelector('.rp-art')) {
        var d = document.createElement('div');
        d.innerHTML = art(s.title, s.kind === 'recording' ? 'i-mic' : 'i-music', 52);
        r.insertBefore(d.firstChild, r.firstChild);
      }
      if (!r.querySelector('.rp-dots')) {
        var tray = document.createElement('div');
        tray.className = 'rp-tray';
        Array.prototype.slice.call(r.querySelectorAll('.iconbtn')).forEach(function (b) { tray.appendChild(b); });
        /* Robert, 16 Sep: a take in the Library should be singable over in
           the Pitch Tracker, and keepable as a note map, from here */
        if (s.kind === 'recording' && s.notes && s.notes.length) {
          var so = document.createElement('button');
          so.className = 'iconbtn'; so.textContent = 'Sing over it'; so.title = 'Open the Pitch Tracker with this take as the guide';
          so.onclick = function (ev) { ev.stopPropagation(); try { switchMode('free'); } catch (e) {} setTimeout(function () { if (window.RPStudio && RPStudio.singOver) RPStudio.singOver(s); }, 250); };
          tray.appendChild(so);
          var nm = document.createElement('button');
          nm.className = 'iconbtn'; nm.textContent = 'Note map'; nm.title = 'Keep the notes on their own';
          nm.onclick = function (ev) { ev.stopPropagation(); if (window.RPMaps) RPMaps.fromTake(s); };
          tray.appendChild(nm);
        }
        var dots = document.createElement('button');
        dots.className = 'rp-dots';
        dots.textContent = '⋯';
        dots.title = 'More';
        dots.onclick = function (ev) { ev.stopPropagation(); r.classList.toggle('rp-open'); };
        r.appendChild(dots);
        r.appendChild(tray);
      }
    });
  }

  /* ================================================================== */
  var ticks = 0;
  setInterval(function () {
    ticks++;
    if (!lib() || !$('modeLib') || !window.RPPage) return;
    mini();
    npTick();
    var on_ = $('modeLib').classList.contains('active');
    if (on_) {
      if (!$('rpLibTop')) L.draw();
      else hideBaseChrome();
    }
    decorate();
  }, 400);
})();
