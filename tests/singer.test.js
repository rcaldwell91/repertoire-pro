/* Repertoire Pro — does the app hear what is actually being sung?

   Robert, 24 Sep: "for a file, draw the line the app HEARS, not bars." The
   live tracker follows his voice; the old file analyser drew bars that
   missed the words, and had never been measured against a real voice.

   This measures the trace a file now produces against the file itself.

   WHERE THE FILE IS LOUD, IS THE APP LISTENING?  The file's own quiet is
   the reference: window RMS every 50ms, split into quiet and loud by Otsu's
   method on the log of those values - the cut that best separates the two
   groups the file actually contains. Nothing is assumed about how much of a
   recording is singing, and there is no threshold to tune by hand, which
   matters because the first version of this test DID have one. A fixed
   "12dB above the 20th percentile" put the line at -8.5dB from peak on one
   of these recordings - around the median of the singing itself - so it
   called only the loudest peaks voice and the measurement was meaningless.
   Otsu puts it at -27.6dB and finds 86% of that file is voice, which is
   what a vocals-only recording looks like.

   Wherever the file is loud, the trace has to be following a pitch at
   least 90% of the time. And no more than 10% of the trace may be voiced
   where the file is quiet - hearing a note in a gap is as wrong as missing
   one in a phrase.

   AND CAN NOTES BE CUT FROM IT?  Bubbles are grouped out of the trace, not
   out of the old analyser: a run holding inside one semitone for at least
   0.15s. At least 85% of the sung time has to land inside one before they
   are worth showing anyone.

   THIS NEEDS REAL SINGING. It does not carry a synthesised tone and will
   not pass on one: a tone has no breath, no consonants, no release. The
   recordings are Robert's own and live outside this repo - the paths come
   from RP_RECORDINGS, as label:path pairs. With none it says so and fails,
   because an unmeasured claim is not a passing one. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const URL_ = process.env.RP_URL || 'https://rcaldwell91.github.io/repertoire-pro/next.html';
const LOCAL = process.env.RP_LOCAL || path.join(__dirname, '..', 'next.html');
const SPEC = process.env.RP_RECORDINGS || '';

const VOICED_IN_LOUD = 90;   /* % of loud time the trace must be following */
const VOICED_IN_QUIET = 10;  /* % of the voiced trace allowed in the gaps  */
const SUNG_IN_NOTE = 85;     /* % of sung time that must land in a bubble  */

let fails = 0;
function ok(c, w) { console.log((c ? '  ✓ ' : '  ✗ ') + w); if (!c) fails++; }
function loud(lines) {
  const w = Math.max.apply(null, lines.map(l => l.length)) + 4;
  console.log('\n' + '='.repeat(w));
  lines.forEach(l => console.log('  ' + l));
  console.log('='.repeat(w) + '\n');
}

