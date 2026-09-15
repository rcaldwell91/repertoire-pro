/* ======================================================================
   Repertoire Pro — "Hear it": an example of each exercise.

   Robert, 13 Sep: "add audio examples for the exercises to teach people
   what they are supposed to sound like — a voice performing the right
   sound, so we don't have to guess if it's ooo or uuuu."

   What this is, and what it is not. It is the app's own voice-like tone —
   the one Note Match already uses — shaped into the vowel the exercise
   asks for, singing the exercise's actual pattern in the singer's own
   range. It is a synthesised voice, and every button says so. It is NOT a
   recording of a singer: the app does not take audio from anywhere, and
   a real human example is something a coach records. That is the next
   step, and it is built to plug in here: a coach's recording for an
   exercise, when there is one, plays instead of this.

   Vowels are made the way the reference voice is made — a buzz through
   two or three band-pass filters sitting on the vowel's formants. The
   numbers are the standard ones (Peterson & Barney): oo 300/870, ah
   730/1090, ee 270/2290, uh 640/1190, ay 530/1840, and a hum is a buzz
   with the mouth closed (a low-pass, no formants).
   ====================================================================== */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }

  var X = window.RPExample = {};
  /* Briar, 15 Sep: "the Hear it just sounds like a rain stick … it doesn't
     emulate the actual sound you are supposed to make." So the button is
     OFF everywhere until a real recording replaces the synth. Everything
     that plays stays in place; a recording per exercise plugs into X.play
     (look up exId in a table of audio URLs before falling back to the
     synth) and this switch goes back on. */
  X.enabled = false;
  var VOWELS = {
    oo: [[300, 3.5, 1.0], [870, 6, 0.35], [2240, 8, 0.10]],
    ah: [[730, 3.2, 1.0], [1090, 5, 0.55], [2440, 7, 0.22]],
    ee: [[270, 4, 1.0], [2290, 8, 0.45], [3010, 9, 0.18]],
    uh: [[640, 3.2, 1.0], [1190, 5, 0.5], [2390, 7, 0.2]],
    ay: [[530, 3.5, 1.0], [1840, 6, 0.5], [2480, 7, 0.2]],
    oh: [[570, 3.2, 1.0], [840, 5, 0.5], [2410, 7, 0.18]]
  };
  /* what each exercise's syllable is, in vowel terms; a hum is 'm' */
  function vowelOf(e) {
    var s = String((e && e.syl) || '').toLowerCase();
    if (/^(mmm|hum|m,|m$|nnn|ng)/.test(s) || /^m\b/.test(s)) return 'm';
    if (/oo|through a straw|noo|loo/.test(s)) return 'oo';
    if (/ee|mee|gee|kee/.test(s)) return 'ee';
    if (/ay|nay|bay|bae/.test(s)) return 'ay';
    if (/oh|ol\b|knoll/.test(s)) return 'oh';
    if (/uh|mum|buh/.test(s)) return 'uh';
    if (/brrr|lip/.test(s)) return 'lip';
    if (/sss|silent|hiss/.test(s)) return 'sss';
    return 'ah';
  }

  function f0(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  /* one voiced note, in one vowel */
  function voice(ac, midi, when, dur, vowel, dest, vol) {
    var out = ac.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.linearRampToValueAtTime(vol, when + 0.06);
    out.gain.setValueAtTime(vol, when + Math.max(0.08, dur - 0.08));
    out.gain.linearRampToValueAtTime(0.0001, when + dur);
    out.connect(dest);
    var osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0(midi), when);
    /* a little vibrato, late, like a voice */
    var lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, when);
    lg.gain.linearRampToValueAtTime(f0(midi) * 0.012, when + Math.min(0.6, dur));
    lfo.connect(lg); lg.connect(osc.frequency);
    var pre = ac.createGain(); pre.gain.value = 0.35;
    osc.connect(pre);
    if (vowel === 'm') {
      var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 0.7;
      pre.connect(lp); lp.connect(out);
    } else if (vowel === 'lip') {
      /* a lip trill is a voice chopped ~28 times a second by the lips */
      var chop = ac.createGain(); chop.gain.value = 0.5;
      var trill = ac.createOscillator(); trill.type = 'square'; trill.frequency.value = 28;
      var tg = ac.createGain(); tg.gain.value = 0.5;
      trill.connect(tg); tg.connect(chop.gain);
      var lp2 = ac.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 900;
      pre.connect(lp2); lp2.connect(chop); chop.connect(out);
      trill.start(when); trill.stop(when + dur + 0.05);
    } else {
      var form = VOWELS[vowel] || VOWELS.ah;
      form.forEach(function (f) {
        var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f[0]; bp.Q.value = f[1];
        var g = ac.createGain(); g.gain.value = f[2];
        pre.connect(bp); bp.connect(g); g.connect(out);
      });
    }
    osc.start(when); osc.stop(when + dur + 0.05);
    lfo.start(when); lfo.stop(when + dur + 0.05);
    return when + dur;
  }
  /* unvoiced: a hiss is band-passed noise */
  function hiss(ac, when, dur, dest, vol) {
    var len = Math.ceil(ac.sampleRate * dur), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ac.createBufferSource(); src.buffer = buf;
    var bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 5500; bp.Q.value = 0.8;
    var out = ac.createGain();
    out.gain.setValueAtTime(0.0001, when);
    out.gain.linearRampToValueAtTime(vol * 0.5, when + 0.15);
    out.gain.setValueAtTime(vol * 0.5, when + dur - 0.3);
    out.gain.linearRampToValueAtTime(0.0001, when + dur);
    src.connect(bp); bp.connect(out); out.connect(dest);
    src.start(when); src.stop(when + dur);
    return when + dur;
  }

  var stopAt = 0;
  X.playing = function () { return (typeof ctx !== 'undefined' && ctx) ? ctx.currentTime < stopAt : false; };

  /* the pattern the exercise actually uses, in the singer's own range */
  X.play = function (exId) {
    var e = null; try { e = V10.exById(exId); } catch (err) {}
    if (!e) return false;
    try { ensureCtx(); } catch (err) {}
    if (typeof ctx === 'undefined' || !ctx) return false;
    var dest = (typeof guideGain !== 'undefined' && guideGain) ? guideGain : ctx.destination;
    var lo = 48, hi = 72;
    try { lo = RANGE.lo; hi = RANGE.hi; } catch (err) {}
    var mid = Math.round((lo + hi) / 2);
    var t = ctx.currentTime + 0.08;
    var vw = vowelOf(e);
    var eng = e.engine || {};
    var end = t;
    if (vw === 'sss' || eng.kind === 'timed' || eng.kind === 'cycle') {
      end = hiss(ctx, t, 3.0, dest, 0.6);
    } else if (eng.kind === 'glide') {
      /* a siren: one long note sliding up an octave and back */
      var o = ctx.createGain(); o.gain.setValueAtTime(0.0001, t); o.gain.linearRampToValueAtTime(0.45, t + 0.15);
      o.gain.setValueAtTime(0.45, t + 3.6); o.gain.linearRampToValueAtTime(0.0001, t + 4); o.connect(dest);
      var osc = ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f0(mid - 5), t);
      osc.frequency.exponentialRampToValueAtTime(f0(mid + 7), t + 2);
      osc.frequency.exponentialRampToValueAtTime(f0(mid - 5), t + 4);
      var pre = ctx.createGain(); pre.gain.value = 0.35; osc.connect(pre);
      (VOWELS.oo).forEach(function (f) { var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f[0]; bp.Q.value = f[1]; var g = ctx.createGain(); g.gain.value = f[2]; pre.connect(bp); bp.connect(g); g.connect(o); });
      osc.start(t); osc.stop(t + 4.1); end = t + 4;
    } else if (eng.kind === 'ladder' && eng.pattern && window.V10 && V10.PATTERNS && V10.PATTERNS[eng.pattern]) {
      var p = V10.PATTERNS[eng.pattern], bpm = eng.bpm || 120, spb = 60 / bpm;
      var root = mid - Math.floor((p.span || 7) / 2);
      var at = t;
      for (var i = 0; i < p.deg.length; i++) {
        var d = (p.dur && p.dur[i]) || 1;
        voice(ctx, root + p.deg[i], at, d * spb * 0.95, vw === 'lip' ? 'lip' : vw, dest, 0.55);
        at += d * spb;
      }
      end = at;
    } else {
      /* hold, guided: one comfortable note, in the vowel, for three seconds */
      end = voice(ctx, mid, t, 3.0, vw === 'lip' ? 'lip' : vw, dest, 0.55);
    }
    stopAt = end;
    return true;
  };

  /* a Hear-it button, wired: says what it is */
  X.button = function (exId, small) {
    if (!X.enabled) return '';
    return '<button class="btn" data-hear="' + exId + '" style="padding:' + (small ? '7px 11px;font-size:12px' : '9px 14px;font-size:12.5px') +
      '" title="A synthesised voice, not a singer">▶ Hear it</button>';
  };
  X.wire = function (root) {
    (root || document).querySelectorAll('[data-hear]').forEach(function (b) {
      if (b.dataset.wired) return;
      b.dataset.wired = '1';
      on(b, 'click', function (ev) {
        ev.stopPropagation();
        var ok = X.play(b.dataset.hear);
        var was = b.textContent;
        b.textContent = ok ? 'Playing… (a synthesised voice, not a singer)' : 'No sound yet — tap once more';
        setTimeout(function () { b.textContent = was; }, ok ? 3200 : 1500);
      });
    });
  };
  setInterval(function () { X.wire(document); }, 800);
})();
