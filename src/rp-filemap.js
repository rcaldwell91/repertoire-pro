/* ======================================================================
   Repertoire Pro — reading a file with the same ear as the microphone.

   Robert, 24 Sep: "for a file, draw the line the app HEARS, not bars."

   The evidence was his own: a take he recorded while a track played out of
   a speaker draws as a gold line that follows the singer. The same track
   opened as a FILE drew as bars that missed the words. The live tracker
   works. The old file mapper — a different algorithm, written separately —
   had never once been measured against a real voice, and it was the thing
   that was wrong.

   So a file is now read the way a microphone is read. Not a similar method:
   the same yinHz() the live path calls, the same noise gate, the same
   octave anchor from the pitch model, the same median-of-five smoothing,
   twenty points a second. What comes out is the same shape of thing a take
   carries — {t, m} with no duration — so every screen already draws it as a
   line, because that is how a take is drawn.

   Two differences from the live path, both deliberate:

     - the window is CENTRED on the point's own time rather than trailing
       behind it. A microphone can only look backwards; a file can be looked
       at from both sides, and the honest time for a pitch is the middle of
       the window it was read from. It is why a file's trace needs no lag
       taken off it and a take's does.
     - the pitch model runs over the whole file in one batch instead of one
       frame at a time. Same model, same frames, same 220ms spacing — a
       worker handed all of them at once rather than pestered live.

   The old analyser is still in the build. Nothing the singer can reach
   calls it until it passes the singer test.
   ====================================================================== */
