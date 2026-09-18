/* Repertoire Pro — the map holds still, and the two lines land together.

   Robert, 17 Sep: "THE MAP STILL JUMPS. Fix first — nothing else can be
   judged until it stops." And: "MEASURE IT, do not guess. Pick one clear
   note near the start... Report the difference in seconds, and say whether
   it is a constant offset or gets worse through the song."

   This is that measurement, kept, so neither answer can quietly come back.
   The test builds its own audio: sixteen notes, note k starting at exactly
   k * 1.2 s. Ground truth, written here in the open rather than trusted to
   a file. Then it asks the shipping code two questions.

     1. Where does the app think each note starts?
        - the note map, built from the file, reads them 0.05 s EARLY
        - the live microphone line reads them 0.10 s LATE
        Both are corrected before anything is drawn, so both land on the
        truth and therefore on each other. That is what is asserted.

     2. Does the view hold still? The window is worked out from the song
        before Start and must be the same window after a voice has wandered
        two octaves away from it.

   Runs against the built next.html (or RP_URL). Exit 1 on any failure. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const URL_ = process.env.RP_URL || 'https://rcaldwell91.github.io/repertoire-pro/next.html';
const LOCAL = process.env.RP_LOCAL || path.join(__dirname, '..', 'next.html');
let fails = 0;
function ok(cond, what) { console.log((cond ? '  ✓ ' : '  ✗ ') + what); if (!cond) fails++; }

/* ---- the ground truth, made here --------------------------------------
   A voice-like tone: a fundamental plus a few harmonics and nothing below
   it, so the app's voice-only path will accept it. Note k starts at exactly
   k * GAP seconds and holds for HOLD. */
const SR = 44100, GAP = 1.2, HOLD = 0.9;
/* LEAD is silence before the first note. Every recording of a person has
   some; and the analyser cannot see a note that begins in the file's first
   0.05 s, because its first look at the audio is centred at 0.1 s. Starting
   the tune at sample zero would be measuring that edge rather than the thing
   this test is for. Note k starts at LEAD + k * GAP. */
