/* Repertoire Pro — Learn a song, proved on a real voice.

   Robert, 24 Sep: "Learn a song SHOWS the bubbles. They are for judging
   pitch and how long a note is held, and for the game on top of that."

   A bubble that cannot be hit is worse than no bubble, and a score that
   says a perfect performance was poor is worse than no score. So this does
   not check the code paths - it sings.

   Each of Robert's two recordings is opened in Learn a song AND fed to the
   microphone at the same time: the singer singing their own song, which is
   the best performance that recording can possibly give. If that scores
   low, the bubbles or the scoring are wrong, because the singer is not.

   The two clocks have to be lined up first, and by a long way: reading the
   file takes over a minute before the song starts, and the microphone's
   copy may have been running the whole time. Nothing about the offset is
   assumed - the singer's own line is compared against the song's trace at
   every offset across the whole recording, and the best match wins. The
   copy loops, so an offset always exists. That number is reported. Then the
   song is nudged by it, the scoring is reset, and the measurement starts.

   Scored over the stretch actually played, not the whole song - a full
   pass of both recordings is eight minutes of real time for no extra
   truth. Which stretch is reported alongside the number.

   The recordings never enter this repo. Paths come from RP_RECORDINGS as
   label:path pairs; with none it says so and fails, because an unmeasured
   claim is not a passing one. No synthetic tone will do: a tone has no
   consonants, and consonants are the whole difficulty. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const URL_ = process.env.RP_URL || 'https://rcaldwell91.github.io/repertoire-pro/next.html';
const LOCAL = process.env.RP_LOCAL || path.join(__dirname, '..', 'next.html');
const SPEC = process.env.RP_RECORDINGS || '';
const PLAY_SECS = 75;        /* the stretch measured, after alignment */
const MIC_SR = 16000;

let fails = 0;
function ok(c, w) { console.log((c ? '  ✓ ' : '  ✗ ') + w); if (!c) fails++; }
function loud(lines) {
  const w = Math.max.apply(null, lines.map(l => l.length)) + 4;
  console.log('\n' + '='.repeat(w));
  lines.forEach(l => console.log('  ' + l));
  console.log('='.repeat(w) + '\n');
}
const wait = ms => new Promise(r => setTimeout(r, ms));

async function page(browser, withRoute) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, permissions: ['microphone'] });
  const p = await ctx.newPage();
  if (withRoute && fs.existsSync(LOCAL)) {
    const body = fs.readFileSync(LOCAL, 'utf8');
    await p.route('**/*', r => r.request().url() === URL_
      ? r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }) : r.continue());
  }
  await p.goto(URL_, { waitUntil: 'load', timeout: 180000 });
  await p.waitForTimeout(3500);
  return p;
}

/* Chromium's fake microphone wants a 16-bit WAV. Make one once per
   recording and keep it beside the recording, outside the repo. */
