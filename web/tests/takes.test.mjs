/* Takes on Learn a song, on the built app, in a real Chrome, against the
   real database and takes store, with the two permanent test accounts only
   (RULEBOOK 1d): rp-test@example.com sings, rp-coach@example.com is its
   coach. Real voices only: the song on the phone is the separator's real
   output for one song (RP_SPLIT, as in tests/notemap.test.mjs), and the
   singing is the mirror (tests/harness.mjs) - a real recording given to
   the mic the moment the speaker plays it, with phone-like delays.

   Every take a run makes is deleted by the run, through the app; no other
   take is ever touched. Prints one line per check; exits 1 if any fails.
   ONLY=name,name runs some; APP_DIR points it at another build. */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './chrome.mjs';
import { MIRROR, PROBE, serve } from './harness.mjs';
import { copy, fill } from '../src/core/copy.ts';
import { SUPABASE_KEY, SUPABASE_URL } from '../src/data/config.ts';
import { COACH_EMAIL, EMAIL, password } from './test-account.mjs';
import { isRight, rightPct, singerNow } from '../src/core/takes.ts';
import { clearTestTakes } from './clear-test-takes.mjs';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (...names) => !ONLY.length || names.some((n) => ONLY.includes(n));
const QUIET_MS = 300;
const PREFIX = process.env.RP_SPLIT || '';
const PARTS = ['voice', 'music', 'voice30', 'music30'];
if (!PARTS.every((p) => existsSync(`${PREFIX}-${p}.mp3`))) {
  console.log('FAIL setup: RP_SPLIT must name the separator\'s output for one song (PREFIX-voice.mp3 and so on), kept outside the repo');
  process.exit(1);
}

const ALL = ['take-voice-only', 'take-lines-up', 'take-review', 'take-leave', 'take-removed-undo', 'take-saved-first', 'take-offline',
  'take-delete-undo', 'take-send', 'take-private', 'apps-side-by-side', 'take-new-phone', 'old-app-takes', 'take-send-kept', 'take-unlinked', 'take-no-coach', 'take-words', 'no-page-errors'];
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
}

/* the database as each test account sees it, through its own sign-in */
function rest(method, path, token, body) {
  const args = ['-sS', '-X', method, SUPABASE_URL + path, '-H', 'apikey: ' + SUPABASE_KEY, '-H', 'authorization: Bearer ' + (token || SUPABASE_KEY),
    '-H', 'content-type: application/json', '-w', '\n%{http_code}'];
  if (body) args.push('--data', JSON.stringify(body));
  const out = execFileSync('curl', args, { encoding: 'utf8' });
  const i = out.lastIndexOf('\n');
  const text = out.slice(0, i);
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: +out.slice(i + 1), json };
}
const tokenOf = (email) => rest('POST', '/auth/v1/token?grant_type=password', null, { email, password: password(email) }).json.access_token;
const coachToken = tokenOf(COACH_EMAIL);
const coachId = JSON.parse(Buffer.from(coachToken.split('.')[1], 'base64url')).sub;
const singerId = JSON.parse(Buffer.from(tokenOf(EMAIL).split('.')[1], 'base64url')).sub;
/* the coach-singer link, as the coach removes it and adds it back (the old app's own ways) */
const unlink = () => rest('DELETE', `/rest/v1/coach_students?coach_id=eq.${coachId}&student_id=eq.${singerId}`, coachToken).status;
const relink = () => rest('POST', '/rest/v1/rpc/add_student_by_email', coachToken, { p_email: EMAIL }).status;
const linked = () => (rest('GET', `/rest/v1/coach_students?select=id&coach_id=eq.${coachId}&student_id=eq.${singerId}`, coachToken).json || []).length === 1;
/** what the coach can see of a take: its rows, and whether its sound opens */
function asCoach(path) {
  const rows = rest('GET', `/rest/v1/takes?select=id,coach_id,student_id,audio_path&audio_path=eq.${encodeURIComponent(path)}`, coachToken).json || [];
  const sign = rest('POST', `/storage/v1/object/sign/takes/${path}`, coachToken, { expiresIn: 60 });
  return { rows: rows.length, mine: rows.every((r) => r.coach_id === coachId), opens: sign.status === 200 && !!sign.json?.signedURL };
}

clearTestTakes();             /* nothing left from an earlier run */
const local = await serve(REPO, APP);
/* RP_LIVE=1: the live site itself, as a phone reaches it */
const LIVE = process.env.RP_LIVE === '1';
const server = local.server;
const ORIGIN = LIVE ? 'https://rcaldwell91.github.io' : local.ORIGIN;
const URL_APP = LIVE ? 'https://rcaldwell91.github.io/repertoire-pro/app/' : local.URL_APP;
const env = await launch({ mic: `${PREFIX}-voice30.mp3`, allowMic: false, online: true });
/* the singer has said yes to the mic, as on the phone: the app opens the
   mic before the sound (RULEBOOK 4, Sound, Android 4), so a question nobody
   answers would hold Start */
