/* ======================================================================
   Repertoire Pro — "Test me and see where I'm at."

   Robert, 12 Sep:

     "I'm thinking maybe we can have a test — do you wanna build a 'test me
      to see where I'm at'? After they ask those questions, if we wanna do a
      thorough test, you can give them some warm-ups and see what they score
      in, and let the test exercises and the test warm-ups determine where
      their level is. Give them a quiz on some music theory and what are
      some of the terms, see if they know what that is. That's where the
      gamify stuff comes in. Okay, what's this interval — is it a third, is
      it an octave, is it a fifth?"

   The four placement questions ask. This MEASURES. That is the whole
   difference, and it is the reason this is worth building: a self-reported
   level is a guess, and everywhere else this app refuses to show a number
   it did not measure.

   So nothing here invents a score. Every step launches an exercise the app
   already has, and reads the result that exercise already writes down:

     · Steady note   → per cent of the hold that stayed inside the window
     · Ear drill     → how many cents off the note, and how many rounds hit
     · Theory game   → stars, out of three

   It does not drive those screens automatically. It hands you to them one
   at a time and waits, because an exercise that runs itself is an exercise
   you are not doing.

   NOT FINISHED: Robert has said this sits behind the paywall later. It is
   free today because there is no paywall today. Nothing here assumes either
   way.
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

  var T = window.RPTest = {};

  /* When the test was started. Only results logged AFTER that count, so an
     old ear drill from last week cannot stand in for one you have not done. */
  var startedAt = 0;
  try { startedAt = +(localStorage.getItem('rp_test_at') || 0); } catch (e) {}

  var STEPS = [
    { key: 'range', name: 'Sing your range',
      what: 'Your lowest comfortable note, then your highest. About a minute. Every exercise is then built around it.',
      measures: 'your range', mode: 'you',
      go: function () {
        try { if (window.RPProfile) RPProfile.open('voice'); } catch (e) {}
        setTimeout(function () {
          var b = $('btnRangeTest');
          if (b) { try { b.scrollIntoView({ block: 'center' }); } catch (e) {} b.click(); }
        }, 350);
      } },
    { key: 'sustain', name: 'Hold one note steady',
      what: 'Five seconds on one note. It measures how much of the hold stayed on the note.',
      measures: 'breath and steadiness', mode: 'train',
      go: function () { var b = $('btnSustain'); if (b) b.click(); } },
    { key: 'ear', name: 'Hear the note',
      what: 'A few rounds of ear training. It measures how far off you are, in cents.',
      measures: 'your ear', mode: 'train',
      go: function () { try { V10.startDrill('hilo'); } catch (e) {} } },
    { key: 'sing', name: 'Sing the note back',
      what: 'A note plays, you sing it and hold it. Ten rounds. It counts how many you matched.',
      measures: 'pitch, with your own voice', mode: 'train',
      go: function () { var b = $('btnMatch'); if (b) b.click(); } },
    { key: 'theory', name: 'Name the interval',
      what: 'Is that a third, a fifth, an octave? Three stars if you have it.',
      /* The theory games render into modeLearn, not modeTrain. Sending
         somebody to Train and then starting a game there left them looking
         at the exercise list with the game built invisibly behind it. */
      measures: 'what you have been taught', mode: 'learn',
      go: function () { try { V10.startGame('interval'); } catch (e) {} } }
  ];

  /* the results this test can see: mine, and since it started */
  function mine() {
    var uid = (window.RP && RP.user) ? RP.user.id : null;
    return (window.RP && RP.results ? RP.results : []).filter(function (r) {
      if (uid && r.student_id !== uid) return false;
      var t = new Date(r.created_at).getTime();
      /* a row with no usable date is a row that has only just been written —
         count it rather than losing the thing they have this second done */
      return isNaN(t) ? true : t >= startedAt;
    });
  }

  function isMatch(r) { return /note match/i.test(r.label || ''); }
  function resultFor(key) {
    var rs = mine();
    if (key === 'range') {
      var rg = null;
      try { rg = window.RPRange ? RPRange.get() : null; } catch (e) {}
      if (!rg || rg.by !== 'test' || !rg.at) return null;
      if (new Date(rg.at).getTime() < startedAt) return null;
      return { lo: rg.lo, hi: rg.hi };
    }
    if (key === 'sing') {
      var mm = rs.filter(function (r) { return r.kind === 'ear' && isMatch(r) && r.out_of; });
      if (!mm.length) return null;
      var best = mm.slice().sort(function (a, b) { return b.score / b.out_of - a.score / a.out_of; })[0];
      return { score: best.score, outOf: best.out_of };
    }
    if (key === 'sustain') {
      var s = rs.filter(function (r) { return r.kind === 'sustain' && r.pct != null; });
      return s.length ? { pct: Math.max.apply(null, s.map(function (r) { return r.pct; })) } : null;
    }
    if (key === 'ear') {
      var e = rs.filter(function (r) { return r.kind === 'ear' && r.cents != null && !isMatch(r); });
      if (!e.length) return null;
      return { cents: Math.min.apply(null, e.map(function (r) { return r.cents; })),
               runs: e.length };
    }
    if (key === 'theory') {
      var g = rs.filter(function (r) { return r.kind === 'game' && r.score != null; });
      if (!g.length) return null;
      return { stars: Math.max.apply(null, g.map(function (r) { return r.score; })),
               outOf: g[0].out_of || 3 };
    }
    return null;
  }

  /* Ear and sing both write kind 'ear', so the app cannot tell them apart
     from the row alone. Say so rather than pretending they are separate
     measurements — two runs of the same measure is what it is. */
  function said(key, r) {
    if (!r) return '';
    if (key === 'range') { try { return midiName(r.lo) + ' to ' + midiName(r.hi); } catch (e) { return r.lo + ' to ' + r.hi; } }
    if (key === 'sustain') return r.pct + '% of the hold stayed on the note';
    if (key === 'ear') return 'closest was ' + r.cents + ' cents off';
    if (key === 'sing') return r.score + ' of ' + r.outOf + ' notes matched';
    if (key === 'theory') return r.stars + ' of ' + r.outOf + ' stars';
    return '';
  }

  function doneCount() {
    return STEPS.filter(function (s) { return !!resultFor(s.key); }).length;
  }

  /* ------------------------------------------------------------------ */
  /* what the numbers mean                                               */
  /*                                                                     */
  /* These thresholds are judgements, not measurements, so they are      */
  /* written here in one place where they can be argued with — and the   */
  /* screen always shows the raw number next to the verdict, so nobody   */
  /* has to take the verdict's word for it.                              */
  /* ------------------------------------------------------------------ */
  T.place = function () {
    var sus = resultFor('sustain'), ear = resultFor('ear'), th = resultFor('theory'), mt = resultFor('sing'), rg = resultFor('range');
    var sing = null, taught = null, why = [];

    if (rg) why.push('sang from ' + said('range', rg));
    if (sus || ear || mt) {
      var n = 0, tot = 0;
      if (sus) { tot += sus.pct >= 75 ? 3 : sus.pct >= 45 ? 2 : 1; n++; }
      if (ear) { tot += ear.cents <= 20 ? 3 : ear.cents <= 45 ? 2 : 1; n++; }
      if (mt) { var f = mt.score / mt.outOf; tot += f >= 0.8 ? 3 : f >= 0.5 ? 2 : 1; n++; }
      sing = Math.round(tot / n);
      if (sus) why.push('held a note ' + sus.pct + '% steady');
      if (ear) why.push('got within ' + ear.cents + ' cents of the note');
      if (mt) why.push('matched ' + mt.score + ' of ' + mt.outOf + ' notes');
    }
    if (th) {
      taught = th.stars >= 3 ? 3 : th.stars >= 2 ? 2 : 1;
      why.push('scored ' + th.stars + ' of ' + th.outOf + ' naming intervals');
    }
    return { sing: sing, taught: taught, why: why,
             done: doneCount(), total: STEPS.length };
  };

  /* ------------------------------------------------------------------ */
  /* the screen                                                          */
  /* ------------------------------------------------------------------ */
  function sheet(html) {
    if (window.RP && RP.sheet) return RP.sheet(html);
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
    if (!startedAt) {
      startedAt = Date.now();
      try { localStorage.setItem('rp_test_at', String(startedAt)); } catch (e) {}
    }
    draw();
  };

  function draw() {
    var p = T.place();
    var h = '<b style="font-size:18px">Where am I actually at?</b>' +
      '<div class="measured" style="margin-top:8px">Five short things. Nothing here is a guess — ' +
      'each one measures something and shows you the number. Do them in any order, stop whenever ' +
      'you like, come back to it later.</div>';

    h += '<div class="rp-lab" style="margin-top:16px">' + p.done + ' OF ' + p.total + ' DONE</div>';

    STEPS.forEach(function (s) {
      var r = resultFor(s.key);
      h += '<div class="rp-card' + (r ? ' rp-done' : ' hot') + '" style="margin-top:8px;padding:12px">' +
        '<div class="rp-ttl">' + esc(s.name) +
        (r ? '<span class="rp-tag">done</span>' : '') + '</div>' +
        '<div class="rp-sub">' + esc(s.what) + '</div>';
      if (r) {
        h += '<div class="rp-sub" style="margin-top:5px;color:var(--gold)"><b>' +
          esc(said(s.key, r)) + '</b></div>';
      }
      h += '<button class="btn' + (r ? '' : ' primary') + '" data-go="' + esc(s.key) + '" ' +
        'style="width:100%;padding:10px;margin-top:9px;font-size:12.5px">' +
        (r ? 'Do it again' : 'Start') + '</button></div>';
    });

    if (p.done) {
      h += '<div class="rp-lab" style="margin-top:18px">WHAT THAT SAYS SO FAR</div>';
      h += '<div class="rp-card" style="padding:12px">';
      p.why.forEach(function (w) {
        h += '<div style="font-size:13px;line-height:1.5">· You ' + esc(w) + '.</div>';
      });
      if (p.sing || p.taught) {
        h += '<div style="font-size:13.5px;line-height:1.55;margin-top:9px">' +
          (p.sing ? 'On singing that puts you at <b>' +
            (p.sing === 1 ? 'beginner' : p.sing === 2 ? 'intermediate' : 'experienced') + '</b>. ' : '') +
          (p.taught ? 'On words and music, <b>' +
            (p.taught === 1 ? 'plain English' : p.taught === 2 ? 'some terms' : 'the proper terms') + '</b>.' : '') +
          '</div>';
      }
      if (p.done < p.total) {
        h += '<div class="measured" style="margin-top:9px;font-size:11.5px">' +
          'Based on the ' + p.done + ' you have done. The rest would make it surer.</div>';
      }
      h += '</div>';
      h += '<button class="btn primary" id="rpTestApply" style="width:100%;padding:13px;margin-top:12px">' +
        'Use this instead of my answers</button>';
      h += '<div class="measured" style="margin-top:7px;font-size:11.5px;text-align:center">' +
        'You can always change it back in Profile.</div>';
    }

    h += '<button class="btn" id="rpTestX" style="width:100%;padding:11px;margin-top:12px">Close</button>';
    sheet(h);

    (($('rpSheet')) || document).querySelectorAll('[data-go]').forEach(function (b) {
      on(b, 'click', function () {
        var s = STEPS.filter(function (x) { return x.key === b.dataset.go; })[0];
        if (!s) return;
        shut();
        /* Leave no other exercise open behind this one. Starting the ear drill
           straight after the steady note otherwise landed you on Train with
           both panels stacked up the screen. */
        ['susPanel', 'v10Ear', 'v10Game', 'v10Guided', 'matchPanel'].forEach(function (id) {
          var el = $(id);
          if (el) el.style.display = 'none';
        });
        try { window.switchMode(s.mode || 'train'); } catch (e) {}
        setTimeout(function () { s.go(); }, 140);
        /* Coming back here afterwards is the singer's move, not ours — the
           app must not yank them out of an exercise the moment it finishes. */
      });
    });
    on($('rpTestX'), 'click', shut);
    on($('rpTestApply'), 'click', function () {
      var q = T.place();
      var ME = window.RPPlain;
      if (!ME) return;
      if (q.sing) ME.experience = q.sing;
      if (q.taught) {
        ME.taught = q.taught;
        ME.words = q.taught === 1 ? 'plain' : q.taught === 2 ? 'some' : 'technical';
      }
      ME.measured = { at: new Date().toISOString(), sing: q.sing, taught: q.taught, why: q.why };
      ME.save();
      shut();
      try { if (window.RP && RP.toast) RP.toast('Done — that is measured, not guessed.'); } catch (e) {}
      try { if (ME.apply) ME.apply(); } catch (e) {}
    });
  }

  /* ------------------------------------------------------------------ */
  /* the way in, from Profile                                            */
  /* ------------------------------------------------------------------ */
  function mountRow() {
    var host = $('modeYou');
    if (!host) return;
    var d = $('rpTestRow');
    var fresh = !d;
    if (fresh) {
      d = document.createElement('div');
      d.id = 'rpTestRow';
      d.className = 'rp-card';
      d.style.cursor = 'pointer';
    }
    var p = T.place();
    d.innerHTML = '<div class="row" style="justify-content:space-between;align-items:center">' +
      '<div style="flex:1;min-width:0"><div class="rp-ttl">Test me — where am I actually at?</div>' +
      '<div class="rp-sub">' + (p.done
        ? p.done + ' of ' + p.total + ' done. Measured, not guessed.'
        : 'Five short things that measure instead of asking.') + '</div></div>' +
      '<div style="color:var(--ink-faint);font-size:20px">›</div></div>';
    if (fresh) {
      on(d, 'click', function () { T.open(); });
      try { host.appendChild(d); } catch (e) {}
    }
  }

  setInterval(mountRow, 1500);
  setTimeout(mountRow, 900);
})();
