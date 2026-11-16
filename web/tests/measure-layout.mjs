/* Where the room goes on the singing screen (16 Nov, bubbles back to 40 px):
   every part's top and height, while Mum is singing, at the phone sizes
   given (SIZES=390x844,360x740). Prints; doesn't pass or fail. */
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './chrome.mjs';
import { ANDROID, PROBE, serve } from './harness.mjs';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const SIZES = (process.env.SIZES || '390x844,360x740,360x800').split(',').map((s) => s.split('x').map(Number));
const ID = process.env.EX || 'mum';
const { server, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: process.env.RP_MIC, allowMic: true });
await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin: new URL(URL_APP).origin });
const { page } = env;
await page.addInitScript(ANDROID);
await page.addInitScript(PROBE);
let loads = 0;
for (const [w, h] of SIZES) {
  await page.c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: true });
  await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/' + ID);
  await page.waitFor(`!!document.querySelector('#ex-start')`, 8000);
  await page.tap('#ex-start');
  await page.waitFor(`!!document.querySelector('#ex-run')`, 6000);
  await sleep(3500);
  const r = await page.eval(`(() => {
    const at = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return Math.round(b.top) + '+' + Math.round(b.height); };
    const cv = document.querySelector('#bubbles');
    return { run: at('#ex-run'), top: at('.sing-top'), status: at('#mic-line'), prompt: at('.sing-prompt'), map: at('.sing-map'), dots: at('.sing .dots'),
      body: at('.sing-body'), bar: at('.sing-bar'), tabs: at('.tabs'), bubble: cv?.dataset.bubble, row: cv?.dataset.row, canvas: cv?.getBoundingClientRect().height, view: cv ? (+cv.dataset.viewHi - +cv.dataset.viewLo).toFixed(1) : null };
  })()`);
  console.log(`${w}x${h}`, JSON.stringify(r));
  await page.tap('#ex-close');
}
await env.close();
server.close();
