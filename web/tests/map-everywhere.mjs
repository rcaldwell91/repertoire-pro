/* The note map on every Train exercise (Robert, 21 Nov: "it slides up and
   down as you rise, but never zooms in or out ... a little over an octave"):
   for each exercise at each of its levels, at 390 x 844 and 360 x 740,
   while it runs: the half steps in view, the spacing, whether the view ever
   changes size, and whether Pause, Restart, the gear, Close, the cue and the
   map all sit whole above the tab bar. Prints a table; exits 1 if any map
   shows fewer than MIN half steps, zooms, or a control doesn't fit. */
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { launch, sleep } from './chrome.mjs';
import { ANDROID, PROBE, serve } from './harness.mjs';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const MIN = Number(process.env.MIN || 13);
const SIZES = (process.env.SIZES || '390x844,360x740').split(',').map((s) => s.split('x').map(Number));
const src = readFileSync(join(WEB, 'src/core/exercises.ts'), 'utf8');
const body = src.slice(src.indexOf('export const EXERCISES'), src.indexOf('export function exercise('));
/* each exercise's id and how many levels it has */
const IDS = [...body.matchAll(/(?:ex|leveled)\('([a-z0-9]+)'/g)].map((m) => m[1]).filter((id) => !process.env.IDS || process.env.IDS.split(',').includes(id));
const tmp = mkdtempSync(join(tmpdir(), 'rp-map-'));
const SILENCE = join(tmp, 'silence.wav');
spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '60', SILENCE]);
const { server, ORIGIN, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: SILENCE, allowMic: true });
await env.browser.send('Browser.setPermission', { permission: { name: 'microphone' }, setting: 'granted', origin: ORIGIN });
const { page } = env;
await page.addInitScript(ANDROID);
await page.addInitScript(PROBE);
let loads = 0, bad = 0;
const RANGE = { lo: 48, hi: 72, at: '2026-11-21T00:00:00Z', by: 'test' };
for (const [w, h] of SIZES) {
  await page.c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: true });
  for (const id of IDS) {
    for (const level of [1, 2, 3]) {
      await page.goto(URL_APP + '?load=' + ++loads + '#/train');
      await page.waitFor(`!!document.querySelector('#today')`, 8000);
      await page.eval(`localStorage.clear(); localStorage.setItem('rp.range', ${JSON.stringify(JSON.stringify(RANGE))}); localStorage.setItem('rp.level.${id}', '${level}')`);
      await page.goto(URL_APP + '?load=' + ++loads + '#/train/ex/' + id);
      if (!(await page.waitFor(`!!document.querySelector('#ex-start')`, 8000))) { console.log(`${w}x${h} ${id}: no Start`); break; }
      const got = await page.eval(`localStorage.getItem('rp.level.${id}')`);
      await page.tap('#ex-start');
      await page.waitFor(`!!document.querySelector('#ex-run')`, 6000);
      const seen = [];
      for (let k = 0; k < 8; k++) {
        await sleep(700);
        seen.push(await page.eval(`(() => {
          const cv = document.querySelector('#bubbles'); const tabs = document.querySelector('.tabs').getBoundingClientRect();
          const whole = (s) => { const e = document.querySelector(s); if (!e) return true; const b = e.getBoundingClientRect(); return b.height === 0 || (b.top >= -1 && b.bottom <= tabs.top + 1 && b.left >= -1 && b.right <= innerWidth + 1); };
          return { map: !!cv, view: cv ? +cv.dataset.viewHi - +cv.dataset.viewLo : null, row: cv ? +cv.dataset.row : null, canvas: cv ? cv.getBoundingClientRect().height : null,
            fits: ['#ex-pause', '#ex-restart', '#ex-gear-run', '#ex-close', '#ex-cue', '#bubbles', '#ex-dots'].every(whole), shown: document.querySelector('#rp-level, .level-name')?.textContent || '' };
        })()`));
      }
      const maps = seen.filter((s) => s.map);
      const views = maps.map((s) => s.view);
      const lo = views.length ? Math.min(...views) : null, hi = views.length ? Math.max(...views) : null;
      const zooms = views.length && hi - lo > 0.05;
      const fits = seen.every((s) => s.fits);
      const few = views.length && lo < MIN;
      if (zooms || !fits || few) bad++;
      console.log(`${w}x${h} ${id} level ${got}: ${maps.length ? `${lo.toFixed(1)}${zooms ? '-' + hi.toFixed(1) : ''} half steps, rows ${maps[0].row} px, map ${Math.round(maps[0].canvas)} px` : 'no map'}${zooms ? ' ZOOMS' : ''}${few ? ' FEWER THAN ' + MIN : ''}${fits ? '' : ' A CONTROL DOES NOT FIT'}`);
      await page.tap('#ex-close').catch(() => {});
      /* one level only when it has no levels inside it */
      if (!new RegExp(`leveled\\('${id}'`).test(body)) break;
    }
  }
}
await env.close();
server.close();
process.exit(bad ? 1 : 0);