await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin: ORIGIN });
const { page } = env;
await page.addInitScript(MIRROR);
await page.addInitScript(PROBE);
const S = (expr) => `window.__probe.${expr}`;
const ID = 'take-test-song';
let loads = 0;
async function open() {
  await page.goto(URL_APP + '?load=' + ++loads + '#/sing/learn/song/' + ID);
  await page.waitFor(`!!document.querySelector('#song-play')`, 8000);
}
const idb = (store, body) => page.eval(`(async () => {
  const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app'); q.onsuccess = () => ok(q.result); q.onerror = no; });
  const all = await new Promise((ok) => { const q = db.transaction(${JSON.stringify(store)}).objectStore(${JSON.stringify(store)}).getAll(); q.onsuccess = () => ok(q.result); });
  db.close();
  return (${body})(all);
})()`);
const takesKept = () => idb('takes', `(all) => all.filter((t) => t.songId === ${JSON.stringify(ID)}).map((t) => ({ id: t.id, path: t.path || null,
  sendTo: t.sendTo.map((c) => c.name), sent: t.sent.map((c) => c.name), seconds: t.seconds, songAt: t.songAt, rightPct: t.rightPct, progress: t.progress ?? null }))`);
const rows = () => page.eval(`[...document.querySelectorAll('.take-row')].map((r) => ({ id: r.dataset.take, text: r.innerText }))`);

/** the old app (next.html), signed in on this browser: does it load the
    singer's takes, and does any tab show a blank (undefined, null, NaN)? */
async function oldAppLooks(pg, take) {
  await pg.goto(ORIGIN + '/repertoire-pro/next.html');
  const loaded = await pg.waitFor(`typeof RP !== 'undefined' && !!RP.user && Array.isArray(RP.takes) && RP.takes.length > 0`, 30000);
  const takes = await pg.eval(`(RP.takes || []).filter((t) => t.audio_path === ${JSON.stringify(take.path)}).map((t) => t.coach_id)`);
  await pg.eval(`document.getElementById('rpTourSkip')?.click()`);
  const odd = [];
  for (const nav of ['navHome', 'navTrain', 'navSing', 'navLib', 'navYou']) {
    await pg.eval(`document.getElementById('${nav}')?.click()`);
    await sleep(600);
    const t = await pg.eval(`document.body.innerText`);
    const hit = /.{0,40}(\bundefined\b|\bnull\b|NaN).{0,40}/.exec(t);
    if (hit) odd.push(nav + ': "' + hit[0].replace(/\n/g, ' / ') + '"');
  }
  return { loaded, takes, odd };
}
let sideNote = '';

/** sign in through the Account screen (signing out first if need be) */
async function signInAs(p, email) {
  await p.goto(URL_APP + '?load=' + ++loads + '#/profile/account');
  await p.waitFor(`!!document.querySelector('#email') || !!document.querySelector('#sign-out')`, 8000);
  if (await p.eval(`!!document.querySelector('#sign-out')`)) {
    await p.tap('#sign-out');
    await p.waitFor(`!!document.querySelector('#email')`, 8000);
  }
  await p.tap('#email');
  await p.type(email);
  await p.tap('#password');
  await p.type(password(email));
  await p.tap('#sign-in');
  if (!(await p.waitFor(`document.querySelector('#signed-in-as')?.textContent.includes(${JSON.stringify(email)})`, 15000))) throw new Error('could not sign in as ' + email);
}

