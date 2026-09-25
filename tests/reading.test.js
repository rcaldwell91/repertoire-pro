/* Repertoire Pro — a song is read while you wait for nothing, and it only
   ever sounds when you are there.

   Robert, 25 Sep, on his phone with wired headphones:

     "Robert opened All of Me in the Pitch Tracker, it sat reading, he left
      for another tab, and when the read finished the song started playing
      in the background."

     "All of Me sat at 'Waiting to be read — 0%' for minutes."

   So this checks, on his own recordings, with no stand-in audio:

     THE READ    progress moves inside the first second and never sits at
                 0% for two; a song he opens interrupts a background read
                 at once, the interrupted read carries on afterwards and
                 comes out exactly as an uninterrupted one; background
                 reading waits while anything is making a sound.
     PLAYING     a song may start once the reading is 8 seconds ahead of
                 it, stays at least 4 seconds behind the reading, and when
                 the reading falls behind it pauses with "Catching up…"
                 and carries on by itself.
     PRESENCE    on both screens, a song opened while it still needs
                 reading does not start if he has left the screen, or if
                 the page is hidden, when the reading gets far enough.

   The page going to the background is made the way the browser reports it
   - document.hidden and a visibilitychange event - since a headless test
   browser never hides a page itself.

   The recordings never enter this repo; RP_RECORDINGS gives label:path
   pairs, and with none it says so and fails. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const URL_ = process.env.RP_URL || 'https://rcaldwell91.github.io/repertoire-pro/next.html';
const LOCAL = process.env.RP_LOCAL || path.join(__dirname, '..', 'next.html');
const SPEC = process.env.RP_RECORDINGS || '';

let fails = 0;
function ok(c, w) { console.log((c ? '  ✓ ' : '  ✗ ') + w); if (!c) fails++; }
function loud(lines) {
  const w = Math.max.apply(null, lines.map(l => l.length)) + 4;
  console.log('\n' + '='.repeat(w)); lines.forEach(l => console.log('  ' + l)); console.log('='.repeat(w) + '\n');
}

(async () => {
  const recs = SPEC.split(',').map(s => s.trim()).filter(Boolean).map(s => {
    const i = s.indexOf(':');
    return i < 0 ? { label: path.basename(s), file: s } : { label: s.slice(0, i), file: s.slice(i + 1) };
  });
  const missing = recs.filter(r => !fs.existsSync(r.file));
  if (recs.length < 2 || missing.length) {
    loud(['NO EVIDENCE: the reading was not checked on real songs.',
          recs.length < 2 ? 'RP_RECORDINGS needs two recordings.' : 'not on disk: ' + missing.map(m => m.label).join(', ')]);
    process.exit(1);
  }
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
  await p.evaluate((files) => {
    try { RPTour.stop(); } catch (e) {}
    ['rp_tour_student', 'rp_tour_coach', 'rp_tip_tracker', 'rp_tip_song', 'rp_tip_lib', 'rp_tip_learnsong', 'rp_tip_voice']
      .forEach(k => localStorage.setItem(k, 'done'));
    window.__bytes = files.map(b64 => { const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; });
    let n = 0;
    window.__mk = (i) => ({ id: 'rd' + (++n) + '_' + Date.now(), title: 'Song ' + n, kind: 'song',
                            blob: new Blob([__bytes[i]], { type: 'audio/mpeg' }), addedAt: Date.now() });
    /* every sound the page starts, so the test can ask whether any is playing */
    window.__plays = [];
    const real = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { __plays.push(this); return real.apply(this, arguments); };
    window.__sounding = () => __plays.filter(el => !el.paused && !el.ended).length;
    window.__setHidden = (h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => h ? 'hidden' : 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    window.__holdRead = () => { RPFileMap.__hold = new Promise(r => { window.__releaseRead = () => { RPFileMap.__hold = null; r(); }; }); };
    window.__untilDone = (id) => new Promise(res => { const iv = setInterval(() => {
      const s = RPFileMap.stateOf(id); if (s && (s.st === 'done' || s.st === 'failed')) { clearInterval(iv); res(s.st); } }, 100); });
  }, recs.slice(0, 2).map(r => fs.readFileSync(r.file).toString('base64')));
  const quiet = () => p.evaluate(() => { try { RPStudio.stopAll(); } catch (e) {} try { RPLearnSong.leave(); } catch (e) {}
    try { RPOneSound.stopAll(); } catch (e) {} __plays.forEach(el => { try { el.pause(); } catch (e) {} }); });

  /* ---- THE READ ------------------------------------------------------ */
  console.log('\nthe read');
  const first = await p.evaluate(async () => {
    const s = __mk(1), t0 = performance.now();
    let firstMove = null, last0 = 0, at8 = null;
    const iv = setInterval(() => {
      const x = RPFileMap.stateOf(s.id); if (!x) return;
      const t = (performance.now() - t0) / 1000, pct = RPFileMap.pct(x);
      if (pct > 0 && firstMove == null) firstMove = t;
      if (pct === 0) last0 = t;
      if (at8 == null && x.readTo >= RPFileMap.LEAD_START) at8 = t;
    }, 50);
    await RPFileMap.ensure(s, true);
    clearInterval(iv);
    return { firstMove, last0, at8, total: (performance.now() - t0) / 1000, dur: RPFileMap.stateOf(s.id).dur };
  });
  console.log('    ' + recs[1].label + ': read ' + first.dur.toFixed(0) + 's of song in ' + first.total.toFixed(1) + 's (' +
              (first.dur / first.total).toFixed(1) + 'x real time); the figure first moved at ' + first.firstMove.toFixed(2) +
              's; 8 seconds read at ' + first.at8.toFixed(2) + 's');
  ok(first.firstMove != null && first.firstMove <= 1, 'the progress moves inside the first second (' + first.firstMove.toFixed(2) + 's)');
  ok(first.last0 < 2, 'it never shows 0% for two seconds (last at ' + first.last0.toFixed(2) + 's)');

  const pre = await p.evaluate(async () => {
    const A = __mk(0), B = __mk(1);
    RPFileMap.ensure(A).catch(() => {});                   /* the Library's quiet re-read */
    await new Promise(res => { const iv = setInterval(() => { const x = RPFileMap.stateOf(A.id);
      if (x && x.readTo >= 20) { clearInterval(iv); res(); } }, 20); });
    const before = RPFileMap.stateOf(A.id).readTo;
    const tB = performance.now();
    RPFileMap.ensure(B, true).catch(() => {});             /* he opens a song */
    const aNow = RPFileMap.stateOf(A.id).st, bNow = RPFileMap.stateOf(B.id).st;
    let bFirst = null;
    await new Promise(res => { const iv = setInterval(() => { const x = RPFileMap.stateOf(B.id);
      if (x && x.readTo > 0) { bFirst = (performance.now() - tB) / 1000; clearInterval(iv); res(); } }, 20); });
    await new Promise(r => setTimeout(r, 800));
    const aHeld = RPFileMap.stateOf(A.id).readTo;
    await __untilDone(B.id);
    const aAtBDone = RPFileMap.stateOf(A.id).readTo;
    await __untilDone(A.id);
    const Aref = __mk(0);
    await RPFileMap.build(Aref);
    return { before, aNow, bNow, bFirst, aHeld, aAtBDone, aDone: RPFileMap.stateOf(A.id).st,
             same: JSON.stringify(A.notes) === JSON.stringify(Aref.notes) && JSON.stringify(A.bubbles) === JSON.stringify(Aref.bubbles),
             pts: A.notes.length };
  });
  ok(pre.aNow === 'queued' && pre.bNow === 'reading', 'a song he opens interrupts the background read at once (' + pre.aNow + ' / ' + pre.bNow + ')');
  ok(pre.bFirst != null && pre.bFirst < 1.5, 'and its first notes are found ' + (pre.bFirst || 0).toFixed(2) + 's later');
  ok(pre.aAtBDone === pre.aHeld, 'the background read stays where it stopped until his song is read (' +
     pre.aHeld + 's, then ' + pre.aAtBDone + 's)');
  ok(pre.aDone === 'done', 'then the background read carries on and finishes');
  ok(pre.same, 'and comes out exactly as a read that was never interrupted (' + pre.pts + ' points)');

  const wait = await p.evaluate(async () => {
    const C = __mk(1);
    RPOneSound.claim('test-sound', () => {});
    RPFileMap.ensure(C).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));
    const during = Object.assign({}, RPFileMap.stateOf(C.id));
    RPOneSound.release('test-sound');
    const t0 = performance.now();
    await new Promise(res => { const iv = setInterval(() => { const x = RPFileMap.stateOf(C.id);
      if (x && x.readTo > 0) { clearInterval(iv); res(); } }, 20); });
    const after = (performance.now() - t0) / 1000;
    await __untilDone(C.id);
    return { during, after };
  });
  ok(wait.during.st === 'queued' && wait.during.readTo === 0, 'background reading waits while something is playing (' +
     wait.during.st + ', ' + wait.during.readTo + 's read)');
  ok(wait.after < 1.5, 'and starts once it stops (' + wait.after.toFixed(2) + 's)');

  /* ---- PRESENCE ------------------------------------------------------ */
  console.log('\nsound only when he is there');
  const cases = [
    { name: 'Pitch Tracker, left the screen', screen: 'pt', how: 'leave' },
    { name: 'Pitch Tracker, page hidden', screen: 'pt', how: 'hide' },
    { name: 'Learn a song, left the screen', screen: 'ls', how: 'leave' },
    { name: 'Learn a song, page hidden', screen: 'ls', how: 'hide' }
  ];
  for (const c of cases) {
    await quiet();
    const r = await p.evaluate(async (c) => {
      const s = __mk(c.screen === 'pt' ? 0 : 1);
      __holdRead();                                      /* keep it mid-read while he goes */
      if (c.screen === 'pt') await RPStudio.openWith(s);
      else {
        switchMode('song');
        await new Promise(r => setTimeout(r, 300));
        RPLearnSong.reset(); RPLearnSong.open(s);
        document.getElementById('rpLsStart').click();     /* Start, pressed while it reads */
      }
      await new Promise(r => setTimeout(r, 600));
      const midRead = RPFileMap.stateOf(s.id).readTo;
      if (c.how === 'leave') switchMode(c.screen === 'pt' ? 'lib' : 'free');
      else __setHidden(true);
      __releaseRead();
      await __untilDone(s.id);
      await new Promise(r => setTimeout(r, 1500));
      const sounding = __sounding();
      const playing = (window.RPStudio && RPStudio.overlay) ? 'tracker' : (RPLearnSong.isPlaying() ? 'learn' : '');
      if (c.how === 'hide') __setHidden(false);
      return { midRead, sounding, playing };
    }, c);
    ok(r.midRead < 8 && r.sounding === 0 && !r.playing, c.name + ': nothing plays when the reading gets there' +
       ' (left at ' + r.midRead + 's read; ' + r.sounding + ' sounding' + (r.playing ? ', ' + r.playing + ' playing' : '') + ')');
  }
  const refused = await p.evaluate(async () => {
    __setHidden(true);
    const claim = RPOneSound.claim('hidden-test', () => {});
    const a = new Audio(URL.createObjectURL(new Blob([__bytes[0]], { type: 'audio/mpeg' })));
    let refused = false;
    try { await a.play(); } catch (e) { refused = true; }
    __setHidden(false);
    return { claim, refused, paused: a.paused };
  });
  ok(refused.claim === null && refused.refused && refused.paused, 'while the page is hidden nothing may start a sound at all');

  /* ---- PLAYING WHILE IT READS ----------------------------------------- */
  console.log('\nplaying while it reads');
  await quiet();
  await p.evaluate(() => switchMode('free'));
  const pt = await p.evaluate(async () => {
    const s = __mk(1);
    RPStudio.openWith(s);
    /* stop the reading just after it can start, so it has to fall behind */
    await new Promise(res => { const iv = setInterval(() => { const x = RPFileMap.stateOf(s.id);
      if (x && x.readTo >= RPFileMap.LEAD_START) { clearInterval(iv); __holdRead(); res(); } }, 5); });
    const startRead = RPFileMap.stateOf(s.id).readTo;
    await new Promise(res => { const iv = setInterval(() => { if (RPStudio.overlay && RPStudio.overlay.audio &&
      !RPStudio.overlay.audio.paused) { clearInterval(iv); res(); } }, 20); });
    const a = RPStudio.overlay.audio;
    let worst = -1e9;
    const t0 = performance.now();
    await new Promise(res => { const iv = setInterval(() => {
      const x = RPFileMap.stateOf(s.id), over = a.currentTime - (x.readTo - RPFileMap.LEAD_MIN);
      if (!a.paused && over > worst) worst = over;
      if (RPStudio.catching || performance.now() - t0 > 20000) { clearInterval(iv); res(); } }, 20); });
    const caught = { catching: RPStudio.catching, paused: a.paused, at: +a.currentTime.toFixed(2), readTo: RPFileMap.stateOf(s.id).readTo };
    __releaseRead();
    const t1 = performance.now();
    await new Promise(res => { const iv = setInterval(() => {
      if ((!RPStudio.catching && !a.paused) || performance.now() - t1 > 8000) { clearInterval(iv); res(); } }, 20); });
    const back = { catching: RPStudio.catching, paused: a.paused, after: (performance.now() - t1) / 1000 };
    RPStudio.stopAll();
    return { startRead, worst, caught, back };
  });
  ok(pt.startRead >= 8, 'Pitch Tracker: the song starts once 8 seconds are read (' + pt.startRead + 's)');
  ok(pt.worst <= 0.1, 'it never plays closer than 4 seconds to the reading (at most ' + pt.worst.toFixed(2) + 's past)');
  ok(pt.caught.catching && pt.caught.paused, 'when the reading falls behind it pauses and says "Catching up…" (at ' +
     pt.caught.at + 's, read to ' + pt.caught.readTo + 's)');
  ok(!pt.back.catching && !pt.back.paused, 'and carries on by itself once the reading is ahead again (' + pt.back.after.toFixed(1) + 's)');

  await quiet();
  const ls = await p.evaluate(async () => {
    const s = __mk(0);
    switchMode('song');
    await new Promise(r => setTimeout(r, 300));
    RPLearnSong.reset(); RPLearnSong.open(s);
    document.getElementById('rpLsStart').click();
    await new Promise(res => { const iv = setInterval(() => { const x = RPFileMap.stateOf(s.id);
      if (x && x.readTo >= RPFileMap.LEAD_START) { clearInterval(iv); __holdRead(); res(); } }, 5); });
    const t0 = performance.now();
    await new Promise(res => { const iv = setInterval(() => {
      if (RPLearnSong.catching() || performance.now() - t0 > 25000) { clearInterval(iv); res(); } }, 20); });
    const caught = { catching: RPLearnSong.catching(), sounding: __sounding(), notes: RPLearnSong.notes().length };
    __releaseRead();
    const t1 = performance.now();
    await new Promise(res => { const iv = setInterval(() => {
      if ((!RPLearnSong.catching() && __sounding() > 0) || performance.now() - t1 > 8000) { clearInterval(iv); res(); } }, 20); });
    const back = { catching: RPLearnSong.catching(), sounding: __sounding() };
    RPLearnSong.leave();
    return { caught, back };
  });
  ok(ls.caught.notes > 0, 'Learn a song: the bubbles read so far are on the board while it reads (' + ls.caught.notes + ')');
  ok(ls.caught.catching && ls.caught.sounding === 0, 'Learn a song: when the reading falls behind it pauses and says "Catching up…"');
  ok(!ls.back.catching && ls.back.sounding > 0, 'and carries on by itself once the reading is ahead again');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await browser.close();
  console.log(fails ? '\nREADING TEST FAILED: ' + fails : '\nall good');
  process.exit(fails ? 1 : 0);
})();
