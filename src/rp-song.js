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
                sub: 'Pick it from the list at the top of the next screen. Add more in your Library.' });
    h += door({ id: 'rpLsBuilt', icon: 'i-music',    title: 'Built-in songs',
                sub: 'Six that come with the app, ready to sing.' });
    h += door({ id: 'rpLsSing',  icon: 'i-mic',      title: 'Sing it in yourself',
                sub: 'Sing the tune once and the app writes the notes down.' });
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
        on(root.querySelector('#rpLsOwn'), 'click', function () {
          go('song');
          setTimeout(function () { var sel = $('songSel'); if (sel) sel.scrollIntoView({ block: 'center' }); }, 400);
        });
        on(root.querySelector('#rpLsBuilt'), 'click', function () { go('song'); });
        on(root.querySelector('#rpLsSing'), 'click', function () {
          go('song');
          setTimeout(function () { var b = $('edSingIn'); if (b) b.scrollIntoView({ block: 'center' }); }, 400);
        });
        on(root.querySelector('#rpLsPair'), 'click', function () {
          if (!S.founder()) { locked(); return; }
          S.pairSheet();
        });
        on(root.querySelector('#rpLsRoom'), 'click', S.roomSheet);
      }
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
      try { libRender(); } catch (e) {}
      try { fillSongSel(); } catch (e) {}
      msg('Added. Opening it…');
      setTimeout(function () {
        shut();
        go('song');
        setTimeout(function () {
          var sel = $('songSel');
          if (sel) { sel.value = 'lib:' + song.id; sel.dispatchEvent(new Event('change')); }
          var b = $('btnBuildMap');
          if (b) b.scrollIntoView({ block: 'center' });
        }, 500);
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
    if ($('modeSong') && $('modeSong').classList.contains('active')) drawMix();
    if (n > 3000) clearInterval(iv);
  }, 500);
})();
