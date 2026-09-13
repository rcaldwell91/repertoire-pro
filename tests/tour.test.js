/* Repertoire Pro — the walkthrough, tested in a real browser.
   Robert, 13 Sep: "Add a test that the tour opens on first run, skips
   cleanly, and restarts from Profile."
   Runs against the built next.html (or RP_URL). Exit 1 on any failure. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const URL_ = process.env.RP_URL || 'https://rcaldwell91.github.io/repertoire-pro/next.html';
const LOCAL = process.env.RP_LOCAL || path.join(__dirname, '..', 'next.html');
let fails = 0;
function ok(cond, what) { console.log((cond ? '  ✓ ' : '  ✗ ') + what); if (!cond) fails++; }

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--no-sandbox',
      '--disable-features=PostQuantumKyber,TLS13KyberSupport,EncryptedClientHello,UseDnsHttpsSvcb,UseDnsHttpsSvcbAlpn', '--ssl-version-max=tls1.2']
  });
  const ctx = await browser.newContext({ viewport: { width: 412, height: 900 }, permissions: ['microphone'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  if (fs.existsSync(LOCAL)) {
    const body = fs.readFileSync(LOCAL, 'utf8');
    await p.route('**/*', r => r.request().url() === URL_ ? r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body }) : r.continue());
  }
  await p.goto(URL_, { waitUntil: 'load', timeout: 120000 });
  await p.waitForTimeout(4500);

  console.log('first run');
  ok(await p.evaluate(() => window.RPTour && RPTour.running()), 'tour opens by itself on first run');
  ok(!(await p.evaluate(() => { const o = document.getElementById('rpSheet'); return !!(o && o.style.display !== 'none' && o.innerHTML); })), 'no questionnaire on top of it');
  ok(await p.evaluate(() => getComputedStyle(document.getElementById('rpTourDim')).pointerEvents === 'none'), 'the dark part is click-through — the app is not blocked');
  ok(await p.evaluate(() => /1 OF \d/.test(document.getElementById('rpTourCard').innerText)), 'card shows step 1');

  console.log('skip');
  await p.evaluate(() => document.getElementById('rpTourNext').click()); await p.waitForTimeout(700);
  await p.evaluate(() => document.getElementById('rpTourSkip').click()); await p.waitForTimeout(400);
  ok(!(await p.evaluate(() => RPTour.running())), 'skip stops it');
  ok(await p.evaluate(() => !document.getElementById('rpTourDim') && !document.getElementById('rpTourCard')), 'skip removes the overlay');
  ok((await p.evaluate(() => localStorage.getItem('rp_tour_student'))) === 'done', 'skip counts as seen — it will not nag');
  await p.evaluate(() => window.switchMode('train')); await p.waitForTimeout(700);
  ok(await p.evaluate(() => (document.querySelector('.mode.active') || {}).id === 'modeTrain'), 'app works normally after a skip');

  console.log('does not come back');
  await p.reload({ waitUntil: 'load' }); await p.waitForTimeout(4500);
  ok(!(await p.evaluate(() => RPTour.running())), 'not shown again on the next open');

  console.log('restart from Profile');
  await p.evaluate(() => window.switchMode('you')); await p.waitForTimeout(2000);
  ok(!!(await p.$('#rpHelpRow')), 'Help row is in Profile');
  await p.evaluate(() => document.getElementById('rpHelpRow').click()); await p.waitForTimeout(800);
  ok(await p.evaluate(() => /How to use Repertoire/.test(document.getElementById('rpSheet').innerText)), 'Help page opens');
  await p.evaluate(() => document.getElementById('rpHelpTour').click()); await p.waitForTimeout(1200);
  ok(await p.evaluate(() => RPTour.running()), 'tour restarts from Help');
  let n = 0;
  while (await p.evaluate(() => RPTour.running()) && n++ < 12) { await p.evaluate(() => document.getElementById('rpTourNext').click()); await p.waitForTimeout(650); }
  ok(!(await p.evaluate(() => RPTour.running())) && n === 8, 'Next walks all 8 steps and Done closes it (' + n + ' presses)');

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await browser.close();
  console.log(fails ? '\nTOUR TEST FAILED (' + fails + ')' : '\nTOUR TEST PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
