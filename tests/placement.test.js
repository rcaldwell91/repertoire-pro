/* Repertoire Pro — does the drawing put a note at the playhead when that
   note sounds?

   Robert, 25 Sep, on his phone with wired headphones: in Learn a song the
   bubble fills before it reaches the bar, and in the Pitch Tracker
   sing-along the gold does not sit on the words. "This round is timing and
   the line - measured with numbers, not searches."

   So nothing here searches for an offset. Two independent records are laid
   side by side:

     THE SOUND. The recording's own loud onsets, from the decoded file: RMS
     every 10ms over 20ms, split into quiet and loud by Otsu's method on the
     file's own loudness, and an onset is a loud frame after at least 0.15s
     of quiet - the start of a sung phrase.

     THE DRAWING. With a recording hook switched on, each screen's own draw
     code writes down, every frame, where it drew the first point of each
     phrase (Pitch Tracker) or the left edge of each bubble (Learn a song)
     and the song's own clock at that frame. When that position crosses the
     playhead - the right-hand edge on the Pitch Tracker, the white bar in
     Learn a song - the clock is read off between the two frames either side.

   Each onset is paired with the first drawn phrase start that crosses from
   100ms before it to 250ms after it: a pairing of events inside a fixed
   window, not a search for the offset that fits best. Reported per screen,
   per recording: the median difference in milliseconds, and the spread.

   Also recorded, for the fill rule: any frame where a bubble's fill reached
   past the bar.

   The gate is +/-30ms on the median, on both screens, for both recordings.

   The recordings never enter this repo. RP_RECORDINGS gives label:path
   pairs; with none it says so and fails. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const URL_ = process.env.RP_URL || 'https://rcaldwell91.github.io/repertoire-pro/next.html';
const LOCAL = process.env.RP_LOCAL || path.join(__dirname, '..', 'next.html');
const SPEC = process.env.RP_RECORDINGS || '';
const PLAY = +(process.env.RP_PLAY || 90);
const GATE_MS = 30;
const DUMP = process.env.RP_DUMP || '';

let fails = 0;
function ok(c, w) { console.log((c ? '  ✓ ' : '  ✗ ') + w); if (!c) fails++; }
function loud(lines) {
  const w = Math.max.apply(null, lines.map(l => l.length)) + 4;
  console.log('\n' + '='.repeat(w)); lines.forEach(l => console.log('  ' + l)); console.log('='.repeat(w) + '\n');
}
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

/* crossings: a position that moves left over time crosses `at` between two
   frames; the clock there is read off by straight-line interpolation */
function crossings(frames, key, idxOf, xOf, at) {
  const seen = new Map();   /* id -> [clock, x] from the previous frame */
  const out = new Map();
  for (const f of frames) {
    const list = f[key] || [];
    const here = new Map();
    for (const it of list) here.set(idxOf(it), xOf(it));
    for (const [id, x] of here) {
      const prev = seen.get(id);
      if (prev && !out.has(id) && prev[1] > at(f) && x <= at(f)) {
        const [a0, x0] = prev, a1 = f.a;
        const c = x0 === x ? a1 : a0 + (a1 - a0) * (x0 - at(f)) / (x0 - x);
        out.set(id, c);
      }
    }
    for (const [id, x] of here) seen.set(id, [f.a, x]);
  }
  return out;
}

function pair(onsets, starts, lo, hi) {
  /* starts: sorted crossing clocks. First start inside [T+lo, T+hi]. */
  const diffs = [];
  let k = 0;
  for (const T of onsets) {
    while (k < starts.length && starts[k] < T + lo) k++;
    if (k < starts.length && starts[k] <= T + hi) { diffs.push(starts[k] - T); k++; }
  }
  return diffs;
}

function summary(diffs) {
  const ms = diffs.map(d => d * 1000);
  return { n: ms.length, med: pct(ms, 0.5), p25: pct(ms, 0.25), p75: pct(ms, 0.75),
           p10: pct(ms, 0.1), p90: pct(ms, 0.9) };
}
const fmt = s => s.n ? ('median ' + (s.med >= 0 ? '+' : '') + s.med.toFixed(0) + 'ms   middle half ' +
  s.p25.toFixed(0) + ' to ' + s.p75.toFixed(0) + 'ms   p10-p90 ' + s.p10.toFixed(0) + ' to ' + s.p90.toFixed(0) +
  'ms   (' + s.n + ' phrases)') : 'no phrases paired';

