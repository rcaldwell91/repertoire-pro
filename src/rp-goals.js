/* ======================================================================
   Repertoire Pro — "I want to be able to…"

   The idea bank, item 7, and it is the point underneath most of the others.
   Robert:

     "Maybe people don't know. They just know what they wanna do… I don't
      really know what exercise I need. I don't know the difference. I just
      wanna be able to sing these type of songs at karaoke."

   So: nobody should have to know the name of an exercise to be given the
   right one. You say what you want to be able to DO, in the words you would
   actually use, and the app hands you the work.

   Item 4 — the style techniques, screams and runs and vibrato and whistle
   notes — is the same feature and is folded in here rather than built
   separately. Those are exactly the things people CAN name when they cannot
   name an exercise, which is the whole argument for this screen.

   ----------------------------------------------------------------------
   THE THREE PLACES THIS SCREEN SAYS NO
   ----------------------------------------------------------------------
   Every goal here lists real exercises that already exist in the app. Three
   of them also have to tell the truth about their limits, and those are the
   most valuable entries on the screen rather than the weakest:

   · WHISTLE NOTES. The laryngeal geometry is not present in every singer,
     and no amount of training creates the register if the physiology does
     not support it. Selling practice toward something somebody may simply
     not have is the clearest possible version of the thing this app refuses
     to do. So it says so.

   · SCREAMS AND GROWLS. The noise is false-fold vibration, and the research
     is genuinely reassuring — laryngoscopy studies of singers performing
     these effects found no visible pathology, and there is little evidence
     that the effects are inherently damaging. But "not inherently damaging"
     is not "safe to learn off a screen". The app explains what it is, and
     then says plainly that this one wants a teacher watching you.

   · VIBRATO. It is not a wobble you add. It appears as a tension-release
     oscillation, and training changes it rather than installing it. So the
     honest instruction is to work on what suppresses it.

   ----------------------------------------------------------------------
   Research behind this is in Drive, "RESEARCH: the style techniques".
   As with the body work, the numbers found in search were not verifiable at
   source from this sandbox, so none are printed on screen.
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

  var G = window.RPGoals = {};

  /* `ex` are app exercise ids. Anything that does not resolve is simply not
     shown, so this list can never promise an exercise that is not there. */
  var GOALS = [
    {
      id: 'high', skill: 'Higher notes', name: 'Hit higher notes without it hurting',
      sub: 'The top of your range, without the strain.',
      ex: ['siren', 'liptrill', 'yawnsigh', 'descend', 'octleap', 'nay'],
      say: 'Height comes from coordination before it comes from effort, which is why almost ' +
           'everything here is quiet. Sirens and lip trills let you cross the gear change without ' +
           'pushing through it, and starting at the TOP and coming down takes the shove out of it.',
      note: 'If it hurts, that is not a sign you are working hard enough — stop. Pain is the one ' +
            'signal in singing that never means progress.'
    },
    {
      id: 'runs', skill: 'Runs and riffs', name: 'Sing runs and riffs',
      sub: 'The fast decorated bits. The proper word is melisma.',
      ex: ['ninetone', 'staccato', 'gee', 'mee', 'octrep'],
      say: 'A run is a fine motor skill, so it is built the way every fine motor skill is built: ' +
           'slowly, cleanly, then faster in small steps. Take a short pattern, slow it until every ' +
           'note is genuinely separate, then lift the tempo a little at a time.',
      note: 'Speed built on approximate notes stays approximate at every tempo, because what you ' +
            'rehearse is what you learn. The ladder lets you set the speed — use it low first.'
    },
    {
      id: 'vibrato', skill: 'Vibrato', name: 'Get vibrato',
      sub: 'The natural shimmer on a held note.',
      ex: ['messa', 'sustain', 'yawnsigh', 'hum'],
      say: 'Vibrato is not a wobble you add on top. It is an oscillation that shows up on its own ' +
           'when the voice is free — so the work is not "do a vibrato", it is removing whatever is ' +
           'holding the note rigid. Long easy notes, and getting louder and softer on one pitch.',
      note: 'Manufacturing a wobble by shaking your jaw or your stomach is a different thing that ' +
            'sounds like vibrato and is not. Training changes the vibrato you have; it does not ' +
            'install one.'
    },
    {
      id: 'belt', skill: 'Belting', name: 'Sing loud without shouting',
      sub: 'Power that does not cost you the next day.',
      ex: ['nay', 'bay', 'wah', 'mee', 'staccato'],
      say: 'The bright, slightly bratty sounds are the way in. They get you volume from resonance ' +
           'rather than from pushing more air, which is the difference between belting and shouting.',
      note: 'THIS IS THE ONE MOST WORTH A REAL TEACHER. Loud is where people hurt themselves, and ' +
            'an app cannot hear the difference between a good loud and a bad one. If you have a ' +
            'coach, ask them to listen to this.'
    },
    {
      id: 'flat', skill: 'Staying in tune', name: 'Stop going flat',
      sub: 'Landing on the note and staying there.',
      ex: ['mum', 'mee', 'descend', 'sustain'],
      say: 'This is the one the app is genuinely best at, because it can measure it. The Pitch ' +
           'Tracker shows you where you actually are while you sing, and the ear drills tell you ' +
           'in cents how far off you were — which is a number, not an opinion.',
      note: 'Most people who think they are tone deaf are not. They have simply never had anything ' +
            'tell them, in the moment, which way they were off.'
    },
    {
      id: 'steady', name: 'Hold a note without wobbling',
      sub: 'Steady, and for as long as you meant to.',
      ex: ['sustain', 'hiss', 'farinelli', 'straw'],
      say: 'A wobble is usually an air problem rather than a throat problem. Steady air makes a ' +
           'steady note, so the work is mostly breath, and the app scores the hold so you can see ' +
           'it improve.',
      note: ''
    },
    {
      id: 'air', skill: 'Breath', name: 'Not run out of air',
      sub: 'Getting to the end of the phrase.',
      ex: ['hiss', 'farinelli', 'straw', 'liptrill'],
      say: 'Almost nobody who runs out of air is short of air. They are spending it too fast at ' +
           'the start. The hiss is timed for exactly that — it makes the leak visible.',
      note: ''
    },
    {
      id: 'whistle', name: 'Whistle notes',
      sub: 'The very top. The Mariah thing.',
      ex: ['siren', 'liptrill'],
      say: 'Worth knowing before you spend months on it: the whistle register depends on the shape ' +
           'of your larynx, and not everybody has one that will do it. Where the physiology is not ' +
           'there, no amount of practice creates it. Researchers do not fully agree on the ' +
           'mechanism even in the people who have it.',
      note: 'So the app will not sell you a whistle-note course. Quiet sirens taken gently upward ' +
            'are the honest way to find out whether it is there — and if it is not, that is ' +
            'information, not failure.',
      hard: true
    },
    {
      id: 'scream', skill: 'Screams and growls', name: 'Screams and growls',
      sub: 'Rock and metal distortion — the high scream and the low one.',
      ex: ['straw', 'liptrill', 'hum'],
      say: 'The grit is not your vocal cords tearing. It is the FALSE folds — a second pair sitting ' +
           'above the ones that make your actual note — vibrating alongside them and adding noise. ' +
           'Laryngoscopy studies of singers doing these effects have found no visible damage, and ' +
           'there is little evidence that the effects are inherently harmful when they are done ' +
           'properly.',
      note: 'AND THE APP IS STILL NOT GOING TO TEACH YOU. "Not inherently harmful" is a very ' +
            'different sentence from "safe to learn off a screen", and the gap between them is ' +
            'somebody watching and listening while you do it. Find a coach who teaches distortion. ' +
            'What is listed here is the gentle work that keeps the voice underneath it healthy — ' +
            'which every scream teacher will start you on anyway.',
      hard: true
    }
  ];
  G.goals = GOALS;

  function exFor(g) {
    var out = [];
    (g.ex || []).forEach(function (id) {
      var e = null;
      try { e = V10.exById ? V10.exById(id) : null; } catch (err) {}
      if (e) out.push(e);
    });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Robert, 13 Sep: not a pop-up. A page, with a back button. */
  function sheet(html) {
    if (window.RPPage) {
      return RPPage.open({ key: 'goals', backLabel: 'Train', html: html });
    }
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
  function shut() {
    if (window.RPPage && RPPage.isOpen()) return RPPage.back();
    var o = $('rpSheet'); if (o) { o.style.display = 'none'; o.innerHTML = ''; }
  }

  G.open = function (id) {
    if (id) return one(id);
    var h = '<b style="font-size:18px">What do you want to be able to do?</b>' +
      '<div class="measured" style="margin-top:8px">Say it however you would say it out loud. ' +
      'You do not need to know what any exercise is called — that is the app’s job.</div>' +
      '<div style="margin-top:14px">';
    GOALS.forEach(function (g) {
      h += '<div class="rp-card" data-goal="' + esc(g.id) + '" style="cursor:pointer;padding:12px;' +
        'margin-bottom:7px">' +
        '<div class="rp-ttl">' + esc(g.name) +
        (g.hard ? '<span class="rp-tag">read this one first</span>' : '') + '</div>' +
        '<div class="rp-sub">' + esc(g.sub) + '</div></div>';
    });
    h += '</div><button class="btn" id="rpGoalX" style="width:100%;padding:12px;margin-top:8px">Close</button>';
    var box = sheet(h);
    on($('rpGoalX'), 'click', shut);
    box.querySelectorAll('[data-goal]').forEach(function (c) {
      on(c, 'click', function () { G.open(c.dataset.goal); });
    });
  };

  function one(id) {
    var g = GOALS.filter(function (x) { return x.id === id; })[0];
    if (!g) return G.open();
    var list = exFor(g);

    var h = '<button class="btn" id="rpGoalBack" style="padding:7px 11px;font-size:12px">‹ All of them</button>' +
      '<b style="font-size:18px;display:block;margin-top:12px">' + esc(g.name) + '</b>' +
      '<div class="rp-sub" style="margin-top:2px">' + esc(g.sub) + '</div>' +
      '<div style="font-size:13.5px;line-height:1.6;margin-top:12px">' + esc(g.say) + '</div>';

    if (g.note) {
      h += '<div class="rp-card" style="margin-top:12px;padding:12px;border-left:3px solid ' +
        (g.hard ? 'var(--miss)' : 'var(--gold)') + '">' +
        '<div style="font-size:13px;line-height:1.55">' + esc(g.note) + '</div></div>';
    }

    if (list.length) {
      h += '<div class="rp-lab" style="margin-top:18px">WHAT TO DO, IN ORDER</div>';
      list.forEach(function (e, i) {
        h += '<div class="rp-card" style="padding:11px;margin-top:7px">' +
          '<div class="rp-ttl">' + (i + 1) + '. ' + esc(e.name) +
          (e.syl ? '<span class="rp-tag">' + esc(e.syl) + '</span>' : '') + '</div>' +
          (e.what ? '<div class="rp-sub">' + String(e.what).replace(/<[^>]+>/g, '') + '</div>' : '') +
          '<button class="btn primary" data-start="' + esc(e.id) + '" style="width:100%;padding:9px;' +
          'margin-top:8px;font-size:12.5px">Start this one</button></div>';
      });
    }

    /* The screams card says plainly that the app will not teach you this and
       that you should find somebody who will. Saying that and then leaving
       you to work out how is not much of an answer, so the coaches who put
       their hand up for it are one tap away. */
    if (g.skill && window.RPFind) {
      h += '<button class="btn" id="rpGoalCoach" style="width:100%;padding:11px;margin-top:14px;' +
        'font-size:12.5px">Find a coach who teaches ' + esc(String(g.skill).toLowerCase()) + '</button>';
    }

    h += '<button class="btn" id="rpGoalX" style="width:100%;padding:12px;margin-top:' +
      (g.skill && window.RPFind ? '8px' : '14px') + '">Close</button>';
    var box = sheet(h);
    on($('rpGoalX'), 'click', shut);
    on($('rpGoalCoach'), 'click', function () { RPFind.browse(g.skill); });
    on($('rpGoalBack'), 'click', function () { G.open(); });
    box.querySelectorAll('[data-start]').forEach(function (b) {
      on(b, 'click', function () {
        shut();
        try { window.switchMode('train'); } catch (e) {}
        setTimeout(function () { try { V10.startEx(b.dataset.start); } catch (e) {} }, 130);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /* the way in, at the top of Train                                     */
  /* ------------------------------------------------------------------ */
  function mount() {
    var host = $('modeTrain');
    if (!host || $('rpGoalRow')) return;
    var d = document.createElement('div');
    d.id = 'rpGoalRow';
    d.className = 'exrow';
    d.style.cursor = 'pointer';
    d.innerHTML = '<div class="exhead">' +
      '<div class="exname">I want to be able to…</div>' +
      '<button class="btn primary" id="rpGoalGo" style="padding:7px 12px;font-size:12px">Open</button>' +
      '</div>' +
      '<div class="exsyl" style="margin-top:6px;font-weight:600">Higher notes · runs · vibrato · ' +
      'belting · staying in tune · screams</div>' +
      '<div class="measured">Say what you want to do. You do not need to know what any exercise is called.</div>';
    host.insertBefore(d, host.firstChild);
    on($('rpGoalGo'), 'click', function (e) { e.stopPropagation(); G.open(); });
    on(d, 'click', function () { G.open(); });
  }

  setInterval(mount, 1500);
  setTimeout(mount, 1050);
})();
