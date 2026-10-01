/* Repertoire Pro — nothing starts until the singer presses Start, and
   ending means ending.

   Robert, 1 Oct:
     1. Every exercise run screen opens paused, with one button: Start. The
        clock, mic, guide notes and siren glide begin only on that tap -
        from every way in: Train cards, Home Start, routines, goals, coach
        work.
     2. Routines never chain by themselves. When a step ends: "Next: [name]",
        Start and End session. End session goes back to where it started.
     3. Outside a routine, ending an exercise returns to its page.
     4. Timed: after a second of quiet, stop the clock and show the result.
        Never launch anything after.
     5. Hold a note: no 1.5-second auto-advance; a Next button.
     6. Tips never appear over a running exercise.
     7. Home's Today card lists exactly the steps its Start runs.

   Real browser, the built page. The microphone is fed Robert's own singing
   (RP_MIC, a WAV): three seconds of it and then real silence, because his
   recording never drops to the quiet the timed exercise listens for - its
   quietest moments are room noise at 0.008, over the 0.005 line - and the
   point here is to hear a real voice stop.
   Every sound the page starts is logged - oscillators, audio buffers longer
   than a click-free unlock, audio elements - and so is every request for the
   microphone. Each way in starts from a freshly loaded page. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const URL_ = process.env.RP_URL || 'https://rcaldwell91.github.io/repertoire-pro/next.html';
const LOCAL = process.env.RP_LOCAL || path.join(__dirname, '..', 'next.html');
const MIC = process.env.RP_MIC || '';
const IDLE = 5000;
/* ONLY=idle,routine,quiet,ladderend,hiss,ladder,hold,tips,home runs just those parts */
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = k => !ONLY.length || ONLY.indexOf(k) >= 0;

let fails = 0;
function ok(c, w) { console.log((c ? '  ✓ ' : '  ✗ ') + w); if (!c) fails++; }

const INSTRUMENT = () => {
  window.__snd = []; window.__gum = 0;
  const S = AudioScheduledSourceNode.prototype.start;
  AudioScheduledSourceNode.prototype.start = function () {
    const real = this instanceof OscillatorNode || (this.buffer && this.buffer.duration > 0.05);
    if (real) __snd.push({ t: performance.now(), k: this.constructor.name });
    return S.apply(this, arguments);
  };
  const P = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { __snd.push({ t: performance.now(), k: 'media' }); return P.apply(this, arguments); };
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const G = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function () { __gum++; return G.apply(null, arguments); };
  }
};

