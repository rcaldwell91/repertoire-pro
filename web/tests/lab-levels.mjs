/* Robert, 21 Nov: "every speed you ship must pass your real-voice lab
   check at that level's band; if a level can't pass, don't ship it". Every
   scored exercise at every level, on the built app, with a real voice
   (never a tone; RP_SPLIT, kept outside the repo):
     - sung right, arriving 0.09 s after each piano note (his takes);
     - at Beginner, sung a half step off: must still fail;
   short-note exercises with real short sung syllables (0.15 s).
   Exercises that sing the same notes at the same speed and band are run
   once. Pass (the 4 Nov rule): right 85% or more, off 15% or less.
   IDS=a,b runs only those. Prints a line a run and a table; exits 1 if a
   level fails. */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { launch, sleep } from './chrome.mjs';
import { ANDROID, MIRROR, PROBE, serve } from './harness.mjs';
import { pcm, singNotes, singShort, steadyNote, syllables } from './voice.mjs';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const PREFIX = process.env.RP_SPLIT || '';
const SOURCE30 = `${PREFIX}-voice30.mp3`, SOURCE = `${PREFIX}-voice.mp3`;
const tmp = mkdtempSync(join(tmpdir(), 'rp-levels-'));
const SILENCE = join(tmp, 'silence.wav');
spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '30', SILENCE]);
const STEADY = steadyNote(pcm(FFMPEG, SOURCE30));
const POOL = syllables(pcm(FFMPEG, SOURCE));
const HOME = Math.round(STEADY.m);
const RANGE = { lo: HOME - 6, hi: HOME + 7 };
const b64 = (v) => v.buffer.toString('base64');
const ARRIVE = 0.09, PASS = 0.85, FAIL = 0.15;

/* which exercises and levels: read from the source list */
const src = readFileSync(join(WEB, 'src/core/exercises.ts'), 'utf8');
const body = src.slice(src.indexOf('const LISTED'), src.indexOf('export function exercise('));
const IDS = [...body.matchAll(/(?:ex|leveled)\('([a-z0-9]+)'/g)].map((m) => m[1]).filter((id) => !process.env.IDS || process.env.IDS.split(',').includes(id));

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
async function run(voice) {
  await page.eval(`window.__mirror.on = true; window.__mirror.atOnce = false; window.__mirror.load(${JSON.stringify(b64(voice))})`);
  await page.tap('#ex-start');
  await page.waitFor(`!!document.querySelector('#ex-result')`, 240000);
  const s = await page.eval(`document.querySelector('#ex-score')?.textContent ?? ''`);
  const m = /(\d+) of (\d+)/.exec(s);
  await sleep(200);
  return m ? { hits: +m[1], n: +m[2] } : { hits: 0, n: 0 };
}

const done = new Map();
const rows = [];
let failed = 0;
for (const id of IDS) {
  for (const level of [1, 2, 3]) {
    const o = await open(id, level);
    /* not sung over the piano (parts, slides, clocks): measured elsewhere */
    if (!o.round) break;
    const notes = (o.piano ?? o.round).map(([m, t, d]) => ({ m, t, d }));
    const short = id === 'staccato' || id === 'pops' || id === 'bwoop';
    const key = JSON.stringify([notes.map((n) => [n.m - notes[0].m, +n.t.toFixed(3), +n.d.toFixed(3)]), short, level, o.piano ? 'p' : 'r', id === 'interval' || id === 'match' ? id : '']);
    const singAt = (shift) => (short ? singShort(FFMPEG, SOURCE, POOL, notes.map((n) => ({ ...n, t: n.t + ARRIVE })), tmp, { sungFor: 0.15, shift })
      : singNotes(FFMPEG, SOURCE30, STEADY, notes.map((n) => ({ ...n, t: n.t + ARRIVE })), tmp, { shift }));
    let res = done.get(key);
    if (!res) {
      const right = await run(singAt(0));
      /* the level it was sung at, as the result says: one it doesn't have is skipped */
      right.level = +(await page.eval(`document.querySelector('#ex-level')?.dataset.level ?? 0`));
      if (right.level !== level) { console.log(`${id} level ${level}: none (sung at ${right.level || 'its one level'})`); if (!right.level) break; continue; }
      let off = null;
      if (level === 1) {
        await open(id, level);
        off = await run(singAt(1));
      }
      res = { right, off };
      done.set(key, res);
    }
    const okRight = res.right.n > 0 && res.right.hits / res.right.n >= PASS;
    const okOff = !res.off || res.off.hits / Math.max(1, res.off.n) <= FAIL;
    if (!okRight || !okOff) failed++;
    const pct = (r) => (r ? `${r.hits} of ${r.n} (${Math.round((100 * r.hits) / Math.max(1, r.n))}%)` : '-');
    const line = `${id} level ${level}: right ${pct(res.right)}; a half step off ${pct(res.off)}${okRight && okOff ? '' : '  FAILS'}`;
    console.log(line);
    rows.push(line);
  }
}
await env.close();
server.close();
console.log(failed ? `${failed} level(s) fail` : 'every level passes');
process.exit(failed ? 1 : 0);
