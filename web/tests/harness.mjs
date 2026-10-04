/* The test web server and the sound probe, shared by the browser tests. */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

/** GitHub Pages, locally: the repo at /repertoire-pro/, the build at app/ */
export async function serve(REPO, APP) {
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.mp3': 'audio/mpeg', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2', '.woff': 'font/woff' };
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (!path.startsWith('/repertoire-pro/')) {
      res.writeHead(404).end();
      return;
    }
    let rest = path.slice('/repertoire-pro/'.length);
    let root = REPO;
    if (rest === 'app' || rest.startsWith('app/')) {
      root = APP;
      rest = rest.slice(4);
    }
    let file = normalize(join(root, rest));
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const ORIGIN = 'http://127.0.0.1:' + server.address().port;
  return { server, ORIGIN, URL_APP: ORIGIN + '/repertoire-pro/app/' };
}

/* Watches everything that can make sound or listen, from before the app
   loads: every AudioContext, every buffer source started and stopped,
   every getUserMedia call and every track it handed out. */
export const PROBE = `(() => {
  const P = window.__probe = { contexts: 0, started: 0, gum: 0, live: new Set(), tracks: [], fetched: [],
    decoded: [], actionAt: null, quietAt: null, events: [], starts: [], net: [] };
  const gainOf = new WeakMap();
  const now = () => performance.now();
  const note = (k) => P.events.push([k, Math.round(now())]);
  P.micLive = () => P.tracks.filter((t) => t.readyState === 'live').length;
  P.quiet = () => P.live.size === 0 && P.micLive() === 0;
  const checkQuiet = () => { if (P.actionAt !== null && P.quietAt === null && P.quiet()) P.quietAt = now(); };
  P.mark = () => { P.actionAt = now(); P.quietAt = null; checkQuiet(); };
  const AC = window.AudioContext;
  window.AudioContext = class extends AC {
    constructor(...a) { super(...a); P.contexts++; note('context'); }
    decodeAudioData(buf, ...rest) {
      return super.decodeAudioData(buf, ...rest).then((b) => {
        const d = b.getChannelData(0);
        let peak = 0; for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
        P.decoded.push({ seconds: b.duration, peak });
        return b;
      });
    }
  };
  const S = AudioBufferSourceNode.prototype;
  const start = S.start, stop = S.stop;
  S.start = function (...a) {
    P.started++; P.live.add(this); note('play');
    P.starts.push({ when: a[0] ?? 0, offset: a[1] ?? 0, seconds: this.buffer ? this.buffer.duration : 0, loop: this.loop, loopStart: this.loopStart, loopEnd: this.loopEnd });
    this.addEventListener('ended', () => { P.live.delete(this); checkQuiet(); });
    return start.apply(this, a);
  };
  S.stop = function (...a) { P.live.delete(this); note('stop'); const r = stop.apply(this, a); checkQuiet(); return r; };
  /* which volume each sound goes through, to read what each slider did */
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (to, ...r) {
    if (this instanceof AudioBufferSourceNode && to instanceof GainNode) gainOf.set(this, to);
    return connect.call(this, to, ...r);
  };
  P.playing = () => [...P.live].map((s) => ({ seconds: s.buffer ? s.buffer.duration : 0, gain: gainOf.get(s) ? gainOf.get(s).gain.value : null }));
  const T = MediaStreamTrack.prototype, tstop = T.stop;
  T.stop = function () { const r = tstop.apply(this); note('mic-closed'); checkQuiet(); return r; };
  const md = navigator.mediaDevices, gum = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => {
    P.gum++; note('mic-asked');
    const s = await gum(c);
    P.tracks.push(...s.getTracks()); note('mic-open');
    return s;
  };
  const f = window.fetch;
  window.fetch = (u, ...r) => { P.net.push(String(u && u.url ? u.url : u)); return f(u, ...r).then((res) => { P.fetched.push([String(u), res.status]); return res; }); };
  const xopen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u, ...r) { P.net.push(String(u)); return xopen.call(this, m, u, ...r); };
  /* the action a check times from: a tap, the Back button, or hiding */
  document.addEventListener('click', () => P.mark(), true);
  window.addEventListener('popstate', () => P.mark(), true);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') P.mark(); });
})();`;