(async () => {
  if (!MIC || !fs.existsSync(MIC)) {
    console.log('\nNO EVIDENCE: RP_MIC must be a WAV of a real voice, to feed the microphone.\n');
    process.exit(1);
  }
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
           '--use-file-for-fake-audio-capture=' + MIC, '--autoplay-policy=no-user-gesture-required']
  });
  const body = fs.existsSync(LOCAL) ? fs.readFileSync(LOCAL, 'utf8') : null;
  const errs = [];

  async function fresh(opts) {
    opts = opts || {};
    const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, permissions: ['microphone'] });
    await ctx.addInitScript(INSTRUMENT);
    await ctx.addInitScript((tips) => {
      try {
        localStorage.setItem('rp_tour_student', 'done');
        if (!tips) ['tracker', 'voice', 'guided', 'ladder', 'match', 'sustain', 'range', 'keys', 'ear']
          .forEach(k => localStorage.setItem('rp_tip_' + k, 'done'));
      } catch (e) {}
    }, !!opts.tips);
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    p.on('dialog', d => d.accept().catch(() => {}));
    if (body) await p.route('**/*', r => r.request().url() === URL_
      ? r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }) : r.continue());
    await p.goto(URL_, { waitUntil: 'load', timeout: 180000 });
    await p.waitForTimeout(3500);
    await p.evaluate(() => { try { RPTour.stop(); } catch (e) {} const o = document.getElementById('rpSheet'); if (o) o.style.display = 'none'; });
    return { p, ctx };
  }

  /* what is going on right now, read off the page itself */
  const look = (p, since) => p.evaluate((since) => {
    const vis = el => !!(el && el.offsetParent !== null);
    const big = document.getElementById('gBig');
    const clock = vis(big) ? parseFloat(big.textContent) || 0 : 0;
    let running = [];
    try { if (G.running) running.push('ladder'); } catch (e) {}
    try { if (MATCH.active) running.push('match'); } catch (e) {}
    try { if (SUS.running) running.push('hold'); } catch (e) {}
    try { if (window.RPInterval && RPInterval.running()) running.push('interval'); } catch (e) {}
    const buttons = [...document.querySelectorAll('button')].filter(vis).map(b => b.innerText.trim());
    const card = document.getElementById('rpTourCard');
    return {
      sounds: __snd.filter(s => s.t >= since).length,
      soundsAll: __snd.length,
      gum: __gum,
      micOn: (() => { try { return !!MIC.on; } catch (e) { return false; } })(),
      clock, running,
      starts: buttons.filter(t => t === 'Start').length,
      buttons,
      text: (document.querySelector('.mode.active') || document.body).innerText,
      mode: (() => { try { return state.mode; } catch (e) { return ''; } })(),
      /* the card is position:fixed, so it has no offsetParent: measure it */
      tip: !!(card && getComputedStyle(card).display !== 'none' && getComputedStyle(card).visibility !== 'hidden' &&
              card.getBoundingClientRect().height > 0),
      routine: (() => { try { return !!V10.routineState.on; } catch (e) { return false; } })()
    };
  }, since);
  const now = p => p.evaluate(() => performance.now());
  const clickText = (p, txt) => p.evaluate((txt) => {
    const b = [...document.querySelectorAll('button')].find(x => x.offsetParent !== null && x.innerText.trim() === txt);
    if (b) b.click();
    return !!b;
  }, txt);

  /* opened, then five seconds of nothing; then Start, and it runs */
  async function idleThenStart(name, open) {
    const { p, ctx } = await fresh();
    try {
      const t0 = await now(p);
      await open(p);
      await p.waitForTimeout(IDLE);
      const a = await look(p, t0);
      ok(a.sounds === 0 && a.gum === 0 && !a.micOn && a.clock === 0 && !a.running.length && a.starts >= 1,
         name + ': five seconds after opening — ' +
         (a.sounds ? a.sounds + ' sounds, ' : 'silent, ') + (a.gum || a.micOn ? 'mic opened, ' : 'mic closed, ') +
         'clock ' + a.clock + (a.running.length ? ', running: ' + a.running.join(' ') : '') +
         (a.starts ? ', Start showing' : ', no Start button'));
      const t1 = await now(p);
      const pressed = await clickText(p, 'Start');
      await p.waitForTimeout(3000);
      const b = await look(p, t1);
      const runs = b.sounds > 0 || b.gum > a.gum || b.micOn || b.clock > 0 || b.running.length > 0;
      ok(pressed && runs, name + ': after Start it runs (' + [b.sounds ? b.sounds + ' sounds' : '', b.micOn ? 'mic on' : '',
         b.clock ? 'clock ' + b.clock : '', b.running.join(' ')].filter(Boolean).join(', ') + ')');
    } catch (e) { ok(false, name + ': ' + e.message); }
    await ctx.close();
  }

  const trainCard = id => async p => {
    await p.evaluate(() => { switchMode('train'); });
    await p.waitForTimeout(700);
    await p.evaluate(() => RPTrain.all());
    await p.waitForTimeout(700);
    await p.evaluate((id) => document.querySelector('[data-exstart="' + id + '"]').click(), id);
  };
  const pitchGame = tool => async p => {
    await p.evaluate(() => { switchMode('train'); });
    await p.waitForTimeout(700);
    await p.evaluate(() => RPTrain.category('pitch'));
    await p.waitForTimeout(700);
    await p.evaluate((t) => document.querySelector('[data-tool="' + t + '"]').click(), tool);
  };
  const drill = kind => async p => {
    await p.evaluate(() => { switchMode('train'); });
    await p.waitForTimeout(700);
    await p.evaluate(() => RPTrain.category('ear'));
    await p.waitForTimeout(700);
    await p.evaluate((k) => document.querySelector('[data-drill="' + k + '"]').click(), kind);
  };
  const trainRoutine = key => async p => {
    await p.evaluate(() => { switchMode('train'); });
    await p.waitForTimeout(900);
    await p.evaluate((k) => document.querySelector('[data-routine="' + k + '"]').click(), key);
  };
  const homeStart = async p => {
    await p.evaluate(() => { switchMode('home'); });
    await p.waitForTimeout(1800);
    await p.evaluate(() => document.getElementById('rpTodayGo').click());
  };
  const goal = async p => {
    await p.evaluate(() => { switchMode('train'); RPGoals.open('high'); });
    await p.waitForTimeout(900);
    await p.evaluate(() => [...document.querySelectorAll('[data-start]')].find(b => b.offsetParent !== null).click());
  };
  const coachWork = async p => {
    await p.evaluate(() => RPWork.open({ id: 'test-a1', title: 'Lip trills', app_ex_id: 'liptrill' }));
  };

  if (want('idle')) {
  console.log('\nnothing starts until Start');
  for (const [name, id] of [['Train card · guided (Straw)', 'straw'], ['Train card · timed (Hiss)', 'hiss'],
                            ['Train card · breath cycle', 'farinelli'], ['Train card · siren glide', 'siren'],
                            ['Train card · scale ladder', 'liptrill'], ['Train card · hold', 'sustain']]) {
    await idleThenStart(name, trainCard(id));
  }
  await idleThenStart('Train · Match the note', pitchGame('btnMatch'));
  await idleThenStart('Train · Hold a note', pitchGame('btnSustain'));
  await idleThenStart('Train · Hold the interval', pitchGame('rpIntervalGo'));
  for (const k of ['tonic', 'degree', 'singdeg', 'hilo']) await idleThenStart('Train · ear drill ' + k, drill(k));
  await idleThenStart('Train · Quiet session', trainRoutine('quiet'));
  await idleThenStart('Train · Cool-down', trainRoutine('cool'));
  await idleThenStart('Home · Start', homeStart);
  await idleThenStart('Goals · Start this one', goal);
  await idleThenStart('Coach work', coachWork);
  }

  /* ---- routines ---------------------------------------------------- */
  if (want('routine')) console.log('\nroutines never chain by themselves');
  if (want('routine')) {
    const { p, ctx } = await fresh();
    try {
      const rt = await p.evaluate(() => { const P = V10.P || {}; const r = P.quietDefault ? V10.ROUTINES.quiet : V10.ROUTINES[P.level || 1];
        return { name: r.name, steps: r.steps.map(id => V10.exById(id).name), kinds: r.steps.map(id => (V10.exById(id).engine || {}).kind) }; });
      await homeStart(p);
      await p.waitForTimeout(1500);
      await clickText(p, 'Start');
      await p.waitForTimeout(2500);
      /* step 1: Done (or End exercise, whichever this step has) */
      const t1 = await now(p);
      const ended1 = await p.evaluate(() => {
        for (const id of ['gQuit', 'btnTrainStop', 'btnSusQuit']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); return id; } }
        return null;
      });
      await p.waitForTimeout(IDLE);
      const a = await look(p, t1);
      const want1 = 'Next: ' + rt.steps[1];
      ok(ended1 && a.sounds === 0 && a.running.length === 0 && a.text.indexOf(want1) >= 0 &&
         a.buttons.indexOf('Start') >= 0 && a.buttons.indexOf('End session') >= 0,
         rt.name + ', step 1 (' + rt.steps[0] + ') ended: five seconds later ' + (a.sounds ? a.sounds + ' sounds' : 'nothing playing') +
         ', ' + (a.text.indexOf(want1) >= 0 ? '"' + want1 + '" showing' : 'no "' + want1 + '"') +
         (a.buttons.indexOf('End session') >= 0 ? ' with Start and End session' : ''));
      /* step 2 is a scale ladder: Start, then End exercise */
      await clickText(p, 'Start');
      await p.waitForTimeout(4000);
      const r2 = await look(p, t1);
      ok(r2.running.indexOf('ladder') >= 0 || r2.sounds > 0, 'Start runs step 2 (' + rt.steps[1] + ', a ' + rt.kinds[1] + ')');
      const t2 = await now(p);
      await p.evaluate(() => { for (const id of ['gQuit', 'btnTrainStop', 'btnSusQuit']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); return; } } });
      await p.waitForTimeout(IDLE);
      const b = await look(p, t2);
      const want2 = 'Next: ' + rt.steps[2];
      ok(b.sounds === 0 && b.running.length === 0 && b.text.indexOf(want2) >= 0,
         'step 2 ended: five seconds later ' + (b.sounds ? b.sounds + ' sounds' : 'nothing playing') + ', ' +
         (b.text.indexOf(want2) >= 0 ? '"' + want2 + '" showing' : 'no "' + want2 + '"'));
      await clickText(p, 'End session');
      await p.waitForTimeout(1500);
      const c = await look(p, t2);
      ok(!c.routine && c.mode === 'home' && c.sounds === 0, 'End session leaves the routine and goes back to where it started (' + c.mode + ')');
    } catch (e) { ok(false, 'routine: ' + e.message); }
    await ctx.close();
  }
  if (want('quiet')) {
    const { p, ctx } = await fresh();
    try {
      await trainRoutine('quiet')(p);
      await p.waitForTimeout(1500);
      await clickText(p, 'Start');
      /* hiss: sing, stop; it stops itself after a second of quiet */
      const t0 = await now(p);
      let stopped = false;
      for (let i = 0; i < 60 && !stopped; i++) {
        await p.waitForTimeout(500);
        stopped = await p.evaluate(() => /Next: /.test((document.querySelector('.mode.active') || document.body).innerText));
      }
      const t1 = await now(p);
      await p.waitForTimeout(IDLE);
      const a = await look(p, t1);
      ok(stopped && a.sounds === 0 && a.running.length === 0 && /Next: /.test(a.text),
         'Quiet session, the timed step stops itself on a second of quiet: ' + (stopped ? '"Next:" showing' : 'it never stopped') +
         ', and five seconds later ' + (a.sounds ? a.sounds + ' sounds' : 'nothing playing'));
      await clickText(p, 'End session');
      await p.waitForTimeout(1200);
      const c = await look(p, t1);
      ok(!c.routine && c.mode === 'train', 'End session goes back to Train, where it started (' + c.mode + ')');
    } catch (e) { ok(false, 'quiet routine: ' + e.message); }
    await ctx.close();
  }

  /* a scale ladder that reaches its end inside a routine. The song runs for
     minutes, so the end is the same call the app makes at the last beat */
  if (want('ladderend')) {
    const { p, ctx } = await fresh();
    try {
      await homeStart(p);
      await p.waitForTimeout(1500);
      await clickText(p, 'Start');
      await p.waitForTimeout(2000);
      await p.evaluate(() => document.getElementById('gQuit').click());
      await p.waitForTimeout(1200);
      await clickText(p, 'Start');
      await p.waitForTimeout(4000);
      const t1 = await now(p);
      await p.evaluate(() => stopRun(true));
      await p.waitForTimeout(IDLE);
      const a = await look(p, t1);
      ok(a.sounds === 0 && a.running.length === 0 && /Next: Sirens/.test(a.text),
         'a scale ladder that reaches its end in a routine: five seconds later ' + (a.sounds ? a.sounds + ' sounds' : 'nothing playing') +
         ', ' + (/Next: Sirens/.test(a.text) ? '"Next: Sirens" showing' : 'no "Next:" screen'));
    } catch (e) { ok(false, 'ladder end in a routine: ' + e.message); }
    await ctx.close();
  }

  /* ---- outside a routine ------------------------------------------- */
  if (want('hiss') || want('ladder')) console.log('\noutside a routine, ending means ending');
  if (want('hiss')) {
    const { p, ctx } = await fresh();
    try {
      await trainCard('hiss')(p);
      await p.waitForTimeout(1200);
      await clickText(p, 'Start');
      let res = '';
      for (let i = 0; i < 60 && !res; i++) {
        await p.waitForTimeout(500);
        res = await p.evaluate(() => { const s = document.getElementById('gSub'); return s && /Stopped/.test(s.textContent) ? s.textContent : ''; });
      }
      const c1 = await p.evaluate(() => document.getElementById('gBig').textContent);
      const t1 = await now(p);
      await p.waitForTimeout(IDLE);
      const a = await look(p, t1);
      const c2 = await p.evaluate(() => { const b = document.getElementById('gBig'); return b && b.offsetParent !== null ? b.textContent : null; });
      ok(!!res && c2 === c1 && a.sounds === 0 && !/Next: /.test(a.text),
         'Hiss stops itself and shows the result (' + (res || 'no result') + '); five seconds later the clock still reads ' + c2 +
         ' and ' + (a.sounds ? a.sounds + ' sounds started' : 'nothing has started'));
      await clickText(p, 'Done');
      await p.waitForTimeout(1500);
      const b = await look(p, t1);
      const page = await p.evaluate(() => { const h = document.querySelector('#modePage h1, #modePage .rp-page-title'); return h ? h.textContent : (document.querySelector('#modePage') || {}).innerText || ''; });
      ok(/Hiss/i.test(page) && b.sounds === 0, 'Done returns to the exercise\'s own page (' + (page || '').slice(0, 40) + ')');
    } catch (e) { ok(false, 'hiss: ' + e.message); }
    await ctx.close();
  }
  if (want('ladder')) {
    const { p, ctx } = await fresh();
    try {
      await trainCard('liptrill')(p);
      await p.waitForTimeout(1200);
      await clickText(p, 'Start');
      await p.waitForTimeout(4000);
      const t1 = await now(p);
      await p.evaluate(() => document.getElementById('btnTrainStop').click());   /* "‹ Exercises" */
      await p.waitForTimeout(IDLE);
      const a = await look(p, t1);
      const page = await p.evaluate(() => { const h = document.querySelector('#modePage h1'); return h ? h.textContent : ''; });
      ok(a.sounds === 0 && a.running.length === 0 && /lip trill/i.test(page),
         'A scale ladder ended by hand returns to its own page (' + page + ') and nothing starts');
    } catch (e) { ok(false, 'ladder end: ' + e.message); }
    await ctx.close();
  }

  /* ---- hold a note: Next, not a timer -------------------------------- */
  if (want('hold')) console.log('\nhold a note');
  if (want('hold')) {
    const { p, ctx } = await fresh();
    try {
      await pitchGame('btnSustain')(p);
      await p.waitForTimeout(1200);
      await clickText(p, 'Start');
      let res = '';
      for (let i = 0; i < 40 && !res; i++) {
        await p.waitForTimeout(500);
        res = await p.evaluate(() => { const r = document.getElementById('susResult'); return r && /steady/.test(r.textContent) ? r.textContent : ''; });
      }
      const round1 = await p.evaluate(() => document.getElementById('susRound').textContent);
      await p.waitForTimeout(3500);
      const after = await look(p, await now(p));
      const round2 = await p.evaluate(() => document.getElementById('susRound').textContent);
      ok(!!res && round2 === round1 && after.buttons.indexOf('Next') >= 0,
         'after a hold (' + (res || 'none') + ') it waits on ' + round1 + ' with a Next button, 3.5s later still ' + round2);
      await clickText(p, 'Next');
      await p.waitForTimeout(600);
      const round3 = await p.evaluate(() => document.getElementById('susRound').textContent);
      ok(round3 !== round1, 'Next moves on (' + round3 + ')');
    } catch (e) { ok(false, 'hold: ' + e.message); }
    await ctx.close();
  }

  /* ---- tips ---------------------------------------------------------- */
  if (want('tips')) console.log('\ntips never cover a running exercise');
  if (want('tips')) {
    let over = [];
    for (const [name, open] of [['Match the note', pitchGame('btnMatch')], ['Straw', trainCard('straw')],
                                ['Scale ladder', trainCard('liptrill')], ['Hold a note', pitchGame('btnSustain')],
                                ['Ear drill', drill('hilo')]]) {
      const { p, ctx } = await fresh({ tips: true });
      try {
        /* from the moment it opens: a tip card on screen while anything runs */
        const watch = async (ms) => {
          for (let i = 0; i < ms / 300; i++) {
            await p.waitForTimeout(300);
            const a = await look(p, 0);
            if (a.tip && (a.running.length || a.clock > 0 || a.soundsAll > 0)) return true;
          }
          return false;
        };
        await open(p);
        let hit = await watch(3600);
        if (!hit) { await clickText(p, 'Start'); hit = await watch(4200); }
        if (hit) over.push(name);
      } catch (e) { over.push(name + ' (' + e.message + ')'); }
      await ctx.close();
    }
    ok(over.length === 0, over.length ? 'a tip covered: ' + over.join(', ') : 'no tip card over any running exercise (five tried, tips not yet seen)');
  }

  /* ---- Home's card -------------------------------------------------- */
  if (want('home')) console.log('\nHome\'s Today card');
  if (want('home')) {
    const { p, ctx } = await fresh();
    try {
      await p.evaluate(() => switchMode('home'));
      await p.waitForTimeout(2000);
      const r = await p.evaluate(() => {
        const P = V10.P || {}; const rt = P.quietDefault ? V10.ROUTINES.quiet : V10.ROUTINES[P.level || 1];
        const card = document.getElementById('rpToday');
        return { steps: rt.steps.map(id => V10.exById(id).name), mins: rt.mins,
                 rows: [...card.querySelectorAll('.planstep .pt')].map(x => x.textContent.trim()),
                 go: document.getElementById('rpTodayGo').textContent, text: card.innerText };
      });
      ok(JSON.stringify(r.rows) === JSON.stringify(r.steps), 'the card lists exactly the steps Start runs (' + r.rows.length + ' of ' + r.steps.length + ': ' + r.rows.join(', ') + ')');
      ok(r.go.indexOf(r.mins + ' min') >= 0, 'with their real total, ' + r.mins + ' min ("' + r.go + '")');
    } catch (e) { ok(false, 'Home card: ' + e.message); }
    await ctx.close();
  }

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await browser.close();
  console.log(fails ? '\nFLOW TEST FAILED: ' + fails : '\nall good');
  process.exit(fails ? 1 : 0);
})();