(async () => {
  const recs = SPEC.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.indexOf(':');
    return i < 0 ? { label: path.basename(s), file: s }
                 : { label: s.slice(0, i), file: s.slice(i + 1) };
  });
  const missing = recs.filter(r => !fs.existsSync(r.file));
  if (!recs.length || missing.length) {
    loud(['NO EVIDENCE: no real singing to measure against.',
          !recs.length ? 'RP_RECORDINGS is not set.'
                       : 'these are not on disk: ' + missing.map(m => m.label).join(', '),
          'Set RP_RECORDINGS to label:path pairs, comma separated.',
          'The app has NOT been measured against a real voice.']);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']
  });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  if (fs.existsSync(LOCAL)) {
    const body = fs.readFileSync(LOCAL, 'utf8');
    await p.route('**/*', r => r.request().url() === URL_
      ? r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }) : r.continue());
  }
  await p.goto(URL_, { waitUntil: 'load', timeout: 180000 });
  await p.waitForTimeout(4000);

  for (const rec of recs) {
    console.log('\n' + rec.label);
    const b64 = fs.readFileSync(rec.file).toString('base64');
    const r = await p.evaluate(async (b64) => {
      const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const blob = new Blob([u], { type: 'audio/mpeg' });
      const song = { id: 'sg' + Date.now(), title: 'measured', kind: 'song',
                     blob: blob, at: Date.now() };
      const t0 = performance.now();
      try { await RPFileMap.build(song); }
      catch (e) { return { err: String(e && e.message || e) }; }
      const took = (performance.now() - t0) / 1000;

      /* the file's own loud and quiet, on the same 50ms grid as the trace */
      ensureCtx();
      const dec = await ctx.decodeAudioData(await blob.arrayBuffer());
      const sr = dec.sampleRate, L = dec.getChannelData(0);
      const R = dec.numberOfChannels > 1 ? dec.getChannelData(1) : L;
      const HOP = 0.05, W = Math.round(HOP * sr);
      const n = Math.floor(dec.duration / HOP);
      const rms = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        let s = 0;
        const a = k * W;
        for (let i = 0; i < W; i++) { const v = (L[a + i] + R[a + i]) / 2; s += v * v; }
        rms[k] = Math.sqrt(s / W);
      }
      /* Otsu's method over log-RMS: the cut that best separates the two
         groups the file contains, rather than a number chosen in advance */
      const logs = [];
      for (let k = 0; k < n; k++) logs.push(Math.log10(rms[k] || 1e-9));
      const lo = Math.min.apply(null, logs), hi = Math.max.apply(null, logs), B = 200;
      const hist = new Array(B).fill(0);
      logs.forEach(v => hist[Math.min(B - 1, Math.floor((v - lo) / (hi - lo) * B))]++);
      let sum = 0; for (let i = 0; i < B; i++) sum += i * hist[i];
      let sumB = 0, wB = 0, best = 0, bestT = 0;
      for (let i = 0; i < B; i++) {
        wB += hist[i]; if (!wB) continue;
        const wF = n - wB; if (!wF) break;
        sumB += i * hist[i];
        const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
        if (v > best) { best = v; bestT = i; }
      }
      const thresh = Math.pow(10, lo + (bestT + 0.5) / B * (hi - lo));
      const peak = Math.max.apply(null, Array.from(rms));
      const cutDb = 20 * Math.log10(thresh / (peak || 1));
      let loudN = 0, loudVoiced = 0, voicedN = 0, voicedQuiet = 0;
      const notes = song.notes;
      for (let k = 0; k < n && k < notes.length; k++) {
        const isLoud = rms[k] >= thresh, isV = notes[k].m != null;
        if (isLoud) { loudN++; if (isV) loudVoiced++; }
        if (isV) { voicedN++; if (!isLoud) voicedQuiet++; }
      }
      /* how much of the sung time lands inside a grouped note */
      const bub = song.bubbles || [];
      let inNote = 0;
      const mark = new Uint8Array(n);
      bub.forEach(b => {
        const a = Math.round(b.t / HOP), z = Math.round((b.t + b.d) / HOP);
        for (let k = a; k < z && k < n; k++) mark[k] = 1;
      });
      for (let k = 0; k < n && k < notes.length; k++) if (notes[k].m != null && mark[k]) inNote++;

      return {
        dur: dec.duration, took: took, points: notes.length, bubbles: bub.length,
        cutDb: cutDb,
        loudSecs: loudN * HOP, voicedSecs: voicedN * HOP,
        voicedInLoud: loudN ? 100 * loudVoiced / loudN : 0,
        voicedInQuiet: voicedN ? 100 * voicedQuiet / voicedN : 0,
        sungInNote: voicedN ? 100 * inNote / voicedN : 0,
        from: song.notesFrom, hasD: notes.some(x => x.d != null)
      };
    }, b64);

    if (r.err) { ok(false, rec.label + ': ' + r.err); continue; }
    console.log('    ' + r.dur.toFixed(0) + 's of audio, read in ' + r.took.toFixed(0) + 's — ' +
                r.points + ' points, ' + r.loudSecs.toFixed(0) + 's of voice (cut at ' +
                r.cutDb.toFixed(1) + 'dB from peak), ' +
                r.voicedSecs.toFixed(0) + 's followed, ' + r.bubbles + ' notes cut from it');
    ok(r.from === 'trace', rec.label + ': read with the live tracker, not the old analyser');
    ok(!r.hasD, rec.label + ': it is a line, not bars — no durations on the points');
    ok(r.voicedInLoud >= VOICED_IN_LOUD,
       rec.label + ': following the voice ' + r.voicedInLoud.toFixed(1) + '% of the loud time (needs ' + VOICED_IN_LOUD + ')');
    ok(r.voicedInQuiet <= VOICED_IN_QUIET,
       rec.label + ': only ' + r.voicedInQuiet.toFixed(1) + '% of the line falls in the gaps (allows ' + VOICED_IN_QUIET + ')');
    ok(r.sungInNote >= SUNG_IN_NOTE,
       rec.label + ': ' + r.sungInNote.toFixed(1) + '% of the singing lands inside a note (needs ' + SUNG_IN_NOTE + ')');
  }

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await browser.close();
  console.log(fails ? '\nSINGER TEST FAILED: ' + fails : '\nall good');
  process.exit(fails ? 1 : 0);
})();
