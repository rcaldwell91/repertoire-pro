/* ======================================================================
   Repertoire Pro — the Learn tab, the Sing-tab way.

   Robert, 13 Sep: "I go on the Learn tab and immediately I'm turned off.
   It's too many words. I don't know what to read first." So: one tile per
   subject, tap it, and only that subject's lessons show. The paragraphs
   about what lessons can and cannot do are gone from the front; the
   descriptions sit behind an (i) on each row.

   The base app still renders every lesson and game into this tab — its
   rows and buttons are what open a lesson and start a game — so this
   sorts what it drew rather than drawing again. It re-sorts after every
   render, because the base redraws the whole tab on every tap.
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

  var LN = window.RPLearn = {};
  var open = null;    /* unit name, or 'games', or null for the tiles */
  var ICON = { 'Play it': 'i-play', 'Sound and pitch': 'i-target', 'Time': 'i-repeat',
               'The major scale and key': 'i-bar-chart', 'Minor and the third': 'i-trending-up',
               'Intervals': 'i-layers', 'Chords and harmony': 'i-music', 'Song form': 'i-file',
               'Your voice': 'i-mic', 'Advanced': 'i-package' };
  var SUB = { 'Play it': 'Games. Every answer plays, so your ear learns it too.',
              'Sound and pitch': 'What a note is, and what "in tune" means.',
              'Time': 'Beats, bars, and counting in.',
              'The major scale and key': 'Do-re-mi, and what a key is.',
              'Minor and the third': 'The sad one, and the note that makes it sad.',
              'Intervals': 'The distance between two notes.',
              'Chords and harmony': 'Notes that sound together.',
              'Song form': 'Verse, chorus, bridge — the shape of a song.',
              'Your voice': 'Range, registers, and the right key for you.',
              'Advanced': 'For when the rest is easy.' };

  function css() {
    if ($('rpLearnCSS')) return;
    var s = document.createElement('style');
    s.id = 'rpLearnCSS';
    s.textContent = '.rp-info{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;' +
      'border-radius:50%;border:1px solid var(--line);color:var(--ink-faint);font-size:12px;font-weight:800;margin-left:8px;' +
      'cursor:pointer;flex:none}.rp-info.on{color:var(--gold);border-color:var(--gold)}' +
      '#modeLearn .lsn .ld,#modeLearn .grow .gd,#modeLearn .grow .measured{display:none}' +
      '#modeLearn .lsn.rp-open .ld,#modeLearn .grow.rp-open .gd,#modeLearn .grow.rp-open .measured{display:block}' +
      '#modeLearn .lsn .lsnbody .ld{display:block}';
    document.head.appendChild(s);
  }

  /* split what the base drew into { games: [...nodes], units: {name: [nodes]} } */
  function harvest(host) {
    var out = { games: [], units: {}, order: [], chrome: [] };
    var cur = null;
    Array.prototype.slice.call(host.children).forEach(function (el) {
      if (el.id === 'rpLearnTop' || el.id === 'rpLearnUnit' || el.id === 'rpTriviaRow') return;
      if (el.tagName === 'H3') {
        var t = (el.textContent || '').trim();
        cur = (t === 'Play it') ? 'games' : t;
        if (cur !== 'games') { out.units[cur] = out.units[cur] || []; if (out.order.indexOf(cur) < 0) out.order.push(cur); }
        out.chrome.push(el);
        return;
      }
      if (cur === 'games' && el.classList.contains('grow')) { out.games.push(el); return; }
      if (cur && cur !== 'games' && el.classList.contains('lsn')) { out.units[cur].push(el); return; }
      if (cur === 'games' && el.classList.contains('notice')) { out.chrome.push(el); return; }
      out.chrome.push(el);    /* h1, pill, notices, tier buttons — not shown up front */
    });
    return out;
  }

  /* Robert, 14 Sep: "maybe we can have an example to show/hear on the
     cards to help people visualise and understand." Each is a few notes
     played with the app's own reference sound: (midi, seconds from now,
     length). Same offset = together. */
  function P(m, at, dur, vol) { try { V10._play(m, at, dur == null ? 0.7 : dur, vol == null ? 0.5 : vol); } catch (e) {} }
  function run(list, gap, dur) { list.forEach(function (m, i) { P(m, i * (gap || 0.45), dur || 0.42); }); return list.length * (gap || 0.45); }
  function chord(list, at, dur) { list.forEach(function (m) { P(m, at || 0, dur || 1.2, 0.36); }); }
  var EX = {
    1:  { say: 'One note, held', go: function () { P(60, 0, 1.4); } },
    2:  { say: 'A to G, then A again', go: function () { run([57, 59, 60, 62, 64, 65, 67, 69]); } },
    3:  { say: 'A half step, then a whole step', go: function () { run([60, 61]); run([60, 62]).valueOf(); P(60, 1.2, 0.42); P(62, 1.65, 0.42); } },
    4:  { say: 'C, C sharp, D', go: function () { run([60, 61, 62], 0.55); } },
    5:  { say: 'C, then the C an octave up', go: function () { P(60, 0, 0.8); P(72, 0.9, 0.8); chord([60, 72], 2.0, 1.2); } },
    7:  { say: 'Four beats', go: function () { run([67, 67, 67, 67], 0.6, 0.15); } },
    14: { say: 'A scale, bottom to top', go: function () { run([60, 62, 64, 65, 67, 69, 71, 72], 0.38); } },
    15: { say: 'The major scale from C', go: function () { run([60, 62, 64, 65, 67, 69, 71, 72], 0.38); } },
    16: { say: 'Up the scale, then home', go: function () { var t = run([60, 62, 64, 65, 67, 69, 71], 0.36); P(72, t, 0.5); P(60, t + 0.9, 1.3); } },
    17: { say: 'Degrees 1 to 7, then 1 again', go: function () { run([60, 62, 64, 65, 67, 69, 71, 72], 0.4); } },
    20: { say: 'Major, then minor: only the middle note moves', go: function () { chord([60, 64, 67], 0, 1.1); chord([60, 63, 67], 1.4, 1.3); } },
    21: { say: 'The natural minor scale from A', go: function () { run([57, 59, 60, 62, 64, 65, 67, 69], 0.38); } },
    25: { say: 'A third, then a fifth', go: function () { P(60, 0, 0.5); P(64, 0.55, 0.6); P(60, 1.5, 0.5); P(67, 2.05, 0.7); } },
    28: { say: 'Three notes at once: a chord', go: function () { chord([60, 64, 67], 0, 1.6); } },
    29: { say: 'Root, third, fifth — then together', go: function () { run([60, 64, 67], 0.5, 0.45); chord([60, 64, 67], 1.7, 1.4); } },
    30: { say: 'The chord, then its third on its own', go: function () { chord([60, 64, 67], 0, 1.2); P(64, 1.5, 1.2); } },
    31: { say: 'Four chords that all belong to C', go: function () { chord([60, 64, 67], 0, 0.7); chord([65, 69, 72], 0.8, 0.7); chord([67, 71, 74], 1.6, 0.7); chord([60, 64, 67], 2.4, 1.2); } },
    33: { say: 'Home, away, tension, home', go: function () { chord([60, 64, 67], 0, 0.7); chord([65, 69, 72], 0.8, 0.7); chord([67, 71, 74], 1.6, 0.7); chord([60, 64, 67], 2.4, 1.2); } },
    34: { say: 'A cadence: the tension chord, then home', go: function () { chord([67, 71, 74], 0, 0.9); chord([60, 64, 67], 1.0, 1.5); } },
    35: { say: 'A plain chord, then the same with a seventh', go: function () { chord([60, 64, 67], 0, 1.1); chord([60, 64, 67, 70], 1.4, 1.4); } },
    43: { say: 'A tune, then the same tune a third higher', go: function () { run([60, 62, 64, 62, 60], 0.36); run([64, 65, 67, 65, 64].map(function (m) { return m; }), 0.36).valueOf(); } },
    45: { say: 'Major, then the same notes started on D', go: function () { run([60, 62, 64, 65, 67, 69, 71, 72], 0.3); [62, 64, 65, 67, 69, 71, 72, 74].forEach(function (m, i) { P(m, 2.7 + i * 0.3, 0.32); }); } },
    47: { say: 'The pentatonic: five notes', go: function () { run([60, 62, 64, 67, 69, 72], 0.38); } }
  };
  /* two runs one after the other, for the rows above that play two things */
  EX[3].go = function () { P(60, 0, 0.42); P(61, 0.45, 0.42); P(60, 1.3, 0.42); P(62, 1.75, 0.42); };
  EX[43].go = function () { run([60, 62, 64, 62, 60], 0.36); [64, 65, 67, 65, 64].forEach(function (m, i) { P(m, 2.1 + i * 0.36, 0.34); }); };
  function hearButton(row) {
    if (!(window.RPExample && RPExample.enabled)) return;   /* off with the rest of Hear it */
    var body = row.querySelector('.lsnbody');
    if (!body || body.querySelector('[data-lhear]')) return;
    var n = +row.dataset.lsn;
    var ex = EX[n];
    if (!ex) return;
    var b = document.createElement('button');
    b.className = 'btn';
    b.setAttribute('data-lhear', n);
    b.style.cssText = 'padding:8px 12px;font-size:12.5px;margin:2px 0 10px';
    b.textContent = '▶ Hear it — ' + ex.say;
    on(b, 'click', function (ev) {
      ev.stopPropagation();
      try { if (typeof ensureCtx === 'function') ensureCtx(); } catch (e) {}
      ex.go();
    });
    body.insertBefore(b, body.firstChild);
  }

  /* Robert's audit, 17 Sep: a game followed you onto every tab. The base
     puts the game panel beside the Learn tab, not inside it, so switching
     tabs never hid it. Leaving Learn now ends the game the way its own
     Quit does. */
  (function () {
    var n = 0, iv = setInterval(function () {
      if (typeof window.switchMode !== 'function') { if (++n > 50) clearInterval(iv); return; }
      clearInterval(iv);
      var prev = window.switchMode;
      window.switchMode = function (m) {
        try {
          var g = $('v10Game');
          if (m !== 'learn' && g && g.style.display !== 'none') {
            var q = g.querySelector('#gameQuit');
            if (q) q.click(); else { g.style.display = 'none'; var h = $('modeLearn'); if (h) h.style.display = ''; }
          }
        } catch (e) {}
        return prev.apply(this, arguments);
      };
    }, 100);
  })();

  function infoButton(row) {
    if (row.querySelector('.rp-info')) return;
    var b = document.createElement('span');
    b.className = 'rp-info';
    b.textContent = 'i';
    b.title = 'What this one is about';
    var head = row.querySelector('.lt, .gt') || row.firstElementChild;
    if (head) head.appendChild(b);
    on(b, 'click', function (ev) {
      ev.stopPropagation();
      row.classList.toggle('rp-open');
      b.classList.toggle('on', row.classList.contains('rp-open'));
    });
  }

  function layout() {
    var host = $('modeLearn');
    if (!host) return;
    css();
    var h = harvest(host);
    h.chrome.forEach(function (el) { el.style.display = 'none'; });

    var done = {};
    try { done = (V10.P && V10.P.lessonsDone) || {}; } catch (e) {}

    var top = $('rpLearnTop');
    if (!top) { top = document.createElement('div'); top.id = 'rpLearnTop'; host.insertBefore(top, host.firstChild); }
    var unit = $('rpLearnUnit');
    if (!unit) { unit = document.createElement('div'); unit.id = 'rpLearnUnit'; host.appendChild(unit); }

    if (!open) {
      var tiles = [{ icon: ICON['Play it'], title: 'Play it', sub: SUB['Play it'], data: 'data-unit="games"' }];
      h.order.forEach(function (u) {
        var list = h.units[u] || [];
        var nd = list.filter(function (el) { return el.classList.contains('done'); }).length;
        tiles.push({ icon: ICON[u] || 'i-book', title: u, sub: SUB[u] || '', data: 'data-unit="' + esc(u) + '"',
                     tag: nd ? nd + ' of ' + list.length : '' });
      });
      top.innerHTML = '<h1 style="margin:0 0 2px">Learn</h1>' +
        '<div class="rp-sub" style="margin:0 0 10px">What your coach means when they say it. Pick a subject.</div>' +
        RPPage.tiles(tiles);
      top.style.display = '';
      unit.style.display = 'none';
      /* park every row out of sight, in its holder */
      h.games.forEach(function (el) { el.style.display = 'none'; });
      h.order.forEach(function (u) { h.units[u].forEach(function (el) { el.style.display = 'none'; }); });
      top.querySelectorAll('[data-unit]').forEach(function (t) {
        on(t, 'click', function () { open = t.dataset.unit; layout(); window.scrollTo(0, 0); });
      });
      /* the word of the day sits under the tiles, small */
      var tv = $('rpTriviaRow'); if (tv) host.appendChild(tv);
    } else {
      top.style.display = 'none';
      var rows = open === 'games' ? h.games : (h.units[open] || []);
      unit.innerHTML = '<button class="pill backpill" id="rpLearnBack">← Learn</button>' +
        '<h1 style="margin:0 0 2px">' + esc(open === 'games' ? 'Play it' : open) + '</h1>' +
        '<div class="rp-sub" style="margin:0 0 10px">' + esc(SUB[open === 'games' ? 'Play it' : open] || '') +
        ' Tap ⓘ for what a row is about.</div>';
      var box = document.createElement('div');
      unit.appendChild(box);
      rows.forEach(function (el) { el.style.display = ''; box.appendChild(el); infoButton(el); hearButton(el); });
      /* the rows the base drew that are not this subject stay parked */
      h.games.forEach(function (el) { if (rows.indexOf(el) < 0) el.style.display = 'none'; });
      h.order.forEach(function (u) { h.units[u].forEach(function (el) { if (rows.indexOf(el) < 0) el.style.display = 'none'; }); });
      unit.style.display = '';
      on($('rpLearnBack'), 'click', function () { open = null; layout(); window.scrollTo(0, 0); });
      var tv2 = $('rpTriviaRow'); if (tv2) tv2.style.display = 'none';
    }
    var tv3 = $('rpTriviaRow'); if (tv3 && !open) tv3.style.display = '';
  }

  LN.open = function (u) { open = u || null; layout(); };

  /* re-sort after every base render */
  (function install() {
    var n = 0;
    var iv = setInterval(function () {
      if (!window.V10 || !V10.renderLearn || V10.renderLearn.__rp) { if (++n > 80) clearInterval(iv); return; }
      clearInterval(iv);
      var prev = V10.renderLearn;
      var wrapped = function () {
        var r = prev.apply(this, arguments);
        try { layout(); } catch (e) {}
        return r;
      };
      wrapped.__rp = 1;
      V10.renderLearn = wrapped;
      if ($('modeLearn') && $('modeLearn').children.length) { try { layout(); } catch (e) {} }
      /* The base's own tap handlers call its renderLearn closure directly,
         not V10.renderLearn, so the wrapper never sees those redraws. Watch
         the tab instead: when our containers are gone, the base has redrawn
         and it is time to sort again. */
      var host = $('modeLearn');
      if (host && window.MutationObserver) {
        var busy = false;
        new MutationObserver(function () {
          if (busy) return;
          if ($('rpLearnTop') && $('rpLearnUnit') && $('rpLearnTop').parentElement === host) {
            /* still ours — unless the word of the day just landed on top */
            var tv = $('rpTriviaRow');
            if (!(tv && !open && tv !== host.lastElementChild)) return;
          }
          busy = true;
          setTimeout(function () { try { layout(); } catch (e) {} busy = false; }, 30);
        }).observe(host, { childList: true });
      }
    }, 200);
  })();
})();
