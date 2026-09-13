/* ======================================================================
   Repertoire Pro — the Train tab, the Sing-tab way.

   Robert, 13 Sep: "It's still too much information. Less is more."
   At the top, the categories and the level, side-scrolling. Under that,
   ONE exercise that matches, with Start and a See more. Then a tile per
   category — icon, title, one line, chevron — each opening a page with
   that category's exercises. Everything, all at once, hidden behind one
   button at the bottom. Your range is not on this tab any more; it lives
   in Profile and is offered when you sign up.

   The base app's own Train renderer still runs — its running-exercise
   screens (ladder, guided, note match, sustain) are what Start opens
   into — but its list is hidden and this sits in front of it.
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
  function strip(h) { return String(h || '').replace(/<[^>]+>/g, ''); }

  var TR = window.RPTrain = {};
  var CATS = [
    { id: 'warmup',  name: 'Warm-up',  icon: 'i-zap',         sub: 'Gentle ways to start making sound.' },
    { id: 'breath',  name: 'Breath',   icon: 'i-wind',        sub: 'Letting air out slowly and steadily.' },
    { id: 'tone',    name: 'Tone',     icon: 'i-volume',      sub: 'The colour of the sound, and the gear change.' },
    { id: 'agility', name: 'Agility',  icon: 'i-shuffle',     sub: 'Moving quickly and cleanly between notes.' },
    { id: 'range',   name: 'Range',    icon: 'i-chevrons-up', sub: 'More usable notes, top and bottom.' },
    { id: 'pitch',   name: 'Pitch',    icon: 'i-target',      sub: 'Hitting the note you meant, and holding it.' },
    { id: 'ear',     name: 'Ear',      icon: 'i-headphones',  sub: 'Hearing it before you sing it.' }
  ];
  var LEVELS = [[0, 'Any level'], [1, 'Beginner'], [2, 'Intermediate'], [3, 'Advanced']];
  var TOOLS = [
    ['btnMatch',   'Note Match',   'A note plays, you sing it back and hold it. Ten rounds.'],
    ['btnKbd',     'Keyboard',     'Press a note, hear it, sing it back, see where you landed.'],
    ['btnSustain', 'Sustain Hold', 'Hold one note dead steady for five seconds.']
  ];
  var DRILLS = [
    ['tonic',   'Find home',       'A phrase plays. Sing the note it wants to rest on.'],
    ['degree',  'Name the degree', 'A key is set, then one note plays. Which one is it, 1 to 7?'],
    ['singdeg', 'Sing the degree', 'A key is set. Then sing the one it asks for.'],
    ['hilo',    'Higher or lower', 'Two notes. Which was higher? Listening only.']
  ];

  var sel = { cat: 'warmup', level: 0 };
  try { sel.cat = localStorage.getItem('rp_tr_cat') || 'warmup'; sel.level = +(localStorage.getItem('rp_tr_lvl') || 0); } catch (e) {}
  if (!CATS.some(function (c) { return c.id === sel.cat; })) sel.cat = 'warmup';

  function EX() { try { return (window.V10 && V10.EX) || []; } catch (e) { return []; } }
  function listFor(cat, level) {
    var all = EX();
    var list;
    if (cat === 'pitch') list = all.filter(function (e) { return e.score === 'pitch'; });
    else if (cat === 'ear') list = [];
    else list = all.filter(function (e) { return e.pillar === cat; });
    if (level) list = list.filter(function (e) { return e.level === level; });
    return list.slice().sort(function (a, b) { return a.level - b.level; });
  }
  function catOf(id) { return CATS.filter(function (c) { return c.id === id; })[0]; }
  function lvlName(l) { return ['', 'Beginner', 'Intermediate', 'Advanced'][l] || ''; }

  /* ---- one exercise, as a card -------------------------------------- */
  function exCard(e, big) {
    return '<div class="rp-card" data-exopen="' + esc(e.id) + '" style="padding:12px;cursor:pointer;margin-top:8px">' +
      '<div class="row" style="justify-content:space-between;align-items:center;gap:10px">' +
      '<div style="flex:1;min-width:0"><div class="rp-ttl">' + esc(e.name) +
      (e.quiet ? '<span class="rp-tag">quiet ok</span>' : '') + '</div>' +
      '<div class="rp-sub">' + esc(lvlName(e.level)) + (e.syl ? ' · on “' + esc(e.syl) + '”' : '') + '</div>' +
      (big ? '<div style="font-size:12.5px;line-height:1.5;margin-top:6px">' + esc(strip(e.what)) + '</div>' : '') +
      '</div>' +
      '<button class="btn primary" data-exstart="' + esc(e.id) + '" style="padding:9px 14px;font-size:12.5px">Start</button>' +
      '</div></div>';
  }
  function wireEx(root, backTo) {
    root.querySelectorAll('[data-exstart]').forEach(function (b) {
      on(b, 'click', function (ev) { ev.stopPropagation(); TR.start(b.dataset.exstart); });
    });
    root.querySelectorAll('[data-exopen]').forEach(function (c) {
      on(c, 'click', function (ev) { if (ev.target.closest('[data-exstart]')) return; TR.detail(c.dataset.exopen, backTo); });
    });
    root.querySelectorAll('[data-tool]').forEach(function (b) {
      on(b, 'click', function () { TR.tool(b.dataset.tool); });
    });
    root.querySelectorAll('[data-drill]').forEach(function (b) {
      on(b, 'click', function () { TR.drill(b.dataset.drill); });
    });
  }

  /* everything that runs, runs on the Train tab — so go there first */
  TR.start = function (id) {
    try { window.switchMode('train'); } catch (e) {}
    setTimeout(function () { try { V10.startEx(id); } catch (e) {} }, 90);
  };
  TR.tool = function (btnId) {
    try { window.switchMode('train'); } catch (e) {}
    setTimeout(function () { var b = $(btnId); if (b) b.click(); }, 90);
  };
  TR.drill = function (kind) {
    try { window.switchMode('train'); } catch (e) {}
    setTimeout(function () { try { V10.startDrill(kind); } catch (e) {} }, 90);
  };
  TR.routine = function (key) {
    try { window.switchMode('train'); } catch (e) {}
    setTimeout(function () {
      try { V10.startRoutine(key === 'cool' ? V10.COOLDOWN : V10.ROUTINES[key]); } catch (e) {}
    }, 90);
  };

  /* ---- an exercise's own page --------------------------------------- */
  TR.detail = function (id, backTo) {
    var e = null; try { e = V10.exById(id); } catch (err) {}
    if (!e || !window.RPPage) return;
    var h = '<div class="rp-sub" style="margin:-6px 0 10px">' + esc(lvlName(e.level)) +
      (e.syl ? ' · on “' + esc(e.syl) + '”' : '') + (e.quiet ? ' · quiet ok' : '') + '</div>' +
      '<button class="btn primary" data-exstart="' + esc(e.id) + '" style="width:100%;padding:13px;font-size:14px">Start</button>' +
      '<div class="rp-card" style="margin-top:14px;padding:13px;font-size:13.5px;line-height:1.55">' +
      '<div class="rp-lab">WHAT</div><div>' + strip(e.what) + '</div>' +
      (e.how ? '<div class="rp-lab" style="margin-top:12px">HOW</div><div>' + e.how + '</div>' : '') +
      (e.miss ? '<div class="rp-lab" style="margin-top:12px">WATCH FOR</div><div>' + e.miss + '</div>' : '') +
      (e.why ? '<div class="rp-lab" style="margin-top:12px">WHY IT WORKS</div><div>' + e.why + '</div>' : '') +
      '</div>';
    RPPage.open({ key: 'ex:' + id, title: e.name, html: h, backLabel: backTo ? backTo.label : 'Train',
      back: backTo ? backTo.go : null, wire: function (root) { wireEx(root, null); } });
  };

  /* ---- a category's page -------------------------------------------- */
  TR.category = function (cat, level) {
    var c = catOf(cat);
    if (!c || !window.RPPage) return;
    if (level == null) level = sel.level;
    var h = '<div class="segrow" style="margin-bottom:4px">';
    LEVELS.forEach(function (l) {
      h += '<button class="seg' + (level === l[0] ? ' on' : '') + '" data-lv="' + l[0] + '">' + l[1] + '</button>';
    });
    h += '</div>';
    if (cat === 'pitch') {
      h += '<div class="rp-lab" style="margin-top:12px">GAMES</div>';
      TOOLS.forEach(function (t) {
        h += '<div class="rp-card" style="padding:12px;margin-top:8px"><div class="row" style="justify-content:space-between;align-items:center;gap:10px">' +
          '<div style="flex:1;min-width:0"><div class="rp-ttl">' + esc(t[1]) + '</div><div class="rp-sub">' + esc(t[2]) + '</div></div>' +
          '<button class="btn primary" data-tool="' + t[0] + '" style="padding:9px 14px;font-size:12.5px">Play</button></div></div>';
      });
    }
    if (cat === 'ear') {
      DRILLS.forEach(function (t) {
        h += '<div class="rp-card" style="padding:12px;margin-top:8px"><div class="row" style="justify-content:space-between;align-items:center;gap:10px">' +
          '<div style="flex:1;min-width:0"><div class="rp-ttl">' + esc(t[1]) + '</div><div class="rp-sub">' + esc(t[2]) + '</div></div>' +
          '<button class="btn primary" data-drill="' + t[0] + '" style="padding:9px 14px;font-size:12.5px">Play</button></div></div>';
      });
      h += '<div class="measured" style="margin-top:10px">These ask you to sing back, not just tap an answer — hearing a note and producing it are different skills, and only one of them makes you sing better.</div>';
    }
    var list = listFor(cat, level);
    if (list.length) {
      h += '<div class="rp-lab" style="margin-top:12px">' + (cat === 'pitch' ? 'EXERCISES' : (list.length + ' EXERCISE' + (list.length === 1 ? '' : 'S'))) + '</div>';
      list.forEach(function (e) { h += exCard(e, false); });
    } else if (cat !== 'ear') {
      h += '<div class="measured" style="margin-top:12px">Nothing at that level here. Try Any level.</div>';
    }
    RPPage.open({ key: 'cat:' + cat, title: c.name, sub: c.sub, html: h, backLabel: 'Train',
      wire: function (root) {
        wireEx(root, { label: c.name, go: function () { TR.category(cat, sel.level); } });
        root.querySelectorAll('[data-lv]').forEach(function (b) {
          on(b, 'click', function () { sel.level = +b.dataset.lv; try { localStorage.setItem('rp_tr_lvl', sel.level); } catch (e) {} TR.category(cat, sel.level); });
        });
      } });
  };

  TR.all = function () {
    if (!window.RPPage) return;
    var h = '';
    CATS.forEach(function (c) {
      var list = listFor(c.id, 0);
      if (!list.length) return;
      h += '<div class="rp-lab" style="margin-top:14px">' + esc(c.name.toUpperCase()) + '</div>';
      list.forEach(function (e) { h += exCard(e, false); });
    });
    RPPage.open({ key: 'all', title: 'Every exercise', sub: EX().length + ' of them. Tap a name to read about it.', html: h, backLabel: 'Train',
      wire: function (root) { wireEx(root, { label: 'Every exercise', go: TR.all }); } });
  };

  /* ---- the tab itself ----------------------------------------------- */
  function pickOne(cat, level) {
    var list = listFor(cat, level);
    if (!list.length) list = listFor(cat, 0);
    if (!list.length) return null;
    var d = new Date();
    var n = d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();   /* same one all day, different tomorrow */
    return list[n % list.length];
  }

  function draw() {
    var mode = $('modeTrain');
    if (!mode) return;
    var top = $('rpTrainTop');
    if (!top) {
      top = document.createElement('div');
      top.id = 'rpTrainTop';
      mode.insertBefore(top, mode.firstChild);
    }
    var h = '<div class="segrow" style="margin-top:2px">';
    CATS.forEach(function (c) {
      h += '<button class="seg' + (sel.cat === c.id ? ' on' : '') + '" data-cat="' + c.id + '">' + esc(c.name) + '</button>';
    });
    h += '</div><div class="segrow">';
    LEVELS.forEach(function (l) {
      h += '<button class="seg' + (sel.level === l[0] ? ' on' : '') + '" data-lv="' + l[0] + '">' + l[1] + '</button>';
    });
    h += '</div>';

    var c = catOf(sel.cat);
    if (sel.cat === 'ear') {
      var dr = DRILLS[new Date().getDate() % DRILLS.length];
      h += '<div class="rp-card hot" style="padding:13px;margin-top:8px"><div class="rp-lab">QUICK ONE · EAR</div>' +
        '<div class="row" style="justify-content:space-between;align-items:center;gap:10px;margin-top:6px">' +
        '<div style="flex:1;min-width:0"><div class="rp-ttl" style="font-size:15px">' + esc(dr[1]) + '</div><div class="rp-sub">' + esc(dr[2]) + '</div></div>' +
        '<button class="btn primary" data-drill="' + dr[0] + '" style="padding:10px 16px;font-size:13px">Play</button></div>' +
        '<button class="btn" data-more="ear" style="width:100%;padding:9px;margin-top:10px;font-size:12.5px">See all ear drills</button></div>';
    } else {
      var one = pickOne(sel.cat, sel.level);
      if (one) {
        h += '<div class="rp-card hot" style="padding:13px;margin-top:8px"><div class="rp-lab">QUICK ONE · ' + esc(c.name.toUpperCase()) +
          (sel.level ? ' · ' + esc(lvlName(sel.level).toUpperCase()) : '') + '</div>' +
          '<div class="row" style="justify-content:space-between;align-items:center;gap:10px;margin-top:6px">' +
          '<div style="flex:1;min-width:0"><div class="rp-ttl" style="font-size:15px">' + esc(one.name) + '</div>' +
          '<div class="rp-sub">' + esc(strip(one.what)) + '</div></div>' +
          '<button class="btn primary" data-exstart="' + esc(one.id) + '" style="padding:10px 16px;font-size:13px">Start</button></div>' +
          '<button class="btn" data-more="' + esc(sel.cat) + '" style="width:100%;padding:9px;margin-top:10px;font-size:12.5px">See more ' +
          esc(c.name.toLowerCase()) + '</button></div>';
      }
    }

    h += '<div class="row" style="gap:8px;margin-top:10px">' +
      '<button class="btn" data-routine="quiet" style="flex:1;padding:9px;font-size:12.5px">Quiet session</button>' +
      '<button class="btn" data-routine="cool" style="flex:1;padding:9px;font-size:12.5px">Cool-down</button></div>';

    h += '<h3 style="margin:18px 4px 2px">Work on</h3>';
    h += RPPage.tiles(CATS.map(function (c) {
      var n = c.id === 'ear' ? DRILLS.length : (c.id === 'pitch' ? listFor('pitch', 0).length + TOOLS.length : listFor(c.id, 0).length);
      return { icon: c.icon, title: c.name, sub: c.sub, data: 'data-more="' + c.id + '"' };
    }));

    h += '<h3 style="margin:18px 4px 2px">Also</h3>';
    h += RPPage.tiles([
      { icon: 'i-activity', title: 'Pitch Tracker', sub: 'See the notes you sing, drawn live. Record a take.', id: 'rpTileTracker' },
      { icon: 'i-layers',   title: 'I want to be able to…', sub: 'Say what you want. It picks the exercises.', id: 'rpTileGoals' },
      { icon: 'i-user',     title: 'Before the voice', sub: 'Posture, jaw, tongue, shoulders. No sound.', id: 'rpTileBody' }
    ]);
    h += '<button class="btn" id="rpTrainAll" style="width:100%;padding:11px;margin-top:14px;font-size:12.5px">Every exercise, all at once</button>';

    top.innerHTML = h;
    wireEx(top);
    top.querySelectorAll('[data-cat]').forEach(function (b) {
      on(b, 'click', function () { sel.cat = b.dataset.cat; try { localStorage.setItem('rp_tr_cat', sel.cat); } catch (e) {} draw(); });
    });
    top.querySelectorAll('[data-lv]').forEach(function (b) {
      on(b, 'click', function () { sel.level = +b.dataset.lv; try { localStorage.setItem('rp_tr_lvl', sel.level); } catch (e) {} draw(); });
    });
    top.querySelectorAll('[data-more]').forEach(function (b) {
      on(b, 'click', function () { TR.category(b.dataset.more, sel.level); });
    });
    top.querySelectorAll('[data-routine]').forEach(function (b) {
      on(b, 'click', function () { TR.routine(b.dataset.routine); });
    });
    on($('rpTrainAll'), 'click', TR.all);
    on($('rpTileTracker'), 'click', function () { var g = $('rpTrainPitchGo'); if (g) g.click(); });
    on($('rpTileGoals'), 'click', function () { if (window.RPGoals) RPGoals.open(); });
    on($('rpTileBody'), 'click', function () { if (window.RPBody) RPBody.open(); });
  }

  /* the base's own list, and the rows other modules put at the top, stay
     in the DOM (their buttons are what our tiles click) but out of sight */
  function tidy() {
    ['v10TrainHost', 'rpGoalRow', 'rpBodyRow', 'rpTrainPitch'].forEach(function (id) {
      var el = $(id); if (el && el.style.display !== 'none') el.style.display = 'none';
    });
    var rp = $('rangePanel');
    if (rp && rp.parentElement && rp.parentElement.id === 'modeTrain' && window.RPProfile && RPProfile.takeRange) RPProfile.takeRange(rp);
  }

  /* hide the top while something is actually running, so the exercise is
     the first thing on the screen */
  function running() {
    var ids = ['v10Guided', 'trainLadderBar', 'matchPanel', 'susPanel', 'kbdPanel'];
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el && el.style.display && el.style.display !== 'none') return true;
      if (el && !el.style.display && ids[i] === 'v10Guided') return false;
    }
    try { if (V10.routineState && V10.routineState.on) return true; } catch (e) {}
    return false;
  }
  function watch() {
    var top = $('rpTrainTop');
    if (!top) return;
    var r = running();
    var want = r ? 'none' : '';
    if (top.style.display !== want) top.style.display = want;
  }

  var ticks = 0;
  var iv = setInterval(function () {
    ticks++;
    if (!window.V10 || !V10.EX || !$('modeTrain') || !window.RPPage) { if (ticks > 80) clearInterval(iv); return; }
    tidy();
    if (!$('rpTrainTop')) draw();
    watch();
  }, 400);
})();
