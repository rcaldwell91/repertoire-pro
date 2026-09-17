/* =====================================================================
   Repertoire Pro — the reference note is a real piano.

   Robert, 18 Sep: "Listen to the new reference note yourself. Piano in
   code often means a synth with a piano-ish envelope, which is the exact
   thing I didn't like." It was. Then: "source a real sampled note."

   The samples are the Steinway B sustains from the Versilian Community
   Sample Library (github.com/sgossner/VCSL), CC0 — public domain, no
   credit required, safe in a commercial app. Sixteen anchors, every four
   semitones from C2 to C7, because VCSL's piano is whole-tone sampled so
   a three-semitone grid would have meant resampling every anchor. Each
   one is trimmed to three seconds, faded, mixed to mono and encoded at
   96 kbps: 584 KB for the set, in audio/piano/ next to the page.

   Every sample was measured offline and its real pitch is in TUNING
   below. A grand is stretch-tuned — the bass sits flat and the treble
   sharp, the Railsback curve, and it is right there in the numbers —
   so playbackRate corrects each note to equal temperament rather than
   assuming the file is where the label says.

   If a file has not arrived, or there is no network, playPiano falls
   back to the synth it already had. Nobody ever gets silence.
   ===================================================================== */
(function () {
  'use strict';
  var P = {};
  window.RPPiano = P;

  /* midi -> the frequency that sample actually sounds, measured */
  var TUNING = {
    36: 64.911,  40: 81.988,  44: 103.749, 48: 130.506,
    52: 164.423, 56: 207.258, 60: 261.269, 64: 329.250,
    68: 414.691, 72: 521.108, 76: 658.776, 80: 830.029,
    84: 1048.313, 88: 1322.752, 92: 1663.746, 96: 2109.428
  };
  var ANCHORS = Object.keys(TUNING).map(Number).sort(function (a, b) { return a - b; });
  var DIR = 'audio/piano/';
  var buf = {};       /* midi -> AudioBuffer */
  var tried = {};     /* midi -> true once a fetch has started */
  var dead = false;   /* one hard failure and we stop asking */

  function theCtx() { try { return ctx; } catch (e) { return null; } }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function nearest(midi) {
    var best = ANCHORS[0], d = 1e9;
    for (var i = 0; i < ANCHORS.length; i++) {
      var k = Math.abs(ANCHORS[i] - midi);
      if (k < d) { d = k; best = ANCHORS[i]; }
    }
    return best;
  }

  function load(anchor) {
    if (dead || tried[anchor]) return;
    tried[anchor] = true;
    var c = theCtx();
    if (!c) { tried[anchor] = false; return; }
    fetch(DIR + anchor + '.mp3', { cache: 'force-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function (ab) {
        return new Promise(function (res, rej) {
          var out = c.decodeAudioData(ab, res, rej);
          if (out && out.then) out.then(res, rej);
        });
      })
      .then(function (b) { buf[anchor] = b; })
      .catch(function () {
        tried[anchor] = false;
        /* a 404 means the files are not deployed; stop asking sixteen times */
        if (anchor === 60) dead = true;
      });
  }

  /* Warm the anchors around the singer's range, once there is a context.
     Nothing blocks on this: the synth covers every note until a file
     lands, and the swap is silent. */
  P.warm = function () {
    if (dead || !theCtx()) return;
    var lo = 48, hi = 84;
    try { if (RANGE && isFinite(RANGE.lo)) { lo = RANGE.lo - 4; hi = RANGE.hi + 4; } } catch (e) {}
    ANCHORS.forEach(function (a) { if (a >= lo - 4 && a <= hi + 4) load(a); });
  };

  /* Returns true when it has played the note. False means "not ready" and
     the caller falls back to its synth. */
  P.play = function (midi, when, dur, dest, vol) {
    var c = theCtx();
    if (!c || dead) return false;
    var a = nearest(midi);
    if (!buf[a]) { load(a); return false; }
    if (Math.abs(a - midi) > 3) return false;   /* too far to shift cleanly */

    var hold = Math.max(0.25, dur || 1);
    var src = c.createBufferSource();
    src.buffer = buf[a];
    src.playbackRate.value = hz(midi) / TUNING[a];

    var g = c.createGain();
    g.gain.setValueAtTime(vol == null ? 0.5 : vol, when);
    /* the file is three seconds long. If the caller wants less, take the
       note off with a short fade rather than a click. */
    var fade = Math.min(0.18, hold * 0.35);
    g.gain.setValueAtTime(vol == null ? 0.5 : vol, when + Math.max(0.02, hold - fade));
    g.gain.linearRampToValueAtTime(0.0001, when + hold);

    src.connect(g); g.connect(dest || c.destination);
    src.start(when);
    src.stop(when + hold + 0.05);
    return true;
  };

  P.ready = function () { return !dead && !!buf[60]; };
  P.state = function () {
    return { dead: dead, loaded: Object.keys(buf).map(Number).sort(function (a, b) { return a - b; }) };
  };

  /* try to warm as soon as there is an audio context, and again when the
     range changes, because that moves which anchors matter */
  var n = 0;
  var iv = setInterval(function () {
    if (theCtx()) { P.warm(); if (++n > 3) clearInterval(iv); }
    else if (++n > 200) clearInterval(iv);
  }, 1000);
})();
