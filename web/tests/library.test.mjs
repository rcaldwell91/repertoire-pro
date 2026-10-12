/* The old app's Library on a phone where both apps once shared storage.
   Until 5 Oct this app kept its songs in the old app's store, so the old
   Library can still list them as "undefined · –:––". On first start this
   app removes, once and quietly, only those records: shaped like this app's
   songs (a file name, the file, a split state; no artist and no added
   time), and only once the same song is safe in this app's own store.
   Anything shaped like an old-app song is never touched.

   Built app, real Chrome. Prints one line per check; exits 1 if any fails.
   ONLY=name,name runs some; APP_DIR points it at another build. */
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './chrome.mjs';
import { serve } from './harness.mjs';
import { copy } from '../src/core/copy.ts';

const WEB = fileURLToPath(new URL('..', import.meta.url));
const REPO = resolve(WEB, '..');
const APP = resolve(process.env.APP_DIR || join(REPO, 'app'));
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (...names) => !ONLY.length || names.some((n) => ONLY.includes(n));
const ALL = ['stray-cleared', 'old-song-kept', 'stray-without-copy-kept', 'once-only', 'no-storage', 'long-title', 'no-page-errors'];
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
}

const { server, ORIGIN, URL_APP } = await serve(REPO, APP);
const env = await launch({ mic: '/dev/null', allowMic: false });
const { page } = env;
/* a phone whose storage refuses, or never answers, when a check asks */
await page.addInitScript(`(() => { const open = IDBFactory.prototype.open; const how = localStorage.getItem('rp.test.idb');
  if (!how) return;
  IDBFactory.prototype.open = function (name, ...a) {
    if (name !== 'repertoire-app') return open.call(this, name, ...a);
    if (how === 'refused') { const fake = { result: null, error: new DOMException('denied', 'UnknownError') };
      setTimeout(() => fake.onerror && fake.onerror({ target: fake }), 10); return fake; }
    return { result: null, error: null };
  }; })()`);

/* both stores, as a phone that ran both apps has them */
const SETUP = `(async () => {
  const open = (name, v, stores) => new Promise((ok, no) => { const q = indexedDB.open(name, v);
    q.onupgradeneeded = () => { for (const s of stores) if (!q.result.objectStoreNames.contains(s)) q.result.createObjectStore(s, { keyPath: 'id' }); };
    q.onsuccess = () => ok(q.result); q.onerror = () => no(q.error); });
  const put = (db, store, list) => new Promise((ok, no) => { const t = db.transaction(store, 'readwrite'); list.forEach((v) => t.objectStore(store).put(v)); t.oncomplete = ok; t.onerror = () => no(t.error); });
  const file = (n) => new Blob([new Uint8Array(n).fill(7)], { type: 'audio/mpeg' });
  /* this app's songs, as it stored them in the shared store */
  const stray = { id: 'new-song-1', title: 'All of Me', created: 1759600000000, fileName: 'All of Me.mp3', file: file(1000), seconds: 240, state: 'ready' };
  const orphan = { id: 'new-song-2', title: 'Ride', created: 1759600000001, fileName: 'Ride.mp3', file: file(2000), state: 'failed' };
  /* the old app's own songs, each way it makes them */
  const oldLib = { id: 's1759000000000_0', title: 'Fly Me', artist: 'Unknown artist', blob: file(3000), addedAt: 1759000000000, key: null, lrc: null, duration: 0 };
  const oldOwn = { id: 'aud_1759000000001', title: 'My song', artist: 'Added by you', kind: 'song', blob: file(4000), added: 1759000000001,
    fileName: 'my song.mp3', file: file(10), state: 'ready' };
  const old = await open('repertoire', 3, ['songs', 'playlists', 'meta', 'packs']);
  await put(old, 'songs', [stray, orphan, oldLib, oldOwn]);
  old.close();
  /* this app's own store: the first song is safe here; the second never made it */
  const mine = await open('repertoire-app', 1, ['songs', 'lines', 'takes']);
  await put(mine, 'songs', [stray]);
  mine.close();
  localStorage.setItem('rp.db.moved', '1');
})()`;

/* what each store holds now, record by record */
const READ = `(async () => {
  const dbs = (await indexedDB.databases()).map((d) => d.name);
  const read = (name) => new Promise((ok) => { if (!dbs.includes(name)) return ok(null);
    const q = indexedDB.open(name); q.onsuccess = () => { const d = q.result; const r = d.transaction('songs').objectStore('songs').getAll();
      r.onsuccess = async () => { const out = {}; for (const v of r.result) { const b = v.blob || v.file;
        out[v.id] = { ...v, blob: undefined, file: undefined, bytes: b ? b.size : null, keys: Object.keys(v).sort().join(',') }; }
        d.close(); ok(out); }; }; });
  return { old: await read('repertoire'), mine: await read('repertoire-app') };
})()`;