(async () => {
  const recs = SPEC.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.indexOf(':');
    return i < 0 ? { label: path.basename(s), file: s } : { label: s.slice(0, i), file: s.slice(i + 1) };
  });
  const missing = recs.filter(r => !fs.existsSync(r.file));
  if (!recs.length || missing.length) {
    loud(['NO EVIDENCE: no real singing to measure placement against.',
          !recs.length ? 'RP_RECORDINGS is not set.' : 'not on disk: ' + missing.map(m => m.label).join(', '),
          'Note placement has NOT been measured.']);
    process.exit(1);
  }

  const results = {};
  for (const rec of recs) {
    console.log('\n' + rec.label);
    const browser = await chromium.launch({
      executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
             '--autoplay-policy=no-user-gesture-required']
    });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, permissions: ['microphone'] });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    if (fs.existsSync(LOCAL)) {
      const body = fs.readFileSync(LOCAL, 'utf8');
      await p.route('**/*', r => r.request().url() === URL_
        ? r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }) : r.continue());
    }
    await p.goto(URL_, { waitUntil: 'load', timeout: 180000 });
    await p.waitForTimeout(3500);
    await p.evaluate(() => { try { RPTour.stop(); } catch (e) {} localStorage.setItem('rp_tour_student', 'done'); });

    /* the sound: onsets from the file itself, and the song read */
    const prep = await p.evaluate(async (b64) => {
      const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const blob = new Blob([u], { type: 'audio/mpeg' });
      ensureCtx();
      const dec = await ctx.decodeAudioData(await blob.arrayBuffer());
      const sr = dec.sampleRate, L = dec.getChannelData(0);
      const R = dec.numberOfChannels > 1 ? dec.getChannelData(1) : L;
      const HOPS = Math.round(0.01 * sr), WIN = Math.round(0.02 * sr);
      const n = Math.floor((dec.length - WIN) / HOPS);
      const lg = new Float32Array(n);
      for (let k = 0; k < n; k++) {
        let s2 = 0; const a = k * HOPS;
        for (let i = 0; i < WIN; i++) { const v = (L[a + i] + R[a + i]) / 2; s2 += v * v; }
        lg[k] = Math.log10(Math.sqrt(s2 / WIN) || 1e-9);
      }
      let lo = Infinity, hi = -Infinity;
      for (let k = 0; k < n; k++) { if (lg[k] < lo) lo = lg[k]; if (lg[k] > hi) hi = lg[k]; }
      const B = 200, hist = new Array(B).fill(0);
      for (let k = 0; k < n; k++) hist[Math.min(B - 1, Math.floor((lg[k] - lo) / (hi - lo) * B))]++;
      let sum = 0; for (let i = 0; i < B; i++) sum += i * hist[i];
      let sumB = 0, wB = 0, best = 0, bestT = 0;
      for (let i = 0; i < B; i++) {
        wB += hist[i]; if (!wB) continue; const wF = n - wB; if (!wF) break;
        sumB += i * hist[i]; const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
        if (v > best) { best = v; bestT = i; }
      }
      const cut = lo + (bestT + 0.5) / B * (hi - lo);
      const onsets = [];
      let quiet = 0;
      for (let k = 0; k < n; k++) {
        if (lg[k] < cut) { quiet++; continue; }
        if (quiet >= 15) {
          let held = 0;
          for (let j = k; j < Math.min(n, k + 15); j++) if (lg[j] >= cut) held++;
          if (held >= 10) onsets.push(+(k * 0.01 + 0.01).toFixed(3));
        }
        quiet = 0;
      }
      const song = { id: 'pl' + Date.now(), title: 'measured', kind: 'song', blob: blob, addedAt: Date.now() };
      await RPFileMap.build(song);
      await dbPut('songs', song);
      if (!LIB.songs.some(x => x.id === song.id)) LIB.songs.push(song);
      window.__song = song;
      return { onsets, dur: dec.duration, sr,
               outL: (typeof ctx.outputLatency === 'number') ? ctx.outputLatency : null,
               baseL: (typeof ctx.baseLatency === 'number') ? ctx.baseLatency : null,
               notes: song.notes.map(x => [x.t, x.m]), bubbles: song.bubbles.map(b => [b.t, b.d]) };
    }, fs.readFileSync(rec.file).toString('base64'));

    const onsets = prep.onsets.filter(T => T > 2 && T < PLAY - 1);
    console.log('    ' + prep.onsets.length + ' phrase onsets in the file, ' + onsets.length +
                ' inside the ' + PLAY + 's measured; the browser reports output latency ' +
                (prep.outL == null ? 'n/a' : (prep.outL * 1000).toFixed(0) + 'ms') +
                ', base ' + (prep.baseL == null ? 'n/a' : (prep.baseL * 1000).toFixed(0) + 'ms'));

    /* THE PITCH TRACKER sing-along */
    const pt = await p.evaluate(async (secs) => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      window.__rpMeasure = [];
      await RPStudio.openWith(window.__song);
      await wait(secs * 1000);
      const out = window.__rpMeasure; window.__rpMeasure = null;
      try { RPStudio.stopAll(); } catch (e) {}
      return out.filter(f => f.s === 'pt');
    }, PLAY);
    const ptCross = crossings(pt, 'r', it => it[0], it => it[1], f => f.edge);
    const ptStarts = [...ptCross.values()].sort((a, b) => a - b);
    const ptDiffs = pair(onsets, ptStarts, -0.10, 0.25);

    /* LEARN A SONG */
    const ls = await p.evaluate(async (secs) => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      switchMode('song'); await wait(600);
      RPLearnSong.open(window.__song); await wait(900);
      window.__rpMeasure = [];
      document.getElementById('rpLsStart').click();
      await wait(3200);
      /* gold ahead of the bar, straight off the pixels: strong gold to the
         right of the white bar, sampled once a second */
      let goldAhead = 0, samples = 0;
      for (let k = 0; k < secs; k++) {
        await wait(1000);
        try {
          const cv = document.getElementById('rpLsCv');
          const last = window.__rpMeasure[window.__rpMeasure.length - 1];
          if (!cv || !last) continue;
          const dpr = cv.width / (cv.clientWidth || cv.width);
          const x0 = Math.ceil((last.head + 3) * dpr);
          const d = cv.getContext('2d').getImageData(x0, 0, cv.width - x0, cv.height).data;
          /* strong gold only: the fill and the old ring are near-opaque;
             the C-note guide lines are the same hue at a fifth of the
             strength, and counting them is what made the first version of
             this check report 60,000 pixels of nothing */
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] >= 180 && d[i] > 215 && d[i + 1] > 170 && d[i + 1] < 225 && d[i + 2] < 150) goldAhead++;
          }
          samples++;
        } catch (e) {}
      }
      const out = window.__rpMeasure; window.__rpMeasure = null;
      out.goldAhead = goldAhead; out.samples = samples;
      try { RPLearnSong.leave(); } catch (e) {}
      const frames = out.filter(f => f.s === 'ls');
      return { frames: frames, goldAhead: out.goldAhead, samples: out.samples };
    }, PLAY);
    const lsFrames = ls.frames;
    /* only bubbles that start a phrase: at least 0.15s after the one before */
    const phraseStart = new Set();
    prep.bubbles.forEach((b, j) => {
      if (j === 0 || b[0] - (prep.bubbles[j - 1][0] + prep.bubbles[j - 1][1]) >= 0.15) phraseStart.add(j);
    });
    const lsCross = crossings(lsFrames, 'b', it => it[0], it => it[1], f => f.head);
    const lsStarts = [...lsCross.entries()].filter(([j]) => phraseStart.has(j)).map(([, c]) => c).sort((a, b) => a - b);
    const lsDiffs = pair(onsets, lsStarts, -0.10, 0.25);

    /* the fill rule: any fill reaching past the bar */
    let aheadFrames = 0, aheadMax = 0, filledFrames = 0;
    for (const f of lsFrames) for (const it of (f.b || [])) {
      if (it[2] == null) continue;
      filledFrames++;
      const over = it[2] - f.head;
      if (over > 1) { aheadFrames++; if (over > aheadMax) aheadMax = over; }
    }

    /* where the lateness comes from, read straight off the stored data with
       no drawing involved: how late the trace's first voiced point is after
       the sound, and how much later the first bubble starts after that */
    const runStarts = [];
    const halfStep = prep.notes.length > 1 ? (prep.notes[1][0] - prep.notes[0][0]) / 2 : 0.025;
    prep.notes.forEach((x, i) => { if (x[1] != null && (i === 0 || prep.notes[i - 1][1] == null)) runStarts.push(x[0] - halfStep); });
    const bubStarts = prep.bubbles.filter((b, j) => phraseStart.has(j)).map(b => b[0]);
    const traceDiffs = pair(onsets, runStarts, -0.10, 0.25);
    const bubDiffs = pair(onsets, bubStarts, -0.10, 0.25);
    const sTR = summary(traceDiffs), sBU = summary(bubDiffs);
    console.log('    in the data   trace starts ' + fmt(sTR));
    console.log('                  bubbles start ' + fmt(sBU));

    /* what matters is the ear: the phone plays a sound outL after it is
       sent, so a note should reach the playhead outL after its place in
       the file. "as heard" takes the browser's own reported figure off. */
    const outL = prep.outL || 0;
    const ptHeard = ptDiffs.map(d => d - outL), lsHeard = lsDiffs.map(d => d - outL);
    const sPTh = summary(ptHeard), sLSh = summary(lsHeard);

    const sPT = summary(ptDiffs), sLS = summary(lsDiffs);
    results[rec.label] = { pt: sPT, ls: sLS, ptHeard: sPTh, lsHeard: sLSh, outL: prep.outL, baseL: prep.baseL,
                           fill: { aheadFrames, filledFrames, aheadMax } };
    console.log('    Pitch Tracker  as sent  ' + fmt(sPT));
    console.log('                   as heard ' + fmt(sPTh));
    console.log('    Learn a song   as sent  ' + fmt(sLS));
    console.log('                   as heard ' + fmt(sLSh));
    console.log('    fill past the bar in ' + aheadFrames + ' of ' + filledFrames + ' filled bubble-frames' +
                (aheadFrames ? ', by up to ' + aheadMax.toFixed(1) + 'px' : '') +
                '; strong gold to the right of the bar: ' + ls.goldAhead + ' pixels over ' + ls.samples + ' looks');
    if (DUMP) fs.writeFileSync(path.join(DUMP, 'place-' + rec.label.replace(/\W/g, '') + '.json'),
      JSON.stringify({ onsets, ptDiffs, lsDiffs, prep: { outL: prep.outL, baseL: prep.baseL } }));

    ok(sPT.n >= 8, rec.label + ': enough phrases paired on the Pitch Tracker (' + sPT.n + ')');
    ok(sLS.n >= 8, rec.label + ': enough phrases paired in Learn a song (' + sLS.n + ')');
    ok(sPTh.n && Math.abs(sPTh.med) <= GATE_MS, rec.label + ': Pitch Tracker puts a note at the playhead within ' + GATE_MS + 'ms of hearing it (' + (sPTh.n ? sPTh.med.toFixed(0) : '–') + 'ms)');
    ok(sLSh.n && Math.abs(sLSh.med) <= GATE_MS, rec.label + ': Learn a song puts a note at the bar within ' + GATE_MS + 'ms of hearing it (' + (sLSh.n ? sLSh.med.toFixed(0) : '–') + 'ms)');
    ok(aheadFrames === 0, rec.label + ': no fill ever reaches past the bar');
    ok(ls.goldAhead === 0, rec.label + ': nothing gold is drawn ahead of the bar (' + ls.goldAhead + ' pixels)');
    ok(errs.length === 0, rec.label + ': no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await browser.close();
  }
  console.log(fails ? '\nPLACEMENT TEST FAILED: ' + fails : '\nall good');
  process.exit(fails ? 1 : 0);
})();
