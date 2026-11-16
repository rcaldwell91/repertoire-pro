/* Screenshots for the 16 Nov report: Mum singing at 390 x 844 and 360 x 740
   (bubbles back to 40 px with the menu), Bwoop singing at 360 x 740, and
   Find your resting note after a real voice's slide came to rest. Real voice
   (RP_SPLIT). Writes PNGs to OUT. */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { launch, sleep } from './chrome.mjs';
import { ANDROID, MIRROR, PROBE, serve } from './harness.mjs';
import { pcm, restingSlides, singNotes, steadyNote } from './voice.mjs';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const OUT = process.env.OUT || mkdtempSync(join(tmpdir(), 'rp-shots-'));
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const SOURCE = `${process.env.RP_SPLIT}-voice30.mp3`;
const tmp = mkdtempSync(join(tmpdir(), 'rp-shot-'));
const SILENCE = join(tmp, 'silence.wav');
spawnSync(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '30', SILENCE]);
const STEADY = steadyNote(pcm(FFMPEG, SOURCE));
const HOME = Math.round(STEADY.m);
const RANGE = { lo: HOME - 8, hi: HOME + 8 };

const { server, ORIGIN, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: SILENCE, allowMic: true });
await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin: ORIGIN });
const { page } = env;
await page.addInitScript(ANDROID);
await page.addInitScript(MIRROR);
await page.addInitScript(PROBE);
let loads = 0;
const size = (w, h) => page.c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 2, mobile: true });
const shot = async (name) => {
  writeFileSync(join(OUT, name), await page.screenshot());
  console.log('wrote', join(OUT, name));
};
const open = async (id) => {
  await page.goto(URL_APP + '?load=' + ++loads + '#/train');
  await page.waitFor(`!!document.querySelector('#today')`, 8000);
  await page.eval(`localStorage.setItem('rp.range', ${JSON.stringify(JSON.stringify({ ...RANGE, at: '2026-11-16T00:00:00Z', by: 'test' }))})`);
  await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/' + id);
  await page.waitFor(`!!document.querySelector('#ex-start')`, 8000);
};
async function singing(id, name) {
  await open(id);
  const round = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.round)`);
  const voice = singNotes(FFMPEG, SOURCE, STEADY, round.map(([m, t, d]) => ({ m, t, d })), tmp);
  await page.eval(`window.__mirror.on = true; window.__mirror.atOnce = false; window.__mirror.load(${JSON.stringify(voice.buffer.toString('base64'))})`);
  await page.tap('#ex-start');
  await page.waitFor(`window.__probe.starts.some((x) => x.seconds > 0.2)`, 12000);
  await sleep(4200);
  const px = await page.eval(`document.querySelector('#bubbles').dataset.bubble + ' px bubbles on ' + document.querySelector('#bubbles').dataset.row + ' px rows'`);
  await shot(name);
  console.log('  ', px);
  await page.tap('#ex-close');
}
await size(390, 844);
await singing('mum', '1-mum-singing-390x844.png');
await size(360, 740);
await singing('mum', '2-mum-singing-360x740.png');
await singing('bwoop', '3-bwoop-singing-360x740.png');
/* Find your resting note: one slide that comes to rest, then its line */
await open('restnote');
const rest = restingSlides(FFMPEG, SOURCE, STEADY, [{ t: 4, from: HOME - 1, to: HOME - 6, secs: 1.2, hold: 1.2 }], tmp);
await page.eval(`window.__mirror.on = true; window.__mirror.atOnce = true; window.__mirror.load(${JSON.stringify(rest.buffer.toString('base64'))})`);
await page.tap('#ex-start');
await page.waitFor(`!!document.querySelector('#ex-rest-now')`, 15000);
await sleep(300);
await shot('4-resting-note-360x740.png');
await page.tap('#ex-done');
await page.waitFor(`!!document.querySelector('#ex-rest')`, 5000);
await shot('5-resting-note-result-360x740.png');
await env.close();
server.close();
