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
    { id: 'tone',    name: 'Tone',     icon: 'i-volume',      sub: 'How your voice sounds, and the place where it changes from low to high.' },
    { id: 'agility', name: 'Agility',  icon: 'i-shuffle',     sub: 'Moving quickly and cleanly between notes.' },
    { id: 'range',   name: 'Range',    icon: 'i-chevrons-up', sub: 'More usable notes, top and bottom.' },
    { id: 'pitch',   name: 'Pitch',    icon: 'i-target',      sub: 'Hitting the note you meant, and holding it.' },
    { id: 'ear',     name: 'Ear',      icon: 'i-headphones',  sub: 'Hearing it before you sing it.' }
  ];
  var LEVELS = [[0, 'Any level'], [1, 'Beginner'], [2, 'Intermediate'], [3, 'Advanced']];
  var TOOLS = [
    ['btnMatch',   'Match the note',  'A note plays. Sing it back and hold it. Ten notes.'],
    ['btnKbd',     'Keyboard',        'Press a note and sing it back. Nothing is scored here.'],
    ['btnSustain', 'Hold a note',     'Hold one note steady for five seconds. Ten notes.'],
    ['rpIntervalGo', 'Hold the interval', 'A note plays. Sing the one a step above it, and hold it.']
  ];
  var DRILLS = [
    ['tonic',   'Sing the home note', 'A short tune plays. Sing the note it sounds finished on.'],
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
  /* Robert, 17 Sep: never offer a level that has nothing in it, and never
     recommend "Lip trills · ADVANCED" when the list at Advanced is empty. */
  function levelsIn(cat) {
    var have = {};
    listFor(cat, 0).forEach(function (e) { have[e.level] = 1; });
    return LEVELS.filter(function (l) { return l[0] === 0 || have[l[0]]; });
  }
  function effectiveLevel(cat, level) {
    return levelsIn(cat).some(function (l) { return l[0] === level; }) ? level : 0;
  }

  /* ---- one exercise, as a card -------------------------------------- */
  function exCard(e, big) {
    return '<div class="rp-card" data-exopen="' + esc(e.id) + '" style="padding:12px;cursor:pointer;margin-top:8px">' +
      '<div class="row" style="justify-content:space-between;align-items:center;gap:10px">' +
      '<div style="flex:1;min-width:0"><div class="rp-ttl"><span class="rp-name">' + esc(e.name) + '</span>' +
      '<span class="rp-info" role="button" aria-label="What is this?" title="What is this?">i</span>' +
      (e.quiet ? ' <span class="rp-tag" aria-label="quiet, fine where people can hear you">quiet</span>' : '') + '</div>' +
      '<div class="rp-sub">' + esc(lvlName(e.level)) + (e.syl ? ' · on “' + esc(e.syl) + '”' : '') + '</div>' +
      (big ? '<div style="font-size:12.5px;line-height:1.5;margin-top:6px">' + esc(strip(e.what)) + '</div>' : '') +
      '</div>' +
      '<button class="btn primary" data-exstart="' + esc(e.id) + '" style="padding:9px 14px;font-size:12.5px">Start</button>' +
      '</div></div>';
  }
  function wireEx(root, backTo) {
    if (window.RPExample) { try { RPExample.wire(root); } catch (e) {} }
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
    setTimeout(function () {
      var b = $(btnId);
      if (b) b.click();
      else try { console.warn('RP: #' + btnId + ' is not in the page'); } catch (e) {}
    }, 90);
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
      (e.syl ? ' · on “' + esc(e.syl) + '”' : '') + (e.quiet ? ' · can be done quietly' : '') + '</div>' +
      '<button class="btn primary" data-exstart="' + esc(e.id) + '" style="width:100%;padding:13px;font-size:14px">Start</button>' +
      '<div class="rp-card" style="margin-top:14px;padding:13px;font-size:13.5px;line-height:1.55">' +
      '<div class="rp-lab">WHAT</div><div>' + strip(e.what) + '</div>' +
      (window.RPExample ? '<div style="margin-top:10px">' + RPExample.button(e.id) + '</div>' : '') +
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
      if (!levelsIn(cat).some(function (x) { return x[0] === l[0]; })) return;
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
      h += '<div class="measured" style="margin-top:10px">Most of these ask you to sing the answer, not tap it. Hearing a note and singing it are different skills.</div>';
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
          on(b, 'click', function () { sel.level = +b.dataset.lv; try { localStorage.setItem('rp_tr_lvl', sel.level); } catch (e) {} draw(); TR.category(cat, sel.level); });
        });
      } });
  };

  TR.all = function () {
    if (!window.RPPage) return;
    /* Robert, 17 Sep: the "quiet" tag was defined only in an aria-label,
       so a sighted reader met a word with no key. Here is the key, where
       the tag appears most. */
    var h = '<div class="measured"><b>quiet</b> marks the ones that work at ' +
      'speaking volume \u2014 hums, hisses and straws. Fine where people can hear you.</div>';
    CATS.forEach(function (c) {
      var list = listFor(c.id, 0);
      if (!list.length) return;
      h += '<div class="rp-lab" style="margin-top:14px">' + esc(c.name.toUpperCase()) + '</div>';
      list.forEach(function (e) { h += exCard(e, false); });
    });
    RPPage.open({ key: 'all', title: 'Every exercise', sub: 'Tap a name to read what it is.', html: h, backLabel: 'Train',
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
    /* Robert, 17 Sep: the seven categories were on the screen twice — pills
       at the top and a list below, doing two different jobs. The pills are
       gone; the buttons in the body are the way in. The level chips stay:
       they say which level the one below came from. */
    var h = '<div class="segrow" style="margin-top:2px">';
    var eff = effectiveLevel(sel.cat, sel.level);
    levelsIn(sel.cat).forEach(function (l) {
      h += '<button class="seg' + (eff === l[0] ? ' on' : '') + '" data-lv="' + l[0] + '">' + l[1] + '</button>';
    });
    h += '</div>';

    var c = catOf(sel.cat);
    if (sel.cat === 'ear') {
      var dr = DRILLS[new Date().getDate() % DRILLS.length];
      h += '<div class="rp-card hot" style="padding:13px;margin-top:8px"><div class="rp-lab">START HERE · EAR</div>' +
        '<div class="row" style="justify-content:space-between;align-items:center;gap:10px;margin-top:6px">' +
        '<div style="flex:1;min-width:0"><div class="rp-ttl" style="font-size:15px">' + esc(dr[1]) + '</div><div class="rp-sub">' + esc(dr[2]) + '</div></div>' +
        '<button class="btn primary" data-drill="' + dr[0] + '" style="padding:10px 16px;font-size:13px">Play</button></div>' +
        '<button class="btn" data-more="ear" style="width:100%;padding:9px;margin-top:10px;font-size:12.5px">All ear exercises</button></div>';
    } else {
      var one = pickOne(sel.cat, effectiveLevel(sel.cat, sel.level));
      if (one) {
        h += '<div class="rp-card hot" style="padding:13px;margin-top:8px"><div class="rp-lab">START HERE · ' + esc(c.name.toUpperCase()) +
          ' · ' + esc(lvlName(one.level).toUpperCase()) + '</div>' +
          '<div class="row" style="justify-content:space-between;align-items:center;gap:10px;margin-top:6px">' +
          '<div style="flex:1;min-width:0"><div class="rp-ttl" style="font-size:15px" data-exopen="' + esc(one.id) + '">' + esc(one.name) +
          '<span class="rp-info" title="What is this?">i</span></div>' +
          '<div class="rp-sub">' + esc(strip(one.what)) + '</div></div>' +
          '<button class="btn primary" data-exstart="' + esc(one.id) + '" style="padding:10px 16px;font-size:13px">Start</button></div>' +
          (window.RPExample ? '<div style="margin-top:8px">' + RPExample.button(one.id, true) + '</div>' : '') +
          '<button class="btn" data-more="' + esc(sel.cat) + '" style="width:100%;padding:9px;margin-top:10px;font-size:12.5px">All ' +
          esc(c.name.toLowerCase()) + ' exercises</button></div>';
      }
    }

    h += '<div class="row" style="gap:8px;margin-top:10px">' +
      '<button class="btn" data-routine="quiet" style="flex:1;padding:9px;font-size:12.5px">Quiet session</button>' +
      '<button class="btn" data-routine="cool" style="flex:1;padding:9px;font-size:12.5px">Cool-down</button></div>' +
      /* Robert, 17 Sep: every other button on this screen has a line under
         it saying what it does. These two did not. */
      '<div class="rp-sub" style="margin:5px 4px 0;font-size:12px">Quiet session: ten minutes of hums, ' +
      'hisses and straws, at speaking volume, so nobody hears you. Cool-down: three minutes to finish ' +
      'on when you have been singing.</div>';

    /* Robert, 17 Sep: the seven categories were on the screen twice — the
       chips at the top and a tile for each below. The chips choose; See
       more opens the list. The tiles went. */
    h += '<h3 style="margin:18px 4px 2px">Pick what to work on</h3>';
    h += RPPage.tiles([
      /* Robert, 17 Sep: the Pitch Tracker moved to the Sing tab — it belongs
         with singing, not with the exercises. */
      { icon: 'i-layers',   title: 'Choose what to get better at', sub: 'Say what you want to sing better and Repertoire picks the exercises for it.', id: 'rpTileGoals' },
      { icon: 'i-user',     title: 'Body and breath', sub: 'Posture, jaw, tongue, shoulders. No singing.', id: 'rpTileBody' }
    ]);
    /* Robert, 17 Sep: the pillars as their own buttons with icons, in the
       body of the screen, under the tools and above the browse link. */
    h += '<h3 style="margin:18px 4px 2px">What do you want to work on?</h3>';
    h += RPPage.tiles(CATS.map(function (c) {
      return { icon: c.icon, title: c.name, sub: c.sub, data: 'data-more="' + c.id + '"' };
    }));
    h += '<button class="btn" id="rpTrainAll" style="width:100%;padding:11px;margin-top:14px;font-size:12.5px">Browse every exercise</button>';

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
  /* Only what is actually on the screen counts. The first version also
     asked the routine whether it was "on" — and a routine you walk out of
     half-way stays on forever, so the Train tab came back black until a
     refresh. Briar found that one. */
  /* Profile → Help: every exercise, what it is and how to do it */
  function helpRow() {
    var d = $('rpExRow');
    if (d) return;
    d = document.createElement('div');
    d.id = 'rpExRow';
    d.className = 'rp-card';
    d.style.cursor = 'pointer';
    d.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<div><div class="rp-ttl">Every exercise, explained</div>' +
      '<div class="rp-sub">What each one is, and how to do it.</div></div>' +
      '<div style="color:var(--ink-faint);font-size:20px">›</div></div>';
    on(d, 'click', function () {
      try { window.switchMode('train'); } catch (e) {}
      setTimeout(TR.all, 120);
    });
    var host = $('modeYou') || document.body;
    host.appendChild(d);
  }
  setInterval(helpRow, 1500);
  setTimeout(helpRow, 800);

  TR.running = function () { return running(); };
  TR.redraw = function () { try { draw(); } catch (e) {} };
  function running() {
    var ids = ['v10Guided', 'trainLadderBar', 'matchPanel', 'susPanel', 'kbdPanel', 'v10Ear', 'v10Game', 'rtBox', 'rpIntervalPanel'];
    for (var i = 0; i < ids.length; i++) {
      var el = $(ids[i]);
      if (el && el.offsetParent !== null) return true;
    }
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
