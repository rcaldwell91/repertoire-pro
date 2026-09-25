/* Repertoire Pro — a score that gives the same number every time.

   Robert, 25 Sep: "Replace the hit-rate measurement with a deterministic
   one: run the app's own scoring function on each recording's stored trace
   against its own bubbles - the same code path the screen uses, no
   microphone, no clock - so it gives the same number every run."

   The live-microphone measurement moved ten points between runs of an
   unchanged build, because a real-time capture is sampled on a clock that
   jitters. That noise belonged to the rig, and a gate that noisy could not
   decide anything. So this one has no microphone and no clock in it at all.

   Each recording is read by the app, cut into its bubbles, and then its own
   traced line is scored against them by RPLearnSong.scoreTrace - which calls
   the very function the screen calls every frame to credit a held note. The
   line the bubbles were cut from is the best performance that recording can
   give, so a low score here means the bubbles or the scoring are wrong.
   It runs twice and the two answers must be identical.

   The recordings never enter this repo; RP_RECORDINGS gives label:path
   pairs, and with none it says so and fails. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const URL_ = process.env.RP_URL || 'https://rcaldwell91.github.io/repertoire-pro/next.html';
const LOCAL = process.env.RP_LOCAL || path.join(__dirname, '..', 'next.html');
const SPEC = process.env.RP_RECORDINGS || '';
const HIT_PCT = 80;

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
  if (!recs.length || missing.length) {
    loud(['NO EVIDENCE: no real singing to score.',
          !recs.length ? 'RP_RECORDINGS is not set.' : 'not on disk: ' + missing.map(m => m.label).join(', '),
          'The score has NOT been checked against a real voice.']);
    process.exit(1);
  }
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox']
  });
  const p = await (await browser.newContext({ viewport: { width: 412, height: 900 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  if (fs.existsSync(LOCAL)) {
    const body = fs.readFileSync(LOCAL, 'utf8');
    await p.route('**/*', r => r.request().url() === URL_
      ? r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }) : r.continue());
  }
  await p.goto(URL_, { waitUntil: 'load', timeout: 180000 });
  await p.waitForTimeout(3500);

  for (const rec of recs) {
    console.log('\n' + rec.label);
    const r = await p.evaluate(async (b64) => {
      const bin = atob(b64), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const song = { id: 'sc' + Date.now(), title: 'measured', kind: 'song',
                     blob: new Blob([u], { type: 'audio/mpeg' }), addedAt: Date.now() };
      try { await RPFileMap.build(song); } catch (e) { return { err: String(e && e.message || e) }; }
      const a = RPLearnSong.scoreTrace(song.bubbles, song.notes);
      const b = RPLearnSong.scoreTrace(song.bubbles, song.notes);
      /* the same line an octave down, the way a man sings along with a man */
      const down = song.notes.map(q => ({ t: q.t, m: q.m == null ? null : q.m - 12 }));
      const exact = RPLearnSong.scoreTrace(song.bubbles, down);
      const any = RPLearnSong.scoreTrace(song.bubbles, down, true);
      const anyUp = RPLearnSong.scoreTrace(song.bubbles, song.notes, true);
      return { a, b, exact, any, anyUp, bubbles: song.bubbles.length, points: song.notes.length };
    }, fs.readFileSync(rec.file).toString('base64'));
    if (r.err) { ok(false, rec.label + ': ' + r.err); continue; }
    console.log('    ' + r.a.hit + ' of ' + r.a.total + ' notes hit (' + r.a.pct + '%), held ' + r.a.avg +
                '% of the way on average, from ' + r.points + ' points of line');
    ok(JSON.stringify(r.a) === JSON.stringify(r.b), rec.label + ': the same number both times');
    ok(r.a.total === r.bubbles, rec.label + ': every bubble was scored');
    ok(r.a.pct >= HIT_PCT, rec.label + ': the recording singing its own line hits ' + r.a.pct + '% (needs ' + HIT_PCT + ')');
    /* Robert, 25 Sep: a note counts only in its own octave unless Any
       octave is on */
    ok(r.exact.hit === 0, rec.label + ': the same line an octave down scores ' + r.exact.hit + ' notes with Any octave off');
    ok(JSON.stringify(r.any) === JSON.stringify(r.anyUp) && r.any.pct >= HIT_PCT,
       rec.label + ': with Any octave on it scores exactly what the line itself does (' + r.any.pct + '%)');
  }
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await browser.close();
  console.log(fails ? '\nSCORE TEST FAILED: ' + fails : '\nall good');
  process.exit(fails ? 1 : 0);
})();
