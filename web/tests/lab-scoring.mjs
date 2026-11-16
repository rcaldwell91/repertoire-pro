/* The two scoring questions in the 4 Nov plan, on the built app, with a
   real voice (never a tone):
   A. very short notes (Staccato, Consonant pops): every note sung right
      with a real short sung sound of 0.1, 0.15, 0.2 and 0.3 s, each with
      its own natural start and end (tests/voice.mjs syllables), at the
      note's start; then the same three half steps off;
   B. the runs and the nine-tone scale at every speed: sung right, sung
      off, sung right but arriving 80 ms after each piano note, and sung
      right and off with a real slide into every note (tests/voice.mjs
      slides).
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
import { pcm, pitchTrack, restingSlides, singNotes, singShort, slides, steadyNote, syllables } from './voice.mjs';
/* a note's name, as the app writes it (core/notemap) */
const keyName = (m) => ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const PREFIX = process.env.RP_SPLIT || '';
const ONLY = (process.env.ONLY || 'a,b,c,d').split(',');
const SOURCE30 = `${PREFIX}-voice30.mp3`, SOURCE = `${PREFIX}-voice.mp3`;
const tmp = mkdtempSync(join(tmpdir(), 'rp-lab-'));
const SILENCE = join(tmp, 'silence.wav');
spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '30', SILENCE]);
const STEADY = steadyNote(pcm(FFMPEG, SOURCE30));
const POOL = syllables(pcm(FFMPEG, SOURCE));
const SLIDES = slides(pcm(FFMPEG, SOURCE));
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

async function run(id, level, voiceOf, label, range = RANGE) {
  await page.goto(URL_APP + '?load=' + ++loads + '#/train');
  await page.waitFor(`!!document.querySelector('main h1')`, 8000);
  await page.eval(`localStorage.setItem('rp.range', ${JSON.stringify(JSON.stringify({ ...range, at: '2026-11-13T00:00:00Z', by: 'test' }))});
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
  /* Staccato's round is 10 notes: three runs, each with other sounds, so a
     share is out of 30 */
  const total = async (id, level, times, opts, label) => {
    let hits = 0, n = 0;
    for (let turn = 0; turn < times; turn++) {
      const r = await run(id, level, (notes) => singShort(FFMPEG, SOURCE, POOL, notes, tmp, { ...opts, turn: turn * 2 }), `${label}, run ${turn + 1}`);
      hits += r.hits; n += r.n;
    }
    console.log(`= ${label}: ${hits} of ${n} (${Math.round((100 * hits) / Math.max(1, n))}%)`);
  };
  for (const [id, level, times] of [['staccato', 2, 3], ['pops', 1, 1]]) {
    for (const len of [0.1, 0.15, 0.2, 0.3]) await total(id, level, times, { sungFor: len }, `${id} sung right, ${len} s a note`);
    for (const len of [0.15, 0.3]) await total(id, level, times, { sungFor: len, shift: 3 }, `${id} three half steps off, ${len} s a note`);
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
      await run(id, level, (notes) => singNotes(FFMPEG, SOURCE30, STEADY, notes, tmp, { slides: SLIDES, slideSource: SOURCE }), `${id} level ${level} right, sliding into each note`);
      await run(id, level, (notes) => singNotes(FFMPEG, SOURCE30, STEADY, notes, tmp, { slides: SLIDES, slideSource: SOURCE, shift: 3 }), `${id} level ${level} three half steps off, sliding`);
    }
  }
}
if (ONLY.includes('c')) {
  /* C. Find your resting note (Robert, 16 Nov): real sung sound sliding down
     and settling on a note we know, three slides a go, then Done; and slides
     that never settle. Counted: the notes named right, named wrong, and not
     named. */
  console.log('C. Find your resting note: slides that settle on a known note');
  const S30 = SOURCE30;
  let right = 0, wrong = 0, none = 0, n = 0;
  const sets = [[[56, 48], [55, 47], [57, 49]], [[60, 52], [59, 51], [58, 50]], [[53, 45], [54, 46], [52, 44]], [[62, 55], [61, 54], [63, 56]]];
  for (const set of sets) {
    const slidesOf = set.map(([from, to], k) => ({ t: 4 + k * 4, from, to, secs: 1 + 0.3 * k, hold: 1.1 }));
    const got = await rest(restingSlides(FFMPEG, S30, STEADY, slidesOf, tmp));
    set.forEach(([, to], k) => {
      n++;
      if (got[k] == null) none++;
      else if (got[k] === to) right++;
      else wrong++;
    });
    console.log(`  sung to rest on ${set.map(([, to]) => keyName(to)).join(', ')}: named ${got.map((x) => (x == null ? '-' : keyName(x))).join(', ')}`);
  }
  console.log(`= settling slides: ${right} of ${n} named right, ${wrong} named wrong, ${none} not named`);
  const never = await rest(restingSlides(FFMPEG, S30, STEADY, [0, 1, 2].map((k) => ({ t: 4 + k * 4, from: 56 - k, to: 48 - k, secs: 2.6, hold: 0 })), tmp));
  console.log(`= slides that never settle: ${never.filter((x) => x == null).length} of ${never.length} not named (named: ${never.filter((x) => x != null).map(keyName).join(', ') || 'none'})`);
}
if (ONLY.includes('d')) {
  /* D. Bwoop at the heights it reaches (Robert, 16 Nov): the singer's own range
     from the recording, so it climbs from the middle to the top; the short-note rule */
  const m = pitchTrack(pcm(FFMPEG, SOURCE)).filter(Number.isFinite).sort((a, b) => a - b);
  const VOICE_RANGE = { lo: Math.round(m[Math.floor(m.length * 0.05)]), hi: Math.round(m[Math.floor(m.length * 0.95)]) };
  console.log(`D. Bwoop over the singer's own range ${keyName(VOICE_RANGE.lo)} to ${keyName(VOICE_RANGE.hi)}, real syllables`);
  for (const len of [0.1, 0.15, 0.2, 0.3]) {
    for (const turn of [0, 2]) await run('bwoop', 3, (notes) => singShort(FFMPEG, SOURCE, POOL, notes, tmp, { sungFor: len, turn }), `bwoop sung right, ${len} s a note, run ${turn / 2 + 1}`, VOICE_RANGE);
  }
  for (const len of [0.15, 0.3]) await run('bwoop', 3, (notes) => singShort(FFMPEG, SOURCE, POOL, notes, tmp, { sungFor: len, shift: 3 }), `bwoop three half steps off, ${len} s a note`, VOICE_RANGE);
}

/* Find your resting note, sung: Start, the slides, Done; the notes it named, slide by slide */
async function rest(voice) {
  await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/restnote');
  await page.waitFor(`!!document.querySelector('#ex-start')`, 8000);
  await page.eval(`window.__mirror.on = true; window.__mirror.atOnce = true; window.__mirror.load(${JSON.stringify(b64(voice))})`);
  await page.tap('#ex-start');
  await page.waitFor(`!!document.querySelector('#ex-done')`, 8000);
  const secs = voice.buffer.length / 2 / 48000;
  await sleep(secs * 1000 + 1500);
  await page.tap('#ex-done');
  await page.waitFor(`!!document.querySelector('#ex-rest')`, 5000);
  /* each slide's resting note, in order (null: it never settled), as the result holds them */
  return page.eval(`JSON.parse(document.querySelector('#ex-rest').dataset.notes)`);
}

await env.close();
server.close();

