/* ======================================================================
   Repertoire Pro — the word of the day.

   Robert, 13 Sep: "gamify the app through warm ups, exercises, trivia, and
   theory."

   Warm-ups, exercises and theory already exist and already keep score. The
   missing one was trivia, and the temptation was to sit down and invent a
   few hundred questions.

   We did not, for the reason this app does most things: the glossary is
   already there, it is already 56 terms, and every definition in it has
   been written to be true in one plain sentence. So the question is built
   FROM the glossary — here is a definition, which word is it? — and the
   answer is the app's own answer. There is no second source to get wrong
   and nothing new to fact-check.

   One a day. Deliberately one: it is a nudge, not a quiz app bolted onto a
   singing app, and Robert asked for subtle. It changes at midnight, the
   same word for everybody on the same day, and answering it once is the
   end of it — no grinding it for points.
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

  var T = window.RPTrivia = {};

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }

  /* The glossary holds plurals and near-synonyms pointing at the same
     sentence ("semitone" and "semitones"). Asking somebody to pick between
     two words with an identical definition is not a question, it is a coin
     toss — so one word per distinct meaning. */
  function pool() {
    var G = null;
    try { G = window.RPPlain && RPPlain.glossary; } catch (e) {}
    if (!G) return [];
    var bySentence = {};
    Object.keys(G).forEach(function (word) {
      var def = G[word];
      if (!bySentence[def] || word.length < bySentence[def].length) bySentence[def] = word;
    });
    return Object.keys(bySentence).map(function (def) {
      return { word: bySentence[def], def: def };
    }).sort(function (a, b) { return a.word < b.word ? -1 : 1; });
  }

  /* same word for everyone, all day, different tomorrow */
  function pickFor(dayStr, list) {
    if (!list.length) return null;
    var h = 0;
    for (var i = 0; i < dayStr.length; i++) h = (h * 31 + dayStr.charCodeAt(i)) >>> 0;
    return { i: h % list.length, h: h };
  }

  T.question = function () {
    var list = pool();
    var p = pickFor(today(), list);
    if (!p) return null;
    var right = list[p.i];

    /* three wrong ones, chosen the same way so the options do not reshuffle
       every time the screen redraws */
    var others = [], h = p.h;
    var used = {};
    used[p.i] = 1;
    while (others.length < 3 && others.length < list.length - 1) {
      h = (h * 1103515245 + 12345) >>> 0;
      var j = h % list.length;
      if (used[j]) continue;
      used[j] = 1;
      others.push(list[j]);
    }
    var opts = others.concat([right]);
    /* deterministic shuffle */
    for (var k = opts.length - 1; k > 0; k--) {
      h = (h * 1103515245 + 12345) >>> 0;
      var m = h % (k + 1);
      var t = opts[k]; opts[k] = opts[m]; opts[m] = t;
    }
    return { right: right, opts: opts };
  };

  function answeredKey() { return 'rp_trivia_' + today(); }
  T.answered = function () {
    try { return localStorage.getItem(answeredKey()); } catch (e) { return null; }
  };

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

  T.open = function () {
    var q = T.question();
    if (!q) return;
    var already = T.answered();

    var h = '<div class="rp-lab">WORD OF THE DAY</div>' +
      '<div class="measured" style="margin-top:8px">Which word means this?</div>' +
      '<div class="rp-card" style="margin-top:10px;padding:14px">' +
      '<div style="font-size:15px;line-height:1.5">' + esc(q.right.def) + '</div></div>';

    if (already) {
      var got = already === q.right.word;
      h += '<div class="rp-card' + (got ? ' hot' : '') + '" style="margin-top:12px;padding:13px">' +
        '<div class="rp-ttl">' + esc(q.right.word) + '</div>' +
        '<div class="rp-sub">' + (got ? 'You had it.' : 'You said “' + esc(already) + '”.') +
        '</div></div>' +
        '<div class="measured" style="margin-top:10px">One a day. There is a new one tomorrow.</div>';
    } else {
      h += '<div style="margin-top:12px">';
      q.opts.forEach(function (o) {
        h += '<button class="btn" data-word="' + esc(o.word) + '" style="width:100%;padding:12px;' +
          'margin-bottom:7px;font-size:14px;font-weight:800">' + esc(o.word) + '</button>';
      });
      h += '</div>';
      h += '<div class="measured" style="margin-top:4px;font-size:11.5px">No wrong answer costs you ' +
        'anything. The definition is the app’s own — it is the same sentence you get when you ' +
        'tap the word anywhere else.</div>';
    }

    h += '<button class="btn" id="rpTvX" style="width:100%;padding:12px;margin-top:12px">Close</button>';
    var box = sheet(h);
    on($('rpTvX'), 'click', shut);

    box.querySelectorAll('[data-word]').forEach(function (b) {
      on(b, 'click', function () {
        var chose = b.dataset.word;
        try { localStorage.setItem(answeredKey(), chose); } catch (e) {}
        var got = chose === q.right.word;
        /* Only a right answer scores, and only the first one — the key is
           the date, so there is nothing to grind. */
        if (got) {
          try {
            if (window.RP && RP.logResult) {
              RP.logResult({ kind: 'trivia', label: 'Word of the day: ' + q.right.word,
                             score: 1, out_of: 1 });
            }
          } catch (e) {}
        }
        T.open();
        try {
          if (window.RP && RP.toast) {
            RP.toast(got ? 'Right — ' + q.right.word + '.'
                         : 'It was “' + q.right.word + '”. Now you know it.');
          }
        } catch (e) {}
      });
    });
  };

  /* ------------------------------------------------------------------ */
  /* one small row on Learn, where words belong                          */
  /* ------------------------------------------------------------------ */
  function mount() {
    var host = $('modeLearn');
    if (!host) return;
    /* "None" means none. Take the row away if it is already there. */
    if (T.dose && T.dose() === 'none') {
      var gone = $('rpTriviaRow');
      if (gone && gone.parentElement) gone.parentElement.removeChild(gone);
      return;
    }
    var q = T.question();
    if (!q) return;
    var done = T.answered();
    var d = $('rpTriviaRow');
    var fresh = !d;
    if (fresh) {
      d = document.createElement('div');
      d.id = 'rpTriviaRow';
      d.className = 'rp-card';
      d.style.cursor = 'pointer';
      d.style.marginTop = '10px';
    }
    d.classList.toggle('hot', !done);
    d.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<div style="flex:1;min-width:0"><div class="rp-ttl">Word of the day' +
      (done ? '<span class="rp-tag">done</span>' : '') + '</div>' +
      '<div class="rp-sub">' + (done
        ? 'It was “' + esc(q.right.word) + '”. A new one tomorrow.'
        : 'One question, ten seconds.') + '</div></div>' +
      '<div style="color:var(--ink-faint);font-size:20px">›</div></div>';
    if (fresh) {
      on(d, 'click', T.open);
      try { host.insertBefore(d, host.firstChild); } catch (e) {}
    }
  }


  /* ==================================================================
     THE DOSE.

     Robert, idea bank #3: "a setting controls the dose: a lot / medium /
     a little / none." The reason he wants trivia at all is a level of
     depth other apps do not have — not a quiz bolted on.

     So the honest question was: where does a fact come from? He has a
     standing, permanent rule — never scrape or source lyrics or audio —
     and song and artist trivia needs a catalogue the app does not have
     and is not allowed to go and take. That half is NOT built, and the
     chooser says so in plain words rather than quietly leaving it out.

     What IS built comes from two places the app already owns and has
     already had to be right about: the glossary, and the paragraph
     under every exercise explaining why it works. Nothing here is a
     new claim. It is the app repeating something it already says,
     at the moment it is useful, as often as you asked for it.
     ================================================================== */

  var DOSES = [
    { k: 'lot',    name: 'A lot',      sub: 'The word of the day, and something worth knowing on every exercise.' },
    { k: 'med',    name: 'Medium',     sub: 'The word of the day, and a note on an exercise now and then.' },
    { k: 'little', name: 'A little',   sub: 'Just the word of the day.' },
    { k: 'none',   name: 'None',       sub: 'Nothing extra. The exercises and lessons, and that is it.' }
  ];

  T.dose = function () {
    try {
      var v = localStorage.getItem('rp_trivia_dose');
      if (v && DOSES.some(function (d) { return d.k === v; })) return v;
    } catch (e) {}
    return 'med';
  };
  T.setDose = function (v) {
    try { localStorage.setItem('rp_trivia_dose', v); } catch (e) {}
    /* the word-of-the-day row may need to appear or disappear right now */
    var r = $('rpTriviaRow'); if (r && r.parentElement) r.parentElement.removeChild(r);
    var f = $('rpFactStrip'); if (f && f.parentElement) f.parentElement.removeChild(f);
    mount(); doseRow();
  };
  function doseName() {
    var d = T.dose();
    return (DOSES.filter(function (x) { return x.k === d; })[0] || DOSES[1]).name;
  }

  T.chooseDose = function () {
    var cur = T.dose();
    var h = '<b style="font-size:18px">How much extra?</b>' +
      '<div class="measured" style="margin-top:8px">Words, and the reason an exercise works. ' +
      'It is meant to be a nudge, not homework — so you set how much of it you want.</div>' +
      '<div style="margin-top:14px">';
    DOSES.forEach(function (d) {
      h += '<div class="rp-card' + (d.k === cur ? ' hot' : '') + '" data-dose="' + d.k + '" ' +
        'style="cursor:pointer;padding:12px;margin-bottom:7px">' +
        '<div class="rp-ttl">' + esc(d.name) +
        (d.k === cur ? '<span class="rp-tag">yours</span>' : '') + '</div>' +
        '<div class="rp-sub">' + esc(d.sub) + '</div></div>';
    });
    h += '</div>' +
      '<button class="btn" id="rpDoseX" style="width:100%;padding:12px;margin-top:12px">Close</button>';
    var box = sheet(h);
    on($('rpDoseX'), 'click', shut);
    box.querySelectorAll('[data-dose]').forEach(function (c) {
      on(c, 'click', function () {
        T.setDose(c.dataset.dose);
        T.chooseDose();
        try { if (window.RP && RP.toast) RP.toast('Extras: ' + doseName().toLowerCase() + '.'); } catch (e) {}
      });
    });
  };

  /* ---- the row in Profile ------------------------------------------ */
  function doseRow() {
    var host = $('modeYou');
    if (!host) return;
    var d = $('rpDoseRow');
    var fresh = !d;
    if (fresh) {
      d = document.createElement('div');
      d.id = 'rpDoseRow';
      d.className = 'rp-card';
      d.style.cursor = 'pointer';
    }
    d.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<div><div class="rp-ttl">Words and extras</div>' +
      '<div class="rp-sub">' + esc(doseName()) + '</div></div>' +
      '<div style="color:var(--ink-faint);font-size:20px">›</div></div>';
    if (fresh) {
      on(d, 'click', T.chooseDose);
      try { host.appendChild(d); } catch (e) {}
    }
  }

  /* ==================================================================
     WORTH KNOWING — the line that appears next to the exercise you are
     actually doing.

     V10.noteRunning is a hook the base app already calls every time an
     exercise starts and which does nothing. We wrap it rather than
     touching the base: the app tells us what is running, and we put one
     sentence of its own explanation on the screen beside it.
     ================================================================== */

  function firstSentence(html) {
    var t = String(html || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    var m = t.match(/^[^.!?]+[.!?]/);
    var out = m ? m[0] : t;
    /* a very short opener ("It is not.") is not worth a card — take two */
    if (out.length < 60 && out.length < t.length) {
      var m2 = t.slice(out.length).trim().match(/^[^.!?]+[.!?]/);
      if (m2) out += ' ' + m2[0];
    }
    return out.trim();
  }

  var shownFor = {};   /* one strip per exercise per session, not per redraw */

  function factStrip(e) {
    var d = T.dose();
    if (d === 'none' || d === 'little') return;
    if (!e) return;
    /* Medium means "now and then": every other exercise, counted, not
       random — random means two in a row and then nothing for ten. */
    if (d === 'med') {
      shownFor.__n = (shownFor.__n || 0) + 1;
      if (shownFor.__n % 2 === 0) return;
    }
    var line = firstSentence(e.why || e.what);
    if (!line) return;

    var old = $('rpFactStrip');
    if (old && old.parentElement) old.parentElement.removeChild(old);

    var box = document.createElement('div');
    box.id = 'rpFactStrip';
    box.className = 'rp-card';
    box.style.cssText = 'padding:11px;margin-top:10px;border-left:3px solid var(--gold)';
    box.innerHTML = '<div class="rp-lab">WHY THIS ONE WORKS</div>' +
      '<div style="font-size:13px;line-height:1.55;margin-top:5px">' + esc(line) + '</div>';

    /* Guided exercises get their own panel; ladders run in the train slot.
       Put it wherever the exercise actually is. */
    var g = $('v10Guided');
    var slot = $('trainSlot');
    try {
      if (g && g.style.display !== 'none') g.appendChild(box);
      else if (slot && slot.parentElement) slot.parentElement.insertBefore(box, slot);
      else return;
    } catch (err) { return; }
  }

  (function wrapNoteRunning() {
    function attach() {
      if (!window.V10 || !V10.noteRunning || V10.noteRunning.__rp) return false;
      var prev = V10.noteRunning;
      var wrapped = function (e) {
        try { prev.apply(this, arguments); } catch (err) {}
        try { factStrip(e); } catch (err) {}
      };
      wrapped.__rp = 1;
      V10.noteRunning = wrapped;
      return true;
    }
    if (!attach()) {
      var n = 0;
      var iv = setInterval(function () { if (attach() || ++n > 40) clearInterval(iv); }, 300);
    }
  })();

  setInterval(function () { mount(); doseRow(); }, 1500);
  setTimeout(function () { mount(); doseRow(); }, 1100);
})();
