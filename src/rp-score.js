/* ======================================================================
   Repertoire Pro — scorecards.

   The rule the app already sets for itself applies here: only numbers it
   genuinely measured, and it says out loud what it cannot see. Every figure
   below is one the singer was shown at the time, sent on to their coach —
   nothing is inferred, averaged into a grade, or invented.
   ====================================================================== */
(function () {
  'use strict';
  var RP = window.RP, V10 = window.V10;
  if (!RP || !V10) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------------------------------------------------------- */
  /* the hooks — where the app already worked a number out             */
  /* ---------------------------------------------------------------- */
  (function hooks() {
    var mp = V10.markPractised;
    if (mp && !mp.__rp) {
      V10.markPractised = function (label) {
        try { mp.apply(this, arguments); } catch (e) {}
        RP.logResult({ kind: 'practice', label: String(label || 'Practice') });
      };
      V10.markPractised.__rp = true;
    }
    var ss = V10.setStars;
    if (ss && !ss.__rp) {
      V10.setStars = function (id, n) {
        try { ss.apply(this, arguments); } catch (e) {}
        var g = (V10.GAMES || []).find(function (x) { return x.id === id; });
        RP.logResult({ kind: 'game', label: (g && g.name) || String(id), score: n, out_of: 3 });
      };
      V10.setStars.__rp = true;
    }
  })();

  /* ---------------------------------------------------------------- */
  /* reading the numbers back                                          */
  /* ---------------------------------------------------------------- */
  function dayKey(iso) {
    var d = new Date(iso);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function card(studentId) {
    var rs = (RP.results || []).filter(function (r) { return r.student_id === studentId; });
    var since = Date.now() - 7 * 86400000;
    var wk = rs.filter(function (r) { return new Date(r.created_at).getTime() >= since; });

    var days = {};
    wk.forEach(function (r) { days[dayKey(r.created_at)] = true; });

    var ear = rs.filter(function (r) { return r.kind === 'ear' && r.cents != null; });
    var earHit = rs.filter(function (r) { return r.kind === 'ear' && r.score != null; });
    var sus = rs.filter(function (r) { return r.kind === 'sustain' && r.pct != null; });
    var games = rs.filter(function (r) { return r.kind === 'game'; });

    // best star per game, so replays do not inflate the total
    var best = {};
    games.forEach(function (g) { best[g.label] = Math.max(best[g.label] || 0, g.score || 0); });
    var starSum = Object.keys(best).reduce(function (a, k) { return a + best[k]; }, 0);

    function avg(list, f) {
      if (!list.length) return null;
      return Math.round(list.reduce(function (a, x) { return a + f(x); }, 0) / list.length);
    }

    var as = (RP.assignments || []).filter(function (a) { return a.student_id === studentId; });

    return {
      daysThisWeek: Object.keys(days).length,
      sessionsThisWeek: wk.filter(function (r) { return r.kind === 'practice'; }).length,
      lastAt: rs.length ? rs[0].created_at : null,
      earRuns: ear.length,
      earCentsLatest: ear.length ? ear[0].cents : null,
      earCentsBest: ear.length ? Math.min.apply(null, ear.map(function (r) { return r.cents; })) : null,
      earCentsAvg: avg(ear, function (r) { return r.cents; }),
      earHitLatest: earHit.length ? earHit[0] : null,
      susRuns: sus.length,
      susLatest: sus.length ? sus[0].pct : null,
      susBest: sus.length ? Math.max.apply(null, sus.map(function (r) { return r.pct; })) : null,
      starSum: starSum,
      starOutOf: (V10.GAMES || []).length * 3,
      /* Counting only assignments that are FINISHED FOREVER made a daily one
         permanently unfinished, so this card said "1 of 2" on the same screen
         as a week strip saying "2 of 2". Both now ask the same question: how
         much of the work this week was due, and how much of it happened. */
      week: (RP.weekProgress ? RP.weekProgress(studentId, 0) : null),
      assignedOpen: as.filter(function (a) { return !a.done_at; }).length,
      assignedDone: as.filter(function (a) { return a.done_at; }).length,
      practisedLabels: labelCounts(wk)
    };
  }
  function labelCounts(list) {
    var c = {};
    list.filter(function (r) { return r.kind === 'practice'; })
        .forEach(function (r) { c[r.label] = (c[r.label] || 0) + 1; });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a]; })
      .slice(0, 6).map(function (k) { return { label: k, n: c[k] }; });
  }
  RP.scorecard = card;

  /* ---------------------------------------------------------------- */
  /* drawing it                                                        */
  /* ---------------------------------------------------------------- */
  function tile(big, small, tone) {
    var col = tone === 'good' ? 'var(--hit)' : tone === 'warn' ? 'var(--gold)' : 'var(--ink)';
    return '<div class="rp-tile"><div class="rp-big" style="color:' + col + '">' + big + '</div>' +
      '<div class="rp-small">' + small + '</div></div>';
  }
  function bars(rs, studentId) {
    // seven days, on or off — the same week strip the app already draws
    var out = '', now = new Date();
    var days = {};
    (RP.results || []).filter(function (r) { return r.student_id === studentId; })
      .forEach(function (r) { days[dayKey(r.created_at)] = true; });
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now.getTime() - i * 86400000);
      var k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      out += '<div class="rp-day' + (days[k] ? ' on' : '') + '">' + 'SMTWTFS'[d.getDay()] + '</div>';
    }
    return '<div class="rp-week">' + out + '</div>';
  }

  RP.scorecardHTML = function (studentId, whose) {
    var c = card(studentId);
    var you = whose === 'you';
    var h = '<div class="rp-lab" style="margin-top:18px">SCORECARD</div>';

    if (!c.earRuns && !c.susRuns && !c.sessionsThisWeek && !c.starSum) {
      return h + '<div class="rp-empty" style="padding:8px 2px">Nothing measured yet. ' +
        (you ? 'Do a warm-up or an ear drill and the numbers appear here — and on your coach\'s phone.'
             : 'The moment they practise, this fills in.') + '</div>';
    }

    h += bars(null, studentId);
    h += '<div class="rp-tiles">';
    h += tile(c.daysThisWeek + '<span class="rp-of">/7</span>', 'days practised', c.daysThisWeek >= 4 ? 'good' : 'warn');
    if (c.week && c.week.due) {
      h += tile(c.week.done + '<span class="rp-of">/' + c.week.due + '</span>', 'set this week',
                c.week.done === c.week.due ? 'good' : (c.week.done ? 'warn' : ''));
    } else {
      h += tile(c.assignedDone + '<span class="rp-of">/' + (c.assignedDone + c.assignedOpen) + '</span>',
                'assignments done', c.assignedOpen === 0 && c.assignedDone > 0 ? 'good' : '');
    }
    if (c.susRuns) h += tile(c.susBest + '%', 'steadiest hold', c.susBest >= 70 ? 'good' : 'warn');
    if (c.earRuns) h += tile(c.earCentsBest + '<span class="rp-of">¢</span>', 'closest to the note', c.earCentsBest <= 25 ? 'good' : 'warn');
    if (c.starSum) h += tile(c.starSum + '<span class="rp-of">/' + c.starOutOf + '</span>', 'theory stars', '');
    h += '</div>';

    if (c.earRuns) {
      h += '<div class="rp-line"><b>Ear drills</b> — ' + c.earRuns + ' run' + (c.earRuns > 1 ? 's' : '') +
        '. Latest ' + c.earCentsLatest + '¢ from the note, average ' + c.earCentsAvg + '¢, best ' + c.earCentsBest + '¢' +
        (c.earHitLatest ? ', last score ' + c.earHitLatest.score + ' of ' + c.earHitLatest.out_of : '') + '.</div>';
    }
    if (c.susRuns) {
      h += '<div class="rp-line"><b>Steady note</b> — ' + c.susRuns + ' run' + (c.susRuns > 1 ? 's' : '') +
        '. Latest hold was ' + c.susLatest + '% steady, best ' + c.susBest + '%.</div>';
    }
    if (c.practisedLabels.length) {
      h += '<div class="rp-line"><b>This week</b> — ' +
        c.practisedLabels.map(function (l) { return esc(l.label) + (l.n > 1 ? ' ×' + l.n : ''); }).join(' · ') + '.</div>';
    }

    h += '<div class="measured" style="margin-top:10px"><b>What these are not.</b> Cents is distance from ' +
      'the note, and per cent steady is how much of a hold stayed inside the window — both measured on the ' +
      'phone, both honest. Neither is a mark for singing. Tone, breath support, tension and register are ' +
      'not measured here' + (you ? '' : ', so nothing on this card replaces listening to them') + '.</div>';
    return h;
  };

  /* styles */
  (function css() {
    if (document.getElementById('rpScoreCSS')) return;
    var s = document.createElement('style');
    s.id = 'rpScoreCSS';
    s.textContent =
      '.rp-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:8px;margin-top:10px;}' +
      '.rp-tile{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:11px 10px;}' +
      '.rp-big{font-size:23px;font-weight:900;line-height:1.05;}' +
      '.rp-of{font-size:13px;font-weight:800;color:var(--ink-faint);}' +
      '.rp-small{font-size:10.5px;font-weight:700;letter-spacing:.3px;color:var(--ink-dim);margin-top:4px;}' +
      '.rp-week{display:flex;gap:5px;margin-top:10px;}' +
      '.rp-day{flex:1;text-align:center;font-size:10.5px;font-weight:800;padding:7px 0;border-radius:8px;' +
      'background:var(--panel2);border:1px solid var(--line);color:var(--ink-faint);}' +
      '.rp-day.on{background:var(--gold);border-color:var(--gold);color:#231a00;}' +
      '.rp-line{font-size:12.5px;color:var(--ink-dim);line-height:1.5;margin-top:9px;}';
    document.head.appendChild(s);
  })();
})();