try {
  /* a page of the same site that is not the app, so nothing runs before the stores are set up */
  await page.goto(URL_APP + 'favicon.svg');
  await page.eval(SETUP);
  const before = await page.eval(READ);
  await page.goto(URL_APP + '#/home');
  await page.waitFor(`!!document.querySelector('main h1')`, 8000);
  await page.waitFor(`localStorage.getItem('rp.db.strays') === '1'`, 5000);
  const after = await page.eval(READ);

  if (want('stray-cleared')) {
    const gone = !!before.old['new-song-1'] && !after.old['new-song-1'];
    const kept = after.mine?.['new-song-1'];
    check('stray-cleared', gone && !!kept && kept.bytes === 1000 && kept.title === 'All of Me',
      `the stray "All of Me" in the old Library: there before ${!!before.old['new-song-1']}, gone after ${!after.old['new-song-1']}; ` +
      `still in this app with its file ${!!kept && kept.bytes === 1000}`);
  }
  if (want('old-song-kept')) {
    const same = (id) => JSON.stringify(before.old[id]) === JSON.stringify(after.old[id]);
    check('old-song-kept', !!after.old['s1759000000000_0'] && same('s1759000000000_0') && !!after.old['aud_1759000000001'] && same('aud_1759000000001'),
      `the old app's own songs, untouched: from its Library ${same('s1759000000000_0')}, added on Learn a song (it even has a file name) ${same('aud_1759000000001')}`);
  }
  if (want('stray-without-copy-kept')) {
    check('stray-without-copy-kept', !!after.old['new-song-2'] && JSON.stringify(before.old['new-song-2']) === JSON.stringify(after.old['new-song-2']),
      `a stray with no copy in this app ("Ride"): left alone ${!!after.old['new-song-2']}`);
  }
  if (want('once-only')) {
    /* another stray appears later: a second start leaves it, since it runs once per phone */
    await page.eval(`(async () => { const q = indexedDB.open('repertoire'); const d = await new Promise((ok) => (q.onsuccess = () => ok(q.result)));
      await new Promise((ok) => { const t = d.transaction('songs', 'readwrite'); t.objectStore('songs').put({ id: 'new-song-1', title: 'All of Me', created: 1, fileName: 'a.mp3', file: new Blob(['x']), state: 'ready' }); t.oncomplete = ok; });
      d.close(); })()`);
    await page.goto(URL_APP + '?again=1#/home');
    await page.waitFor(`!!document.querySelector('main h1')`, 8000);
    await new Promise((r) => setTimeout(r, 1500));
    const again = await page.eval(READ);
    check('once-only', !!again.old['new-song-1'], `on the next start nothing more is removed ${!!again.old['new-song-1']}`);
  }
  /* the old app (20 Sep): a long file name as the title filled the screen.
     It wraps, inside the screen, and is never cut */
  if (want('long-title')) {
    const title = 'All_of_Me_John_Legend_Live_at_the_Royal_Albert_Hall_Remastered_Extended_Version_2014_Official_Audio_HQ';
    await page.eval(`(async () => { const q = indexedDB.open('repertoire-app'); const d = await new Promise((ok) => (q.onsuccess = () => ok(q.result)));
      await new Promise((ok) => { const t = d.transaction('songs', 'readwrite'); t.objectStore('songs').put({ id: 'long-title', title: ${JSON.stringify(title)},
        created: Date.now(), fileName: 'x.mp3', file: new Blob(['x']), state: 'new' }); t.oncomplete = ok; }); d.close(); })()`);
    await page.goto(URL_APP + '?t=long#/sing/learn/song/long-title');
    await page.waitFor(`document.querySelector('main h1')?.textContent === ${JSON.stringify(title)}`, 5000);
    const r = await page.eval(`(() => { const h = document.querySelector('main h1').getBoundingClientRect();
      return { right: h.right, width: innerWidth, scroll: document.documentElement.scrollWidth, lines: Math.round(h.height / parseFloat(getComputedStyle(document.querySelector('main h1')).lineHeight)) }; })()`);
    check('long-title', r.right <= r.width && r.scroll <= r.width && r.lines >= 2,
      `a ${title.length}-letter title with no spaces: inside the screen ${r.right <= r.width}, no sideways scroll ${r.scroll <= r.width}, wrapped onto ${r.lines} lines, shown whole`);
  }
  /* the old app: storage missing, blocked or silent for 3 s is said, not shown as "No songs yet" */
  if (want('no-storage')) {
    for (const how of ['refused', 'silent']) {
      await page.goto(URL_APP + 'favicon.svg');
      await page.eval(`localStorage.setItem('rp.test.idb', ${JSON.stringify(how)})`);
      await page.goto(URL_APP + '?idb=' + how + '#/sing/learn');
      const said = await page.waitFor(`document.querySelector('#no-storage')?.textContent === ${JSON.stringify(copy.songs.noStorage)}`, 6000);
      const none = await page.eval(`document.body.innerText.includes(${JSON.stringify(copy.songs.none)})`);
      results.push({ name: 'no-storage:' + how, ok: said && !none });
      console.log(`  storage ${how}: "${copy.songs.noStorage}" shown ${said}; "${copy.songs.none}" shown ${none}`);
    }
    await page.eval(`localStorage.removeItem('rp.test.idb')`);
    const each = results.filter((r) => r.name.startsWith('no-storage:'));
    results.splice(0, results.length, ...results.filter((r) => !r.name.startsWith('no-storage:')));
    check('no-storage', each.length === 2 && each.every((r) => r.ok), 'a phone that refuses storage, and one where it never answers');
  }
  check('no-page-errors', page.errors.length === 0, page.errors.join(' | '));
} catch (e) {
  const why = 'the test stopped: ' + String(e.message || e).split('\n')[0];
  const said = new Set(results.map((r) => r.name));
  for (const name of ALL) if (want(name) && !said.has(name)) check(name, false, why);
} finally {
  await env.close();
  server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} of ${results.length} checks FAILED` : `\nall ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
