/* Learn a song, on the built app, in a real Chrome, against the real
   separator and the real sign-in (the permanent test account), with songs
   from RP_RECORDINGS ("Name:path,Name:path", kept outside the repo). Prints
   one line per check; exits 1 if any fails. ONLY=name,name runs some.
   APP_DIR points it at another build (scripts/mutate-app.mjs). */
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './chrome.mjs';
import { PROBE, serve } from './harness.mjs';
import { CONTRAST, strayWords, THEMES } from './checks.mjs';
import { EMAIL, password } from './test-account.mjs';
import { copy } from '../src/core/copy.ts';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (...names) => !ONLY.length || names.some((n) => ONLY.includes(n));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const SHOTS = process.env.SHOTS || '';
const QUIET_MS = 300;
const SEP = 'modal.run';

const songs = (process.env.RP_RECORDINGS || '').split(',').map((x) => x.split(':')).filter((x) => x.length === 2 && existsSync(x[1]));
const MIC = process.env.RP_MIC;
if (songs.length < 2 || !MIC || !existsSync(MIC)) {
  console.log('FAIL setup: RP_RECORDINGS needs two real songs and RP_MIC a real voice (kept outside the repo)');
  process.exit(1);
}
const [[SONG, SONG_PATH], [SONG2, SONG2_PATH]] = songs;

const ALL = ['signed-out-prompt', 'sign-in', 'too-big', 'too-long', 'server-off', 'split-progress', 'first30-early', 'line-first30', 'sliders',
  'controls', 'song-contrast', 'song-leave', 'song-hidden', 'sum-matches', 'reopen', 'signed-out-again', 'no-page-errors'];
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
}

/* real voice, made too long and too big for the limits */
const tmp = mkdtempSync(join(tmpdir(), 'rp-song-'));
const LONG = join(tmp, 'long voice.mp3');
const BIG = join(tmp, 'big voice.wav');
spawnSync(FFMPEG, ['-v', 'error', '-y', '-stream_loop', '-1', '-i', MIC, '-t', '660', '-ac', '1', '-b:a', '32k', LONG]);
spawnSync(FFMPEG, ['-v', 'error', '-y', '-stream_loop', '-1', '-i', MIC, '-t', '200', '-ac', '2', '-ar', '44100', BIG]);

