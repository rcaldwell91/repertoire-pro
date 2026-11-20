/* Screenshots for the 20 Nov report (Robert: "screenshots at 390 and 360
   wide before sign-off, of a five-note scale and of the biggest pattern"):
   Mum (five notes) and Big climb's arpeggio (19 half steps, the biggest
   pattern) while a real voice sings (RP_SPLIT), at 390 x 844 and 360 x 740;
   and Bwoop and Note bends at 360 x 740. One zoom, bubbles the band that
   counts. Writes PNGs to OUT. */
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
const RANGE = { lo: HOME - 10, hi: HOME + 12 };

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
const open = async (id, level) => {
  await page.goto(URL_APP + '?load=' + ++loads + '#/train');
  await page.waitFor(`!!document.querySelector('#today')`, 8000);
  await page.eval(`localStorage.setItem('rp.range', ${JSON.stringify(JSON.stringify({ ...RANGE, at: '2026-11-20T00:00:00Z', by: 'test' }))});
    ${level ? `localStorage.setItem('rp.level.${id}', '${level}')` : ''}`);
  await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/' + id);
  await page.waitFor(`!!document.querySelector('#ex-start')`, 8000);
};
async function singing(id, name, wait = 4600, level) {
  await open(id, level);
  /* the voice where a singer's is: 0.09 s after each piano note (his takes) */
  const piano = await page.eval(`JSON.parse(document.querySelector('#ex-start').dataset.piano).filter((n) => !n[3])`);
  const voice = singNotes(FFMPEG, SOURCE, STEADY, piano.map(([m, t, d]) => ({ m, t: t + 0.09, d })), tmp);
  await page.eval(`window.__mirror.on = true; window.__mirror.atOnce = false; window.__mirror.load(${JSON.stringify(voice.buffer.toString('base64'))})`);
  await page.tap('#ex-start');
  await page.waitFor(`window.__probe.starts.some((x) => x.seconds > 0.2)`, 12000);
  await sleep(wait);
  const d = await page.eval(`(() => { const x = document.querySelector('#bubbles').dataset; return x.bubble + ' px bubbles on ' + x.row + ' px rows, the view ' + x.zoom + ' half steps tall'; })()`);
  await shot(name);
  console.log('  ', d);
  await page.tap('#ex-close');
}
await size(390, 844);
await singing('mum', '1-five-note-mum-390x844.png');
await singing('arp19', '2-biggest-pattern-arp19-390x844.png', 6200);
await size(360, 740);
await singing('mum', '3-five-note-mum-360x740.png');
await singing('arp19', '4-biggest-pattern-arp19-360x740.png', 6200);
await singing('bwoop', '5-bwoop-360x740.png', 5200);
await singing('bends', '6-note-bends-360x740.png', 5200);
await env.close();
server.close();
