/* Screenshots at the narrowest phone width (360 px), for the report:
   an exercise page and a running exercise, both with the menu, sung by a
   real voice (RP_SPLIT). Writes PNGs to OUT (a folder outside the repo, or
   the report's folder). */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { launch, sleep } from './chrome.mjs';
import { ANDROID, MIRROR, PROBE, serve } from './harness.mjs';
import { pcm, singNotes, steadyNote } from './voice.mjs';

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
const RANGE = { lo: HOME - 6, hi: HOME + 8 };

const { server, ORIGIN, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: SILENCE, allowMic: true });
await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin: ORIGIN });
const { page } = env;
await page.addInitScript(ANDROID);
await page.addInitScript(MIRROR);
await page.addInitScript(PROBE);
await page.c.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 760, deviceScaleFactor: 2, mobile: true });
let loads = 0;
const shot = async (name) => {
  const png = await page.screenshot();
  writeFileSync(join(OUT, name), png);
  console.log('wrote', join(OUT, name));
};
await page.goto(URL_APP + '?load=' + ++loads + '#/train');
await page.waitFor(`!!document.querySelector('#today')`, 8000);
await page.eval(`localStorage.setItem('rp.range', ${JSON.stringify(JSON.stringify({ ...RANGE, at: '2026-11-13T00:00:00Z', by: 'test' }))});
  localStorage.setItem('rp.tension', JSON.stringify({ spots: ['jaw'] }))`);
await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/straw');
await page.waitFor(`!!document.querySelector('#ex-start')`, 8000);
await sleep(600);
await shot('1-exercise-page-360.png');
const round = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.round)`);
const notes = round.map(([m, t, d]) => ({ m, t, d }));
const voice = singNotes(FFMPEG, SOURCE, STEADY, notes, tmp);
await page.eval(`window.__mirror.on = true; window.__mirror.load(${JSON.stringify(voice.buffer.toString('base64'))})`);
await page.tap('#ex-start');
await page.waitFor(`window.__probe.starts.some((x) => x.seconds > 0.2)`, 12000);
await sleep(5200);
await shot('2-singing-360.png');
await page.tap('#ex-close');
await env.close();
server.close();
