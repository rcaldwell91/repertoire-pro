/* The 20 Nov timing round, on the built app, with a real voice (never a
   tone): Robert, 13 and 20 Nov, "the first note of every round never
   counts, even sung right on time". Each case is sung from silence at the
   start of every round, the way a singer does after the lead note:
     - right, on the beat (the voice starting with the piano);
     - right, arriving when his saved takes say a voice arrives: 0.09 s
       after the piano (the median, 0.14 s by the app's own line, which
       reads about 0.05 s late);
     - right, arriving late: 0.2 s after the piano (later than nine notes
       in ten in his takes, by the line: 0.24 s);
     - three half steps off, at the same arrival: must still score low.
   The short-note exercises (Staccato, Consonant pops, Bwoop) with real
   short sung syllables of 0.1 to 0.3 s.
   Every note counted, and the first note of each round on its own. The
   voice is the separated voice of a real song (RP_SPLIT, kept outside the
   repo). APP_DIR points it at another build (the one live before, to
   compare). Measures and reports; doesn't pass or fail. ONLY=a,b. */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { launch, sleep } from './chrome.mjs';
import { ANDROID, MIRROR, PROBE, serve } from './harness.mjs';
import { pcm, pitchTrack, singNotes, singShort, steadyNote, syllables } from './voice.mjs';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const PREFIX = process.env.RP_SPLIT || '';
const ONLY = (process.env.ONLY || 'a,b').split(',');
const SOURCE30 = `${PREFIX}-voice30.mp3`, SOURCE = `${PREFIX}-voice.mp3`;
const tmp = mkdtempSync(join(tmpdir(), 'rp-timing-'));
const SILENCE = join(tmp, 'silence.wav');
spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '30', SILENCE]);
const STEADY = steadyNote(pcm(FFMPEG, SOURCE30));
const POOL = syllables(pcm(FFMPEG, SOURCE));
const HOME = Math.round(STEADY.m);
const RANGE = { lo: HOME - 6, hi: HOME + 7 };
const b64 = (v) => v.buffer.toString('base64');

const { server, ORIGIN, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: SILENCE, allowMic: true });
await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin: ORIGIN });
const { page } = env;
await page.addInitScript(ANDROID);
await page.addInitScript(MIRROR);
await page.addInitScript(PROBE);
let loads = 0;

/** one go of an exercise: the piano's notes (not the lead notes), the voice
    made from them, Start, and what the result says: every note, and the
    first of each round */
async function run(id, level, voiceOf, label, range = RANGE) {
  await page.goto(URL_APP + '?load=' + ++loads + '#/train');
  await page.waitFor(`!!document.querySelector('main h1')`, 8000);
  await page.eval(`localStorage.setItem('rp.range', ${JSON.stringify(JSON.stringify({ ...range, at: '2026-11-13T00:00:00Z', by: 'test' }))});
    localStorage.setItem('rp.level.${id}', '${level}')`);
  await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/' + id);
  await page.waitFor(`!!document.querySelector('#ex-start')`, 8000);
  /* the piano's notes: this build's own list if it has one (lead notes marked), else the sung notes (the build before) */
  const piano = await page.eval(`(() => { const b = document.querySelector('#ex-start');
    return b.dataset.piano ? JSON.parse(b.dataset.piano).filter((n) => !n[3]) : JSON.parse(b.dataset.round); })()`);
  const notes = piano.map(([m, t, d]) => ({ m, t, d }));
  /* the first note of each round: one after a gap */
  const first = notes.map((n, i) => i === 0 || n.t - (notes[i - 1].t + notes[i - 1].d) > 0.2);
  await page.eval(`window.__mirror.on = true; window.__mirror.atOnce = false; window.__mirror.load(${JSON.stringify(b64(voiceOf(notes)))})`);
  await page.tap('#ex-start');
  const end = Math.max(...notes.map((n) => n.t + n.d));
  await page.waitFor(`!!document.querySelector('#ex-result')`, end * 1000 + 15000);
  const s = await page.eval(`document.querySelector('#ex-score')?.textContent ?? ''`);
  const hitStr = await page.eval(`document.querySelector('#ex-result')?.dataset.hit ?? ''`);
  const m = /(\d+) of (\d+)/.exec(s);
  const hits = m ? +m[1] : 0, n = m ? +m[2] : notes.length;
  const firsts = first.filter(Boolean).length;
  const firstHits = hitStr ? first.filter((f, i) => f && hitStr[i] === '1').length : null;
  console.log(`${label}: ${hits} of ${n} (${Math.round((100 * hits) / Math.max(1, n))}%)` +
    (firstHits == null ? '' : `; first notes of rounds ${firstHits} of ${firsts}`));
  await sleep(300);
  return { hits, n, firstHits, firsts };
}

const ARRIVE = 0.09, LATE = 0.2;
const at = (dt) => (notes) => notes.map((x) => ({ ...x, t: x.t + dt }));
if (ONLY.includes('a')) {
  console.log('A. sung from silence each round: on the beat, at the measured arrival, late; and three half steps off');
  for (const [id, level] of [['run5', 1], ['run5', 2], ['run5', 3], ['mum', 1], ['nay', 2], ['ninetone', 3], ['sustain', 1]]) {
    await run(id, level, (notes) => singNotes(FFMPEG, SOURCE30, STEADY, notes, tmp), `${id} level ${level} right, on the beat`);
    await run(id, level, (notes) => singNotes(FFMPEG, SOURCE30, STEADY, at(ARRIVE)(notes), tmp), `${id} level ${level} right, ${ARRIVE * 1000} ms after the piano`);
    await run(id, level, (notes) => singNotes(FFMPEG, SOURCE30, STEADY, at(LATE)(notes), tmp), `${id} level ${level} right, ${LATE * 1000} ms after the piano`);
    await run(id, level, (notes) => singNotes(FFMPEG, SOURCE30, STEADY, at(ARRIVE)(notes), tmp, { shift: 3 }), `${id} level ${level} three half steps off`);
  }
}
if (ONLY.includes('b')) {
  const m = pitchTrack(pcm(FFMPEG, SOURCE)).filter(Number.isFinite).sort((a, b) => a - b);
  const VOICE_RANGE = { lo: Math.round(m[Math.floor(m.length * 0.05)]), hi: Math.round(m[Math.floor(m.length * 0.95)]) };
  console.log(`B. short notes, real syllables (${POOL.length} found), at the measured arrival`);
  for (const [id, level, range] of [['bwoop', 3, VOICE_RANGE], ['staccato', 2, RANGE], ['pops', 1, RANGE]]) {
    for (const len of [0.1, 0.15, 0.2, 0.3]) {
      for (const turn of [0, 2]) {
        await run(id, level, (notes) => singShort(FFMPEG, SOURCE, POOL, at(ARRIVE)(notes), tmp, { sungFor: len, turn }),
          `${id} right, ${len} s a note, run ${turn / 2 + 1}`, range);
      }
    }
    await run(id, level, (notes) => singShort(FFMPEG, SOURCE, POOL, at(LATE)(notes), tmp, { sungFor: 0.15 }), `${id} right, 0.15 s a note, ${LATE * 1000} ms after`, range);
    for (const len of [0.15, 0.3]) await run(id, level, (notes) => singShort(FFMPEG, SOURCE, POOL, at(ARRIVE)(notes), tmp, { sungFor: len, shift: 3 }), `${id} three half steps off, ${len} s a note`, range);
  }
}

await env.close();
server.close();
