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

  /* ---- the pitch model, a few seconds at a time, on several workers ---
     Robert, 25 Sep: All of Me sat at "Waiting to be read - 0%" for
     minutes. Measured that day on the test browser: 109s to read it, 102s
     of that in the pitch model, run over the whole song in one go on one
     worker with no progress in between. The trace itself took under 5s.

     The model cannot simply be left out: on his two recordings it corrects
     4.6% and 5.2% of the sung points, about half of them whole octaves. So
     it runs the way the reading now needs it - a couple of seconds of the
     song per batch, on as many workers as the phone has cores to spare -
     and the conv layer below does the same arithmetic as the one in the
     analyser, four filters by four positions at a time so each number
     loaded is used sixteen times. Same weights, same frames, same answers
     (checked to the last decimal the trace keeps); 74ms a frame became
     24ms on the test machine. It replaces the analyser's own layer only
     inside the workers started here; the live microphone path is as it
     was. */
  function crepeLayer(x, L, lay) {
    var K = lay.K, Cin = lay.Cin, Cout = lay.Cout, stride = lay.stride;
    var outLen = Math.ceil(L / stride);
    var total = Math.max((outLen - 1) * stride + K - L, 0), pl = total >> 1;
    var xp = new Float32Array((L + total) * Cin + 3 * stride * Cin);
    xp.set(x.subarray(0, L * Cin), pl * Cin);
    var y = new Float32Array(outLen * Cout);
    var KC = K * Cin, kf = lay.kf, bias = lay.bias, scale = lay.scale, shift = lay.shift;
    var SC = stride * Cin, acc = new Float64Array(16), p, j, t, q, pp;
    for (p = 0; p < outLen; p += 4) {
      var b0 = p * SC, b1 = b0 + SC, b2 = b1 + SC, b3 = b2 + SC;
      for (j = 0; j < Cout; j += 4) {
        var r0 = j * KC, r1 = r0 + KC, r2 = r1 + KC, r3 = r2 + KC;
        var a0 = 0, a1 = 0, a2 = 0, a3 = 0, c0 = 0, c1 = 0, c2 = 0, c3 = 0;
        var d0 = 0, d1 = 0, d2 = 0, d3 = 0, e0 = 0, e1 = 0, e2 = 0, e3 = 0;
        for (t = 0; t < KC; t++) {
          var k0 = kf[r0 + t], k1 = kf[r1 + t], k2 = kf[r2 + t], k3 = kf[r3 + t];
          var u = xp[b0 + t]; a0 += u * k0; a1 += u * k1; a2 += u * k2; a3 += u * k3;
          u = xp[b1 + t]; c0 += u * k0; c1 += u * k1; c2 += u * k2; c3 += u * k3;
          u = xp[b2 + t]; d0 += u * k0; d1 += u * k1; d2 += u * k2; d3 += u * k3;
          u = xp[b3 + t]; e0 += u * k0; e1 += u * k1; e2 += u * k2; e3 += u * k3;
        }
        acc[0] = a0; acc[1] = a1; acc[2] = a2; acc[3] = a3; acc[4] = c0; acc[5] = c1; acc[6] = c2; acc[7] = c3;
        acc[8] = d0; acc[9] = d1; acc[10] = d2; acc[11] = d3; acc[12] = e0; acc[13] = e1; acc[14] = e2; acc[15] = e3;
        for (pp = 0; pp < 4 && p + pp < outLen; pp++) {
          var o = (p + pp) * Cout;
          for (q = 0; q < 4; q++) {
            var s = acc[pp * 4 + q] + bias[j + q];
            if (s < 0) s = 0;                       /* relu, then batch-norm */
            y[o + j + q] = s * scale[j + q] + shift[j + q];
          }
        }
      }
    }
    var half = outLen >> 1, z = new Float32Array(half * Cout);
    for (p = 0; p < half; p++)
      for (j = 0; j < Cout; j++) {
        var a = y[(2 * p) * Cout + j], b = y[(2 * p + 1) * Cout + j];
        z[p * Cout + j] = a > b ? a : b;
      }
    return { x: z, L: half };
  }

  var POOL = null;
  function pool() {
    if (POOL) return POOL;
    POOL = { slots: [], url: null };
    var ok = false;
    try { ok = !!(CREPE_SPECS && typeof crepeWeights === 'function' && typeof ANALYZER_SRC === 'string'); } catch (e) {}
    if (!ok) return POOL;
    /* every layer has a multiple of four filters; if a model ever did not,
       the analyser's own layer is left in charge */
    var src = ANALYZER_SRC;
    try {
      var fours = CREPE_SPECS.filter(function (s) { return /conv\d\/kernel$/.test(s.name); })
        .every(function (s) { return s.shape[3] % 4 === 0; });
      if (fours) src += '\n' + crepeLayer.toString();
    } catch (e) {}
    try { POOL.url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })); } catch (e) { return POOL; }
    var hc = (navigator && navigator.hardwareConcurrency) || 2;
    var n = Math.max(1, Math.min(4, hc - 1));
    for (var i = 0; i < n; i++) POOL.slots.push({ w: null, busy: false, warm: false });
    return POOL;
  }
  /* one batch of 1024-sample frames through the model; resolves null if a
     worker cannot be had, which means "no anchor here", as before */
  function ancBatch(slot, frames) {
    return new Promise(function (resolve) {
      var P = pool();
      if (!P.url) return resolve(null);
      slot.busy = true;
      var give = function (v) { slot.busy = false; resolve(v); };
      try {
        if (!slot.w) { slot.w = new Worker(P.url); slot.warm = false; }
        var w = slot.w;
        w.onmessage = function (e) { slot.warm = true; give({ midi: e.data.midi, conf: e.data.conf }); };
        w.onerror = function () { try { w.terminate(); } catch (x) {} slot.w = null; give(null); };
        var data = slot.warm ? null : crepeWeights();
        w.postMessage({ type: 'crepeBatch', specs: CREPE_SPECS, data: data, frames: frames },
                      data ? [data.buffer, frames.buffer] : [frames.buffer]);
      } catch (e) { give(null); }
    });
  }
  /* Starting a worker and building the model in it took 1.8s of the first
     three at phone speed, before a single note could be read. So the
     workers are started and the model built in them a few seconds after
     the app opens, when nothing else is happening; opening a song then
     goes straight to reading it. */
  F.warm = function () {
    var P = pool();
    P.slots.forEach(function (slot) { if (!slot.w && !slot.busy) ancBatch(slot, new Float32Array(0)); });
  };
  setTimeout(function () {
    try { (window.requestIdleCallback || setTimeout)(function () { F.warm(); }); } catch (e) {}
  }, 4000);

  /* the same 1024-sample, 64ms frame the live poll builds */
  function ancFrames(mono, sr, a0, a1) {
    var need = Math.round(0.064 * sr), step = need / 1024, len = mono.length;
    var frames = new Float32Array((a1 - a0) * 1024);
    for (var k = a0; k < a1; k++) {
      var off = k * ANCHOR * sr - need / 2, base = (k - a0) * 1024;
      for (var i = 0; i < 1024; i++) {
        var sp = off + i * step, lo = Math.floor(sp), fr = sp - lo;
        var a = (lo >= 0 && lo < len) ? mono[lo] : 0;
        var b = (lo + 1 >= 0 && lo + 1 < len) ? mono[lo + 1] : 0;
        frames[base + i] = a + (b - a) * fr;
      }
    }
    return frames;
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
  /* the voice line is read in order, in one worker that keeps its place:
     the median-of-five carries from one piece to the next exactly as it
     does through a whole song, so a song read a piece at a time comes out
     point for point the same as one read in one go */
  function traceWorkerMain() {
    var mono = null, sr = 0, o = null, hist = [], k = 0;
    self.onmessage = function (e) {
      var d = e.data;
      if (d.type === 'init') { NGATE.clarity = d.clarity; o = d.o; return; }
      if (d.type === 'audio') { mono = d.mono; sr = d.sr; return; }
      if (d.type === 'run') {
        o.anc = d.anc;
        var out = [];
        traceRange(mono, sr, o, k, Math.max(k, d.k1), hist, out);
        k = Math.max(k, d.k1);
        self.postMessage({ type: 'pts', pts: out });
      }
    };
  }
  function tracer(o, clarity) {
    var w = null, url = null, pending = null;
    try {
      var src = 'var NGATE = { level: 0, clarity: ' + clarity + ' };\n' +
                freqMidi.toString() + '\n' + yinHz.toString() + '\n' +
                traceRange.toString() + '\n(' + traceWorkerMain.toString() + ')();';
      url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      w = new Worker(url);
      w.onmessage = function (e) { var p = pending; pending = null; if (p) p.res(e.data.pts); };
      w.onerror = function () { var p = pending; pending = null; if (p) p.rej(new Error('the reader stopped')); };
      w.postMessage({ type: 'init', o: o, clarity: clarity });
    } catch (e) { w = null; }
    /* no worker: the same function on the page, a short slice at a time */
    var L = { mono: null, sr: 0, hist: [], k: 0 };
    return {
      audio: function (mono, sr) {
        if (w) w.postMessage({ type: 'audio', mono: mono, sr: sr }, [mono.buffer]);
        else { L.mono = mono; L.sr = sr; }
      },
      run: function (k1, anc) {
        if (w) return new Promise(function (res, rej) {
          pending = { res: res, rej: rej };
          w.postMessage({ type: 'run', k1: k1, anc: anc });
        });
        return new Promise(function (res) {
          var out = [];
          o.anc = anc;
          (function slice() {
            var e = Math.min(k1, L.k + 24);
            traceRange(L.mono, L.sr, o, L.k, e, L.hist, out);
            L.k = e;
            if (L.k < k1) setTimeout(slice, 0); else res(out);
          })();
        });
      },
      end: function () {
        try { if (w) w.terminate(); } catch (e) {}
        try { if (url) URL.revokeObjectURL(url); } catch (e) {}
      }
    };
  }

  function id3Size(bytes) {
    var u = new Uint8Array(bytes, 0, Math.min(10, bytes.byteLength));
    if (u.length < 10 || u[0] !== 0x49 || u[1] !== 0x44 || u[2] !== 0x33) return 0;
    return 10 + ((u[6] & 127) << 21 | (u[7] & 127) << 14 | (u[8] & 127) << 7 | (u[9] & 127));
  }
  function mix(buf) {
    var len = buf.length, L = buf.getChannelData(0);
    var R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    var mono = new Float32Array(len);
    for (var i = 0; i < len; i++) mono[i] = (L[i] + R[i]) / 2;
    return mono;
  }

  /* ---- reading a song, from the start, as it goes ----------------------
     Robert, 25 Sep: "Read progressively from the start of the file,
     publishing notes as they are found."

     The first half-megabyte of the file is decoded on its own - about
     27 seconds of a typical song, in about 70ms - and reading starts on it
     at once while the whole file decodes alongside. Measured on both of his
     recordings: those first seconds decode to exactly the same samples as
     the whole file does, apart from the last 10ms of the piece, so nothing
     within a second of its end is read from it. When the whole file
     arrives the reading carries on from where it was.

     Notes go into the song as they are found. A screen asks how far the
     reading has got (F.aheadOf) and plays only while it stays ahead. */
  var PRE_BYTES = 512 * 1024, BATCH = 8;
  F.LEAD_START = 8;          /* seconds read ahead before the song may play */
  F.LEAD_MIN = 4;            /* and never less than this while it plays   */

  async function readSong(job) {
    var song = job.song, s = job.s;
    /* something happened (a batch came back, the whole file arrived, the
       song was let go on again); a signal nobody was waiting for is kept */
    var waiting = null, pending = false;
    var poke = function () { var w = waiting; waiting = null; if (w) w(); else pending = true; };
    var nextEvent = function () {
      if (pending) { pending = false; return Promise.resolve(); }
      return new Promise(function (r) { waiting = r; });
    };
    job.poke = poke;
    var arr = [], tr = null;
    song.notes = arr;               /* the old map goes: nothing drawn from it */
    song.notesFrom = 'trace';
    delete song.traceVer;
    delete song.mapVer;
    song.bubbles = [];
    song.noteFloor = null;
    var mark = function (x) { if (F.__marks) F.__marks.push([x, Math.round(performance.now())]); };
    mark('start');
    try {
      ensureCtx();
      var bytes = await song.blob.arrayBuffer();
      mark('bytes');
      var full = null, fullErr = null, fullIn = false;
      ctx.decodeAudioData(bytes.slice(0)).then(function (b) { full = b; fullIn = true; poke(); },
        function (e) { fullErr = e || new Error('could not decode the file'); fullIn = true; poke(); });
      var head = id3Size(bytes), preLen = head + PRE_BYTES, pre = null;
      if (bytes.byteLength > preLen * 1.25) {
        try { pre = await ctx.decodeAudioData(bytes.slice(0, preLen)); } catch (e) { pre = null; }
      }
      mark('prefix decoded');
      while (!pre && !fullIn) await nextEvent();
      if (!pre && fullErr) throw fullErr;

      var gateLevel = 0.004, gateOn = true, clarity = 0.35;
      try { gateLevel = NGATE.level; } catch (e) { gateOn = false; }
      try { clarity = NGATE.clarity; } catch (e) {}
      var P = pool(), useAnc = !!(P.url && P.slots.length);
      var sr = (pre || full).sampleRate;
      tr = tracer({ HOP: HOP, WIN: WIN, ANCHOR: ANCHOR, gate: gateLevel, gateOn: gateOn,
                    yinOff: yinOffset(sr), anc: null }, clarity);

      var mono = null, final = false, usable = 0, nA = 0, steps = 0, est = 0;
      var ancM = null, ancC = null, got = null, ancDone = 0, ancNext = 0, k = 0, kB = 0;
      var need = Math.round(0.064 * sr);
      var grow = function (n) {
        var m2 = new Float32Array(n), c2 = new Float32Array(n), g2 = new Uint8Array(n);
        if (ancM) { var c = Math.min(n, ancM.length); m2.set(ancM.subarray(0, c)); c2.set(ancC.subarray(0, c)); g2.set(got.subarray(0, c)); }
        ancM = m2; ancC = c2; got = g2;
      };
      var use = function (buf, isFull) {
        mono = mix(buf);
        final = isFull;
        usable = isFull ? mono.length : mono.length - sr;       /* a second clear of the cut */
        tr.audio(mono.slice(0), sr);
        if (isFull) {
          nA = Math.max(1, Math.floor(buf.duration / ANCHOR));
          steps = Math.floor(buf.duration / HOP);
          s.dur = buf.duration;
          grow(nA);
          if (ancNext > nA) ancNext = nA;
        } else {
          est = buf.duration * (bytes.byteLength - head) / Math.max(1, preLen - head);
          grow(Math.ceil(buf.duration / ANCHOR) + 2);
        }
      };
      use(pre || full, !pre);

      while (true) {
        if (!final && fullIn) {
          if (full) { use(full, true); full = null; }
          else if (fullErr && k >= kLimit()) throw fullErr;
        }
        await job.gate();
        /* the pitch model: hand every free worker the next couple of seconds */
        if (useAnc) {
          var aMax = final ? nA : Math.min(ancM.length,
            Math.floor((usable - need / 2 - 2) / (ANCHOR * sr)) + 1);
          P.slots.forEach(function (slot) {
            if (slot.busy || ancNext >= aMax) return;
            /* small first pieces, so the first notes come back quickly */
            var size = ancNext < 2 ? 2 : ancNext < 12 ? 4 : BATCH;
            var a0 = ancNext, a1 = Math.min(aMax, a0 + size);
            ancNext = a1;
            mark('batch ' + a0 + ' out');
            ancBatch(slot, ancFrames(mono, sr, a0, a1)).then(function (r) {
              mark('batch ' + a0 + ' back');
              for (var i = a0; i < a1 && i < got.length; i++) {
                ancM[i] = r ? r.midi[i - a0] : 0;
                ancC[i] = r ? r.conf[i - a0] : 0;      /* no model here: no anchor, as before */
                got[i] = 1;
              }
              poke();
            });
          });
          while (ancDone < got.length && got[ancDone]) ancDone++;
        }
        /* the line: as far as both the audio and the anchors reach */
        var k1 = kLimit();
        if (useAnc && !(final && ancDone >= nA)) {
          while (Math.round((kB * HOP) / ANCHOR) < ancDone) kB++;
          k1 = Math.min(k1, kB);
        }
        /* a test can hold the reading here to make it fall behind on purpose */
        while (F.__hold) await F.__hold;
        if (k1 > k) {
          var anc = useAnc ? { midi: ancM.slice(0, ancDone), conf: ancC.slice(0, ancDone) } : null;
          var pts = await tr.run(k1, anc);
          mark('traced to ' + k1);
          for (var q = 0; q < pts.length; q++) arr.push(pts[q]);
          k = k1;
          bridge(arr);
          song.bubbles = F.bubbles(arr);
          s.readTo = +(k * HOP).toFixed(2);
          s.frac = Math.min(0.99, s.readTo / Math.max(1, final ? s.dur : est));
          continue;
        }
        if (final && k >= steps) break;
        await nextEvent();
      }
      tr.end(); tr = null;

      bridge(arr);
      song.traceVer = TRACE_VER;
      song.bubbles = F.bubbles(arr);
      try { await dbPut('songs', song); } catch (e) {}
      var voiced = arr.filter(function (p) { return p.m != null; }).length;
      s.st = 'done'; s.frac = 1; s.readTo = s.dur;
      s.msg = 'Done — ' + Math.round(voiced * HOP) + 's of singing found.';
      job.res(song);
    } catch (e) {
      if (tr) tr.end();
      s.st = 'failed';
      s.msg = 'Could not read this song — ' + (e && e.message || e);
      job.rej(e);
    }
    delete jobs[job.id];
    schedule();

    function kLimit() {
      if (final) return steps;
      return Math.max(0, Math.floor((usable - (WIN >> 1) - 1) / (HOP * sr)) + 1);
    }
  }

  /* ---- which song is being read ---------------------------------------
     Robert, 25 Sep: "An urgent song interrupts any background read at
     once; the background read resumes afterwards. The background re-read
     of old songs never runs while something is playing or an urgent read
     is waiting."

     Only one song is read at a time. The one the singer opened most
     recently goes first, straight away - whatever was being read stops
     where it is (it keeps what it had) and carries on when it is next in
     line. Songs read in the background, for the Library, wait whenever
     anything is making a sound. */
  var jobs = {}, st = {}, seq = 0, urgentSeq = 0;
  function Job(song) {
    var j = this;
    j.song = song; j.id = song.id || ('song' + (++seq)); j.seq = ++seq; j.urgentAt = 0;
    j.paused = true; j.started = false; j.waiters = []; j.poke = function () {};
    j.s = st[j.id] = { st: 'queued', frac: 0, msg: 'Waiting to be read…', readTo: 0, dur: 0 };
    j.promise = new Promise(function (res, rej) { j.res = res; j.rej = rej; });
    j.promise.catch(function () {});
  }
  Job.prototype.gate = function () {
    var j = this;
    return j.paused ? new Promise(function (r) { j.waiters.push(r); }) : Promise.resolve();
  };
  Job.prototype.go = function () {
    if (this.s.st === 'done' || this.s.st === 'failed') return;
    this.paused = false;
    this.s.st = 'reading';
    this.s.msg = 'Reading the song…';
    var w = this.waiters; this.waiters = [];
    w.forEach(function (f) { f(); });
    this.poke();
    if (!this.started) { this.started = true; readSong(this); }
  };
  Job.prototype.hold = function () {
    if (this.paused || this.s.st === 'done' || this.s.st === 'failed') return;
    this.paused = true;
    this.s.st = 'queued';
    this.s.msg = 'Waiting to be read…';
  };
  function soundOn() {
    try { return !!(window.RPOneSound && RPOneSound.holder()); } catch (e) { return false; }
  }
  function schedule() {
    var live = Object.keys(jobs).map(function (k) { return jobs[k]; });
    var urgent = live.filter(function (j) { return j.urgentAt; })
      .sort(function (a, b) { return b.urgentAt - a.urgentAt; })[0] || null;
    var want = urgent || (soundOn() ? null :
      live.sort(function (a, b) { return a.seq - b.seq; })[0] || null);
    live.forEach(function (j) { if (j !== want) j.hold(); });
    if (want) want.go();
  }
  setInterval(schedule, 500);

  F.stateOf = function (id) { return st[id] || null; };
  /* the figure a screen shows: once anything at all has been read it says
     so, rather than rounding a real start down to 0% */
  F.pct = function (s) {
    if (!s) return 0;
    var f = s.frac || 0;
    return f > 0 ? Math.max(1, Math.round(f * 100)) : 0;
  };
  F.busy = function () { return Object.keys(jobs).length > 0; };
  F.ensure = function (song, urgent) {
    if (!song) return Promise.reject(new Error('no song'));
    var id = song.id;
    var j = id ? jobs[id] : null;
    if (!j && !F.needsBuild(song)) return Promise.resolve(song);
    if (!j) { j = new Job(song); jobs[j.id] = j; }
    if (urgent) j.urgentAt = ++urgentSeq;
    schedule();
    return j.promise;
  };
  /* is this song being read right now (or waiting its turn)? */
  F.reading = function (song) {
    var s = song && song.id ? st[song.id] : null;
    return !!(s && (s.st === 'reading' || s.st === 'queued'));
  };
  /* how far the reading has got, for a screen about to play or playing */
  F.aheadOf = function (song, t) {
    if (!song || !F.needsBuild(song)) return { done: true, ok: true, canStart: true, readTo: Infinity };
    var s = song.id ? st[song.id] : null;             /* none yet: nothing read */
    if (s && s.st === 'failed') return { done: true, failed: true, ok: true, canStart: false, readTo: s.readTo || 0 };
    var readTo = (s && s.readTo) || 0;
    return { done: false, readTo: readTo, ok: readTo - (t || 0) >= F.LEAD_MIN,
             canStart: readTo - (t || 0) >= F.LEAD_START };
  };
  /* read it now, first in line, and say how it is going */
  F.build = function (song, onProgress) {
    if (!song || !song.blob) return Promise.reject(new Error('nothing to read'));
    var say = onProgress || status;
    if (!F.needsBuild(song) && !(song.id && jobs[song.id])) delete song.traceVer;   /* asked for again */
    var p = F.ensure(song, true);
    var s = function () { return song.id ? st[song.id] : null; };
    var iv = setInterval(function () { var x = s(); if (x) say(x.msg, x.frac); }, 250);
    return p.then(function (v) { clearInterval(iv); var x = s(); if (x) say(x.msg, 1); return v; },
                  function (e) { clearInterval(iv); throw e; });
  };
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