(function () {
  'use strict';
  var F = window.RPFileMap = {};

  var HOP = 0.05;            /* twenty points a second, same as a take     */
  var WIN = 4096;            /* the analyser's own window, from base.html  */
  var ANCHOR = 0.22;         /* the pitch model's spacing on the live path */
  var TRACE_VER = 1;

  /* ---- is this song's map the old kind? ------------------------------ */
  F.needsBuild = function (song) {
    if (!song || !song.blob) return false;
    if (!song.notes || !song.notes.length) return true;
    if (song.notesFrom === 'trace' && song.traceVer === TRACE_VER) return false;
    return true;            /* a bar map from the old analyser: read again */
  };

  function status(msg, frac) {
    try { if (typeof mapStatus === 'function') mapStatus(msg, frac); } catch (e) {}
  }

  /* ---- the pitch model, over the whole file at once ------------------- */
  function anchors(mono, sr, n, onFrac) {
    /* same 1024-sample, 64ms frame the live poll builds, at the same
       spacing, handed to the same model in the same worker */
    return new Promise(function (resolve) {
      var specs = null, data = null;
      try { specs = CREPE_SPECS; data = crepeWeights(); } catch (e) {}
      if (!specs || !data || !data.length) return resolve(null);
      var frames = new Float32Array(n * 1024);
      var need = Math.round(0.064 * sr), step = need / 1024;
      for (var k = 0; k < n; k++) {
        var mid = k * ANCHOR * sr, off = mid - need / 2;
        for (var i = 0; i < 1024; i++) {
          var sp = off + i * step, lo = Math.floor(sp), fr = sp - lo;
          var a = (lo >= 0 && lo < mono.length) ? mono[lo] : 0;
          var b = (lo + 1 >= 0 && lo + 1 < mono.length) ? mono[lo + 1] : 0;
          frames[k * 1024 + i] = a + (b - a) * fr;
        }
      }
      var url = null, w = null, done = false;
      var give = function (v) { if (done) return; done = true;
        try { if (w) w.terminate(); } catch (e) {}
        try { if (url) URL.revokeObjectURL(url); } catch (e) {}
        resolve(v); };
      try {
        url = URL.createObjectURL(new Blob([ANALYZER_SRC], { type: 'text/javascript' }));
        w = new Worker(url);
        w.onmessage = function (e) { give({ midi: e.data.midi, conf: e.data.conf }); };
        w.onerror = function () { give(null); };
        w.postMessage({ type: 'crepeBatch', specs: specs, data: data, frames: frames },
                      [data.buffer, frames.buffer]);
      } catch (e) { give(null); }
      if (onFrac) onFrac(1);
    });
  }

  /* ---- the trace ------------------------------------------------------ */
  F.build = async function (song) {
    if (!song || !song.blob) throw new Error('nothing to read');
    ensureCtx();
    status('Reading the file…', 0.02);
    var decoded = await ctx.decodeAudioData((await song.blob.arrayBuffer()).slice(0));
    var sr = decoded.sampleRate, len = decoded.length;
    var L = decoded.getChannelData(0);
    var R = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : L;
    var mono = new Float32Array(len);
    for (var i = 0; i < len; i++) mono[i] = (L[i] + R[i]) / 2;

    status('Listening with the pitch model…', 0.06);
    var nA = Math.max(1, Math.floor(decoded.duration / ANCHOR));
    var anc = await anchors(mono, sr, nA);

    status('Following the voice…', 0.3);
    var steps = Math.floor(decoded.duration / HOP);
    var win = new Float32Array(WIN);
    var notes = [], hist = [];
    var gateLevel = 0.004, gateOn = true;
    try { gateLevel = NGATE.level; } catch (e) { gateOn = false; }

    for (var k = 0; k < steps; k++) {
      var t = k * HOP;
      /* the window sits centred on t, so the pitch is dated where it sounded */
      var start = Math.round(t * sr) - (WIN >> 1);
      var rms = 0, j, sp2;
      for (j = 0; j < WIN; j++) {
        sp2 = start + j;
        var v = (sp2 >= 0 && sp2 < len) ? mono[sp2] : 0;
        win[j] = v; rms += v * v;
      }
      rms = Math.sqrt(rms / WIN);

      var m = null;
      if (!gateOn || rms >= gateLevel) {
        var f = yinHz(win, sr);
        if (f > 0) {
          m = freqMidi(f);
          /* the same octave snap the live path makes, from the same model */
          if (anc) {
            var ai = Math.round(t / ANCHOR);
            if (ai >= 0 && ai < anc.midi.length && anc.conf[ai] >= 0.5) {
              var am = anc.midi[ai], ks = [-24, -12, 12, 24];
              for (var z = 0; z < 4; z++) {
                if (Math.abs(m + ks[z] - am) < 1.5 && Math.abs(m - am) > 4) { m += ks[z]; break; }
              }
            }
          }
        }
      }
      if (m == null) { hist.length = 0; }
      else {
        hist.push(m);
        if (hist.length > 5) hist.shift();
        var s2 = hist.slice().sort(function (a, b) { return a - b; });
        m = s2[Math.floor(s2.length / 2)];
      }
      notes.push({ t: +t.toFixed(2), m: m == null ? null : +m.toFixed(2) });
      if ((k & 255) === 0) {
        status('Following the voice…', 0.3 + 0.65 * (k / steps));
        await new Promise(function (r) { setTimeout(r, 0); });   /* let the page breathe */
      }
    }

    notes = bridge(notes);
    song.notes = notes;
    song.notesFrom = 'trace';
    song.traceVer = TRACE_VER;
    song.noteFloor = null;
    delete song.mapVer;                  /* it is not a bar map any more */
    song.bubbles = F.bubbles(notes);
    try { await dbPut('songs', song); } catch (e) {}

    var voiced = notes.filter(function (p) { return p.m != null; }).length;
    status('Done — ' + Math.round(voiced * HOP) + 's of singing found. Press Start.', null);
    return song;
  };

  /* ---- consonants ----------------------------------------------------
     Measured 24 Sep on two of Robert's own recordings: where the file is
     clearly voice, the tracker followed 85.0% and 92.9% of it. The noise
     gate turned out to be innocent — it stopped 0.1% and 0.0%. Everything
     else was YIN finding no clear pitch, which is the correct answer for an
     "s" or a "t": those sounds have no pitch to find, and loosening the
     clarity gate to cover them would only invent one.

     But a singer saying "s" between two vowels has not stopped singing. So
     a gap is closed only when the audio says it is one sound carrying on:
     short, and with a voiced pitch either side of it. Silence cannot be
     bridged — there is no pitch at either end to bridge from.

     How far apart the two sides may be is not a new judgement. The app
     already has one: the line it draws breaks on a leap of more than six
     semitones and carries on under that. A consonant between two notes a
     fourth apart is one sung phrase, not two, and drawing it as one is what
     the app does everywhere else. Anything wider is a real leap and stays
     the break it is.

     Measured on Robert's two recordings, 24 Sep: 23s and 13s of loud time
     went unfollowed, over 243 and 154 separate stretches, and 17s and 11s
     of that was in stretches under 0.15s. Nothing longer than 0.7s
     anywhere. No missing section, no passage the tracker cannot hear -
     hundreds of consonants, which is what a sung line is full of. The
     length below is set from that: the bucket the time is actually in.
     ------------------------------------------------------------------ */
  var GAP_MAX = 3;           /* 0.15s at twenty points a second */
  var GAP_STEP = 6;          /* the same leap the drawing breaks the line on */
  function bridge(notes) {
    var n = notes.length, i, j;
    for (i = 0; i < n; i++) {
      if (notes[i].m != null) continue;
      var a = i - 1;
      if (a < 0 || notes[a].m == null) continue;
      j = i;
      while (j < n && notes[j].m == null) j++;
      if (j >= n) break;
      var span = j - i;
      if (span > GAP_MAX) { i = j - 1; continue; }
      var m0 = notes[a].m, m1 = notes[j].m;
      if (Math.abs(m1 - m0) > GAP_STEP) { i = j - 1; continue; }
      for (var k = i; k < j; k++) {
        var f = (k - a) / (j - a);
        notes[k].m = +(m0 + (m1 - m0) * f).toFixed(2);
        notes[k].bridged = 1;
      }
      i = j - 1;
    }
    return notes;
  }

  /* ---- step 2: notes cut from the line, not from the old analyser -----
     A run where the pitch holds inside one semitone for at least 0.15s is
     one sung note. Nothing shows these yet: they ship when the singer test
     says at least 85% of the sung time lands inside one. --------------- */
  F.bubbles = function (notes) {
    if (!notes || notes.length < 2) return [];
    /* the step comes from the data rather than from this file's own HOP, so
       a take's live line groups the same way a file's trace does */
    var gaps = [], q;
    for (q = 1; q < notes.length && gaps.length < 40; q++) {
      var g = notes[q].t - notes[q - 1].t;
      if (g > 0) gaps.push(g);
    }
    gaps.sort(function (a, b) { return a - b; });
    var step = gaps.length ? gaps[gaps.length >> 1] : HOP;
    var out = [], i = 0, n = notes.length;
    while (i < n) {
      if (notes[i].m == null) { i++; continue; }
      var j = i, lo = notes[i].m, hi = notes[i].m, sum = notes[i].m, cnt = 1;
      while (j + 1 < n && notes[j + 1].m != null) {
        var m2 = notes[j + 1].m;
        var nlo = Math.min(lo, m2), nhi = Math.max(hi, m2);
        if (nhi - nlo > 1) break;            /* it has moved off this note */
        lo = nlo; hi = nhi; sum += m2; cnt++; j++;
      }
      var dur = notes[j].t - notes[i].t + step;
      if (dur >= 0.15) {
        out.push({ m: Math.round(sum / cnt), t: +(notes[i].t).toFixed(2), d: +dur.toFixed(2) });
      }
      i = j + 1;
    }
    return out;
  };

  /* The notes for a song, whatever it came from. A file carries them from
     the read above; a take is a live line and is cut the same way; a
     built-in was written as notes already. Robert, 24 Sep: Learn a song
     shows these for every source it can open. */
  F.notesOf = function (song) {
    if (!song) return [];
    if (song.bubbles && song.bubbles.length) return song.bubbles;
    var ns = song.notes || [];
    if (!ns.length) return [];
    if (window.rpNoteShape && rpNoteShape(ns) === 'bars') return ns;
    var b = F.bubbles(ns);
    song.bubbles = b;
    if (song.id && song.blob) { try { dbPut('songs', song); } catch (e) {} }
    return b;
  };
})();
