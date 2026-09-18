/* ======================================================================
   Repertoire Pro — note maps, as things of their own.

   Robert, 16 Sep: "I want a note map to be a thing I can keep on its own,
   not only a picture stuck to a take — save it, open it full size on the
   big map, save it as an image, and play it back as a guide."

   A map is the notes of a take (time and pitch, every fraction of a
   second) with a title. It is kept on the phone in localStorage under
   rp_maps — not in the songs store, which the Library plays as audio.
   Forty maps at most; the oldest goes when a new one arrives. It is not
   sent to or from a coach (Robert, 16 Sep: not this round).

   Four things you can do with one: open it full size (its own page with
   the whole map drawn), play it as a guide on the Pitch Tracker (gold
   notes on the big map, driven by a clock instead of a recording, your
   voice in blue over them), save it as a picture, delete it.
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
  var NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function name(m) { try { return midiName(m); } catch (e) { return NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); } }

  var M = window.RPMaps = {};
  var KEY = 'rp_maps', MAX = 40;

  /* ---- storage: notes packed as [t, m] pairs, m null for a gap ---- */
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || '[]') || [];
      return raw.map(function (r) {
        return { id: r.id, title: r.title, at: r.at, from: r.from || '', dur: r.dur || 0,
                 notes: (r.n || []).map(function (p) { return { t: p[0], m: p[1] }; }) };
      });
    } catch (e) { return []; }
  }
  function store(list) {
    var raw = list.map(function (m) {
      return { id: m.id, title: m.title, at: m.at, from: m.from, dur: m.dur,
               n: m.notes.map(function (p) { return [Math.round(p.t * 100) / 100, p.m == null ? null : Math.round(p.m * 100) / 100]; }) };
    });
    try { localStorage.setItem(KEY, JSON.stringify(raw)); return true; }
    catch (e) { return false; }
  }
  M.list = function () { return load().sort(function (a, b) { return (b.at || 0) - (a.at || 0); }); };
  M.get = function (id) { return load().filter(function (m) { return m.id === id; })[0] || null; };
  M.save = function (o) {
    var notes = (o.notes || []).filter(function (p) { return p && typeof p.t === 'number'; });
    if (!notes.length) { say('There are no notes to keep.'); return null; }
    var list = load();
    var m = { id: 'map' + Date.now(), title: o.title || 'Note map', at: Date.now(), from: o.from || '',
              dur: o.dur || notes[notes.length - 1].t || 0, notes: notes };
    list.push(m);
    while (list.length > MAX) list.sort(function (a, b) { return a.at - b.at; }).shift();
    if (!store(list)) { say('Could not keep it — the phone is out of room for maps.'); return null; }
    return m;
  };
  M.remove = function (id) { store(load().filter(function (m) { return m.id !== id; })); };
  M.rename = function (id, title) {
    var list = load(); list.forEach(function (m) { if (m.id === id) m.title = title; }); store(list);
  };

  /* from a kept take: the same notes, kept on their own */
  M.fromTake = function (take) {
    if (!take || !take.notes || !take.notes.length) { say('That take has no notes with it.'); return; }
    var m = M.save({ title: 'Map of ' + take.title, notes: take.notes, from: take.title, dur: take.duration || 0 });
    if (m) { say('Kept as a note map.'); M.open(m.id); }
  };

  /* ---- drawing the whole map on one canvas ---- */
  function bounds(notes) {
    var lo = 200, hi = 0, dur = 0;
    notes.forEach(function (p) { if (p.m != null) { lo = Math.min(lo, p.m); hi = Math.max(hi, p.m); } dur = Math.max(dur, p.t); });
    if (hi < lo) { lo = 57; hi = 69; }
    lo = Math.floor(lo) - 1; hi = Math.ceil(hi) + 1;
    if (hi - lo < 8) { var mid = (hi + lo) / 2; lo = Math.floor(mid - 4); hi = Math.ceil(mid + 4); }
    return { lo: lo, hi: hi, dur: Math.max(dur, 0.5) };
  }
  M.draw = function (cv, map, opts) {
    opts = opts || {};
    var dpr = window.devicePixelRatio || 1;
    var W = opts.width || cv.clientWidth || 360, H = opts.height || 300;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    var g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var dark = !document.body.classList.contains('light');
    g.fillStyle = dark ? '#0d1126' : '#f4f2ee';
    g.fillRect(0, 0, W, H);
    var b = bounds(map.notes);
    var PAD = 34, TOP = 8, BOT = 22;
    var y = function (m) { return TOP + (1 - (m - b.lo) / (b.hi - b.lo)) * (H - TOP - BOT); };
    var x = function (t) { return PAD + (t / b.dur) * (W - PAD - 6); };
    var step = (b.hi - b.lo) > 24 ? 12 : ((b.hi - b.lo) > 14 ? 2 : 1);
    g.font = '700 10px system-ui, sans-serif';
    g.textBaseline = 'middle';
    for (var m = b.lo; m <= b.hi; m++) {
      var isC = ((m % 12) + 12) % 12 === 0;
      if ((m - b.lo) % step && !isC) continue;
      g.strokeStyle = isC ? 'rgba(232,179,74,.55)' : (dark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.10)');
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(PAD, y(m)); g.lineTo(W, y(m)); g.stroke();
      g.fillStyle = isC ? 'rgba(232,179,74,.95)' : (dark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.5)');
      g.textAlign = 'right';
      g.fillText(name(m), PAD - 4, y(m));
    }
    /* seconds along the bottom */
    g.fillStyle = dark ? 'rgba(255,255,255,.45)' : 'rgba(0,0,0,.45)';
    g.textAlign = 'center';
    var every = b.dur > 60 ? 15 : (b.dur > 20 ? 5 : (b.dur > 8 ? 2 : 1));
    for (var s = 0; s <= b.dur; s += every) g.fillText(s + 's', x(s), H - 9);
    /* the line */
    g.beginPath();
    var pen = false, prev = null;
    map.notes.forEach(function (p) {
      if (p.m == null) { pen = false; prev = null; return; }
      var leap = prev && Math.abs(p.m - prev.m) > 6;
      if (!pen || leap) g.moveTo(x(p.t), y(p.m)); else g.lineTo(x(p.t), y(p.m));
      pen = true; prev = p;
    });
    g.strokeStyle = opts.gold ? 'rgba(232,179,74,.95)' : '#4cc9f0';
    g.lineWidth = 2.2; g.lineJoin = 'round'; g.lineCap = 'round';
    g.shadowColor = g.strokeStyle; g.shadowBlur = 6;
    g.stroke();
    g.shadowBlur = 0;
    if (opts.title) {
      g.fillStyle = dark ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.8)';
      g.font = '800 12px system-ui, sans-serif';
      g.textAlign = 'left';
      g.fillText(opts.title, PAD, TOP + 8);
    }
    return cv;
  };

  /* ---- save as a picture ---- */
  M.image = function (map) {
    var cv = document.createElement('canvas');
    M.draw(cv, map, { width: 1200, height: 520, title: map.title });
    try {
      cv.toBlob(function (blob) {
        if (!blob) return say('Could not make the picture.');
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (map.title || 'note-map').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        say('Saved as a picture. It is in your downloads.');
      }, 'image/png');
    } catch (e) { say('Could not make the picture.'); }
  };

  /* ---- the map's own page ---- */
  M.open = function (id) {
    var map = M.get(id);
    if (!map || !window.RPPage) return;
    var d = new Date(map.at || 0);
    var h = '<div class="rp-sub" style="margin:-6px 0 10px">' + esc(fmt(map.dur)) +
      (map.from ? ' · from ' + esc(map.from) : '') + ' · kept ' + (d.getMonth() + 1) + '/' + d.getDate() + '</div>' +
      '<canvas id="rpMapCv" style="display:block;width:100%;border-radius:12px;border:1px solid var(--line)"></canvas>' +
      '<div class="measured" style="margin-top:6px">The notes that were sung. Gold lines are C. Time runs left to right.</div>' +
      '<button class="btn primary" id="rpMapGuide" style="width:100%;padding:13px;margin-top:12px;font-size:14px">Sing along with it on the Pitch Tracker</button>' +
      '<div class="row" style="gap:8px;margin-top:8px">' +
      '<button class="btn" id="rpMapImg" style="flex:1;padding:10px;font-size:12.5px">Save as picture</button>' +
      '<button class="btn" id="rpMapName" style="flex:1;padding:10px;font-size:12.5px">Rename</button>' +
      '<button class="btn danger ghost" id="rpMapDel" style="flex:1;padding:10px;font-size:12.5px">Delete</button></div>';
    RPPage.open({ key: 'map:' + id, title: map.title, html: h, backLabel: 'Library',
      back: function () { try { switchMode('lib'); } catch (e) {} },
      wire: function (root) {
        var cv = root.querySelector('#rpMapCv');
        if (cv) { M.draw(cv, map, { height: 320 }); }
        on(root.querySelector('#rpMapGuide'), 'click', function () { M.guide(map); });
        on(root.querySelector('#rpMapImg'), 'click', function () { M.image(map); });
        on(root.querySelector('#rpMapName'), 'click', function () {
          var t = prompt('Name this map', map.title);
          if (t && t.trim()) { M.rename(map.id, t.trim()); M.open(map.id); }
        });
        on(root.querySelector('#rpMapDel'), 'click', function () {
          if (!confirm('Delete this note map?')) return;
          M.remove(map.id); say('Deleted.');
          try { RPPage.back(); } catch (e) {}
          try { if (window.RPLib) RPLib.draw(); } catch (e) {}
        });
      } });
    /* the page is built before it is laid out; draw again at the real width */
    setTimeout(function () { var cv = $('rpMapCv'); if (cv) M.draw(cv, map, { height: 320 }); }, 60);
  };
  function fmt(sec) { sec = Math.max(0, Math.round(sec || 0)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }

  /* ---- play as a guide: the Pitch Tracker, gold notes, your voice over ---- */
  M.guide = function (map) {
    if (!window.RPStudio || !RPStudio.guide) return say('The Pitch Tracker is not ready.');
    try { switchMode('free'); } catch (e) {}
    setTimeout(function () { RPStudio.guide(map.notes, map.title, map.dur); }, 250);
  };

  /* ---- the Library: a Maps chip and a row per map (rp-lib asks for these) ---- */
  M.rowsHtml = function (row, grid) {
    var list = M.list();
    if (!list.length) return '<div class="measured" style="margin-top:10px">No note maps yet. Open a take and press Note map.</div>';
    var h = '';
    list.forEach(function (m) {
      h += row({ title: m.title, sub: 'Note map · ' + fmt(m.dur) + (m.from ? ' · from ' + m.from : ''), icon: 'i-activity',
                 data: 'data-map="' + esc(m.id) + '"' });
    });
    return h;
  };
})();
