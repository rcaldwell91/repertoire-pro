/* ======================================================================
   Repertoire Pro — meeting people where they are.

   Briar opened the app, hit words she did not know, and said she would wait
   for Robert. That is the failure this file exists to fix.

   Two questions on first open — how much singing, how much music vocabulary —
   and then:
     · every music word in the app can be tapped for one plain sentence
     · exercises show what they actually are, instead of only an insider name
     · a beginner starts on beginner exercises
     · the app says back what it heard, so it does not feel like a test

   None of this needs an account. It is stored on the phone, and copied to
   your profile as well if you are signed in, so a coach can see how to talk
   to you before he has met you.
   ====================================================================== */
(function () {
  'use strict';
  var V10 = window.V10;
  if (!V10) return;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  var ME = window.RPPlain = {
    words: 'some',      // 'plain' | 'some' | 'technical'
    experience: 2       // 1 new · 2 some · 3 lots
  };
  try {
    ME.words = localStorage.getItem('rp_words') || 'some';
    ME.experience = +(localStorage.getItem('rp_exp') || 2);
  } catch (e) {}

  function saveMe() {
    try {
      localStorage.setItem('rp_words', ME.words);
      localStorage.setItem('rp_exp', String(ME.experience));
      localStorage.setItem('rp_asked', '1');
    } catch (e) {}
    var RP = window.RP;
    if (RP && RP.user && RP.sb && RP.profile) {
      RP.sb.from('profiles').update({ words: ME.words, experience: ME.experience })
        .eq('id', RP.user.id).then(function () { RP.profile.words = ME.words; RP.profile.experience = ME.experience; });
    }
  }
  ME.save = saveMe;
  function plain() { return ME.words === 'plain'; }
  ME.isPlain = plain;

  /* ================================================================ */
  /* the glossary — one plain sentence each, no second sentence       */
  /* ================================================================ */
  var G = {
    'semitone': 'The smallest step in music: one key on a piano to the very next one, black or white.',
    'semitones': 'The smallest step in music: one key on a piano to the very next one, black or white.',
    'half step': 'One key on a piano to the very next one. The smallest step there is.',
    'half steps': 'One key on a piano to the very next one. The smallest step there is.',
    'whole step': 'Two keys on a piano, skipping the one in between.',
    'whole steps': 'Two keys on a piano, skipping the one in between.',
    'octave': 'The same note, higher or lower — the way a man and a woman can sing "the same" note.',
    'octaves': 'The same note, higher or lower — the way a man and a woman can sing "the same" note.',
    'pitch': 'How high or low a note is.',
    'vocal range': 'The lowest and highest notes you can sing comfortably.',
    'range': 'The lowest and highest notes you can sing comfortably.',
    'key': 'The handful of notes a song is built from, and the note it feels finished on.',
    'cadence': 'A short run of chords that makes your ear feel the music has arrived home.',
    'degree': 'Where a note sits in the key, counted 1 to 7 from home. "Sing the 5" means the fifth one.',
    'interval': 'The distance between two notes.',
    'intervals': 'The distance between two notes.',
    'scale': 'The notes of a key, in order, going up.',
    'major': 'The bright-sounding set of notes. Most happy-sounding songs use it.',
    'minor': 'The darker-sounding set of notes. Most sad-sounding songs use it.',
    'chord': 'Three or more notes sounding at once.',
    'chords': 'Three or more notes sounding at once.',
    'the third': 'The third note up from home. It is the one that decides whether a chord sounds happy or sad.',
    'tonic': 'Home. The note a song wants to rest on.',
    'semi-occluded': 'Making sound through a narrow opening — a straw, closed lips, a hum. It takes the strain off your voice.',
    'sovt': 'Making sound through a narrow opening — a straw, closed lips, a hum. It takes the strain off your voice.',
    'lip trill': 'Blowing through loose lips so they flutter. It sounds like a motorboat.',
    'lip trills': 'Blowing through loose lips so they flutter. It sounds like a motorboat.',
    'siren': 'Sliding your voice smoothly from low to high and back, like a fire engine.',
    'sirens': 'Sliding your voice smoothly from low to high and back, like a fire engine.',
    'yawn-sigh': 'Start a yawn, then let the sound sigh downwards. It loosens the throat.',
    'straw phonation': 'Humming through a drinking straw.',
    'farinelli breath': 'Breathe in for a count, hold it for a count, breathe out for a count.',
    'sustain': 'Holding one note steady.',
    'cents': 'A very small measure of pitch. One key on a piano is 100 cents, so 20 cents is a fifth of that.',
    'register': 'Which gear your voice is in — chest, head, or the mix between them.',
    'chest voice': 'The thicker, speech-like part of your voice, low down.',
    'head voice': 'The lighter, floatier part of your voice, up high.',
    'mix': 'The blend between your low, speech-like voice and your light, high one.',
    'breath support': 'Letting your breath out steadily, so the note does not wobble or run out.',
    'vibrato': 'The gentle wobble singers let into a held note.',
    'transpose': 'Moving a song up or down so it fits your voice.',
    'transposing': 'Moving a song up or down so it fits your voice.',
    'notation': 'Written music — the dots on lines. You do not need it here.',
    'agility': 'Moving quickly and cleanly between notes.',
    'tone': 'The colour of your sound — warm, bright, breathy, and so on.',
    'larynx': 'Your voice box, in your throat.',
    'laryngeal': 'To do with the voice box in your throat.',
    'staccato': 'Short, separated notes.',
    'legato': 'Notes joined smoothly, with no gap.',
    'arpeggio': 'The notes of a chord sung one after another instead of together.',
    'sharp': 'A bit too high. (It is also the name for the black key just above a note.)',
    'flat': 'A bit too low. (It is also the name for the black key just below a note.)',
    'onset': 'How you start a note — softly, cleanly, or with a little catch.',
    'offbeat': 'Landing between the main beats rather than on them.',
    'cool-down': 'Gentle sound at the end, to leave your voice comfortable.',
    'warm-up': 'Gentle sound at the start, to bring your voice online before you ask anything of it.'
  };
  ME.glossary = G;

  var TERMS = Object.keys(G).sort(function (a, b) { return b.length - a.length; });
  var RX = new RegExp('\\b(' + TERMS.map(function (t) {
    return t.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  }).join('|') + ')\\b', 'i');

  /* ---------------------------------------------------------------- */
  /* marking the words up, without touching anything interactive      */
  /* ---------------------------------------------------------------- */
  var SKIP = /^(SCRIPT|STYLE|BUTTON|INPUT|TEXTAREA|SELECT|OPTION|LABEL|SVG|CANVAS|CODE)$/;
  function markUp(root, cap) {
    if (!root) return;
    var left = cap || 40, seen = {};
    var walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || n.nodeValue.length < 4) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        while (p && p !== root) {
          if (SKIP.test(p.nodeName) || p.classList && p.classList.contains('rp-gl')) return NodeFilter.FILTER_REJECT;
          p = p.parentNode;
        }
        return RX.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var jobs = [], n;
    while (left > 0 && (n = walk.nextNode())) { jobs.push(n); left--; }
    jobs.forEach(function (node) {
      if (!node.parentNode || !node.nodeValue) return;   // our own edits moved it
      var m = RX.exec(node.nodeValue);
      if (!m) return;
      var term = m[1].toLowerCase();
      if (seen[term]) return;           // once per screen is enough
      seen[term] = 1;
      var after = node.splitText(m.index);
      after.nodeValue = after.nodeValue.slice(m[1].length);
      var s = document.createElement('span');
      s.className = 'rp-gl';
      s.dataset.term = term;
      s.textContent = m[1];
      try { node.parentNode.insertBefore(s, after); } catch (e) {}
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.rp-gl');
    if (!t) return;
    e.preventDefault(); e.stopPropagation();
    var term = t.dataset.term;
    say(t.textContent, G[term] || '');
  }, true);

  function say(word, meaning) {
    var o = $('rpGloss');
    if (!o) {
      o = document.createElement('div');
      o.id = 'rpGloss';
      o.style.cssText = 'position:fixed;left:12px;right:12px;bottom:78px;z-index:420;max-width:520px;' +
        'margin:0 auto;background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--gold);' +
        'border-radius:13px;padding:13px 14px;box-shadow:0 10px 34px rgba(0,0,0,.45);display:none';
      document.body.appendChild(o);
      on(o, 'click', function () { o.style.display = 'none'; });
    }
    o.innerHTML = '<div style="font-size:14px;font-weight:900;text-transform:capitalize">' + esc(word) + '</div>' +
      '<div style="font-size:13px;color:var(--ink-dim);line-height:1.5;margin-top:4px">' + esc(meaning) + '</div>' +
      '<div style="font-size:10.5px;color:var(--ink-faint);margin-top:7px">Tap to close</div>';
    o.style.display = 'block';
    clearTimeout(o._h);
    o._h = setTimeout(function () { o.style.display = 'none'; }, 9000);
  }
  ME.explain = say;

  /* ---------------------------------------------------------------- */
  /* first open: two questions, in words that need no music at all     */
  /* ---------------------------------------------------------------- */
  function asked() { try { return localStorage.getItem('rp_asked') === '1'; } catch (e) { return false; } }
  ME.asked = asked;

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

  var step = 0;
  function ask() {
    if (step === 0) {
      sheet('<b style="font-size:18px">Before we start — two questions.</b>' +
        '<div class="measured" style="margin-top:8px">So the app talks to you the right way. ' +
        'There is no wrong answer and you can change both later.</div>' +
        '<div class="rp-lab" style="margin-top:20px">HAVE YOU SUNG MUCH BEFORE?</div>' +
        opt('exp', 1, 'Not really', 'Singing along in the car counts, but that is about it.') +
        opt('exp', 2, 'A bit', 'A choir, a band, some lessons — somewhere in there.') +
        opt('exp', 3, 'Quite a lot', 'You have been doing this a while.'));
      wire('exp', function (v) { ME.experience = v; step = 1; ask(); });
    } else if (step === 1) {
      sheet('<b style="font-size:18px">And music words?</b>' +
        '<div class="measured" style="margin-top:8px">Things like <i>pitch</i>, <i>key</i>, ' +
        '<i>semitone</i>, <i>the third</i>.</div>' +
        '<div class="rp-lab" style="margin-top:20px">WHICH IS CLOSEST?</div>' +
        opt('w', 'plain', 'They lose me', 'I will keep it in plain English and explain any word you tap.') +
        opt('w', 'some', 'I know some', 'Normal words, and anything unusual is one tap from an explanation.') +
        opt('w', 'technical', 'I am comfortable', 'I will use the proper terms and not slow down for them.'));
      wire('w', function (v) { ME.words = v; step = 2; saveMe(); ask(); });
    } else {
      // say back what we heard, so it does not feel like a test with no result
      var e = ME.experience, w = ME.words;
      var line = (e === 1 ? 'Starting you on the beginner exercises'
                : e === 2 ? 'Starting you on the beginner and intermediate exercises'
                : 'All the exercises are open to you') +
        (w === 'plain' ? ', in plain English, and every exercise says what it actually is before you tap it.'
         : w === 'some' ? '. Tap any underlined word and I will explain it in one line.'
         : ', with the proper terms.');
      sheet('<b style="font-size:18px">Got it.</b>' +
        '<div style="font-size:14px;line-height:1.55;margin-top:10px">' + esc(line) + '</div>' +
        '<div class="measured" style="margin-top:12px">You can change either answer any time — ' +
        'it is in <b>Profile</b>, under <b>How I talk to you</b>.</div>' +
        '<button class="btn primary" id="rpOK" style="width:100%;padding:14px;margin-top:18px;font-size:15px">Start</button>');
      on($('rpOK'), 'click', function () { shut(); apply(); });
    }
  }
  ME.ask = function (from) { step = from || 0; ask(); };

  function opt(group, val, title, sub) {
    return '<div class="rp-card" data-' + group + '="' + val + '" style="cursor:pointer;padding:14px">' +
      '<div class="rp-ttl" style="font-size:15px">' + esc(title) + '</div>' +
      '<div class="rp-sub">' + esc(sub) + '</div></div>';
  }
  function wire(group, fn) {
    document.querySelectorAll('[data-' + group + ']').forEach(function (c) {
      on(c, 'click', function () {
        var v = c.getAttribute('data-' + group);
        fn(isNaN(+v) ? v : +v);
      });
    });
  }

  /* ---------------------------------------------------------------- */
  /* what the answers actually change                                  */
  /* ---------------------------------------------------------------- */
  function apply() {
    // A beginner should not be staring at 27 exercises, most of them not for
    // them. The Train tab keeps this under 'rep_level' and reads it at start-up,
    // so the button gets pressed too — otherwise it would take a reload.
    try {
      if (ME.experience === 1 && !localStorage.getItem('rep_level')) {
        localStorage.setItem('rep_level', '1');
        needLevel = true;   // pressed the first time the Train tab actually renders
      }
    } catch (e) {}
    document.body.classList.toggle('rp-plainwords', plain());
    repaint();
  }
  ME.apply = apply;

  /* The Train tab reads its filter once at start-up, so setting the value is
     not enough on a first run — the button has to be pressed once the tab
     exists. One shot only: if the singer then picks a different level, that
     is their choice and we leave it alone. */
  var needLevel = false;
  function pressBeginner() {
    if (!needLevel) return;
    var b = document.querySelector('[data-level="1"]');
    if (!b) return;
    needLevel = false;
    if (!b.classList.contains('on')) b.click();
  }

  var painting = false;
  function repaint() {
    if (painting) return;            // our own marks trigger the observer
    painting = true;
    try {
      var m = document.querySelector('.mode.active');
      if (m) {
        pressBeginner();
        if (ME.words !== 'technical') markUp(m, 40);
        if (plain()) plainOut(m);
      }
    } catch (e) {
    } finally {
      setTimeout(function () { painting = false; }, 60);
    }
  }
  ME.repaint = repaint;

  /* In plain mode, an exercise list says what the thing IS, not only its
     insider name. The description is already in the build — it was just
     hidden behind a tap. */
  function plainOut(root) {
    if (!V10.EX) return;
    root.querySelectorAll('.exrow[data-ex]').forEach(function (row) {
      if (row.dataset.rpPlain) return;
      var ex = V10.exById && V10.exById(row.dataset.ex);
      if (!ex || !ex.what) return;
      row.dataset.rpPlain = '1';
      var d = document.createElement('div');
      d.className = 'rp-whatis';
      d.textContent = String(ex.what).replace(/<[^>]+>/g, '');
      var head = row.querySelector('.exhead');
      try {
        if (head && head.parentNode === row) row.insertBefore(d, head.nextSibling);
        else row.appendChild(d);
      } catch (e) { row.appendChild(d); }
    });
  }

  /* keep it applied as screens change */
  var pending = null;
  function later() { clearTimeout(pending); pending = setTimeout(repaint, 220); }
  var mo = new MutationObserver(later);
  function watch() {
    var w = document.querySelector('.wrap') || document.body;
    mo.observe(w, { childList: true, subtree: true });
  }

  /* ---------------------------------------------------------------- */
  /* a way back in, from Profile                                       */
  /* ---------------------------------------------------------------- */
  function mountProfileRow() {
    var host = $('modeYou');
    if (!host || $('rpTalkRow')) return;
    var d = document.createElement('div');
    d.id = 'rpTalkRow';
    d.className = 'rp-card';
    d.style.cursor = 'pointer';
    d.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<div><div class="rp-ttl">How I talk to you</div>' +
      '<div class="rp-sub">' + (plain() ? 'Plain English' : ME.words === 'some' ? 'Normal words, tap to explain' : 'Proper terms') +
      ' · ' + (ME.experience === 1 ? 'new to singing' : ME.experience === 2 ? 'sung a bit' : 'sung a lot') + '</div></div>' +
      '<div style="color:var(--ink-faint);font-size:20px">›</div></div>';
    on(d, 'click', function () { ME.ask(0); });
    // only ever place it among this screen's own direct children
    try { host.appendChild(d); } catch (e) {}
  }

  /* styles */
  (function css() {
    var s = document.createElement('style');
    s.id = 'rpPlainCSS';
    s.textContent =
      '.rp-gl{border-bottom:1px dashed var(--gold);cursor:pointer;}' +
      '.rp-gl:active{background:rgba(232,179,74,.16);}' +
      '.rp-whatis{font-size:12.5px;color:var(--ink-dim);line-height:1.5;margin-top:6px;' +
      'padding-left:9px;border-left:2px solid var(--line);}';
    document.head.appendChild(s);
  })();

  function boot() {
    watch();
    apply();
    var host = $('modeYou');
    setInterval(mountProfileRow, 1500);
    if (!asked()) setTimeout(function () { ME.ask(0); }, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 300);
})();