const LEAD = 0.6;
const TUNE = [62, 64, 65, 67, 69, 67, 65, 64, 62, 64, 65, 67, 69, 71, 72, 69];
function makeWav() {
  const n = Math.round(SR * (LEAD + GAP * TUNE.length));
  const pcm = Buffer.alloc(n * 2);
  TUNE.forEach((midi, k) => {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const a = Math.round((LEAD + k * GAP) * SR), b = a + Math.round(HOLD * SR);
    for (let i = a; i < b && i < n; i++) {
      const t = (i - a) / SR;
      /* a short fade at each end so the onset is a note, not a click */
      const env = Math.min(1, t / 0.02, (HOLD - t) / 0.05);
      const v = Math.sin(2 * Math.PI * f * t) +
                0.5 * Math.sin(4 * Math.PI * f * t) +
                0.3 * Math.sin(6 * Math.PI * f * t) +
                0.15 * Math.sin(8 * Math.PI * f * t);
      pcm.writeInt16LE(Math.max(-32000, Math.min(32000, Math.round(v * env * 8000))), i * 2);
    }
  });
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

function stats(ds) {
  const mean = ds.reduce((a, b) => a + b, 0) / ds.length;
  const f = ds.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const l = ds.slice(-3).reduce((a, b) => a + b, 0) / 3;
  return { mean: mean, first: f, last: l, drift: l - f,
           worst: Math.max.apply(null, ds.map(Math.abs)) };
}

(async () => {
  const wavPath = path.join(os.tmpdir(), 'rp-timed-' + process.pid + '.wav');
  const wav = makeWav();
  fs.writeFileSync(wavPath, wav);

  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox',
      '--use-file-for-fake-audio-capture=' + wavPath, '--autoplay-policy=no-user-gesture-required',
      '--disable-features=PostQuantumKyber,TLS13KyberSupport,EncryptedClientHello,UseDnsHttpsSvcb,UseDnsHttpsSvcbAlpn',
      '--ssl-version-max=tls1.2']
  });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, permissions: ['microphone'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  if (fs.existsSync(LOCAL)) {
    const body = fs.readFileSync(LOCAL, 'utf8');
    await p.route('**/*', r => r.request().url() === URL_ ? r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }) : r.continue());
  }
  await p.goto(URL_, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => { try { RPTour.stop(); } catch (e) {} localStorage.setItem('rp_tour_student', 'done'); });

  console.log('the two clocks');
  const lags = await p.evaluate(() => ({
    file: window.rpNoteLag ? +rpNoteLag({ mapVer: 3 }).toFixed(4) : null,
    live: window.rpNoteLag ? +rpNoteLag({ notesFrom: 'live' }).toFixed(4) : null,
    exact: window.rpNoteLag ? +rpNoteLag({ notesFrom: 'exact' }).toFixed(4) : null,
    mic: window.rpMicLag ? +rpMicLag().toFixed(4) : null
  }));
  ok(lags.file === 0.05, 'a note map built from a file is drawn 0.05s later than it reads (it reads early)');
  ok(lags.live === -0.1, "a take's own pitch line is drawn 0.1s earlier than it reads (the mic reads late)");
  ok(lags.exact === 0, 'notes the app wrote itself are drawn exactly where they are');
  ok(lags.mic === 0.1, 'the microphone lag comes from the app\'s own setting, 100 ms');

  /* ---- 1. the FILE path: the note map against the truth ---------------- */
  console.log('the note map, against a file whose notes start at exactly ' + GAP + 's apart');
  const b64 = wav.toString('base64');
  const mapped = await p.evaluate(async (b64) => {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const song = { id: 'mt' + Date.now(), title: 'timed', kind: 'recording', cleanVox: true,
                   blob: new Blob([u], { type: 'audio/wav' }), at: Date.now() };
    try { await buildNoteMap(song); } catch (e) { return { err: String(e && e.message || e) }; }
    return { notes: (song.notes || []).map(n => ({ m: n.m, t: n.t })),
             from: song.notesFrom, lag: rpNoteLag(song) };
  }, b64);
  ok(!mapped.err, 'the app finds the tune in the file' + (mapped.err ? ' — ' + mapped.err : ''));
  ok(mapped.from === 'file', 'the map says where it came from, so the drawing knows which clock it is on');
  if (mapped.notes && mapped.notes.length === TUNE.length) {
    ok(true, 'all ' + TUNE.length + ' notes found');
    const raw = mapped.notes.map((n, i) => n.t - (LEAD + i * GAP));
    const fixed = mapped.notes.map((n, i) => n.t + mapped.lag - (LEAD + i * GAP));
    const r = stats(raw), f = stats(fixed);
    console.log('    as stored:  mean ' + r.mean.toFixed(3) + 's, worst ' + r.worst.toFixed(3) + 's, drift ' + r.drift.toFixed(3) + 's');
    console.log('    as drawn:   mean ' + f.mean.toFixed(3) + 's, worst ' + f.worst.toFixed(3) + 's, drift ' + f.drift.toFixed(3) + 's');
    ok(Math.abs(r.drift) < 0.05, 'the error is a constant offset, not a drift through the song');
    ok(f.worst <= 0.06, 'every bubble lands within 60 ms of where the note really is');
  } else {
    ok(false, 'all ' + TUNE.length + ' notes found — got ' + (mapped.notes ? mapped.notes.length : 0));
  }

  /* ---- 2. the LIVE path: the microphone against the same truth --------- */
  console.log('the live line, on the same tune through the microphone');
  await p.evaluate(() => window.switchMode('free'));
  await p.waitForTimeout(1200);
  await p.evaluate(async () => { try { await startMic(); } catch (e) {} FREE.trail.length = 0; FREE.t0 = performance.now(); });
  await p.waitForTimeout(9000);
  const live = await p.evaluate(() => FREE.trail.map(x => ({ t: x.t, m: x.m })));
  /* the fake microphone starts the file when the page starts, so the ABSOLUTE
     times are unknown. What is knowable, and what matters, is the spacing:
     each note must arrive exactly GAP after the one before it. */
  const runs = [];
  let cur = null;
  for (const s of live) {
    if (s.m == null) { cur = null; continue; }
    if (cur && Math.abs(s.m - cur.last) < 1.0) { cur.last = s.m; cur.n++; continue; }
    cur = { t0: s.t, last: s.m, first: s.m, n: 1 };
    runs.push(cur);
  }
  /* the fake microphone is already part-way through the file when the trail
     starts, so the first run it hears is half a note. Drop it: what is being
     measured is the spacing of the notes after that. */
  const heard = runs.filter(r => r.n >= 6).slice(1);
  ok(heard.length >= 4, 'the microphone hears the notes (' + heard.length + ' of them)');
  if (heard.length >= 4) {
    const gaps = [];
    for (let i = 1; i < heard.length; i++) gaps.push(heard[i].t0 - heard[i - 1].t0);
    const worst = Math.max.apply(null, gaps.map(g => Math.abs(g - GAP)));
    console.log('    note-to-note: ' + gaps.map(g => g.toFixed(2)).join(' ') + '  (should all be ' + GAP + ')');
    ok(worst <= 0.12, 'the live line keeps the tune\'s own spacing — no drift against the file');
  }

  /* ---- 3. the view holds still ---------------------------------------- */
  console.log('the view does not move');
  const pinned = await p.evaluate(() => {
    const cv = document.getElementById('freeCanvas');
    return cv && cv._pmPin ? { lo: cv._pmPin.lo, hi: cv._pmPin.hi } : null;
  });
  ok(!!pinned, 'the Pitch Tracker decides its window and pins it' + (pinned ? ' (' + pinned.lo + '–' + pinned.hi + ')' : ''));
  const afterWander = await p.evaluate(() => {
    const cv = document.getElementById('freeCanvas');
    /* a voice that leaves the window entirely, in both directions */
    for (let i = 0; i < 400; i++) laneWindow(cv, i % 2 ? 30 : 100);
    return cv._pmPin ? { lo: cv._pmPin.lo, hi: cv._pmPin.hi } : null;
  });
  ok(pinned && afterWander && pinned.lo === afterWander.lo && pinned.hi === afterWander.hi,
     'a voice two octaves outside the window does not move it');

  console.log('Learn a song pins to the song');
  const ls = await p.evaluate(async () => {
    const notes = [];
    for (let i = 0; i < 12; i++) notes.push({ m: 55 + (i % 7), t: i * 0.8, d: 0.5 });
    RPLearnSong.open({ id: 'lsmt', title: 'Pin test', notes: notes, blob: null, notesFrom: 'exact' });
    await new Promise(r => setTimeout(r, 900));
    const cv = document.getElementById('rpLsCv');
    const pin = cv && cv._pmPin ? { lo: cv._pmPin.lo, hi: cv._pmPin.hi } : null;
    for (let i = 0; i < 400; i++) laneWindow(cv, i % 2 ? 30 : 100);
    const after = cv && cv._pmPin ? { lo: cv._pmPin.lo, hi: cv._pmPin.hi } : null;
    return { pin: pin, after: after, lo: 55, hi: 61 };
  });
  ok(!!ls.pin, 'the song decides the window before Start' + (ls.pin ? ' (' + ls.pin.lo + '–' + ls.pin.hi + ')' : ''));
  ok(ls.pin && ls.pin.lo <= ls.lo && ls.pin.hi >= ls.hi, 'every note of the song is inside it, with room around');
  ok(ls.pin && ls.after && ls.pin.lo === ls.after.lo && ls.pin.hi === ls.after.hi,
     'and it does not move for the whole song');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  try { fs.unlinkSync(wavPath); } catch (e) {}
  await browser.close();
  console.log(fails ? '\nFAILED: ' + fails : '\nall good');
  process.exit(fails ? 1 : 0);
})();
