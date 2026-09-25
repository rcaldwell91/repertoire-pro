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
  var TRACE_VER = 2;

  /* WHERE IN THE WINDOW THE PITCH IS READ FROM. Measured 25 Sep, before
     this change: on Robert's two recordings a phrase's first note reached
     the playhead 60ms and 50ms after the sound on the Pitch Tracker.

     The cause is geometry, not tuning. yinHz does not read the whole 4096
     samples it is handed: it compares sample i with sample i+lag for the
     first 1024 values of i, so everything it uses sits in the first
     1024 + lag samples - about 39ms at the front. The window used to be
     centred on the point's own time, which put the part yinHz actually
     reads 33ms EARLIER than the time the point was given. Every pitch in a
     file was dated a third of a tenth of a second late.

     So the window now starts where it has to for the region yinHz reads to
     be centred on the point's time: half of 1024, plus half a typical sung
     period (4ms, about 250Hz), before it. Across the singing range that
     centre moves by about 2ms, not 33. The loudness gate still looks at the
     whole window. Version 2, so every song read the old way is read again.

     The microphone path is left alone on purpose: its buffer ends at "now"
     and always has, and its delay is what Mic timing offset takes back. */
  function yinOffset(sr) { return (WIN >> 1) - Math.round(512 + 0.002 * sr); }

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

  /* ---- the reading itself, as one plain function ----------------------
     Robert, 25 Sep: "Start never blocks." A four-minute song is thousands of
     pitch readings, and on the page they froze the phone in slices for a
     minute or more. So the per-reading work is one function with nothing
     outside it except yinHz and freqMidi, and it runs in a worker. The
     worker is handed THE PAGE'S OWN SOURCE for those two functions, not a
     copy kept here, so a file and a microphone cannot drift apart. If a
     worker cannot start, the same function runs on the page in short
     slices instead. */
  function traceRange(mono, sr, o, k0, k1, hist, out) {
    var len = mono.length, win = new Float32Array(o.WIN);
    for (var k = k0; k < k1; k++) {
      var t = k * o.HOP;
      var start = Math.round(t * sr) - (o.WIN >> 1);
      var rms = 0, j, sp, v;
      for (j = 0; j < o.WIN; j++) {
        sp = start + j;
        v = (sp >= 0 && sp < len) ? mono[sp] : 0;
        win[j] = v; rms += v * v;
      }
      rms = Math.sqrt(rms / o.WIN);
      var m = null;
      if (!o.gateOn || rms >= o.gate) {
        var f = yinHz(o.yinOff ? win.subarray(o.yinOff) : win, sr);
        if (f > 0) {
          m = freqMidi(f);
          if (o.anc) {
            var ai = Math.round(t / o.ANCHOR);
            if (ai >= 0 && ai < o.anc.midi.length && o.anc.conf[ai] >= 0.5) {
              var am = o.anc.midi[ai], ks = [-24, -12, 12, 24];
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
      out.push({ t: +t.toFixed(2), m: m == null ? null : +m.toFixed(2) });
    }
  }
  function workerMain() {
    self.onmessage = function (e) {
      var d = e.data;
      NGATE.clarity = d.clarity;
      var out = [], hist = [], CH = 512;
      for (var k = 0; k < d.steps; k += CH) {
        traceRange(d.mono, d.sr, d.o, k, Math.min(d.steps, k + CH), hist, out);
        self.postMessage({ type: 'progress', frac: Math.min(1, (k + CH) / d.steps) });
      }
      self.postMessage({ type: 'done', notes: out });
    };
  }
  function runTrace(mono, sr, o, steps, onFrac) {
    var clarity = 0.35;
    try { clarity = NGATE.clarity; } catch (e) {}
    return new Promise(function (resolve) {
      var src = null, url = null, w = null;
      try {
        src = 'var NGATE = { level: 0, clarity: ' + clarity + ' };\n' +
              freqMidi.toString() + '\n' + yinHz.toString() + '\n' +
              traceRange.toString() + '\n(' + workerMain.toString() + ')();';
        url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        w = new Worker(url);
      } catch (e) { w = null; }
      var onPage = function () {
        /* no worker: the same function, a short slice at a time */
        var out = [], hist = [], k = 0, CH = 24;
        (function slice() {
          traceRange(mono, sr, o, k, Math.min(steps, k + CH), hist, out);
          k += CH;
          if (onFrac) onFrac(Math.min(1, k / steps));
          if (k < steps) setTimeout(slice, 0); else resolve(out);
        })();
      };
      if (!w) return onPage();
      w.onmessage = function (e) {
        if (e.data.type === 'progress') { if (onFrac) onFrac(e.data.frac); return; }
        try { w.terminate(); URL.revokeObjectURL(url); } catch (err) {}
        resolve(e.data.notes);
      };
      w.onerror = function () {
        try { w.terminate(); URL.revokeObjectURL(url); } catch (err) {}
        onPage();
      };
      w.postMessage({ mono: mono, sr: sr, o: o, steps: steps, clarity: clarity }, [mono.buffer]);
    });
  }

  /* ---- the trace ------------------------------------------------------ */
  F.build = async function (song, onProgress) {
    if (!song || !song.blob) throw new Error('nothing to read');
    var say = onProgress || status;
    ensureCtx();
    say('Reading the file…', 0.02);
    var decoded = await ctx.decodeAudioData((await song.blob.arrayBuffer()).slice(0));
    var sr = decoded.sampleRate, len = decoded.length;
    var L = decoded.getChannelData(0);
    var R = decoded.numberOfChannels > 1 ? decoded.getChannelData(1) : L;
    var mono = new Float32Array(len);
    for (var i = 0; i < len; i++) mono[i] = (L[i] + R[i]) / 2;

    say('Listening with the pitch model…', 0.06);
    var nA = Math.max(1, Math.floor(decoded.duration / ANCHOR));
    var anc = await anchors(mono, sr, nA);

    say('Following the voice…', 0.3);
    var steps = Math.floor(decoded.duration / HOP);
    var gateLevel = 0.004, gateOn = true;
    try { gateLevel = NGATE.level; } catch (e) { gateOn = false; }
    var o = { HOP: HOP, WIN: WIN, ANCHOR: ANCHOR, gate: gateLevel, gateOn: gateOn,
              yinOff: yinOffset(sr), anc: anc };
    var notes = await runTrace(mono, sr, o, steps, function (fr) {
      say('Following the voice…', 0.3 + 0.65 * fr);
    });

    notes = bridge(notes);
    song.notes = notes;
    song.notesFrom = 'trace';
    song.traceVer = TRACE_VER;
    song.noteFloor = null;
    delete song.mapVer;                  /* it is not a bar map any more */
    song.bubbles = F.bubbles(notes);
    try { await dbPut('songs', song); } catch (e) {}

    var voiced = notes.filter(function (p) { return p.m != null; }).length;
    say('Done — ' + Math.round(voiced * HOP) + 's of singing found.', 1);
    return song;
  };

  /* ---- one at a time, in the background ------------------------------
     Robert, 25 Sep: "A song is read by the live listener ONCE, when it is
     added, in the background ... Start never blocks and nothing asks the
     singer to wait or reload."

     A song is read the moment it is added, and songs carrying an old map
     are read again the first time the Library opens. Only one reading runs
     at a time. A song the singer opens jumps to the front, and any screen
     can ask how far along it is rather than showing an empty board. */
  var Q = [], busy = false, st = {};
  F.stateOf = function (id) { return st[id] || null; };
  F.busy = function () { return busy || Q.length > 0; };
  F.ensure = function (song, urgent) {
    if (!song) return Promise.reject(new Error('no song'));
    if (!F.needsBuild(song)) return Promise.resolve(song);
    var s = st[song.id];
    if (!s || s.st === 'failed' || s.st === 'done') {
      s = st[song.id] = { st: 'queued', frac: 0, msg: 'Waiting to be read…' };
      s.promise = new Promise(function (res, rej) { s.res = res; s.rej = rej; });
      Q.push(song);
    }
    if (urgent && s.st === 'queued') {
      Q = Q.filter(function (x) { return x !== song; });
      Q.unshift(song);
    }
    pump();
    return s.promise;
  };
  function pump() {
    if (busy || !Q.length) return;
    var song = Q.shift(), s = st[song.id];
    busy = true; s.st = 'reading';
    F.build(song, function (msg, frac) { s.msg = msg; if (frac != null) s.frac = frac; })
      .then(function () { s.st = 'done'; s.frac = 1; s.res(song); },
            function (e) { s.st = 'failed'; s.msg = 'Could not read this song — ' + (e && e.message || e); s.rej(e); })
      .then(function () { busy = false; pump(); });
  }
  /* songs that carry a map from before the live listener, re-read quietly */
  F.scanLibrary = function () {
    var list = [];
    try { list = (LIB.songs || []); } catch (e) {}
    list.forEach(function (s) {
      if (s.kind === 'recording') return;
      if (s.notes && s.notes.length && F.needsBuild(s)) F.ensure(s).catch(function () {});
    });
  };
  /* a song is read the moment it is added */
  (function () {
    var real = window.dbPut;
    if (typeof real !== 'function' || real.rpReadWrapped) return;
    var wrapped = function (store, obj) {
      var r = real.apply(this, arguments);
      try {
        if (store === 'songs' && obj && obj.kind !== 'recording' && obj.blob &&
            !(obj.notes && obj.notes.length) && !st[obj.id]) {
          Promise.resolve(r).then(function () { F.ensure(obj).catch(function () {}); });
        }
      } catch (e) {}
      return r;
    };
    wrapped.rpReadWrapped = true;
    window.dbPut = wrapped;
  })();

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
    /* The step comes from the data rather than from this file's own HOP, so
       a take's live line groups the same way a file's trace does.

       It is rounded, and so is every length below, because the times in a
       trace are stored to two decimals and subtracting them does not land
       exactly: the step measured 0.049999999999999996, a three-frame note
       came to 0.14999999999999997, and every one of them failed the 0.15
       test by a hair. That quietly threw away 63 of 488 notes on one of
       Robert's recordings and took five points off the score with them. */
    var gaps = [], q;
    for (q = 1; q < notes.length && gaps.length < 40; q++) {
      var g = notes[q].t - notes[q - 1].t;
      if (g > 0) gaps.push(g);
    }
    gaps.sort(function (a, b) { return a - b; });
    var step = gaps.length ? +gaps[gaps.length >> 1].toFixed(3) : HOP;
    if (!(step > 0)) step = HOP;
    /* A phrase's first note starts where the VOICE starts. Measured 25 Sep:
       on both of Robert's recordings a phrase's first bubble began 20-30ms
       after the traced line did, because a singer scoops into the first
       note of a phrase and a bubble only began once the pitch had settled
       inside a semitone. So the note began after the singer had. When the
       stretch before a bubble is that approach - voiced, straight after
       silence, not long enough to be a note of its own - the bubble starts
       there instead, and keeps the pitch it settled on. No further back
       than the shortest note a bubble can be, so a long slide stays its
       own gesture. */
    var AHEAD = Math.round(0.15 / step);
    var out = [], i = 0, n = notes.length, lastEnd = 0;
    while (i < n) {
      if (notes[i].m == null) { i++; continue; }
      var j = i, lo = notes[i].m, hi = notes[i].m, sum = notes[i].m, cnt = 1;
      while (j + 1 < n && notes[j + 1].m != null) {
        var m2 = notes[j + 1].m;
        var nlo = Math.min(lo, m2), nhi = Math.max(hi, m2);
        if (nhi - nlo > 1) break;            /* it has moved off this note */
        lo = nlo; hi = nhi; sum += m2; cnt++; j++;
      }
      var dur = +(((j - i + 1) * step).toFixed(2));
      if (dur >= 0.15) {
        var k = i;
        while (k - 1 >= lastEnd && notes[k - 1].m != null && i - (k - 1) <= AHEAD) k--;
        if (k < i && (k === 0 || notes[k - 1].m == null)) {
          dur = +(((j - k + 1) * step).toFixed(2));
        } else k = i;                        /* not a phrase start: leave it */
        /* a point taken twenty times a second stands for the 50ms around
           it, so a run of them covers half a step either side. Starting the
           bubble at the first point instead put every note on average 25ms
           after the voice began - measured 25 Sep, with the pitch itself
           locking on 5ms after the sound. The length is unchanged. */
        out.push({ m: Math.round(sum / cnt), t: +(notes[k].t - step / 2).toFixed(3), d: dur });
        lastEnd = j + 1;
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