/** sing (the mirror) from a point for some seconds, then stop: one take */
async function singTake(from, seconds) {
  await page.eval(`window.__mirror.on = true`);
  await page.eval(`(() => { const r = document.querySelector('#song-position'); r.focus();
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(r, ${from});
    r.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await page.key('ArrowLeft');
  await page.key('ArrowRight');
  const n = await page.eval(S('starts.length'));
  await page.tap('#song-play');
  await page.waitFor(S(`starts.length >= ${n + 2} && window.__probe.micLive() === 1`), 8000);
  await sleep(seconds * 1000);
  await page.tap('#song-play');
  return page.waitFor(`!!document.querySelector('#take-review')`, 5000);
}
async function quietWithin() {
  await page.waitFor(S('quietAt !== null'), 2000);
  return page.eval(`(() => { const P = window.__probe; return { quiet: P.quiet(), ms: P.quietAt === null ? null : Math.round(P.quietAt - P.actionAt), live: P.live.size, mic: P.micLive() }; })()`);
}
const quietOk = (q) => q.quiet && q.ms !== null && q.ms <= QUIET_MS;
const made = new Set();      /* takes this run made, deleted at the end */

try {
  /* sign in as the test singer, through the Account screen */
  await signInAs(page, EMAIL);

  /* the split song, stored on the phone as the app stores one */
  await page.eval(`window.__parts = {}`);
  for (const p of PARTS) {
    const b64 = readFileSync(`${PREFIX}-${p}.mp3`).toString('base64');
    await page.eval(`window.__parts[${JSON.stringify(p)}] = new Blob([Uint8Array.from(atob(${JSON.stringify(b64)}), (c) => c.charCodeAt(0))], { type: 'audio/mpeg' })`);
  }
  await page.eval(`(async () => {
    const db = await new Promise((ok, no) => { const q = indexedDB.open('repertoire-app');
      q.onupgradeneeded = () => { const d = q.result; for (const s of ['songs', 'lines', 'takes']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); };
      q.onsuccess = () => ok(q.result); q.onerror = no; });
    const P = window.__parts;
    const secs = await new Promise((ok) => { const a = new Audio(URL.createObjectURL(P.voice)); a.onloadedmetadata = () => ok(a.duration); });
    const song = { id: ${JSON.stringify(ID)}, title: 'Take test song', created: Date.now(), fileName: 'test.mp3', file: P.voice, seconds: secs,
      state: 'ready', voice: P.voice, music: P.music, voice30: P.voice30, music30: P.music30 };
    await new Promise((ok) => { const t = db.transaction('songs', 'readwrite'); t.objectStore('songs').put(song); t.oncomplete = ok; });
    db.close();
    delete window.__parts;
  })()`);
  await open();
  /* the singer's line first (for the take's right notes) */
  await page.waitFor(`!document.querySelector('#map-line')?.textContent && +(document.querySelector('#note-map')?.dataset.lo || 0) !== 55`, 120000);
  const SUNG = 62;          /* a stretch of the song with plenty of singing */

  /* 1. a take: what the mic heard, never the music, in its place */
  const reviewed = await singTake(SUNG, 12);
  const summary = await page.eval(`document.querySelector('#take-summary')?.textContent`);
  /* keep it, so the recording can be read back from the phone */
  const had = (await takesKept()).map((t) => t.id);
  await page.tap('#take-save');
  await page.waitFor(`document.querySelectorAll('.take-row').length > ${had.length}`, 5000);
  const first = (await takesKept()).find((t) => !had.includes(t.id));
  if (first) made.add(first.id);
  const sound = await page.eval(`(async () => {
    const db = await new Promise((ok) => { const q = indexedDB.open('repertoire-app'); q.onsuccess = () => ok(q.result); });
    const get = (s, id) => new Promise((ok) => { const q = db.transaction(s).objectStore(s).get(id); q.onsuccess = () => ok(q.result); });
    const take = await get('takes', ${JSON.stringify(first?.id)}), song = await get('songs', ${JSON.stringify(ID)});
    db.close();
    const R = 22050, dec = async (b) => (await new OfflineAudioContext(1, 1, R).decodeAudioData(await b.arrayBuffer())).getChannelData(0);
    const [x, v, m] = await Promise.all([dec(take.audio), dec(song.voice), dec(song.music)]);
    /* where the take sits against the voice part: the shift that best lines them up */
    const N = Math.min(x.length - R, 3 * R), x0 = R, base = Math.round(take.songAt * R) + x0;
    const corr = (y, lag) => { let a = 0, b = 0, c = 0; for (let i = 0; i < N; i += 2) { const p = x[x0 + i], q = y[base + lag + i] || 0; a += p * q; b += p * p; c += q * q; } return a / Math.sqrt(b * c || 1); };
    let best = { lag: 0, r: -2 };
    for (let lag = -Math.round(0.25 * R); lag <= 0.25 * R; lag += 2) { const r = corr(v, lag); if (r > best.r) best = { lag, r }; }
    for (let lag = best.lag - 2; lag <= best.lag + 2; lag++) { const r = corr(v, lag); if (r > best.r) best = { lag, r }; }
    let music = 0;
    for (let lag = -Math.round(0.25 * R); lag <= 0.25 * R; lag += 4) music = Math.max(music, Math.abs(corr(m, lag)));
    return { lagMs: (best.lag / R) * 1000, voice: best.r, music, seconds: take.seconds, songAt: take.songAt };
  })()`);
  if (want('take-voice-only')) {
    check('take-voice-only', sound.voice > 0.9 && sound.music < 0.2,
      `the take against the song's parts: voice ${sound.voice.toFixed(2)}, music at most ${sound.music.toFixed(2)} (1 is the same sound); ${sound.seconds.toFixed(1)} s from ${sound.songAt.toFixed(2)} s`);
  }
  if (want('take-lines-up')) {
    /* played back: the take starts exactly with the song's parts, at its own place */
    const n = await page.eval(S('starts.length'));
    await page.tap(`.take-row[data-take="${first.id}"] .take-hear`);
    await page.waitFor(S(`starts.length >= ${n + 3}`), 8000);
    const st = await page.eval(S(`starts.slice(${n})`));
    await sleep(1500);
    await page.tap('#song-play');
    const sched = st.length === 3 ? Math.max(Math.abs(st[2].when - st[0].when), Math.abs(st[0].offset - sound.songAt), Math.abs(st[2].offset)) * 1000 : Infinity;
    check('take-lines-up', Math.abs(sound.lagMs) <= 30 && sched <= 1,
      `sung with the speaker 150 ms and the mic 50 ms behind, the take sits ${Math.abs(sound.lagMs).toFixed(1)} ms ${sound.lagMs >= 0 ? 'after' : 'before'} the voice it was sung to (gate ±30 ms); ` +
      `played back over the music from ${st[0]?.offset.toFixed(2)} s, it starts with the parts to within ${sched.toFixed(2)} ms`);
  }
  if (want('take-review')) {
    const m = summary && /^(\d+:\d\d) · (\d+)% right notes$/.exec(summary);
    const listed = (await rows())[0]?.text || '';
    /* the % by the one rule, from what was kept: the take's line and the singer's */
    const kept = await page.eval(`(async () => {
      const db = await new Promise((ok) => { const q = indexedDB.open('repertoire-app'); q.onsuccess = () => ok(q.result); });
      const get = (s, id) => new Promise((ok) => { const q = db.transaction(s).objectStore(s).get(id); q.onsuccess = () => ok(q.result); });
      const t = await get('takes', ${JSON.stringify(first?.id)}), l = await get('lines', ${JSON.stringify(ID)});
      db.close();
      const arr = (a) => Array.from(a, (v) => (Number.isFinite(v) ? v : null));
      return { t: arr(t.line.t), m: arr(t.line.m), singer: arr(l.m), hop: l.hop, any: t.anyOctave };
    })()`);
    const num = (a) => a.map((v) => (v == null ? NaN : v));
    const byRule = rightPct(num(kept.t), num(kept.m), num(kept.singer), kept.hop, kept.any);
    /* and the map, hearing the take back: green exactly where that rule says */
    await page.tap(`.take-row[data-take="${first.id}"] .take-hear`);
    await sleep(3000);
    const map = await page.eval(`(() => { const d = document.querySelector('#note-map').drawn;
      return { you: d.you.map((p) => [p.t, Number.isFinite(p.m) ? p.m : null]), green: d.hits.map((p) => Number.isFinite(p.m)), singer: Array.from(d.lines.singer, (v) => (Number.isFinite(v) ? v : null)), hop: d.lines.hop }; })()`);
    await page.tap('#song-play');
    const sing = num(map.singer);
    let wrongColour = 0, scored = 0;
    map.you.forEach(([t, mm], i) => {
      if (mm == null) return;
      scored++;
      if (isRight(mm, singerNow(sing, map.hop, t), false) !== map.green[i]) wrongColour++;
    });
    check('take-review', reviewed && !!m && listed.includes(`${m?.[2]}% right notes`) && first?.rightPct === +m?.[2] && byRule === first?.rightPct && scored > 20 && wrongColour === 0,
      `after the take: "${summary}"; in Your takes: "${listed.replace(/\n/g, ' / ')}"; the rule gives ${byRule}% from what was kept; ` +
      `hearing it back, the map coloured ${scored - wrongColour} of ${scored} of your notes by that same rule`);
  }

  /* 2. leaving ends it: silence, the mic closed; the take is still there to decide on */
  if (want('take-leave')) {
    await page.eval(`window.__mirror.on = true`);
    const n = await page.eval(S('starts.length'));
    await page.tap('#song-play');
    await page.waitFor(S(`starts.length >= ${n + 2} && window.__probe.micLive() === 1`), 8000);
    await sleep(4000);
    await page.tap('#tab-home');
    const q = await quietWithin();
    await sleep(800);
    await page.back();
    await page.waitFor(`!!document.querySelector('#song-play')`, 5000);
    const kept = await page.waitFor(`!!document.querySelector('#take-review')`, 3000);
    /* hearing a take, then leaving */
    const m2 = await page.eval(S('starts.length'));
    await page.tap('#take-hear');
    await page.waitFor(S(`starts.length >= ${m2 + 3}`), 8000);
    await sleep(800);
    await page.tap('#tab-home');
    const q2 = await quietWithin();
    await sleep(1000);
    const still = await page.eval(S('quiet()'));
    await page.back();
    await page.waitFor(`!!document.querySelector('#take-again')`, 5000);
    await page.tap('#take-again');
    const gone = await page.waitFor(`!document.querySelector('#take-review')`, 2000);
    check('take-leave', quietOk(q) && kept && quietOk(q2) && still && gone,
      `singing, then another tab: silence and the mic closed in ${q.ms} ms, and the take was there to decide on coming back ${kept}; ` +
      `hearing it, then another tab: silence in ${q2.ms} ms, still silent 1 s later ${still}; Try again threw it away with no question ${gone}`);
  }

  /* thrown away by Try again, or by singing again: "Take removed", with Undo */
  if (want('take-removed-undo')) {
    const LINE = `document.querySelector('#take-removed-line')?.innerText || ''`;
    await singTake(SUNG, 4);
    const pct1 = await page.eval(`document.querySelector('#take-summary')?.textContent`);
    await page.tap('#take-again');
    const shown = await page.waitFor(`(${LINE}).includes(${JSON.stringify(copy.take.removed)})`, 2000);
    await page.tap('#undo-remove');
    const back = await page.waitFor(`document.querySelector('#take-summary')?.textContent === ${JSON.stringify(pct1)}`, 2000);
    /* singing again throws it away too */
    await page.eval(`window.__mirror.on = true`);
    const n = await page.eval(S('starts.length'));
    await page.tap('#song-play');
    await page.waitFor(S(`starts.length >= ${n + 2}`), 8000);
    const shown2 = await page.waitFor(`(${LINE}).includes(${JSON.stringify(copy.take.removed)})`, 2000);
    await sleep(1000);
    await page.tap('#undo-remove');
    const back2 = await page.waitFor(`document.querySelector('#take-summary')?.textContent === ${JSON.stringify(pct1)}`, 3000);
    const quiet = await page.waitFor(S('live.size === 0'), 2000);
    await page.tap('#take-again');
    await sleep(6500);
    const after = await page.eval(LINE);
    check('take-removed-undo', shown && back && shown2 && back2 && quiet && !after.trim(),
      `Try again: "${copy.take.removed}" with Undo ${shown}, and Undo brought the same take back ${back}; singing again: the same ${shown2}, ` +
      `Undo stopped the song and brought it back ${back2 && quiet}; a few seconds after Try again the line is gone ${!after.trim()}`);
  }

  /* 3. kept on the phone first; online when it can be */
  if (want('take-saved-first', 'take-offline')) {
    await page.c.send('Network.enable');
    await page.c.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await singTake(SUNG + 20, 8);
    const before = (await takesKept()).map((t) => t.id);
    const t0 = Date.now();
    await page.tap('#take-save');
    await page.waitFor(`document.querySelectorAll('.take-row').length > ${before.length}`, 3000);
    const keptMs = Date.now() - t0;
    const now = (await takesKept()).find((t) => !before.includes(t.id));
    if (now) made.add(now.id);
    const row = (await rows()).find((r) => r.id === now?.id)?.text || '';
    await sleep(3000);
    const stillOffline = (await takesKept()).find((t) => t.id === now?.id);
    if (want('take-saved-first')) {
      check('take-saved-first', !!now && keptMs < 1500 && row.includes(copy.takes.onPhone) && !stillOffline?.path,
        `offline: kept on the phone ${keptMs} ms after Save, and listed as "${row.split('\n').pop()}"; online yet ${!!stillOffline?.path}`);
    }
    /* back online, slowly, so the progress can be seen */
    await page.c.send('Network.emulateNetworkConditions', { offline: false, latency: 50, downloadThroughput: -1, uploadThroughput: 40 * 1024 });
    const seen = new Set();
    const tEnd = Date.now() + 90000;
    let up = null;
    while (Date.now() < tEnd) {
      const r = (await rows()).find((x) => x.id === now?.id)?.text || '';
      const p = /Saving online… (\d+)%/.exec(r);
      if (p) seen.add(+p[1]);
      up = (await takesKept()).find((t) => t.id === now?.id);
      if (up?.path) break;
      await sleep(200);
    }
    await page.c.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    const finalRow = (await rows()).find((x) => x.id === now?.id)?.text || '';
    const own = up?.path ? rest('POST', `/storage/v1/object/sign/takes/${up.path}`, tokenOf(EMAIL), { expiresIn: 60 }).status : 0;
    /* and still on the phone, to hear offline */
    await sleep(2000);
    const stillHere = await page.eval(`(async () => { const d = await new Promise((ok) => { const q = indexedDB.open('repertoire-app'); q.onsuccess = () => ok(q.result); });
      const t = await new Promise((ok) => { const q = d.transaction('takes').objectStore('takes').get(${JSON.stringify(now?.id)}); q.onsuccess = () => ok(q.result); });
      d.close(); return !!(t && t.audio && t.audio.size > 1000); })()`);
    if (want('take-offline')) {
      const steps = [...seen].sort((a, b) => a - b);
      check('take-offline', !!up?.path && own === 200 && steps.length >= 3 && finalRow.includes(copy.takes.saved) && stillHere,
        `back online it went up by itself, showing ${steps.map((n) => n + '%').join(' ')}; then "${finalRow.split('\n').pop()}"; in the takes store for its owner ${own === 200}; ` +
        `its recording still on the phone ${stillHere}`);
    }
  }

  /* 4. delete, with undo */
  if (want('take-delete-undo')) {
    const list = await takesKept();
    const victim = list.find((t) => made.has(t.id) && t.path);
    await page.tap(`.take-row[data-take="${victim.id}"] .take-more`);
    await page.tap(`.take-row[data-take="${victim.id}"] .take-delete`);
    const hidden = await page.waitFor(`!document.querySelector('.take-row[data-take="${victim.id}"]')`, 1000);
    const offered = await page.eval(`document.querySelector('#undo-delete')?.textContent`);
    await page.tap('#undo-delete');
    const back = await page.waitFor(`!!document.querySelector('.take-row[data-take="${victim.id}"]')`, 2000);
    await sleep(7000);
    const stillThere = !!(await takesKept()).find((t) => t.id === victim.id);
    await page.tap(`.take-row[data-take="${victim.id}"] .take-more`);
    await page.tap(`.take-row[data-take="${victim.id}"] .take-delete`);
    await sleep(8000);
    const goneHere = !(await takesKept()).find((t) => t.id === victim.id);
    const goneOnline = rest('POST', `/storage/v1/object/sign/takes/${victim.path}`, tokenOf(EMAIL), { expiresIn: 60 }).status !== 200;
    if (goneHere) made.delete(victim.id);
    check('take-delete-undo', hidden && offered === copy.takes.undo && back && stillThere && goneHere && goneOnline,
      `Delete took it off the list at once ${hidden}, offering "${offered}"; Undo brought it back ${back} and it stayed ${stillThere}; ` +
      `deleted again: gone from the phone ${goneHere} and from the takes store ${goneOnline}`);
  }

  /* 5. sent to the chosen coach only */
  let sentTake = null;
  if (want('take-send', 'take-private')) {
    await singTake(SUNG + 40, 6);
    await page.tap('#take-send');
    await page.waitFor(`!!document.querySelector('#send-go')`, 10000);
    const names = await page.eval(`[...document.querySelectorAll('.coach-pick')].map((l) => l.innerText.trim())`);
    const before = (await takesKept()).map((t) => t.id);
    await page.tap('.coach-pick input');
    await page.tap('#send-go');
    await page.waitFor(`!!document.querySelector('#song-play')`, 5000);
    const confirmed = await page.waitFor(`document.querySelector('#take-confirm')?.textContent === ${JSON.stringify(fill(copy.takes.sent, { names: 'Test Coach' }))}`, 30000);
    sentTake = (await takesKept()).find((t) => !before.includes(t.id));
    if (sentTake) made.add(sentTake.id);
    const row = (await rows()).find((x) => x.id === sentTake?.id)?.text || '';
    const seen = sentTake?.path ? asCoach(sentTake.path) : { rows: 0 };
    if (want('take-send')) {
      check('take-send', names.join() === 'Test Coach' && confirmed && row.includes('Sent to Test Coach') && seen.rows === 1 && seen.mine && seen.opens,
        `the coaches offered: ${names.join(', ')}; "${fill(copy.takes.sent, { names: 'Test Coach' })}" shown ${confirmed}, and the take marked "${row.split('\n').pop()}"; ` +
        `the coach sees ${seen.rows} row for it, and can play it ${seen.opens}`);
    }
  }
  if (want('take-private')) {
    /* a take only saved is not the coach's to hear */
    const kept = (await takesKept()).find((t) => made.has(t.id) && t.path && !t.sent.length);
    const seen = kept ? asCoach(kept.path) : null;
    check('take-private', !!seen && seen.rows === 0 && !seen.opens,
      `a take only saved: the coach sees ${seen?.rows} row for it; can still open its recording ${seen?.opens}`);
  }

  /* 6. a saved take is online, the singer's alone: on a new phone, and in the old app */
  const keptOnly = (await takesKept()).find((t) => made.has(t.id) && t.path && !t.sent.length);
  if (want('take-new-phone', 'old-app-takes') && keptOnly) {
    const env2 = await launch({ mic: `${PREFIX}-voice30.mp3`, allowMic: false, online: true });
    const p2 = env2.page;
    await p2.addInitScript(PROBE);
    try {
      if (want('apps-side-by-side')) {
        /* a phone where this app ran before 5 Oct, sharing the old app's store:
           one of its songs and lines in there, and one of the old app's songs */
        await p2.goto(URL_APP + 'favicon.svg');            /* a plain page on the same site: neither app */
        await p2.eval(`(async () => {
          const d = await new Promise((ok, no) => { const q = indexedDB.open('repertoire', 2);
            q.onupgradeneeded = () => { q.result.createObjectStore('songs', { keyPath: 'id' }); q.result.createObjectStore('lines', { keyPath: 'id' }); };
            q.onsuccess = () => ok(q.result); q.onerror = no; });
          const t = d.transaction(['songs', 'lines'], 'readwrite');
          const blob = new Blob([new Uint8Array(16)], { type: 'audio/mpeg' });
          t.objectStore('songs').put({ id: 'moved-song', title: 'Moved song', created: 1, fileName: 'moved.mp3', file: blob, state: 'new' });
          t.objectStore('songs').put({ id: 's1', title: 'Old app song', blob, addedAt: 1, artist: 'Someone' });
          t.objectStore('lines').put({ id: 'moved-song', ver: 1, hop: 0.05, m: new Float32Array(4), readTo: 0, seconds: 1, whole: false, done: false, anchored: true });
          await new Promise((ok) => (t.oncomplete = ok));
          d.close();
        })()`);
        /* the old app opens it first, as it would */
        await p2.goto(ORIGIN + '/repertoire-pro/next.html');
        const oldFirst = await p2.waitFor(`typeof LIB !== 'undefined' && !!LIB.db`, 30000);
        const oldStores = await p2.eval(`LIB.db ? [...LIB.db.objectStoreNames].join() : ''`);
        const errs1 = p2.errors.length;
        /* then this app */
        await p2.goto(URL_APP + '?load=' + ++loads + '#/sing/learn');
        await sleep(3000);
        const songs = await p2.eval(`[...document.querySelectorAll('.song-row')].map((b) => b.querySelector('strong')?.textContent)`);
        const shared = await p2.eval(`(async () => { const d = await new Promise((ok) => { const q = indexedDB.open('repertoire'); q.onsuccess = () => ok(q.result); });
          const n = await new Promise((ok) => { const q = d.transaction('songs').objectStore('songs').count(); q.onsuccess = () => ok(q.result); });
          const v = d.version, stores = [...d.objectStoreNames].join(); d.close(); return { n, v, stores }; })()`);
        /* and the old app again, after this app */
        await p2.goto(ORIGIN + '/repertoire-pro/next.html');
        const oldAgain = await p2.waitFor(`typeof LIB !== 'undefined' && !!LIB.db && LIB.db.objectStoreNames.contains('playlists')`, 30000);
        /* the plain case on the first browser: this app first, then the old app */
        await page.goto(ORIGIN + '/repertoire-pro/next.html');
        const oldAfterNew = await page.waitFor(`typeof LIB !== 'undefined' && !!LIB.db && LIB.db.objectStoreNames.contains('playlists')`, 30000);
        const errsMain = page.errors.length;
        await open();
        check('apps-side-by-side', oldFirst && /playlists/.test(oldStores) && songs.includes('Moved song') && !songs.includes('Old app song')
          && shared.n === 2 && oldAgain && oldAfterNew && errs1 === 0 && p2.errors.length === 0 && errsMain === 0,
          `a phone that had both apps sharing one store: the old app opened it with its library parts (${oldStores}); this app then listed ${JSON.stringify(songs)} ` +
          `(its own song copied over, the old app's left alone); the shared store still holds its ${shared.n} songs; the old app works after it ${oldAgain}; ` +
          `on a phone that opened this app first, the old app works too ${oldAfterNew}; page errors ${p2.errors.concat(page.errors).join(' | ') || 'none'}`);
      }
      await signInAs(p2, EMAIL);
      await p2.goto(URL_APP + '?load=' + ++loads + '#/sing/learn');
      const listed = await p2.waitFor(`!!document.querySelector('.take-row[data-take="${keptOnly.id}"] .take-hear:not([disabled])')`, 40000);
      const text = await p2.eval(`document.querySelector('.take-row[data-take="${keptOnly.id}"]')?.innerText || ''`);
      const stored = await p2.eval(`(async () => { const db = await new Promise((ok) => { const q = indexedDB.open('repertoire-app'); q.onsuccess = () => ok(q.result); });
        const t = await new Promise((ok) => { const q = db.transaction('takes').objectStore('takes').get(${JSON.stringify(keptOnly.id)}); q.onsuccess = () => ok(q.result); });
        db.close(); return t ? { audio: !!t.audio, songs: 0 } : null; })()`);
      let played = null;
      if (listed) {
        await p2.tap(`.take-row[data-take="${keptOnly.id}"] .take-hear`);
        await p2.waitFor(`window.__probe.starts.length >= 1`, 15000);
        played = await p2.eval(`window.__probe.starts[0]?.seconds`);
        await sleep(500);
        await p2.tap(`.take-row[data-take="${keptOnly.id}"] .take-hear`);
      }
      if (want('take-new-phone')) {
        check('take-new-phone', listed && text.includes('Take test song') && text.includes(`${keptOnly.rightPct}% right notes`) && stored && !stored.audio
          && played != null && Math.abs(played - keptOnly.seconds) < 0.2,
          `a fresh browser, nothing stored, signed in: Learn a song lists "${text.replace(/\n/g, ' / ')}"; tapped, it played ${played?.toFixed(1)} s ` +
          `(the take is ${keptOnly.seconds.toFixed(1)} s), heard from online`);
      }
      if (want('old-app-takes')) {
        /* on this phone the old app's store still holds what the planted
           "before 5 Oct" data put there: said, not judged here */
        const planted = await oldAppLooks(p2, keptOnly);
        sideNote = planted.odd.length ? `on the phone that had shared one store, the old app shows: ${planted.odd.join(', ')}` : '';
      }
    } finally {
      await env2.close();
    }
  }

  if (want('old-app-takes') && keptOnly) {
    /* the old app, signed in as the same singer, with a take that has no coach */
    const errs = page.errors.length;
    const r = await oldAppLooks(page, keptOnly);
    const newErrs = page.errors.slice(errs);
    await open();
    check('old-app-takes', r.loaded && r.takes.length === 1 && r.takes[0] === null && r.odd.length === 0 && newErrs.length === 0,
      `the old app, signed in as the singer: loaded with the take that has no coach ${r.takes.length === 1 && r.takes[0] === null}; ` +
      `its five tabs shown with nothing blank or broken ${r.odd.length === 0 ? 'true' : 'false (' + r.odd.join(', ') + ')'}; page errors ${newErrs.length ? newErrs.join(' | ') : 'none'}` +
      (sideNote ? `. (Separately: ${sideNote})` : ''));
  }

  /* 7. a kept take sent later: shared with the coach, the recording not uploaded again */
  if (want('take-send-kept') && keptOnly) {
    const ups = () => page.eval(S(`net.filter((u) => u.includes('/storage/v1/object/takes/${keptOnly.path}')).length`));
    await page.waitFor(`!!document.querySelector('.take-row[data-take="${keptOnly.id}"] .take-more')`, 15000);
    const before = await ups();
    await page.tap(`.take-row[data-take="${keptOnly.id}"] .take-more`);
    await page.tap(`.take-row[data-take="${keptOnly.id}"] .take-send`);
    await page.waitFor(`!!document.querySelector('#send-go')`, 10000);
    await page.tap('.coach-pick input');
    await page.tap('#send-go');
    await page.waitFor(`!!document.querySelector('#song-play')`, 5000);
    const marked = await page.waitFor(`document.querySelector('.take-row[data-take="${keptOnly.id}"]')?.innerText.includes('Sent to Test Coach')`, 30000);
    const after = await ups();
    const seen = asCoach(keptOnly.path);
    check('take-send-kept', marked && after === before && seen.rows === 1 && seen.opens,
      `a saved take sent from its menu: marked "Sent to Test Coach" ${marked}; uploads of its recording during the send: ${after - before}; ` +
      `the coach now sees ${seen.rows} row for it and can play it ${seen.opens}`);
  }

  /* 8. a coach no longer linked loses the takes sent before */
  if (want('take-unlinked')) {
    const sent = (await takesKept()).find((t) => made.has(t.id) && t.path && t.sent.length);
    const before = sent ? asCoach(sent.path).opens : null;
    let after = null, back = null;
    try {
      unlink();
      after = sent ? asCoach(sent.path).opens : null;
    } finally {
      relink();
      back = linked();
    }
    const again = sent ? asCoach(sent.path).opens : null;
    check('take-unlinked', before === true && after === false && back && again === true,
      `a take sent to the coach: the coach can open it ${before}; with the link removed ${after}; ` +
      `link restored ${back}, and it opens again ${again}`);
  }

  if (want('take-words')) {
    const { strayWords } = await import('./checks.mjs');
    await singTake(SUNG, 3);
    const stray = await strayWords(page);
    await page.tap('#take-again');
    check('take-words', stray.length === 0, stray.length ? 'words not from the copy: ' + stray.join(' | ') : 'every word on the song screen with a take is from the copy');
  }
  /* 8. a singer with no coach (the test coach, singing as a singer) */
  if (want('take-no-coach')) {
    await signInAs(page, COACH_EMAIL);
    await open();
    await singTake(SUNG, 3);
    await page.tap('#take-send');
    const said = await page.waitFor(`document.querySelector('#no-coach')?.textContent === ${JSON.stringify(copy.send.none)}`, 10000);
    const noSend = await page.eval(`!document.querySelector('#send-go')`);
    await page.tap('main .back');
    await page.waitFor(`!!document.querySelector('#take-again')`, 5000);
    await page.tap('#take-again');
    await signInAs(page, EMAIL);
    check('take-no-coach', said && noSend, `signed in as a singer with no coach, Send to a coach says "${copy.send.none}" ${said}, with nothing to send to ${noSend}`);
  }

  check('no-page-errors', page.errors.length === 0, page.errors.join(' | '));
} catch (e) {
  const why = 'the test stopped: ' + String(e.message || e).split('\n')[0];
  const said = new Set(results.map((r) => r.name));
  for (const name of ALL) if (want(name) && !said.has(name)) check(name, false, why);
} finally {
  /* every take this run made goes, through the app (and nothing else) */
  try {
    await page.c.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    if (made.size) await signInAs(page, EMAIL);         /* only the singer can delete its takes */
    for (const id of made) {
      if (!(await page.eval(`!!document.querySelector('.take-row[data-take="${id}"]')`))) await open();
      if (await page.eval(`!!document.querySelector('.take-row[data-take="${id}"]')`)) {
        await page.tap(`.take-row[data-take="${id}"] .take-more`);
        await page.tap(`.take-row[data-take="${id}"] .take-delete`);
      }
    }
    if (made.size) await sleep(8000);
    const left = (await takesKept()).filter((t) => made.has(t.id)).length;
    if (left) console.log(`note: ${left} test take(s) were still on the phone`);
  } catch { /* the browser is gone */ }
  /* and whatever is left online of the test singer's takes */
  try {
    const r = clearTestTakes();
    if (r.rows || r.files) console.log(`note: removed what was left online of the test singer's takes: ${r.rows} rows, ${r.files} recordings`);
  } catch (e) {
    console.log('note: could not clear the test singer\'s takes: ' + e.message);
  }
  await env.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} of ${results.length} checks FAILED` : `\nall ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
