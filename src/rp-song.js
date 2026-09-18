/* =====================================================================
   Repertoire Pro — LEARN A SONG.

   Robert, 17 Sep: "Song Trainer, Sing from your Library and the planned
   learn-a-song idea are all the same engine — pick a song, get its melody
   as a note map, sing against it, get scored. So they become one tile
   with several ways in, and two names disappear."

   This does not reimplement that engine. Everything Song Trainer could do
   still happens in #modeSong: scoring, transpose, the six built-ins, from
   audio, Sing it in. What this adds is the front door — a plain list of
   where the song comes from — and two things the engine did not have:

     · a song brought in as TWO files, the singer alone and the music
       alone, with a slider for each, live while it plays;
     · Listen to the room, which hears a song playing nearby and keeps
       the note map. It never keeps audio.

   The two-file trick is small on purpose. The singer file is stored as
   the song's own `blob`, so the existing mapper reads it (a voice-only
   file maps near-perfectly) and the existing play path plays it. The
   music file rides alongside on a second <audio> element, kept in step
   and mixed by the two sliders. The engine does not know it is there.
   ===================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function go(m) { try { window.switchMode(m); } catch (e) {} }

  var S = window.RPSong = {};

  /* ---------------------------------------------------------------- */
  /* WHO IS UNLOCKED. Robert: "a flag on the profile, nothing more."    */
  /* ---------------------------------------------------------------- */
  var FOUNDERS = ['lyon', 'briar', 'ja ronn', 'jaronn'];
  S.founder = function () {
    try { if (localStorage.getItem('rp_founder') === 'yes') return true; } catch (e) {}
    try {
      var p = window.RP && RP.profile;
      if (p && p.founder) return true;
      var who = ((p && (p.display_name || p.email)) || '').toLowerCase();
      for (var i = 0; i < FOUNDERS.length; i++) if (who.indexOf(FOUNDERS[i]) >= 0) return true;
    } catch (e) {}
    return false;
  };

  /* ---------------------------------------------------------------- */
  /* THE FRONT DOOR                                                     */
  /* ---------------------------------------------------------------- */
  function door(o) {
    return '<button class="mcard" id="' + o.id + '" style="width:100%;text-align:left;border:0">' +
      '<div class="mi"><svg class="ic" style="width:22px;height:22px"><use href="#' + o.icon + '"/></svg></div>' +
      '<div><h4>' + esc(o.title) + (o.lock ? ' <span class="rp-tag">paid</span>' : '') + '</h4>' +
      '<p>' + esc(o.sub) + '</p></div><div class="chev">›</div></button>';
  }

  S.doors = function () {
    if (!window.RPPage) { go('song'); return; }
    var paid = S.founder();
    var h = '<div class="rp-sub" style="margin:0 0 10px">The app maps the melody, then you sing it and see ' +
      'every note you hit. Where is the song coming from?</div>';
    h += door({ id: 'rpLsOwn',   icon: 'i-book',     title: 'A song you own',
                sub: 'Pick one from your Library, or add an audio file now.' });
    h += door({ id: 'rpLsBuilt', icon: 'i-music',    title: 'Built-in songs',
                sub: 'Six that come with the app, ready to sing.' });
    h += door({ id: 'rpLsPair',  icon: 'i-layers',   title: 'A song split in two', lock: !paid,
                sub: paid ? 'The singer on one file, the music on the other. Two sliders, live while it plays.'
                          : 'The singer on one file, the music on the other.' });
    if (!paid) {
      h += '<div class="measured" style="margin-top:6px">Splitting a song into the singer and the music, ' +
        'and the two sliders that let you fade the singer out as you learn it, are the paid part. ' +
        'It is open to founders while we build it.</div>';
    }
    h += door({ id: 'rpLsRoom',  icon: 'i-activity', title: 'Listen to the room',
                sub: 'Play a song on something nearby. The app listens once and keeps the notes.' });
    RPPage.open({
      key: 'learnsong', title: 'Learn a song', sub: 'Pick a song, sing it, see every note you hit.',
      html: h, backLabel: 'Sing',
      wire: function (root) {
        on(root.querySelector('#rpLsOwn'), 'click', S.pickOwn);
        on(root.querySelector('#rpLsBuilt'), 'click', S.pickBuiltIn);
        on(root.querySelector('#rpLsPair'), 'click', function () {
          if (!S.founder()) { locked(); return; }
          S.pairSheet();
        });
        on(root.querySelector('#rpLsRoom'), 'click', S.roomSheet);
      }
    });
  };

  /* A song you own: the list, and the way to add one. Picking one opens
     the map screen \u2014 nothing else. */
  S.pickOwn = function () {
    var songs = [];
    try { songs = (LIB.songs || []).filter(function (x) { return x.kind !== 'recording' && x.blob; }); } catch (e) {}
    var h = '<b style="font-size:18px">A song you own</b>';
    if (!songs.length) {
      h += '<div class="measured" style="margin-top:8px">Nothing here yet. Add an audio file of a song and ' +
        'the app will work out its tune. It reads a voice on its own most accurately.</div>';
    } else {
      h += '<div class="measured" style="margin-top:8px">Pick one. If it has no note map yet, the app ' +
        'works it out when you open it.</div><div style="margin-top:10px">';
      songs.slice(0, 40).forEach(function (x) {
        h += '<button class="rp-card" data-song="' + esc(x.id) + '" style="width:100%;text-align:left;' +
          'padding:12px;margin-top:6px;border:0;cursor:pointer">' +
          '<div class="rp-ttl">' + esc(x.title) + '</div><div class="rp-sub">' +
          (x.notes && x.notes.length ? x.notes.length + ' notes mapped' : 'not mapped yet') +
          (x.musicBlob ? ' \u00b7 singer and music' : '') + '</div></button>';
      });
      h += '</div>';
    }
    h += '<label class="btn primary" style="display:block;width:100%;padding:12px;margin-top:14px;' +
      'text-align:center;cursor:pointer">Add an audio file' +
      '<input type="file" id="rpOwnFile" accept="audio/*" style="display:none"></label>' +
      '<button class="btn" id="rpOwnX" style="width:100%;padding:12px;margin-top:8px">Close</button>';
    var node = sheet(h);
    on($('rpOwnX'), 'click', shut);
    node.querySelectorAll('[data-song]').forEach(function (b) {
      on(b, 'click', function () {
        var x = null;
        try { x = (LIB.songs || []).filter(function (y) { return y.id === b.dataset.song; })[0]; } catch (e) {}
        if (!x) return;
        shut();
        go('song');
        setTimeout(function () { RPLearnSong.open(x); }, 260);
      });
    });
    on($('rpOwnFile'), 'change', async function () {
      var f = $('rpOwnFile').files && $('rpOwnFile').files[0];
      if (!f) return;
      var song = { id: 'aud_' + Date.now(), title: f.name.replace(/\.[^.]+$/, ''),
                   artist: 'Added by you', kind: 'song', blob: f, added: Date.now() };
      try {
        await dbPut('songs', song);
        LIB.songs.push(song);
        libRender();
        fillSongSel();
        shut();
        go('song');
        setTimeout(function () { RPLearnSong.open(song); }, 260);
      } catch (e) { alert('Could not store that here: ' + (e && e.message ? e.message : 'storage refused')); }
    });
  };

  /* The six that come with the app. They have their notes already and no
     file, so the app plays the tune itself \u2014 same screen, same map. */
  S.pickBuiltIn = function () {
    var list = [];
    try { list = SONGS || []; } catch (e) {}
    var h = '<b style="font-size:18px">Built-in songs</b>' +
      '<div class="measured" style="margin-top:8px">These come with the app and are ready to sing. ' +
      'The app plays the tune and you sing over it.</div><div style="margin-top:10px">';
    list.forEach(function (x, i) {
      h += '<button class="rp-card" data-built="' + i + '" style="width:100%;text-align:left;padding:12px;' +
        'margin-top:6px;border:0;cursor:pointer"><div class="rp-ttl">' + esc(x.title) + '</div>' +
        '<div class="rp-sub">' + (x.notes ? x.notes.length + ' notes' : '') + '</div></button>';
    });
    h += '</div><button class="btn" id="rpBiX" style="width:100%;padding:12px;margin-top:12px">Close</button>';
    var node = sheet(h);
    on($('rpBiX'), 'click', shut);
    node.querySelectorAll('[data-built]').forEach(function (b) {
      on(b, 'click', function () {
        var x = list[+b.dataset.built];
        if (!x) return;
        shut();
        go('song');
        setTimeout(function () {
          RPLearnSong.reset();
          /* the app wrote these notes and the app plays them, so their
             times are exact — no microphone or analyser in between */
          RPLearnSong.open({ id: 'built_' + b.dataset.built, title: x.title, notes: x.notes,
                             blob: null, notesFrom: 'exact' });
        }, 260);
      });
    });
  };

  function locked() {
    sheet('<b style="font-size:18px">A song split in two</b>' +
      '<div class="measured" style="margin-top:8px">This is the paid part: the app splitting a song into ' +
      'the singer and the music, and the two sliders that let you fade the singer out as you learn it. ' +
      'It is open to founders while we build it.</div>' +
      '<button class="btn" id="rpLkX" style="width:100%;padding:12px;margin-top:14px">Close</button>');
    on($('rpLkX'), 'click', shut);
  }

  /* ---------------------------------------------------------------- */
  /* TWO FILES: the singer, and the music                               */
  /* ---------------------------------------------------------------- */
  S.pairSheet = function () {
    sheet('<b style="font-size:18px">A song split in two</b>' +
      '<div class="measured" style="margin-top:8px">Two audio files of the same song, the same length: ' +
      'one with only the singer, one with only the music. The app reads the melody off the singer, ' +
      'then you mix the two while you sing.</div>' +
      '<div style="margin-top:14px"><label style="font-size:13px;font-weight:700">What is the song called?</label>' +
      '<input id="rpPrTitle" class="rp-inp" placeholder="Song title" style="width:100%;margin-top:6px"></div>' +
      '<div style="margin-top:12px"><label style="font-size:13px;font-weight:700">The singer, on their own</label>' +
      '<input type="file" id="rpPrVox" accept="audio/*" style="width:100%;margin-top:6px"></div>' +
      '<div style="margin-top:12px"><label style="font-size:13px;font-weight:700">The music, with no singing</label>' +
      '<input type="file" id="rpPrMus" accept="audio/*" style="width:100%;margin-top:6px"></div>' +
      '<div class="notice" id="rpPrMsg" style="margin-top:10px;display:none"></div>' +
      '<button class="btn primary" id="rpPrGo" style="width:100%;padding:12px;margin-top:14px">Add this song</button>' +
      '<button class="btn" id="rpPrX" style="width:100%;padding:12px;margin-top:8px">Close</button>');
    on($('rpPrX'), 'click', shut);
    on($('rpPrGo'), 'click', addPair);
  };

  function msg(t) { var m = $('rpPrMsg'); if (m) { m.innerHTML = t; m.style.display = ''; } }

  async function addPair() {
    var title = ($('rpPrTitle') || {}).value || '';
    var vox = ($('rpPrVox') || {}).files, mus = ($('rpPrMus') || {}).files;
    if (!title.trim()) return msg('Give the song a name first.');
    if (!vox || !vox[0]) return msg('Pick the file with only the singer on it.');
    if (!mus || !mus[0]) return msg('Pick the file with only the music on it.');
    msg('Adding…');
    var song = {
      id: 'pair_' + Date.now(), title: title.trim(), artist: 'Two files',
      kind: 'song', pair: true, cleanVox: true,
      blob: vox[0],          /* the singer: what the mapper reads and the engine plays */
      musicBlob: mus[0],     /* the music: rides alongside, mixed by the sliders */
      added: Date.now()
    };
    try {
      await dbPut('songs', song);
      LIB.songs.push(song);
      /* no swallowing: if the library will not take it, the message has to
         say so rather than claim it was added. */
      libRender();
      fillSongSel();
      msg('Added. Opening it…');
      setTimeout(function () {
        shut();
        go('song');
        setTimeout(function () { RPLearnSong.open(song); }, 300);
      }, 600);
    } catch (e) { msg('Could not store it here: ' + (e && e.message ? e.message : 'storage refused')); }
  }

  /* ---- the two sliders, live ---------------------------------------- */
  var musicEl = null, musicUrl = null, wired = false, lastId = '';

  function cur() {
    try { return SONGLIB.song || null; } catch (e) { return null; }
  }
  function vol(k, d) {
    try { var v = parseFloat(localStorage.getItem('rp_mix_' + k)); return isFinite(v) ? v : d; }
    catch (e) { return d; }
  }
  function setVol(k, v) { try { localStorage.setItem('rp_mix_' + k, String(v)); } catch (e) {} }

  function mixRow(id, label, val) {
    return '<label style="display:block;margin-top:8px"><span style="font-size:12.5px;font-weight:800">' +
      esc(label) + '</span> <output id="' + id + 'Out" style="float:right;font-size:12px;color:var(--ink-dim)">' +
      Math.round(val * 100) + '%</output>' +
      '<input type="range" id="' + id + '" min="0" max="100" value="' + Math.round(val * 100) +
      '" style="width:100%;margin-top:4px"></label>';
  }

  function drawMix() {
    var host = $('modeSong');
    if (!host) return;
    var s = cur();
    var box = $('rpMixBox');
    if (!s) { if (box) box.style.display = 'none'; return; }
    if (!box) {
      box = document.createElement('div');
      box.id = 'rpMixBox';
      box.className = 'panel';
      box.style.marginTop = '10px';
      var anchor = $('libMapPanel');
      if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(box, anchor);
      else host.appendChild(box);
    }
    box.style.display = '';
    if (lastId === s.id) return;
    lastId = s.id;
    if (s.musicBlob) {
      box.innerHTML = '<b style="font-size:13px">The mix</b>' +
        '<div class="measured" style="margin:4px 0 2px">Learn it with the singer up. As you get it, ' +
        'slide the singer down and the music up until you are singing it on your own.</div>' +
        mixRow('rpMixVox', 'Singer', vol('vox', 1)) +
        mixRow('rpMixMus', 'Music', vol('mus', 1));
      on($('rpMixVox'), 'input', function () { apply(); });
      on($('rpMixMus'), 'input', function () { apply(); });
    } else {
      box.innerHTML = '<b style="font-size:13px">Volume</b>' +
        mixRow('rpMixVox', 'The song', vol('vox', 1));
      on($('rpMixVox'), 'input', function () { apply(); });
    }
    apply();
  }

  function apply() {
    var s = cur();
    var v = $('rpMixVox') ? +$('rpMixVox').value / 100 : 1;
    var m = $('rpMixMus') ? +$('rpMixMus').value / 100 : 1;
    if ($('rpMixVoxOut')) $('rpMixVoxOut').textContent = Math.round(v * 100) + '%';
    if ($('rpMixMusOut')) $('rpMixMusOut').textContent = Math.round(m * 100) + '%';
    setVol('vox', v); if ($('rpMixMus')) setVol('mus', m);
    try { libAudio.volume = Math.max(0, Math.min(1, v)); } catch (e) {}
    if (musicEl) musicEl.volume = Math.max(0, Math.min(1, m));
    if (s && s.musicBlob && musicEl && musicUrl !== s.id) loadMusic(s);
  }

  function loadMusic(s) {
    if (!musicEl) return;
    try { if (musicEl.dataset.url) URL.revokeObjectURL(musicEl.dataset.url); } catch (e) {}
    var u = URL.createObjectURL(s.musicBlob);
    musicEl.dataset.url = u;
    musicEl.src = u;
    musicUrl = s.id;
  }

  /* The engine drives libAudio. We follow it, so nothing in the engine
     has to know a second file exists. */
  function wire() {
    if (wired) return;
    var a = null;
    try { a = libAudio; } catch (e) {}
    if (!a) return;
    wired = true;
    musicEl = document.createElement('audio');
    musicEl.id = 'rpMusicEl';
    musicEl.preload = 'auto';
    document.body.appendChild(musicEl);

    function want() { var s = cur(); return !!(s && s.musicBlob); }
    on(a, 'play', function () {
      if (!want()) { try { musicEl.pause(); } catch (e) {} return; }
      var s = cur();
      if (musicUrl !== s.id) loadMusic(s);
      try { musicEl.currentTime = a.currentTime; } catch (e) {}
      musicEl.play().catch(function () {});
    });
    on(a, 'pause', function () { try { musicEl.pause(); } catch (e) {} });
    on(a, 'seeked', function () { if (want()) { try { musicEl.currentTime = a.currentTime; } catch (e) {} } });
    on(a, 'ended', function () { try { musicEl.pause(); } catch (e) {} });
    setInterval(function () {
      if (!want() || a.paused || musicEl.paused) return;
      if (Math.abs(musicEl.currentTime - a.currentTime) > 0.08) {
        try { musicEl.currentTime = a.currentTime; } catch (e) {}
      }
    }, 400);
  }

  /* ---------------------------------------------------------------- */
  /* THE AUDIO DOOR                                                     */
  /*                                                                    */
  /* The pill next to this one takes a note-map file, which is not what */
  /* anybody arriving with a song has. This one takes the audio.        */
  /* ---------------------------------------------------------------- */
  function wireAudioDoor() {
    var inp = $('rpAudioFile');
    if (!inp || inp.dataset.rpWired) return;
    inp.dataset.rpWired = '1';
    on(inp, 'change', async function () {
      var f = inp.files && inp.files[0];
      inp.value = '';
      if (!f) return;
      var song = {
        id: 'aud_' + Date.now(),
        title: f.name.replace(/\.[^.]+$/, ''), artist: 'Added by you',
        kind: 'song', blob: f, added: Date.now()
      };
      try {
        await dbPut('songs', song);
        LIB.songs.push(song);
        libRender();
        fillSongSel();
        var sel = $('songSel');
        if (sel) { sel.value = 'lib:' + song.id; sel.dispatchEvent(new Event('change')); }
        say('Added <b>' + esc(song.title) + '</b>. Next: build its note map.');
      } catch (e) {
        say('Could not store that here: ' + (e && e.message ? e.message : 'storage refused') + '.');
      }
    });
  }

  /* ---------------------------------------------------------------- */
  /* THE MISSING STEP                                                   */
  /*                                                                    */
  /* Robert, 17 Sep: he added a voice-only file, pressed Start, and got */
  /* an empty board. No note bars, no bubbles, dashes for a score. The  */
  /* app had let him start a song it had never listened to, and said    */
  /* nothing. Start now refuses, and says what is missing with the      */
  /* button to fix it one tap away.                                     */
  /* ---------------------------------------------------------------- */
  function needsMap() {
    var s = cur();
    if (!s) return false;                       /* a built-in pack has its notes */
    if (s.notes && s.notes.length) return false;
    try { if (SONGLIB.pack) return false; } catch (e) {}
    return true;
  }

  function guard() {
    var host = $('modeSong');
    if (!host) return;
    var box = $('rpNeedMap');
    var s = cur();
    var play = $('btnPlay');

    if (!needsMap()) {
      if (box) box.style.display = 'none';
      if (play && play.dataset.rpBlocked) {
        play.disabled = false;
        play.title = '';
        delete play.dataset.rpBlocked;
      }
      return;
    }

    if (!box) {
      box = document.createElement('div');
      box.id = 'rpNeedMap';
      box.className = 'panel';
      box.style.cssText = 'margin-top:10px;border-left:3px solid var(--gold)';
      var anchor = $('libMapPanel');
      if (anchor && anchor.parentElement) anchor.parentElement.insertBefore(box, anchor);
      else host.appendChild(box);
    }
    box.style.display = '';
    if (box.dataset.for !== s.id) {
      box.dataset.for = s.id;
      box.innerHTML = '<b style="font-size:14px">This song has no note map yet</b>' +
        '<div class="measured" style="margin:6px 0 10px">The app has to listen to it once and work out ' +
        'the tune. That is what the note bars and the bubbles are drawn from, so until it has done that ' +
        'there is nothing to sing against.</div>' +
        '<label style="display:flex;align-items:flex-start;gap:9px;margin:0 0 10px;cursor:pointer">' +
        '<input type="checkbox" id="rpCleanBox" style="margin-top:3px;flex:none">' +
        '<span style="font-size:12.5px"><b>This is a voice on its own</b> \u2014 no drums, no band, just ' +
        'singing. Tick this and the app reads the tune far more accurately. Leave it unticked for a ' +
        'normal recording with the music still in it.</span></label>' +
        '<button class="btn primary" id="rpNeedMapGo" style="width:100%;padding:12px">Build note map</button>';
      var mine = $('rpCleanBox'), theirs = $('cleanChk');
      if (mine && theirs) {
        mine.checked = theirs.checked;
        on(mine, 'change', function () {
          theirs.checked = mine.checked;
          var sg = cur();
          if (sg) { sg.cleanVox = mine.checked; try { dbPut('songs', sg); } catch (e) {} }
        });
      }
      on($('rpNeedMapGo'), 'click', function () {
        var b = $('btnBuildMap');
        if (b) { b.scrollIntoView({ block: 'center' }); b.click(); }
        else try { console.warn('RP: #btnBuildMap is not in the page'); } catch (e) {}
      });
    }
    /* and Start does not run into an empty board */
    if (play && !play.dataset.rpBlocked) {
      play.dataset.rpBlocked = '1';
      play.disabled = true;
      play.title = 'Build the note map first';
    }
  }

  /* Tidy the panel for a song with no map: the only thing that matters is
     Build note map. Preview and Edit already hide themselves; the MIDI
     import and the voice picker were still sitting in front of it. */
  function tidyMapPanel() {
    var panel = $('libMapPanel');
    if (!panel || panel.style.display === 'none') return;
    var row = panel.querySelector('.row');
    var build = $('btnBuildMap');
    if (row && build && row.firstChild !== build.parentElement && build.parentElement === row) {
      row.insertBefore(build, row.firstChild);
    }
    var hide = needsMap();
    var midi = $('midiFile');
    if (midi && midi.parentElement) midi.parentElement.style.display = hide ? 'none' : '';
    var vs = $('voiceSel');
    if (vs) vs.style.display = hide ? 'none' : '';
  }

  /* ---- is this a voice on its own? --------------------------------- */
  /* An acapella is the best case for mapping and nothing told him to say
     so. A voice with no band under it has very little low end: no kick,
     no bass. Measure that rather than ask. */
  var sniffed = {};
  function sniff(s) {
    if (!s || !s.blob || sniffed[s.id]) return;
    sniffed[s.id] = 'busy';
    var c = null;
    try { ensureCtx(); c = ctx; } catch (e) {}
    if (!c) { sniffed[s.id] = null; return; }   /* no audio yet; try again next tick */
    s.blob.arrayBuffer().then(function (raw) { return c.decodeAudioData(raw.slice(0)); })
      .then(function (buf) {
        var d = buf.getChannelData(0);
        var sr = buf.sampleRate;
        var from = Math.floor(d.length * 0.35), n = Math.min(Math.floor(sr * 15), d.length - from);
        if (n < sr) { sniffed[s.id] = 'done'; return; }
        /* Four one-pole sections at 120 Hz, so the slope is steep enough to
           separate a kick and a bass from a voice. One pole was not: at
           261 Hz it still passed 40% of a plain sung note. */
        var a = Math.exp(-2 * Math.PI * 120 / sr), b = 1 - a;
        var p1 = 0, p2 = 0, p3 = 0, p4 = 0, lo = 0, all = 0;
        for (var i = 0; i < n; i++) {
          var x = d[from + i];
          p1 = a * p1 + b * x; p2 = a * p2 + b * p1;
          p3 = a * p3 + b * p2; p4 = a * p4 + b * p3;
          lo += p4 * p4; all += x * x;
        }
        var frac = all > 0 ? Math.sqrt(lo / all) : 0;
        sniffed[s.id] = 'done';
        s.lowFrac = frac;
        /* Only when it is not a close call. I have no real acapella and no
           real full mix to calibrate against, so this ticks a box on a
           clear reading and says why; everything else is left to the
           singer, with the box in front of them rather than buried. */
        if (frac < 0.12 && !s.cleanVox) {
          s.cleanVox = true;
          try { dbPut('songs', s); } catch (e) {}
          var ck = $('cleanChk');
          if (ck) ck.checked = true;
          var box = $('rpNeedMap');
          if (box) box.dataset.for = '';          /* redraw with it ticked */
          say('Ticked <b>a voice on its own</b> for you: there is almost no bass or drums in this. ' +
              'Untick it if that is wrong.');
        }
      })
      .catch(function () { sniffed[s.id] = 'done'; });
  }

  function say(html) {
    var m = $('libMapMsg');
    if (m) m.innerHTML = html;
  }

  /* ---- tell him it is working while it works ----------------------- */
  var work = { on: false, t0: 0, iv: null };
  function watchBuild() {
    var busy = false;
    try { busy = !!ANALYZE.busy; } catch (e) {}
    if (busy && !work.on) {
      work.on = true; work.t0 = Date.now();
      work.iv = setInterval(function () {
        var m = $('libMapMsg');
        if (!m) return;
        var secs = Math.round((Date.now() - work.t0) / 1000);
        var lead = (m.textContent || '').split(' \u00b7 ')[0];
        m.textContent = lead + ' \u00b7 ' + secs + 's so far. A long song takes a while \u2014 the bar moves as it goes.';
      }, 1000);
    } else if (!busy && work.on) {
      work.on = false; clearInterval(work.iv);
    }
  }

  /* ---------------------------------------------------------------- */
  /* LISTEN TO THE ROOM                                                 */
  /*                                                                    */
  /* A neutral listening tool. It hears whatever is playing near the    */
  /* phone, maps the melody, and keeps the map. The audio is dropped    */
  /* the moment the map exists: nothing is recorded, stored or sent.    */
  /* ---------------------------------------------------------------- */
  var REC = { on: false, rec: null, chunks: [], t0: 0, iv: null };

  S.roomSheet = function () {
    sheet('<b style="font-size:18px">Listen to the room</b>' +
      '<div class="measured" style="margin-top:8px">Play the song on something else — another phone, ' +
      'a speaker, or someone singing it. Keep this phone near it. Press Start, then Stop when the song ends. ' +
      'The app writes the notes down and keeps those. It does not keep the sound.</div>' +
      '<div class="notice" style="margin-top:10px">It listens to whatever is in the room. It does not look ' +
      'anything up and it does not fetch anything.</div>' +
      '<div style="margin-top:14px"><label style="font-size:13px;font-weight:700">What is it called?</label>' +
      '<input id="rpRmTitle" class="rp-inp" placeholder="Song title" style="width:100%;margin-top:6px"></div>' +
      '<div class="notice" id="rpRmMsg" style="margin-top:10px;display:none"></div>' +
      '<div class="row" style="gap:8px;margin-top:14px">' +
      '<button class="btn primary grow" id="rpRmGo" style="padding:12px">Start listening</button>' +
      '<button class="btn grow" id="rpRmStop" style="padding:12px" disabled>Stop</button></div>' +
      '<button class="btn" id="rpRmX" style="width:100%;padding:12px;margin-top:8px">Close</button>');
    on($('rpRmX'), 'click', function () { roomStop(true); shut(); });
    on($('rpRmGo'), 'click', roomStart);
    on($('rpRmStop'), 'click', function () { roomStop(false); });
  };

  function rmsg(t) { var m = $('rpRmMsg'); if (m) { m.innerHTML = t; m.style.display = ''; } }

  async function roomStart() {
    if (REC.on) return;
    if (!($('rpRmTitle') || {}).value.trim()) return rmsg('Give it a name first.');
    if (!window.MediaRecorder) return rmsg('This browser cannot listen for long enough. Try Chrome or Safari.');
    try {
      try { await enableMic(); } catch (e) {}
      var stream = MIC && MIC.stream;
      if (!stream) return rmsg('The microphone is not on. Turn it on with the chip at the top, then press Start.');
      REC.chunks = [];
      REC.rec = new MediaRecorder(stream);
      REC.rec.ondataavailable = function (e) { if (e.data && e.data.size) REC.chunks.push(e.data); };
      REC.rec.onstop = roomMap;
      REC.rec.start();
      REC.on = true; REC.t0 = Date.now();
      $('rpRmGo').disabled = true; $('rpRmStop').disabled = false;
      REC.iv = setInterval(function () {
        var s = Math.round((Date.now() - REC.t0) / 1000);
        rmsg('Listening… ' + Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2) +
             '. Press Stop when the song ends.');
      }, 500);
    } catch (e) { rmsg('Could not start listening: ' + (e && e.message ? e.message : 'the microphone refused')); }
  }

  function roomStop(quiet) {
    if (!REC.on) return;
    REC.on = false;
    clearInterval(REC.iv);
    if (quiet) { REC.chunks = []; try { REC.rec.stop(); } catch (e) {} return; }
    rmsg('Writing the notes down… this takes a moment.');
    try { REC.rec.stop(); } catch (e) {}
  }

  async function roomMap() {
    var chunks = REC.chunks;
    REC.chunks = [];                       /* the audio goes no further */
    if ($('rpRmGo')) $('rpRmGo').disabled = false;
    if ($('rpRmStop')) $('rpRmStop').disabled = true;
    if (!chunks.length) return;
    var title = (($('rpRmTitle') || {}).value || 'Song').trim();
    var blob = new Blob(chunks, { type: chunks[0].type || 'audio/webm' });
    var tmp = { id: 'room_tmp', title: title, blob: blob, kind: 'recording', cleanVox: false, notes: null };
    try {
      await buildNoteMap(tmp);
      var notes = (tmp.notes || []).map(function (n) { return { t: n.t, m: n.m }; });
      if (!notes.length) throw new Error('no clear tune in what it heard');
      var m = RPMaps.save({ title: title, notes: notes, from: 'heard in the room',
                                  dur: notes[notes.length - 1].t || 0 });
      tmp.blob = null; blob = null;        /* and it is gone */
      if (m) {
        rmsg('Kept <b>' + esc(title) + '</b> as a note map, with ' + notes.length +
             ' notes. The sound was not kept. Find it in your Library under Note maps.');
      }
    } catch (e) {
      tmp.blob = null; blob = null;
      rmsg('Could not find a tune in that: ' + (e && e.message ? e.message : 'nothing clear enough') +
           '. Move the phone closer to the speaker and try again. Nothing was kept.');
    }
  }

  /* ---------------------------------------------------------------- */
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

  /* ---------------------------------------------------------------- */
  /* THE SING TAB: four tiles, and the front door on the first one      */
  /* ---------------------------------------------------------------- */
  function hub() {
    var host = $('modeSing');
    if (!host || host.dataset.rpSong) return;
    var lib = $('shLib');
    if (!lib) return;
    host.dataset.rpSong = '1';
    /* Sing from your Library is now a door inside Learn a song, so the
       tile becomes the Pitch Tracker, which Robert moved here from Train. */
    lib.innerHTML = '<div class="mi"><svg class="ic" style="width:22px;height:22px"><use href="#i-activity"/></svg></div>' +
      '<div><h4>Pitch Tracker</h4><p>See the notes you sing, as you sing them</p></div><div class="chev">›</div>';
    lib.id = 'shTracker';
    on(lib, 'click', function () { go('free'); });
    var song = $('shSong');
    if (song) {
      var fresh = song.cloneNode(true);       /* drops the old straight-to-engine click */
      song.parentElement.replaceChild(fresh, song);
      on(fresh, 'click', S.doors);
    }
  }

  var n = 0;
  var iv = setInterval(function () {
    n++;
    hub();
    wire();
    var onMap = false;
    try { onMap = window.RPLearnSong && RPLearnSong.isOpen(); } catch (e) {}
    if (!onMap && $('modeSong') && $('modeSong').classList.contains('active')) {
      drawMix();
      guard();
      tidyMapPanel();
      watchBuild();
      wireAudioDoor();
      try { if (needsMap()) sniff(cur()); } catch (e) {}
    }
    if (n > 3000) clearInterval(iv);
  }, 500);
})();
