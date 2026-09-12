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
    words: 'some',      // 'plain' | 'some' | 'technical'  — DERIVED, never asked
    experience: 2,      // 1 new · 2 some · 3 lots          — the singing side
    taught: 2,          // 1 none · 2 some · 3 a lot        — the music side
    answers: null       // what they actually said, kept raw
  };
  try {
    ME.words = localStorage.getItem('rp_words') || 'some';
    ME.experience = +(localStorage.getItem('rp_exp') || 2);
    ME.taught = +(localStorage.getItem('rp_taught') || 2);
    ME.answers = JSON.parse(localStorage.getItem('rp_answers') || 'null');
  } catch (e) {}

  /* ------------------------------------------------------------------ */
  /* WORKING THE LEVELS OUT FROM THE ANSWERS                             */
  /*                                                                     */
  /* Robert's rule, and it is the whole redesign: "to ask a question     */
  /* about jargon would throw any regular person off. They have no idea  */
  /* what they're talking about."                                        */
  /*                                                                     */
  /* So nobody is asked to rate their own vocabulary. Two questions ask  */
  /* what their singing actually does, two ask what they have actually   */
  /* been taught, and every one of them is answerable by somebody who    */
  /* knows nothing. The levels — and the language the app uses — are     */
  /* worked out from that.                                               */
  /* ------------------------------------------------------------------ */
  function band(sum) { return sum <= 3 ? 1 : sum <= 6 ? 2 : 3; }

  ME.derive = function (a) {
    if (!a) return null;
    var sing   = band((+a.history || 1) + (+a.pitch || 1));
    var taught = band((+a.terms || 1) + (+a.reading || 1));
    return {
      experience: sing,
      taught: taught,
      words: taught === 1 ? 'plain' : taught === 2 ? 'some' : 'technical'
    };
  };

  function saveMe() {
    try {
      localStorage.setItem('rp_words', ME.words);
      localStorage.setItem('rp_exp', String(ME.experience));
      localStorage.setItem('rp_taught', String(ME.taught));
      if (ME.answers) localStorage.setItem('rp_answers', JSON.stringify(ME.answers));
      localStorage.setItem('rp_asked', '1');
    } catch (e) {}
    var RP = window.RP;
    if (RP && RP.user && RP.sb && RP.profile) {
      var row = { words: ME.words, experience: ME.experience, taught: ME.taught };
      /* the raw answers travel too, so a later change to the questions or the
         mapping can re-place everybody instead of stranding them on whatever
         rule happened to be running the day they signed up */
      if (ME.answers) row.placement = { answers: ME.answers, at: new Date().toISOString() };
      RP.sb.from('profiles').update(row).eq('id', RP.user.id).then(function () {
        RP.profile.words = ME.words;
        RP.profile.experience = ME.experience;
        RP.profile.taught = ME.taught;
      });
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
    var shown = t.textContent;
    say(shown.charAt(0).toUpperCase() + shown.slice(1), G[term] || '');
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
    o.innerHTML = '<div style="font-size:14px;font-weight:900">' + esc(word) + '</div>' +
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
      on(o, 'click', function (e) {
        if (e.target !== o) return;                       // only the dark area
        if (!o.querySelector('[data-skip]')) return;      // only the skippable questions
        saveMe(); shut(); apply();
      });
    }
    o.innerHTML = '<div style="background:var(--panel);border:1px solid var(--line);' +
      'border-radius:18px 18px 0 0;width:100%;max-width:560px;padding:20px 16px ' +
      'calc(24px + env(safe-area-inset-bottom,0px));max-height:94vh;overflow-y:auto">' + html + '</div>';
    o.style.display = 'flex';
    return o.firstChild;
  }
  function shut() { var o = $('rpSheet'); if (o) { o.style.display = 'none'; o.innerHTML = ''; } }

  /* Tapping the dark area outside, and the escape key, are what everybody
     already tries first when a thing appears over the app. Both work. */
  (function escapeHatch() {
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var o = $('rpSheet');
      if (o && o.style.display !== 'none' && o.querySelector('[data-skip]')) {
        saveMe(); shut(); apply();
      }
    });
  })();

  /* Robert, 12 Sep: "you have to be able to exit out that little
     questionnaire when you first open the app for the first time. You
     shouldn't force people to answer those questions."

     He is right, and it was worse than rude: the app's whole argument is that
     it never pretends, and an unskippable form on first open is the app
     demanding something before it has given anything. The defaults are
     perfectly good — middle of the road on both — and both answers are
     changeable in Profile whenever they feel like it. */
  function skipRow(where) {
    return '<button class="btn" data-skip="1" style="width:100%;padding:11px;margin-top:14px;' +
      'font-size:12.5px;color:var(--ink-dim)">Skip this \u2014 just let me in</button>' +
      '<div class="measured" style="margin-top:7px;font-size:11.5px;text-align:center">' +
      'Nothing is lost. It all lives in <b>Profile</b> under <b>Where I have got you</b>, ' +
      'and you can set them whenever you want.</div>';
  }

  function wireSkip(box) {
    var b = (box || document).querySelector('[data-skip]');
    if (!b) return;
    on(b, 'click', function () {
      /* Remember that we ASKED, so it does not nag on every launch, but do
         not pretend they answered: whatever is in ME already is the default,
         and it is written down as the default rather than as their choice. */
      saveMe();
      shut();
      apply();
      try {
        if (window.RP && RP.toast) RP.toast('No problem. It is all in Profile if you change your mind.');
      } catch (e) {}
    });
  }

  /* ------------------------------------------------------------------ */
  /* THE PLACEMENT QUESTIONS                                             */
  /*                                                                     */
  /* Four cards, numbered so it is visibly finite, and offered rather    */
  /* than imposed. Robert: "It's not a force thing. If they don't wanna  */
  /* take the test, they wanna just start dabbling around in the whole   */
  /* thing, that's fine."                                                */
  /*                                                                     */
  /* Every option is written so somebody who has never had a lesson can  */
  /* pick one honestly. Question 3 is the old jargon question, asked the */
  /* way round that a beginner can answer: not "how much terminology do  */
  /* you want", but "here is a sentence a teacher would say — what would */
  /* you do?", with "no idea where to start" as a first-class answer.    */
  /* ------------------------------------------------------------------ */
  var QS = [
    { key: 'history', lab: 'YOUR SINGING',
      q: 'How much singing have you actually done?',
      why: '',
      opts: [
        [1, 'Not much, or only on my own', 'In the car, in the shower, nowhere anybody can hear.'],
        [2, 'I sing a lot \u2014 nobody has taught me', 'Plenty of practice, no instruction.'],
        [3, 'Lessons, a choir or a band at some point', 'Somebody has corrected you before.'],
        [4, 'Trained, and I have stuck at it', 'You have been doing this properly for a while.']
      ] },
    { key: 'pitch', lab: 'YOUR SINGING',
      q: 'When you sing along to a record, what usually happens?',
      why: 'This is the one that decides which warm-ups you get first.',
      opts: [
        [1, 'I honestly cannot tell if I am on the right note', 'Most people start here. It is a skill, not a gift.'],
        [2, 'I hear when I am off, but I cannot always fix it', 'Your ear is ahead of your voice \u2014 very common.'],
        [3, 'Usually on it, and I know when I am not', ''],
        [4, 'On it, and I can adjust while I am singing', '']
      ] },
    { key: 'terms', lab: 'WORDS AND MUSIC',
      q: 'A teacher says \u201cgo up to the fifth and hold it\u201d. What do you do?',
      why: 'No wrong answer. This decides how the app words things, nothing else.',
      opts: [
        [1, 'No idea where to start', 'Then the app will not talk like that to you.'],
        [2, 'I would guess', ''],
        [3, 'I know roughly what they mean', ''],
        [4, 'I would just do it', '']
      ] },
    { key: 'reading', lab: 'WORDS AND MUSIC',
      q: 'Have you ever read music off a page?',
      why: '',
      opts: [
        [1, 'Never', 'You will never need to here. Nothing in this app is gated behind it.'],
        [2, 'I have tried, slowly', ''],
        [3, 'Yes, I can read a line', ''],
        [4, 'Yes, fluently', '']
      ] }
  ];

  var step = 0;
  var answers = {};

  function ask() {
    /* step 0 is the OFFER. Nothing has been asked yet and nothing has to be. */
    if (step === 0) {
      sheet('<b style="font-size:18px">Want me to work out where to start you?</b>' +
        '<div class="measured" style="margin-top:8px">Four questions, about a minute. They decide which ' +
        'warm-ups you are given first and how the app words things \u2014 and you can change any of it later, ' +
        'or ignore all of it and just have a look round.</div>' +
        '<button class="btn primary" id="rpGoQ" style="width:100%;padding:14px;margin-top:18px;font-size:15px">' +
        'Ask me the four questions</button>' +
        '<button class="btn" data-skip="1" style="width:100%;padding:12px;margin-top:9px;color:var(--ink-dim)">' +
        'Not now \u2014 let me look round</button>' +
        '<div class="measured" style="margin-top:8px;font-size:11.5px;text-align:center">' +
        'It is in <b>Profile</b> whenever you want it.</div>');
      on($('rpGoQ'), 'click', function () { step = 1; ask(); });
      wireSkip($('rpSheet'));
      return;
    }

    if (step <= QS.length) {
      var Q = QS[step - 1];
      var h = '<div class="row" style="justify-content:space-between;align-items:baseline">' +
        '<div class="rp-lab">' + esc(Q.lab) + '</div>' +
        '<div class="rp-lab" style="color:var(--gold)">QUESTION ' + step + ' OF ' + QS.length + '</div></div>' +
        '<b style="font-size:17px;display:block;margin-top:8px;line-height:1.35">' + Q.q + '</b>';
      if (Q.why) h += '<div class="measured" style="margin-top:7px">' + esc(Q.why) + '</div>';
      h += '<div style="margin-top:14px">';
      Q.opts.forEach(function (o) { h += opt('a', o[0], o[1], o[2]); });
      h += '</div>';
      h += '<div class="row" style="gap:8px;margin-top:12px">' +
        (step > 1 ? '<button class="btn" id="rpQBack" style="flex:1;padding:11px;font-size:12.5px">\u2039 Back</button>' : '') +
        '<button class="btn" data-skip="1" style="flex:1;padding:11px;font-size:12.5px;color:var(--ink-dim)">Skip the rest</button>' +
        '</div>';
      sheet(h);
      wire('a', function (v) {
        answers[Q.key] = v;
        step++;
        ask();
      });
      on($('rpQBack'), 'click', function () { step--; ask(); });
      wireSkip($('rpSheet'));
      return;
    }

    /* all four answered — say what was decided, and why */
    var d = ME.derive(answers) || {};
    ME.answers = answers;
    ME.experience = d.experience;
    ME.taught = d.taught;
    ME.words = d.words;
    saveMe();

    var singLine = d.experience === 1
      ? 'Starting you on the beginner warm-ups \u2014 the gentlest ones, and the ones that actually teach pitch.'
      : d.experience === 2
      ? 'Starting you on the beginner and intermediate warm-ups.'
      : 'Every exercise is open to you.';
    var wordLine = d.taught === 1
      ? 'Plain English throughout. Any word worth knowing is explained the first time it appears, and you can tap it again later.'
      : d.taught === 2
      ? 'Normal words, and anything unusual is one tap from a plain sentence.'
      : 'The proper terms, used properly, with no slowing down.';

    sheet('<b style="font-size:18px">Right \u2014 here is where I am putting you.</b>' +
      '<div class="rp-card" style="margin-top:14px;padding:12px">' +
      '<div class="rp-lab">YOUR SINGING</div>' +
      '<div style="font-size:14px;line-height:1.55;margin-top:4px">' + esc(singLine) + '</div></div>' +
      '<div class="rp-card" style="margin-top:9px;padding:12px">' +
      '<div class="rp-lab">WORDS AND MUSIC</div>' +
      '<div style="font-size:14px;line-height:1.55;margin-top:4px">' + esc(wordLine) + '</div></div>' +
      '<div class="measured" style="margin-top:12px">This is what you <b>told</b> me \u2014 it is not measured. ' +
      'If it is wrong, change it in <b>Profile</b>, or take the test, which measures instead of asking.</div>' +
      '<button class="btn primary" id="rpOK" style="width:100%;padding:14px;margin-top:16px;font-size:15px">Start</button>' +
      '<button class="btn" id="rpTestNow" style="width:100%;padding:12px;margin-top:9px;font-size:12.5px">' +
      'Test me instead \u2014 measure it</button>');
    on($('rpOK'), 'click', function () { shut(); apply(); });
    on($('rpTestNow'), 'click', function () {
      shut(); apply();
      try { if (window.RPTest) RPTest.open(); } catch (e) {}
    });
  }

  ME.ask = function (from) { step = from || 0; answers = {}; ask(); };

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
    if (!host) return;
    /* This used to bail out the moment the row existed, so it showed whatever
       was true the first time Profile was opened and never changed again —
       answer the questions and it still described the old you. Build it once,
       then keep writing the current answer into it. */
    var d = $('rpTalkRow');
    var fresh = !d;
    if (fresh) {
      d = document.createElement('div');
      d.id = 'rpTalkRow';
      d.className = 'rp-card';
      d.style.cursor = 'pointer';
    }
    var sing = ME.experience === 1 ? 'beginner warm-ups'
             : ME.experience === 2 ? 'beginner and intermediate' : 'everything';
    var wrd  = ME.taught === 1 ? 'plain English'
             : ME.taught === 2 ? 'normal words, tap to explain' : 'proper terms';
    d.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<div><div class="rp-ttl">Where I have got you</div>' +
      '<div class="rp-sub">Singing: ' + sing + ' \u00b7 Words: ' + wrd + '</div></div>' +
      '<div style="color:var(--ink-faint);font-size:20px">\u203a</div></div>';
    if (fresh) {
      on(d, 'click', function () { ME.ask(0); });
      // only ever place it among this screen's own direct children
      try { host.appendChild(d); } catch (e) {}
    }
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

  /* The microphone dialog is a wall for a first-timer. It keeps its Close
     button; it now also closes on a tap outside it or on escape, and it no
     longer covers the tabs (see rp-skin.css). */
  function tameMicDialog() {
    var d = $('micHelp');
    if (!d) return;
    if (!d.dataset.rpTame) {
      d.dataset.rpTame = '1';
      d.addEventListener('click', function (e) {
        if (e.target === d) d.style.display = 'none';
      });
    }
    // A first-timer who cannot free the microphone has nowhere to go: both
    // buttons assume they can fix it. Plenty of the app does not need a mic,
    // so say so and let them get on with it.
    var row = d.querySelector('.row');
    if (row && !$('rpNoMic')) {
      var b = document.createElement('button');
      b.className = 'btn ghost';
      b.id = 'rpNoMic';
      b.style.cssText = 'margin-right:auto';
      b.textContent = 'Carry on without it';
      on(b, 'click', function () {
        d.style.display = 'none';
        noMicNote();
      });
      row.insertBefore(b, row.firstChild);
    }
  }

  function noMicNote() {
    say('Without a microphone',
      'Plenty still works: the breathing exercises, Higher or lower in the ear drills, ' +
      'every theory game, and all of the Learn tab. Anything that listens to you will ' +
      'wait until the mic is free.');
  }
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var d = $('micHelp');
    if (d && d.style.display !== 'none') d.style.display = 'none';
  });

  function boot() {
    watch();
    setInterval(tameMicDialog, 1200);
    apply();
    var host = $('modeYou');
    setInterval(mountProfileRow, 1500);
    if (!asked()) setTimeout(function () { ME.ask(0); }, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 300);
})();