/* the length of the song as it really plays, to check "of 4:30" */
function secondsOf(path) {
  const out = spawnSync(FFMPEG, ['-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '8000', '-'], { maxBuffer: 1 << 28 });
  return out.stdout.length / 2 / 8000;
}
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const { server, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: MIC, allowMic: false, online: true });
const { page } = env;
await page.addInitScript(PROBE);

const H1 = 'document.querySelector("main h1")?.textContent';
const LINE = 'document.querySelector("#song-line [role=status]")?.textContent';
const S = (expr) => `window.__probe.${expr}`;
let loads = 0;
async function fresh(hash) {
  await page.goto(URL_APP + '?load=' + ++loads + hash);
  await page.waitFor(`!!document.querySelector("main h1")`);
}
async function quietWithin() {
  await page.waitFor(S('quietAt !== null'), 2000);
  return page.eval(`(() => { const P = window.__probe; return { quiet: P.quiet(), ms: P.quietAt === null ? null : Math.round(P.quietAt - P.actionAt), live: P.live.size }; })()`);
}
const quietOk = (q) => q.quiet && q.ms !== null && q.ms <= QUIET_MS;
const says = (q) => (q.quiet && q.ms !== null ? `silent in ${q.ms} ms` : `still sounding (${q.live})`);
const sepCalls = () => page.eval(S(`net.filter((u) => u.includes('${SEP}')).length`));

/** add a song through the screens, as a singer would */
async function addSong(path, title) {
  await fresh('#/sing/learn');
  await page.waitFor(`!!document.querySelector("#add-song")`, 5000);
  await page.setFiles('#pick-song', [path]);
  await page.waitFor(`${H1} === ${JSON.stringify(copy.addSong.title)}`, 5000);
  const before = await page.eval(`({ title: document.querySelector('#song-title').value, disabled: document.querySelector('#save-song').disabled })`);
  if (title) {
    await page.tap('#song-title');
    await page.eval(`document.querySelector('#song-title').select()`);
    await page.type(title);
  }
  await page.tap('#own-copy');
  await page.tap('#save-song');
  await page.waitFor(`!!document.querySelector("#song-line")`, 5000);
  return before;
}

try {
  if (want('signed-out-prompt')) {
    await fresh('#/sing/learn');
    const prompt = await page.waitFor(`document.querySelector('#sign-in-prompt')?.innerText.includes(${JSON.stringify(copy.songs.signInFirst)})`, 3000);
    const noAdd = await page.eval(`!document.querySelector('#add-song')`);
    await page.tap('#songs-sign-in');
    const toAccount = await page.waitFor(`${H1} === ${JSON.stringify(copy.account.title)}`, 3000);
    check('signed-out-prompt', prompt && noAdd && toAccount, `prompt shown ${prompt}; no Add a song ${noAdd}; its button opens Account ${toAccount}`);
  }

  /* sign in, through the Account screen */
  await fresh('#/profile/account');
  await page.tap('#email');
  await page.type(EMAIL);
  await page.tap('#password');
  await page.type(password());
  await page.tap('#sign-in');
  const signedIn = await page.waitFor(`document.querySelector('#signed-in-as')?.textContent.includes(${JSON.stringify(EMAIL)})`, 15000);
  if (want('sign-in')) check('sign-in', signedIn, `signed in with email and password: ${signedIn}`);

  if (want('too-big')) {
    const before = await sepCalls();
    await addSong(BIG);
    const said = await page.waitFor(`${LINE} === ${JSON.stringify(copy.song.tooBig)}`, 10000);
    const sent = (await sepCalls()) - before;
    check('too-big', said && sent === 0, `said "${copy.song.tooBig}" ${said}; sent to the server ${sent} times`);
  }

  if (want('too-long')) {
    const before = await sepCalls();
    await addSong(LONG);
    const said = await page.waitFor(`${LINE} === ${JSON.stringify(copy.song.tooLong)}`, 10000);
    const sent = (await sepCalls()) - before;
    check('too-long', said && sent === 0, `said "${copy.song.tooLong}" ${said}; sent to the server ${sent} times`);
  }

  if (want('server-off')) {
    await page.cutOff('*' + SEP + '*');
    await addSong(SONG2_PATH, SONG2);
    const said = await page.waitFor(`${LINE} === ${JSON.stringify(copy.song.offline)}`, 20000);
    const retry = await page.eval(`!!document.querySelector('#line-try-again')`);
    await page.cutOff(null);
    check('server-off', said && retry, `said "${copy.song.offline}" ${said}; offers Try again ${retry}`);
  }

  if (want('split-progress', 'first30-early', 'line-first30', 'sliders', 'controls', 'song-leave', 'song-hidden', 'sum-matches', 'reopen', 'song-contrast')) {
    const total = secondsOf(SONG_PATH);
    const before = await addSong(SONG_PATH, SONG);
    /* follow the line under the title, as the singer sees it */
    const seen = [];
    let early = null;
    /* the singer's line as the screen says it is being read, and whether
       the song was still splitting at the time */
    const reading = [];
    const t0 = Date.now();
    for (;;) {
      const s = await page.eval(`({ line: ${LINE}, play: !document.querySelector('#song-play').disabled, map: document.querySelector('#map-line')?.textContent || '' })`);
      if (seen[seen.length - 1] !== s.line) seen.push(s.line);
      const r = /^Reading the singer's line… (\d+):(\d\d) of (\d+:\d\d)$/.exec(s.map);
      if (r && reading[reading.length - 1]?.text !== s.map) reading.push({ text: s.map, at: +r[1] * 60 + +r[2], of: r[3], splitting: /^Splitting/.test(s.line || '') });
      if (!early && s.play && s.line && s.line.startsWith('Splitting')) {
        /* the first 30 seconds can be played while the rest is still splitting */
        const n = await page.eval(S('starts.length'));
        await page.tap('#song-play');
        await page.waitFor(S(`starts.length >= ${n + 2}`), 5000);
        const st = await page.eval(S(`starts.slice(${n})`));
        const still = await page.eval(LINE);
        if (SHOTS) (await import('node:fs')).writeFileSync(join(SHOTS, 'song-first30.png'), await page.screenshot());
        await page.tap('#song-play');
        early = { st, still };
      }
      if (s.line === copy.song.ready) break;
      if (s.line && Object.values(copy.song).includes(s.line) && /Try again|again|Pick|Sign/.test(s.line)) break;
      if (Date.now() - t0 > 600_000) break;
      await sleep(100);
    }
    const sending = seen.map((l) => /^Sending the song… (\d+)%$/.exec(l || '')).filter(Boolean).map((m) => +m[1]);
    const ready = seen.map((l) => /^Splitting: ready to (\d+:\d\d) of (\d+:\d\d)$/.exec(l || '')).filter(Boolean);
    const readyS = ready.map((m) => m[1].split(':').reduce((a, b) => a * 60 + +b, 0));
    const ofOk = ready.length > 0 && ready.every((m) => m[2] === clock(total));
    const done = seen[seen.length - 1] === copy.song.ready;
    if (want('split-progress')) {
      check('split-progress', done && sending.length >= 2 && sending.join() === [...sending].sort((a, b) => a - b).join()
        && sending[sending.length - 1] >= 99 && new Set(readyS).size >= 3 && readyS.join() === [...readyS].sort((a, b) => a - b).join() && ofOk
        && before.disabled && before.title.length > 0,
        `title from the file "${before.title}", Save waited for "I own this copy" ${before.disabled}; sending ${sending.join('% ')}%; ` +
        `ready to ${ready.map((m) => m[1]).join(', ')} of ${ready[0]?.[2]} (the song is ${clock(total)}); finished ${done}` + (done ? '' : '; the line said: ' + seen.join(' / ')));
    }
    if (want('line-first30')) {
      /* read while the rest was still splitting, then carried on from where
         the first 30 seconds stopped, not read again from the start */
      /* until the whole voice has been read and kept */
      const kept = `(async () => {
        const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app'); q.onsuccess = () => ok(q.result); q.onerror = no; });
        const songs = await new Promise((ok) => { const q = db.transaction('songs').objectStore('songs').getAll(); q.onsuccess = () => ok(q.result); });
        const s = songs.find((x) => x.title === ${JSON.stringify(SONG)} && x.voice);
        const l = s && await new Promise((ok) => { const q = db.transaction('lines').objectStore('lines').get(s.id); q.onsuccess = () => ok(q.result); });
        db.close();
        return !!(l && l.whole && l.done);
      })()`;
      const tEnd = Date.now() + 240000;
      while (Date.now() < tEnd && !(await page.eval(kept))) {
        const m = await page.eval(`document.querySelector('#map-line')?.textContent || ''`);
        const r = /^Reading the singer's line… (\d+):(\d\d) of (\d+:\d\d)$/.exec(m);
        if (r && reading[reading.length - 1]?.text !== m) reading.push({ text: m, at: +r[1] * 60 + +r[2], of: r[3], splitting: false });
        await sleep(100);
      }
      const firstPart = reading.filter((r) => r.splitting);
      const later = reading.filter((r) => !r.splitting);
      const restart = later.length ? Math.min(...later.map((r) => r.at)) : null;
      const line = await page.eval(`(async () => {
        const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app'); q.onsuccess = () => ok(q.result); q.onerror = no; });
        const songs = await new Promise((ok) => { const q = db.transaction('songs').objectStore('songs').getAll(); q.onsuccess = () => ok(q.result); });
        const s = songs.find((x) => x.title === ${JSON.stringify(SONG)} && x.voice);
        const l = await new Promise((ok) => { const q = db.transaction('lines').objectStore('lines').get(s.id); q.onsuccess = () => ok(q.result); });
        return l && { whole: l.whole, done: l.done, readTo: l.readTo, ver: l.ver };
      })()`);
      check('line-first30', firstPart.length >= 3 && restart != null && restart >= 25 && reading.every((r) => r.of === clock(total))
        && line && line.whole && line.done && Math.abs(line.readTo - total) < 1,
        `while still splitting, the line was being read (${firstPart.length} steps shown, the last at ${firstPart[firstPart.length - 1]?.at ?? '-'} s); ` +
        `when the whole voice came it carried on from ${restart ?? '-'} s; kept: whole ${line?.whole}, read to ${line?.readTo?.toFixed(0)} of ${total.toFixed(0)} s`);
    }

    if (want('first30-early')) {
      const ok = !!early && early.st.length === 2 && early.st.every((x) => Math.abs(x.seconds - 30) < 0.5)
        && early.st[0].when === early.st[1].when && early.st[0].offset === early.st[1].offset && /^Splitting/.test(early.still || '');
      check('first30-early', ok, early ? `played ${early.st.map((x) => x.seconds.toFixed(1) + ' s').join(' + ')} together while the line said "${early.still}"` : 'never playable before the end');
    }

    if (want('sliders')) {
      await page.tap('#song-play');
      await page.waitFor(S('live.size === 2'), 8000);
      const g0 = await page.eval(S('playing()'));
      await page.eval(`document.querySelector('#voice-volume').focus()`);
      await page.key('PageDown', 8);
      await sleep(300);
      const g1 = await page.eval(S('playing()'));
      await page.eval(`document.querySelector('#music-volume').focus()`);
      await page.key('PageDown', 5);
      await sleep(300);
      const g2 = await page.eval(S('playing()'));
      const fmt = (g) => g.map((x) => x.gain?.toFixed(2)).join(' / ');
      const vOnly = Math.abs(g1[0].gain - g0[0].gain) > 0.5 && Math.abs(g1[1].gain - g0[1].gain) < 0.01;
      const mOnly = Math.abs(g2[1].gain - g1[1].gain) > 0.3 && Math.abs(g2[0].gain - g1[0].gain) < 0.01;
      check('sliders', g0.length === 2 && g0.every((x) => x.gain === 1) && vOnly && mOnly && g0.every((x) => Math.abs(x.seconds - total) < 1),
        `volumes voice / music: ${fmt(g0)} → voice slider down: ${fmt(g1)} → music slider down: ${fmt(g2)}`);
    }

    if (want('controls')) {
      if (!(await page.eval(S('live.size === 2')))) {
        await page.tap('#song-play');
        await page.waitFor(S('live.size === 2'), 8000);
      }
      const secs = (t) => t.split(' / ')[0].split(':').reduce((a, b) => a * 60 + +b, 0);
      const t0 = secs(await page.eval(`document.querySelector('#song-time').textContent`));
      await sleep(3000);
      const t1 = secs(await page.eval(`document.querySelector('#song-time').textContent`));
      /* repeat this part: the ten seconds just heard, over and over */
      let n = await page.eval(S('starts.length'));
      await page.tap('#repeat-part');
      await page.waitFor(S(`starts.length >= ${n + 2}`), 5000);
      const rep = await page.eval(S(`starts.slice(${n})`));
      const repLine = await page.eval(`document.querySelector('#repeat-line').textContent`);
      const looped = rep.length === 2 && rep.every((x) => x.loop && x.loopStart === 0 && x.loopEnd === 10 && x.offset === 0);
      n = await page.eval(S('starts.length'));
      await page.tap('#repeat-part');
      await page.waitFor(S(`starts.length >= ${n + 2}`), 5000);
      const unlooped = (await page.eval(S(`starts.slice(${n})`))).every((x) => !x.loop);
      /* move along the play bar (a tenth of the song), then back 10 s */
      n = await page.eval(S('starts.length'));
      await page.eval(`document.querySelector('#song-position').focus()`);
      await page.key('PageUp');
      await page.waitFor(S(`starts.length >= ${n + 2}`), 5000);
      const seek = await page.eval(S(`starts.slice(${n})`));
      const seekOk = seek.length === 2 && seek.every((x) => x.offset > 20 && x.offset === seek[0].offset);
      await sleep(1500);
      const before = secs(await page.eval(`document.querySelector('#song-time').textContent`));
      n = await page.eval(S('starts.length'));
      await page.tap('#back-10');
      await page.waitFor(S(`starts.length >= ${n + 2}`), 5000);
      const back = await page.eval(S(`starts.slice(${n})`));
      const backOk = back.length === 2 && back.every((x) => Math.abs(x.offset - Math.max(0, before - 10)) < 1.2);
      check('controls', t1 - t0 >= 2 && looped && repLine === 'Repeating 0:00–0:10' && unlooped && seekOk && before > 20 && backOk,
        `the play bar moved ${t0} s → ${t1} s in 3 s; repeat this part: "${repLine}", looping 0–10 s ${looped}; off again ${unlooped}; ` +
        `the play bar moved the song to ${seek.map((x) => x.offset.toFixed(1)).join(' + ')} s; ` +
        `back 10 s from ${before} s restarted at ${back.map((x) => x.offset.toFixed(1)).join(' + ')} s`);
    }

    if (want('song-contrast')) {
      const shots = [];
      for (const theme of THEMES) {
        await page.eval(`localStorage.setItem('rp.theme', '${theme}')`);
        await page.eval(`document.documentElement.dataset.theme = '${theme}'`);
        shots.push([theme, await page.eval(CONTRAST)]);
        if (SHOTS) (await import('node:fs')).writeFileSync(join(SHOTS, `song-${theme}.png`), await page.screenshot());
      }
      const low = shots.flatMap(([t, r]) => r.pairs.filter((p) => p.ratio < 3).map((p) => `${t} ${p.what} ${p.ratio.toFixed(2)}`));
      const unset = shots.flatMap(([t, r]) => r.unsetButtons.map((b) => t + ' ' + b));
      const strays = await strayWords(page);
      check('song-contrast', low.length === 0 && unset.length === 0 && strays.length === 0,
        `song screen in both themes: ${shots.reduce((a, [, r]) => a + r.pairs.length, 0)} pairs, ${low.length ? 'below 3:1: ' + low.join(', ') : 'all at least 3:1'}` +
        (unset.length ? '; buttons without colours: ' + unset.join(', ') : '') + (strays.length ? '; words not from the copy: ' + strays.join(', ') : ''));
    }

    if (want('song-leave')) {
      if (!(await page.eval(S('live.size === 2')))) {
        await page.tap('#song-play');
        await page.waitFor(S('live.size === 2'), 8000);
      }
      await page.tap('#tab-home');
      const q = await quietWithin();
      await sleep(1500);
      const still = await page.eval(S('quiet()'));
      check('song-leave', quietOk(q) && still, `${says(q)} after tapping another tab; still silent 1.5 s later ${still}`);
      await page.back();
      await page.waitFor(`!!document.querySelector('#song-play')`, 5000);
    }

    if (want('song-hidden')) {
      await page.tap('#song-play');
      await page.waitFor(S('live.size === 2'), 8000);
      const show = await env.hide();
      const hidden = await page.waitFor(`document.visibilityState === 'hidden'`, 2000);
      const q = await quietWithin();
      await sleep(800);
      await show();
      await sleep(1200);
      const after = await page.eval(S('quiet()'));
      check('song-hidden', hidden && quietOk(q) && after, `really hidden ${hidden}; ${says(q)}; nothing resumed on coming back ${after}`);
    }

    if (want('sum-matches')) {
      /* the song as stored on the phone: the file, and the voice and music
         the app plays. Played together they must be the song. */
      const r = await page.eval(`(async () => {
        const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app'); q.onsuccess = () => ok(q.result); q.onerror = no; });
        const all = await new Promise((ok) => { const q = db.transaction('songs').objectStore('songs').getAll(); q.onsuccess = () => ok(q.result); });
        const s = all.find((x) => x.title === ${JSON.stringify(SONG)} && x.voice);
        const ctx = new OfflineAudioContext(2, 44100, 44100);
        const dec = async (b) => ctx.decodeAudioData(await b.arrayBuffer());
        const [song, v, m] = await Promise.all([dec(s.file), dec(s.voice), dec(s.music)]);
        const ch = (b, c) => b.getChannelData(Math.min(c, b.numberOfChannels - 1));
        const n = Math.min(song.length, v.length, m.length) - 4000;
        let best = { lag: 0, dot: -Infinity };
        const a = ch(song, 0), x = ch(v, 0), y = ch(m, 0);
        for (let lag = -1500; lag <= 1500; lag++) {
          let d = 0;
          for (let i = 44100 * 60; i < 44100 * 70; i += 3) d += a[i] * (x[i + lag] + y[i + lag]);
          if (d > best.dot) best = { lag, dot: d };
        }
        let sig = 0, err = 0, sx = 0, xx = 0;
        for (let c = 0; c < 2; c++) {
          const A = ch(song, c), X = ch(v, c), Y = ch(m, c);
          for (let i = 2000; i < n; i++) { const t = X[i + best.lag] + Y[i + best.lag]; sig += A[i] * A[i]; err += (A[i] - t) ** 2; sx += A[i] * t; xx += t * t; }
        }
        return { lag: best.lag, sdr: 10 * Math.log10(sig / err), gain: sx / xx, seconds: n / 44100 };
      })()`);
      const st = await page.eval(S('starts.slice(-2)'));
      const together = st.length === 2 && st[0].when === st[1].when && st[0].offset === st[1].offset;
      check('sum-matches', r.sdr > 20 && Math.abs(r.gain - 1) < 0.02 && together,
        `voice + music against the song: ${r.sdr.toFixed(1)} dB apart (MP3 coding only), level ${(r.gain * 100).toFixed(1)}%, ` +
        `offset ${r.lag} samples (the original file's own MP3 start-up); both parts start on the same tick ${together}`);
    }

    if (want('reopen')) {
      await fresh('#/sing/learn');
      await page.waitFor(`[...document.querySelectorAll('.song-row')].some((b) => b.innerText.includes(${JSON.stringify(SONG)}))`, 5000);
      const id = await page.eval(`[...document.querySelectorAll('.song-row')].find((b) => b.innerText.includes(${JSON.stringify(SONG)}))?.dataset.song`);
      await page.tap(`[data-song="${id}"]`);
      await page.waitFor(`document.querySelector('#song-play')?.disabled === false`, 10000);
      await page.tap('#song-play');
      const played = await page.waitFor(S('live.size === 2'), 10000);
      const calls = await sepCalls();
      await page.tap('#song-play');
      check('reopen', played && calls === 0, `opened again after a reload: played ${played}; calls to the server ${calls}`);
    }
  }

  if (want('signed-out-again')) {
    await fresh('#/profile/account');
    await page.tap('#sign-out');
    await page.waitFor(`!!document.querySelector('#sign-in')`, 5000);
    await fresh('#/sing/learn');
    const prompt = await page.waitFor(`!!document.querySelector('#sign-in-prompt')`, 3000);
    check('signed-out-again', prompt, `after signing out, Learn a song asks to sign in ${prompt}`);
  }
  check('no-page-errors', page.errors.length === 0, page.errors.join(' | '));
} catch (e) {
  /* a check that never got to say is a failed check, not a skipped one */
  const why = 'the test stopped: ' + String(e.message || e).split('\n')[0];
  const said = new Set(results.map((r) => r.name));
  for (const name of ALL) if (want(name) && !said.has(name)) check(name, false, why);
} finally {
  await env.close();
  server.close();
  rmSync(tmp, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} of ${results.length} checks FAILED` : `\nall ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
