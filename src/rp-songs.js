/* ======================================================================
   Repertoire Pro — the song book.

   Idea bank #1 wants songs that sit in your range. That needs a catalogue
   of songs WITH their ranges, and on 13 Sep the research came back: there
   is no openly licensed one. The apps that do this keep private
   databases, Hooktheory's terms forbid mining the melody data that would
   give it to you, and the standing rule is permanent — never scrape or
   source lyrics or audio.

   Robert, 13 Sep: "No park — I will pay for a license later once we have
   paying users."

   So this is not a workaround, it is the first half of the same thing.
   The table here is the table a licensed feed would fill; every row
   already carries a `source`, and the day a licence is signed those rows
   arrive next to these ones and every screen keeps working.

   Until then coaches and singers fill it. Which means every row has to
   say WHO SAID SO. "Ja Ronn says this sits G3 to E5" and "somebody typed
   it in" are different claims, and an app that blurs them is worse than
   one with an empty list. So the name is on the row, the word COACH is on
   it when it belongs there, and two people are allowed to disagree in
   public rather than one of them being quietly overwritten.
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

  var S = window.RPSongs = {};

  var book = null;        /* last good list — never wiped by a failed read */
  var loadErr = null;
  var loading = false;

  function name(m) { try { return midiName(m); } catch (e) { return String(m); } }

  function signedIn() {
    try { return !!(window.RP && RP.sb && RP.user); } catch (e) { return false; }
  }

  S.list = function () { return book || []; };

  S.load = function (then) {
    if (!signedIn()) { loadErr = 'signin'; if (then) then(); return; }
    if (loading) return;
    loading = true;
    RP.sb.rpc('list_songs').then(function (r) {
      loading = false;
      if (r.error) {
        /* A failed read is not "there are no songs". Keep what we had and
           say the server could not be reached — this app has been bitten
           by treating one dropped request as an empty truth before. */
        loadErr = r.error.message;
      } else {
        book = r.data || [];
        loadErr = null;
      }
      if (then) then();
    });
  };

  /* ---- what the app already knows, from its own note data ----------- */
  function builtIns() {
    var out = [];
    try {
      if (!window.RPRange || !RPRange.songs) return out;
      RPRange.songs().forEach(function (s) {
        out.push({ id: 'builtin:' + s.title, title: s.title, artist: '',
                   lo: s.lo, hi: s.hi, builtin: true });
      });
    } catch (e) {}
    return out;
  }

  S.all = function () {
    return builtIns().concat(S.list());
  };

  /* ================================================================== */
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

  /* ================================================================== */
  /* ADDING ONE                                                          */
  /* ================================================================== */
  var LO_MIN = 36, HI_MAX = 84;   /* C2 to C6 — past both ends of any singer */

  function noteSel(id, val) {
    var h = '<select id="' + id + '" class="rp-inp" style="width:100%">';
    for (var m = LO_MIN; m <= HI_MAX; m++) {
      h += '<option value="' + m + '"' + (m === val ? ' selected' : '') + '>' + esc(name(m)) + '</option>';
    }
    return h + '</select>';
  }

  S.add = function (existing) {
    if (!signedIn()) {
      sheet('<b style="font-size:17px">Sign in first</b>' +
        '<div class="measured" style="margin-top:8px">The song book is shared, so it needs to know ' +
        'whose entry this is.</div>' +
        '<button class="btn" id="rpSgX" style="width:100%;padding:12px;margin-top:12px">Close</button>');
      on($('rpSgX'), 'click', shut);
      return;
    }
    var e = existing || {};
    var iAmCoach = false;
    try { iAmCoach = !!(RP.profile && RP.profile.is_coach); } catch (err) {}

    var h = '<b style="font-size:18px">' + (existing ? 'Edit this song' : 'Add a song') + '</b>' +
      '<div class="measured" style="margin-top:8px">The lowest and highest note the singer has to ' +
      'reach, in the original key. If you are not sure, leave it — a guess in here is worse than a ' +
      'gap, because somebody will plan a lesson around it.</div>';

    h += '<label class="lab" style="margin-top:14px;display:block">SONG</label>' +
      '<input id="rpSgTitle" class="rp-inp" style="width:100%" maxlength="120" placeholder="Title" value="' +
      esc(e.title || '') + '">';
    h += '<label class="lab" style="margin-top:10px;display:block">ARTIST</label>' +
      '<input id="rpSgArtist" class="rp-inp" style="width:100%" maxlength="120" placeholder="Who sings it" value="' +
      esc(e.artist || '') + '">';

    h += '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:nowrap">' +
      '<div style="flex:1"><label class="lab" style="display:block">LOWEST NOTE</label>' +
      noteSel('rpSgLo', e.lo != null ? e.lo : 55) + '</div>' +
      '<div style="flex:1"><label class="lab" style="display:block">HIGHEST NOTE</label>' +
      noteSel('rpSgHi', e.hi != null ? e.hi : 72) + '</div></div>';

    h += '<label class="lab" style="margin-top:10px;display:block">ORIGINAL KEY (OPTIONAL)</label>' +
      '<input id="rpSgKey" class="rp-inp" style="width:100%" maxlength="24" placeholder="e.g. G major" value="' +
      esc(e.original_key || '') + '">';

    h += '<label class="lab" style="margin-top:10px;display:block">ANYTHING WORTH KNOWING (OPTIONAL)</label>' +
      '<textarea id="rpSgNote" class="rp-inp" rows="2" maxlength="240" style="margin-top:4px" ' +
      'placeholder="Where the hard bit is, what it needs">' + esc(e.note || '') + '</textarea>';

    h += '<div class="rp-card" style="margin-top:14px;padding:12px;border-left:3px solid var(--gold)">' +
      '<div style="font-size:12.5px;line-height:1.55">This goes on the row with your name on it' +
      (iAmCoach ? ', marked COACH' : '') + ', and everybody using the app can see it. If somebody ' +
      'has already added the same song with a different range, both stay — people disagree about ' +
      'this, and the app would rather show you that than pick a winner.</div></div>';

    h += '<div id="rpSgMsg" class="measured" style="margin-top:10px"></div>' +
      '<div class="row" style="gap:7px;margin-top:8px;flex-wrap:nowrap">' +
      '<button class="btn" id="rpSgX" style="flex:1;padding:12px">Cancel</button>' +
      '<button class="btn primary" id="rpSgSave" style="flex:1;padding:12px">' +
      (existing ? 'Save' : 'Add it') + '</button></div>';

    sheet(h);
    on($('rpSgX'), 'click', function () { S.open(); });
    on($('rpSgSave'), 'click', function () {
      var msg = $('rpSgMsg'), btn = $('rpSgSave');
      var title = ($('rpSgTitle').value || '').trim();
      var artist = ($('rpSgArtist').value || '').trim();
      var lo = +$('rpSgLo').value, hi = +$('rpSgHi').value;
      function bad(t) { msg.textContent = t; msg.style.color = 'var(--miss)'; }
      if (!title) return bad('It needs a title.');
      if (hi <= lo) return bad('The highest note has to be above the lowest one.');
      if (hi - lo > 36) return bad('That is more than three octaves. Check the two notes — one of them is wrong.');

      var row = {
        title: title, artist: artist, lo: lo, hi: hi,
        original_key: ($('rpSgKey').value || '').trim(),
        note: ($('rpSgNote').value || '').trim()
      };
      btn.disabled = true;
      msg.textContent = 'Saving…'; msg.style.color = 'var(--ink-dim)';

      var q;
      if (existing) {
        q = RP.sb.from('songs').update(row).eq('id', existing.id).select();
      } else {
        row.added_by = RP.user.id;
        try { row.by_coach = !!(RP.profile && RP.profile.is_coach); } catch (err) { row.by_coach = false; }
        q = RP.sb.from('songs').insert(row).select();
      }
      q.then(function (r) {
        btn.disabled = false;
        if (r.error) {
          return bad(/songs_one_each/.test(r.error.message)
            ? 'You have already added that one. Open it and change it instead.'
            : r.error.message);
        }
        S.load(function () { S.open(); });
        try { RP.toast(existing ? 'Saved.' : 'Added.'); } catch (err) {}
      });
    });
  };

  S.remove = function (id) {
    if (!signedIn()) return;
    RP.sb.from('songs').delete().eq('id', id).then(function (r) {
      if (r.error) { try { RP.toast(r.error.message); } catch (e) {} return; }
      S.load(function () { S.open(); });
    });
  };

  /* ================================================================== */
  /* THE LIST — every song, and whether it fits YOU                      */
  /* ================================================================== */
  function verdict(s, v) {
    var span = s.hi - s.lo;
    if (!v) return { rank: 3, tone: 'var(--ink-faint)', line: 'No range on file for you yet.' };
    var f = window.RPRange ? RPRange.fit({ lo: s.lo, hi: s.hi, span: span }, v.lo, v.hi) : null;
    if (!f) return { rank: 3, tone: 'var(--ink-faint)', line: '' };
    if (f.impossible) {
      return { rank: 2, tone: 'var(--miss)',
        line: 'Wider than you are by ' + f.short + ' semitone' + (f.short === 1 ? '' : 's') +
              ' — it does not fit in any key.' };
    }
    if (f.shift === 0) {
      var bits = [];
      bits.push(f.roomLow === 0 ? 'its lowest note is your lowest note' : f.roomLow + ' spare at the bottom');
      bits.push(f.roomHigh === 0 ? 'its highest is your highest' : f.roomHigh + ' at the top');
      return { rank: 0, tone: 'var(--gold)', line: 'Fits as it is — ' + bits.join(', ') + '.' };
    }
    return { rank: 1, tone: 'var(--gold)',
      line: 'Fits if you move it ' + Math.abs(f.shift) + ' semitone' +
            (Math.abs(f.shift) === 1 ? '' : 's') + ' ' + (f.shift > 0 ? 'up' : 'down') + '.' };
  }

  S.open = function () {
    var v = null;
    try { v = window.RPRange ? RPRange.get() : null; } catch (e) {}

    var rows = S.all().map(function (s) {
      var w = verdict(s, v);
      return { s: s, w: w };
    }).sort(function (a, b) {
      if (a.w.rank !== b.w.rank) return a.w.rank - b.w.rank;
      return (a.s.title || '').toLowerCase() < (b.s.title || '').toLowerCase() ? -1 : 1;
    });

    var h = '<b style="font-size:18px">Songs, and whether they fit you</b>';
    h += v
      ? '<div class="rp-sub" style="margin-top:4px">Your range: ' + esc(name(v.lo)) + '–' +
        esc(name(v.hi)) + ' · ' + (v.hi - v.lo) + ' semitones</div>'
      : '<div class="measured" style="margin-top:6px">Measure your range first and every line below ' +
        'turns into an answer.</div>';

    h += '<button class="btn primary" id="rpSgAdd" style="width:100%;padding:11px;margin-top:12px;' +
      'font-size:12.5px">Add a song</button>';

    if (loadErr === 'signin') {
      h += '<div class="rp-card" style="margin-top:12px;padding:12px"><div class="rp-ttl">Not signed in</div>' +
        '<div class="rp-sub">The shared song book needs an account. The app’s own songs are still ' +
        'listed below.</div></div>';
    } else if (loadErr) {
      h += '<div class="rp-card" style="margin-top:12px;padding:12px;border-left:3px solid var(--miss)">' +
        '<div class="rp-ttl">Could not reach the server</div>' +
        '<div class="rp-sub">' + esc(loadErr) + ' — showing what was already loaded, which may be ' +
        'out of date. Nothing has been lost.</div></div>';
    }

    h += '<div style="margin-top:12px">';
    rows.forEach(function (r) {
      var s = r.s, w = r.w;
      var mine = false;
      try { mine = !s.builtin && RP.user && s.added_by === RP.user.id; } catch (e) {}
      h += '<div class="rp-card" style="padding:12px;margin-bottom:8px;border-left:3px solid ' + w.tone + '">' +
        '<div class="rp-ttl">' + esc(s.title) +
        (s.by_coach ? '<span class="rp-tag">coach</span>' : '') + '</div>' +
        (s.artist ? '<div class="rp-sub">' + esc(s.artist) + '</div>' : '') +
        '<div class="rp-sub">' + esc(name(s.lo)) + '–' + esc(name(s.hi)) + ' · ' + (s.hi - s.lo) +
        ' semitones' + (s.original_key ? ' · ' + esc(s.original_key) : '') + '</div>' +
        (w.line ? '<div style="font-size:12.5px;line-height:1.5;margin-top:6px">' + esc(w.line) + '</div>' : '') +
        (s.note ? '<div class="measured" style="margin-top:5px">' + esc(s.note) + '</div>' : '') +
        '<div class="measured" style="margin-top:6px;font-size:11.5px">' +
        (s.builtin
          ? 'Worked out from the notes the app has for this one.'
          : 'Range given by ' + esc(s.added_name || 'someone') +
            (s.by_coach ? ', a coach' : '') + '.') + '</div>' +
        (mine
          ? '<div class="row" style="gap:7px;margin-top:8px;flex-wrap:nowrap">' +
            '<button class="btn" data-sged="' + esc(s.id) + '" style="flex:1;padding:8px;font-size:12px">Edit</button>' +
            '<button class="btn" data-sgdel="' + esc(s.id) + '" style="flex:1;padding:8px;font-size:12px;' +
            'color:var(--miss)">Remove</button></div>'
          : '') +
        '</div>';
    });
    h += '</div>';

    h += '<div class="rp-card" style="margin-top:6px;padding:12px;border-left:3px solid var(--gold)">' +
      '<div style="font-size:12.5px;line-height:1.55">Where these come from: the first few are worked ' +
      'out from notes the app already has. The rest were entered by the people using it, and each one ' +
      'says who. There is no openly licensed catalogue of songs with vocal ranges — this app does not ' +
      'take lyrics or audio from anywhere, so it is building its own. When a proper catalogue is ' +
      'licensed it lands in the same list, and these stay.</div></div>';

    h += '<button class="btn" id="rpSgX" style="width:100%;padding:12px;margin-top:12px">Close</button>';

    var box = sheet(h);
    on($('rpSgX'), 'click', shut);
    on($('rpSgAdd'), 'click', function () { S.add(null); });
    each(box, '[data-sged]', function (b) {
      on(b, 'click', function () {
        var s = S.list().filter(function (x) { return x.id === b.dataset.sged; })[0];
        if (s) S.add(s);
      });
    });
    each(box, '[data-sgdel]', function (b) {
      on(b, 'click', function () {
        if (b.dataset.sure) return S.remove(b.dataset.sgdel);
        b.dataset.sure = '1';
        b.textContent = 'Tap again to remove';
      });
    });
  };

  /* the way in: load first so the list is real, then draw */
  S.show = function () {
    S.open();                       /* something on screen immediately */
    S.load(function () { S.open(); });
  };

  /* ---- a row in Profile, under the range ---------------------------- */
  function row() {
    var host = $('modeYou');
    if (!host) return;
    var d = $('rpSongRow');
    var fresh = !d;
    if (fresh) {
      d = document.createElement('div');
      d.id = 'rpSongRow';
      d.className = 'rp-card';
      d.style.cursor = 'pointer';
    }
    var n = S.all().length;
    d.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<div><div class="rp-ttl">Songs, and whether they fit you</div>' +
      '<div class="rp-sub">' + n + ' song' + (n === 1 ? '' : 's') + ' on file · add the ones you are ' +
      'working on</div></div>' +
      '<div style="color:var(--ink-faint);font-size:20px">›</div></div>';
    if (fresh) {
      on(d, 'click', S.show);
      try { host.appendChild(d); } catch (e) {}
    }
  }
  setInterval(row, 1500);
  setTimeout(row, 1200);

  /* load once there is an account to load it with */
  var tries = 0;
  var iv = setInterval(function () {
    if (book || ++tries > 60) { clearInterval(iv); return; }
    if (signedIn()) { clearInterval(iv); S.load(); }
  }, 1000);
})();