async function toWav(rec) {
  const out = rec.file.replace(/\.[^.]+$/, '') + '.mic.wav';
  if (fs.existsSync(out)) return out;
  console.log('  (making a microphone copy of ' + rec.label + ' — once)');
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const p = await page(browser, true);
  const b64 = fs.readFileSync(rec.file).toString('base64');
  const data = await p.evaluate(async ([b64, sr]) => {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    ensureCtx();
    const dec = await ctx.decodeAudioData(await new Blob([u]).arrayBuffer());
    const off = new OfflineAudioContext(1, Math.ceil(dec.duration * sr), sr);
    const src = off.createBufferSource();
    src.buffer = dec; src.connect(off.destination); src.start();
    const r = await off.startRendering();
    const ch = r.getChannelData(0), n = ch.length;
    const buf = new Uint8Array(44 + n * 2), dv = new DataView(buf.buffer);
    const w = (o, t) => { for (let i = 0; i < t.length; i++) dv.setUint8(o + i, t.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true);
    dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      let v = Math.max(-1, Math.min(1, ch[i]));
      dv.setInt16(44 + i * 2, Math.round(v * 32700), true);
    }
    let s = '';
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, [b64, MIC_SR]);
  fs.writeFileSync(out, Buffer.from(data, 'base64'));
  await browser.close();
  return out;
}

(async () => {
  const recs = SPEC.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.indexOf(':');
    return i < 0 ? { label: path.basename(s), file: s } : { label: s.slice(0, i), file: s.slice(i + 1) };
  });
  const missing = recs.filter(r => !fs.existsSync(r.file));
  if (!recs.length || missing.length) {
    loud(['NO EVIDENCE: no real singing to measure against.',
          !recs.length ? 'RP_RECORDINGS is not set.'
                       : 'these are not on disk: ' + missing.map(m => m.label).join(', '),
          'Learn a song has NOT been proved on a real voice.']);
    process.exit(1);
  }

  for (const rec of recs) {
    console.log('\n' + rec.label);
    const wav = await toWav(rec);
    const browser = await chromium.launch({
      executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
             '--use-file-for-fake-audio-capture=' + wav, '--autoplay-policy=no-user-gesture-required']
    });
    const p = await page(browser, true);
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.evaluate(() => { try { RPTour.stop(); } catch (e) {} localStorage.setItem('rp_tour_student', 'done'); });

    const b64 = fs.readFileSync(rec.file).toString('base64');
    const built = await p.evaluate(async (b64) => {
      const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const song = { id: 'ls' + Date.now(), title: 'measured', kind: 'song',
                     blob: new Blob([u], { type: 'audio/mpeg' }), addedAt: Date.now() };
      try { await RPFileMap.build(song); } catch (e) { return { err: String(e && e.message || e) }; }
      window.__song = song;
      return { points: song.notes.length, bubbles: (song.bubbles || []).length };
    }, b64);
    if (built.err) { ok(false, rec.label + ': ' + built.err); await browser.close(); continue; }

    /* open it, start it, and let both clocks run */
    const opened = await p.evaluate(async () => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      /* the screen has to be the one on show: Learn a song's draw loop does
         nothing at all while its canvas is hidden, which is correct on a
         phone and silent in a test - no error, just zeroes everywhere */
      switchMode('song');
      await wait(600);
      RPLearnSong.open(window.__song);
      await wait(900);
      const b = document.getElementById('rpLsStart');
      if (!b) return { err: 'no Start button' };
      b.click();
      await wait(16000);                    /* 3s count-in, then 13s running */
      const ins = RPLearnSong.inspect();
      const cv = document.getElementById('rpLsCv');
      return { notes: ins.notes.length, playing: ins.playing, t: ins.t,
               trail: ins.trail.length, heard: ins.trail.filter(x => x.m != null).length,
               onScreen: !!(cv && cv.offsetParent !== null) };
    });
    if (opened.err) { ok(false, rec.label + ': ' + opened.err); await browser.close(); continue; }
    ok(opened.notes > 0, rec.label + ': ' + opened.notes + ' notes to hit, drawn from the recording');
    ok(opened.notes === built.bubbles, rec.label + ': the notes on screen are the ones stored with the song');
    ok(opened.playing === true, rec.label + ': the song is playing');
    ok(opened.onScreen === true, rec.label + ': the screen is the one on show, so it is drawing');
    ok(opened.heard > 40, rec.label + ': the microphone is hearing the singer (' + opened.heard + ' of ' + opened.trail + ' reads)');

    /* line the microphone's copy up with the song */
    const align = await p.evaluate(() => {
      const ins = RPLearnSong.inspect();
      const trace = window.__song.notes;
      const at = new Map();
      trace.forEach(p2 => { if (p2.m != null) at.set(Math.round(p2.t * 20), p2.m); });
      const live = ins.trail.filter(x => x.m != null);
      const span = trace.length ? trace[trace.length - 1].t : 0;
      const tryD = (D) => {
        let good = 0, seen = 0;
        for (const x of live) {
          const m2 = at.get(Math.round((x.t + D) * 20));
          if (m2 == null) continue;
          seen++;
          const off = Math.abs(((x.m - m2 + 6) % 12 + 12) % 12 - 6);
          if (off <= 1) good++;
        }
        return seen > 40 ? good / seen : -1;
      };
      /* coarse pass over the whole recording, then fine around the winner.
         A twentieth of a second is a coarse step next to a note that only
         lasts three of them: the same build scored 69% and 61% on two runs
         purely because the alignment landed on a different step. That noise
         belongs to this rig, not to the app, so the second pass takes it
         down to a hundredth. The measure is still the pitch match, never
         the score, or the rig would just be tuning itself to pass. */
      let best = { d: 0, score: -1 };
      for (let k = 0; k <= Math.round(span * 20); k++) {
        const D = k / 20, sc = tryD(D);
        if (sc > best.score) best = { d: D, score: sc };
      }
      for (let k = -5; k <= 5; k++) {
        const D = Math.max(0, best.d + k / 100), sc = tryD(D);
        if (sc > best.score) best = { d: D, score: sc };
      }
      return best;
    });
    console.log('    the microphone runs ' + align.d.toFixed(2) + 's ahead of the song ' +
                '(' + Math.round(align.score * 100) + '% of the line matches there)');
    ok(align.score >= 0.5, rec.label + ': the microphone is singing the same song');

    const scored = await p.evaluate(async ([D, secs]) => {
      const wait = ms => new Promise(r => setTimeout(r, ms));
      RPLearnSong.seek(D);
      await wait(400);
      RPLearnSong.reset();
      const from = RPLearnSong.inspect().t;
      await wait(3000);
      const early = RPLearnSong.inspect();
      let filling = 0;
      for (const k in early.held) filling++;
      await wait(secs * 1000);
      const ins = RPLearnSong.inspect();
      const to = ins.t;
      /* only the notes actually played in that stretch */
      const rows = [];
      ins.notes.forEach((n, i) => {
        if (n.t < from || n.t + (n.d || 0.4) > to) return;
        const frac = Math.min(1, (ins.held[i] || 0) / (n.d || 0.4));
        rows.push({ m: n.m, frac: frac });
      });
      const hit = rows.filter(r => r.frac >= 0.5).length;
      const avg = rows.length ? rows.reduce((a, b) => a + b.frac, 0) / rows.length : 0;
      /* how fast the draw loop actually ran, because hold time is real
         elapsed time now and a slow loop is worth knowing about */
      let fps = 0;
      await new Promise(res => {
        let n = 0; const t0 = performance.now();
        const tick = () => { if (++n < 30) requestAnimationFrame(tick);
          else { fps = Math.round(n / ((performance.now() - t0) / 1000)); res(); } };
        requestAnimationFrame(tick);
      });
      /* is anything gold actually on the canvas */
      let gold = 0;
      try {
        const cv = document.getElementById('rpLsCv');
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        for (let i = 0; i < d.length; i += 16) {
          if (d[i] > 170 && d[i + 1] > 140 && d[i + 1] < 235 && d[i + 2] < 150) gold++;
        }
      } catch (e) {}
      return { fps: fps, from: from, to: to, played: rows.length, hit: hit,
               pct: rows.length ? Math.round(100 * hit / rows.length) : 0,
               avg: Math.round(100 * avg), fillingEarly: filling,
               fillingLate: Object.keys(ins.held).length, gold: gold };
    }, [align.d, PLAY_SECS]);

    console.log('    sang from ' + scored.from.toFixed(0) + 's to ' + scored.to.toFixed(0) + 's — ' +
                scored.played + ' notes came round, ' + scored.hit + ' hit, held ' + scored.avg +
                '% on average (screen drawing at ' + scored.fps + 'fps)');
    ok(scored.gold > 50, rec.label + ': the bubbles are on the screen (' + scored.gold + ' gold pixels)');
    ok(scored.fillingLate > scored.fillingEarly,
       rec.label + ': the bubbles fill as the song runs (' + scored.fillingEarly + ' → ' + scored.fillingLate + ' touched)');
    ok(scored.played > 20, rec.label + ': enough notes came round to judge it (' + scored.played + ')');
    /* Robert, 25 Sep: the hit rate moved ten points between runs of an
       unchanged build - a live capture sampled on a jittering clock - so it
       is printed here but no longer decides anything. tests/score.test.js
       gives a steady one. This test proves the parts only a live
       microphone can: the bubbles are on screen and they fill. */
    console.log('    (live hit rate this run ' + scored.pct + '% - for information only)');
    ok(errs.length === 0, rec.label + ': no page errors' + (errs.length ? ': ' + errs[0] : ''));
    await browser.close();
  }

  console.log(fails ? '\nLEARN A SONG TEST FAILED: ' + fails : '\nall good');
  process.exit(fails ? 1 : 0);
})();
