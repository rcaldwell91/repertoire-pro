/* The two scoring questions in the 4 Nov plan, on the built app, with a
   real voice (never a tone):
   A. very short notes (Staccato, Consonant pops): every note sung right
      with a real short sung sound of 0.1, 0.15, 0.2 and 0.3 s, each with
      its own natural start and end (tests/voice.mjs syllables), at the
      note's start; then the same three half steps off;
   B. the runs and the nine-tone scale at every speed: sung right, sung
      off, and sung right but arriving 80 ms after each piano note.
   The voice is the separated voice of a real song (RP_SPLIT, kept outside
   the repo). Prints a line per case and the counts; it measures and
   reports, it doesn't pass or fail the build. ONLY=a,b to run one part. */
import { mkdtempSync } from 'node:fs';
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
const ONLY = (process.env.ONLY || 'a,b').split(',');
const SOURCE30 = `${PREFIX}-voice30.mp3`, SOURCE = `${PREFIX}-voice.mp3`;
const tmp = mkdtempSync(join(tmpdir(), 'rp-lab-'));
const SILENCE = join(tmp, 'silence.wav');
spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '30', SILENCE]);
const STEADY = steadyNote(pcm(FFMPEG, SOURCE30));
const POOL = syllables(pcm(FFMPEG, SOURCE));
const HOME = Math.round(STEADY.m);
const RANGE = { lo: HOME - 4, hi: HOME + 5 };
const b64 = (v) => v.buffer.toString('base64');

const { server, ORIGIN, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: SILENCE, allowMic: true });
await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin: ORIGIN });
const { page } = env;
await page.addInitScript(ANDROID);
await page.addInitScript(MIRROR);
await page.addInitScript(PROBE);
let loads = 0;

async function run(id, level, voiceOf, label) {
  await page.goto(URL_APP + '?load=' + ++loads + '#/train');
  await page.waitFor(`!!document.querySelector('main h1')`, 8000);
  await page.eval(`localStorage.setItem('rp.range', ${JSON.stringify(JSON.stringify({ ...RANGE, at: '2026-11-13T00:00:00Z', by: 'test' }))});
    localStorage.setItem('rp.level.${id}', '${level}')`);
  await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/' + id);
  await page.waitFor(`!!document.querySelector('#ex-start')`, 8000);
  const round = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.round)`);
  const notes = round.map(([m, t, d]) => ({ m, t, d }));
  await page.eval(`window.__mirror.on = true; window.__mirror.atOnce = false; window.__mirror.load(${JSON.stringify(b64(voiceOf(notes)))})`);
  await page.tap('#ex-start');
  const end = Math.max(...notes.map((n) => n.t + n.d));
  await page.waitFor(`!!document.querySelector('#ex-result')`, end * 1000 + 15000);
  const s = await page.eval(`document.querySelector('#ex-score')?.textContent ?? ''`);
  const m = /(\d+) of (\d+)/.exec(s);
  const hits = m ? +m[1] : 0, n = m ? +m[2] : notes.length;
  const short = Math.min(...notes.map((x) => x.d));
  console.log(`${label}: ${hits} of ${n} (${Math.round((100 * hits) / Math.max(1, n))}%), notes ${short.toFixed(3)} s`);
  await sleep(300);
  return { hits, n };
}

if (ONLY.includes('a')) {
  console.log(`A. very short notes, real syllables from the recording (${POOL.length} found)`);
  for (const [id, level] of [['staccato', 2], ['pops', 1]]) {
    for (const len of [0.1, 0.15, 0.2, 0.3]) {
      await run(id, level, (notes) => singShort(FFMPEG, SOURCE, POOL, notes, tmp, { sungFor: len }), `${id} sung right, ${len} s a note`);
    }
    for (const len of [0.15, 0.3]) {
      await run(id, level, (notes) => singShort(FFMPEG, SOURCE, POOL, notes, tmp, { sungFor: len, shift: 3 }), `${id} three half steps off, ${len} s a note`);
    }
  }
}
if (ONLY.includes('b')) {
  console.log('B. runs at speed');
  const cases = [['run5', [1, 2, 3]], ['minor5', [1, 2, 3]], ['penta', [1, 2, 3]], ['chrom', [2, 3]], ['turns', [2, 3]], ['ninetone', [2, 3]]];
  for (const [id, levels] of cases) {
    for (const level of levels) {
      await run(id, level, (notes) => singNotes(FFMPEG, SOURCE30, STEADY, notes, tmp), `${id} level ${level} right`);
      await run(id, level, (notes) => singNotes(FFMPEG, SOURCE30, STEADY, notes.map((n) => ({ ...n, t: n.t + 0.08 })), tmp), `${id} level ${level} right, 80 ms late`);
      await run(id, level, (notes) => singNotes(FFMPEG, SOURCE30, STEADY, notes, tmp, { shift: 3 }), `${id} level ${level} three half steps off`);
    }
  }
}
await env.close();
server.close();
