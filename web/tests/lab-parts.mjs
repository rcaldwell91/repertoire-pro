/* Robert, 21 Nov: every level must pass a real-voice check at its band.
   The lab (lab-levels) sings over the piano; these three are sung note by
   note instead: Match the note (Beginner waits; Intermediate and Advanced
   sung back), Hold the note, Match the tone. Each level sung right by a real
   voice (RP_SPLIT, outside the repo); at Beginner, also a half step off.
   Pass: right 85% or more, off 15% or less. */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { launch } from './chrome.mjs';
import { ANDROID, MIRROR, PROBE, serve } from './harness.mjs';
import { pcm, singNotes, steadyNote } from './voice.mjs';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const PREFIX = process.env.RP_SPLIT || '';
const SOURCE30 = `${PREFIX}-voice30.mp3`;
const tmp = mkdtempSync(join(tmpdir(), 'rp-levels-'));
const SILENCE = join(tmp, 'silence.wav');
spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '30', SILENCE]);
const STEADY = steadyNote(pcm(FFMPEG, SOURCE30));
const HOME = Math.round(STEADY.m);
const RANGE = { lo: HOME - 6, hi: HOME + 7 };
const b64 = (v) => v.buffer.toString('base64');
const ARRIVE = 0.09, PASS = 0.85, FAIL = 0.15;

const { server, ORIGIN, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: SILENCE, allowMic: true });
await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin: ORIGIN });
const { page } = env;
await page.addInitScript(ANDROID);
await page.addInitScript(MIRROR);
await page.addInitScript(PROBE);
let loads = 0;

async function open(id, level) {
  await page.goto(URL_APP + '?load=' + ++loads + '#/train');
  await page.waitFor(`!!document.querySelector('main h1')`, 8000);
  await page.eval(`localStorage.clear(); localStorage.setItem('rp.range', ${JSON.stringify(JSON.stringify({ ...RANGE, at: '2026-11-21T00:00:00Z', by: 'test' }))});
    localStorage.setItem('rp.level.${id}', '${level}'); localStorage.setItem('rp.interval.level', '${level}')`);
  await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/' + id);
  await page.waitFor(`!!document.querySelector('#ex-start')`, 8000);
  return page.eval(`(() => { const b = document.querySelector('#ex-start');
    return { piano: b.dataset.piano ? JSON.parse(b.dataset.piano).filter((n) => !n[3]) : null, round: b.dataset.round ? JSON.parse(b.dataset.round) : null,
      levels: [...document.querySelectorAll('#jump-level .choice')].length }; })()`);
}
const score = async () => {
  const s = await page.eval(`document.querySelector('#ex-score')?.textContent ?? ''`);
  const m = /(\d+) of (\d+)/.exec(s);
  return m ? { hits: +m[1], n: +m[2] } : { hits: 0, n: 0 };
};
const load = (v) => page.eval(`window.__mirror.on = true; window.__mirror.atOnce = false; window.__mirror.load(${JSON.stringify(b64(v))})`);
const steady = (m, t, d, shift) => singNotes(FFMPEG, SOURCE30, STEADY, [{ m, t, d }], tmp, { shift });
const atLevel = () => page.eval(`+(document.querySelector('#ex-level')?.dataset.level ?? 0)`);

/* one note at a time: sing, then Next (or Next while waiting) */
async function byParts(id, level, shift, partVoice, waitMs) {
  await open(id, level);
  const parts = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.parts)`);
  for (let i = 0; i < parts.length; i++) {
    await load(partVoice(parts[i], shift));
    await page.tap(i === 0 ? '#ex-start' : '#ex-next-part');
    const ended = await page.waitFor(`!!document.querySelector('#ex-next-part')`, waitMs);
    if (!ended) {
      /* Match the note at Beginner waits for you: Next moves on */
      await page.tap('#ex-wait-next');
      await page.waitFor(`!!document.querySelector('#ex-next-part')`, 3000);
    }
  }
  await page.tap('#ex-next-part');
  await page.waitFor(`!!document.querySelector('#ex-result')`, 8000);
  return { ...(await score()), level: await atLevel() };
}
/* Match the note at Intermediate and Advanced: each note sung back after it plays */
async function matchBack(level, shift) {
  await open('match', level);
  const round = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.round)`);
  const played = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.played)`);
  const notes = round.map(([m, t, d]) => ({ m: played.filter(([, pt]) => pt <= t + 1e-6).pop()[0], t: t + ARRIVE, d }));
  await load(singNotes(FFMPEG, SOURCE30, STEADY, notes, tmp, { shift }));
  await page.tap('#ex-start');
  await page.waitFor(`!!document.querySelector('#ex-result')`, 240000);
  return { ...(await score()), level: await atLevel() };
}

const PLAN = [
  ['match', 1, (s) => byParts('match', 1, s, (m, sh) => steady(m, 1.6, 3, sh), 7000)],
  ['match', 2, (s) => matchBack(2, s)],
  ['match', 3, (s) => matchBack(3, s)],
  ['holdnote', 1, (s) => byParts('holdnote', 1, s, (m, sh) => steady(m, 0, 6.4, sh), 20000)],
  ['holdnote', 2, (s) => byParts('holdnote', 2, s, (m, sh) => steady(m, 0, 6.4, sh), 20000)],
  ['holdnote', 3, (s) => byParts('holdnote', 3, s, (m, sh) => steady(m, 0, 6.4, sh), 20000)],
  ['matchtone', 1, (s) => byParts('matchtone', 1, s, (m, sh) => steady(m, 0.5, 5.5, sh), 16000)],
  ['matchtone', 2, (s) => byParts('matchtone', 2, s, (m, sh) => steady(m, 0.5, 5.5, sh), 16000)],
  ['matchtone', 3, (s) => byParts('matchtone', 3, s, (m, sh) => steady(m, 0.5, 5.5, sh), 16000)],
].filter(([id]) => !process.env.IDS || process.env.IDS.split(',').includes(id));

let failed = 0;
const pct = (r) => (r ? `${r.hits} of ${r.n} (${Math.round((100 * r.hits) / Math.max(1, r.n))}%)` : '-');
for (const [id, level, go] of PLAN) {
  const right = await go(0);
  if (right.level !== level) { console.log(`${id} level ${level}: none (sung at ${right.level || 'its one level'})`); continue; }
  const off = level === 1 ? await go(1) : null;
  const ok = right.n > 0 && right.hits / right.n >= PASS && (!off || off.hits / Math.max(1, off.n) <= FAIL);
  if (!ok) failed++;
  console.log(`${id} level ${level}: right ${pct(right)}; a half step off ${pct(off)}${ok ? '' : '  FAILS'}`);
}
await env.close();
server.close();
console.log(failed ? `${failed} level(s) fail` : 'every level passes');
process.exit(failed ? 1 : 0);
