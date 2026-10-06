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
    decoded: [], actionAt: null, quietAt: null, events: [], starts: [], net: [], monitors: [], reads: 0 };
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
  P.kicks = 0;
  S.start = function (...a) {
    /* the one silent sample that opens the way out (RULEBOOK 4, Sound, Android 3): not a sound */
    if (this.buffer && this.buffer.length <= 1) { P.kicks++; note('kick'); return start.apply(this, a); }
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
    /* the mic played back ("Hear yourself") */
    if (this instanceof MediaStreamAudioSourceNode && to instanceof GainNode) P.monitors.push(to);
    return connect.call(this, to, ...r);
  };
  const disconnect = AudioNode.prototype.disconnect;
  AudioNode.prototype.disconnect = function (...r) { this.__off = true; return disconnect.apply(this, r); };
  /* what is heard of the mic now: the loudest playback still connected */
  P.monitorNow = () => Math.max(0, ...P.monitors.filter((g) => !g.__off).map((g) => g.gain.value));
  /* workers started, and how many were given a stretch of a song to read */
  P.readers = new Set();
  const W = window.Worker;
  window.Worker = class extends W {
    constructor(...a) {
      super(...a);
      const post = this.postMessage.bind(this);
      this.postMessage = (m, ...r) => { if (m && m.type === 'read') P.readers.add(this); return post(m, ...r); };
    }
  };
  /* songs decoded to read their pitch (not to play) */
  const OD = OfflineAudioContext.prototype.decodeAudioData;
  OfflineAudioContext.prototype.decodeAudioData = function (...a) { P.reads++; return OD.apply(this, a); };
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

/* A singer who sings exactly what they hear, for the timing checks: the
   mic is given the song's own voice part (or another real recording, such
   as the same voice an octave down), starting the moment the speaker plays
   it and reaching the mic after the mic's own delay. The speaker's and the
   mic's delays are made phone-like (0.15 s and 0.05 s) and reported the way
   a phone reports them, so an app that leaves either uncorrected puts your
   line in the wrong place. The test's own route into the mic (a stream
   inside the browser) is measured first and taken off, so only the app's
   timing is left to judge. Install BEFORE the PROBE, so the probe still
   sees every mic track. Off until window.__mirror.on = true. */
export const MIRROR = `(() => {
  const M = window.__mirror = { on: false, out: 0.15, inLat: 0.05, buffer: null, ctx: null, src: null, starts: [], at: null, pre: null, waiting: null };
  const AC = window.AudioContext;
  /* The app opens the mic before it makes its sound (RULEBOOK 4, Sound,
     Android 4). The mirror's mic has to come from the app's own sound, so
     when the mic is asked for first, the mirror makes that sound early and
     hands it to the app when the app makes its own. */
  class MAC extends AC {
    constructor(...a) {
      if (M.pre) { const c = M.pre; M.pre = null; return c; }
      super(...a);
      M.ctx = this;
    }
    get outputLatency() { return M.on ? M.out : super.outputLatency; }
  }
  window.AudioContext = MAC;
  const S = AudioBufferSourceNode.prototype, start = S.start;
  S.start = function (...a) {
    const real = this.buffer && this.buffer.length > 1;
    if (real) M.starts.push({ node: this, when: a[0] ?? 0, offset: a[1] ?? 0 });
    const r = start.apply(this, a);
    /* the first part of the song (the voice) starts: the singer joins in */
    if (real && M.waiting && this.context === M.ctx) { const w = M.waiting; M.waiting = null; void w(M.starts[M.starts.length - 1]); }
    return r;
  };
  /* another recording to sing, from the next Start on */
  M.load = (b64) => { M.pending = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer; };
  /* how late a sound put into a stream comes out of it as a mic, here */
  M.loop = null;
  const measureLoop = async (ctx) => {
    const code = 'class D extends AudioWorkletProcessor { process(i) { const a = i[0] && i[0][0];' +
      ' if (a) for (let k = 0; k < a.length; k++) if (Math.abs(a[k]) > 0.5) this.port.postMessage(currentTime + k / sampleRate); return true; } }' +
      ' registerProcessor("rp-loop-probe", D);';
    await ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
    const dest = ctx.createMediaStreamDestination(), src = ctx.createMediaStreamSource(dest.stream);
    const d = new AudioWorkletNode(ctx, 'rp-loop-probe');
    src.connect(d);
    d.connect(ctx.destination);                       /* writes nothing: silent */
    const got = [];
    d.port.onmessage = (e) => got.push(e.data);
    const buf = ctx.createBuffer(1, 4, ctx.sampleRate);
    buf.getChannelData(0)[0] = 1;
    const sent = [];
    for (let i = 0; i < 3; i++) { const s = ctx.createBufferSource(); s.buffer = buf; s.connect(dest); const T = ctx.currentTime + 0.05 + i * 0.1; start.call(s, T); sent.push(T); }
    await new Promise((r) => setTimeout(r, 450));
    dest.stream.getTracks().forEach((t) => MediaStreamTrack.prototype.stop.call(t));
    d.disconnect();
    src.disconnect();
    const ds = got.map((t, i) => t - sent[i]).sort((a, b) => a - b);
    return ds.length ? ds[ds.length >> 1] : 0;
  };
  const md = navigator.mediaDevices, gum = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => {
    if (!M.on) return gum(c);
    if (!M.ctx || M.ctx.state === 'closed') { new MAC({ latencyHint: 'interactive' }); M.pre = M.ctx; }
    const ctx = M.ctx;
    if (M.loop === null) M.loop = await measureLoop(ctx);
    if (M.pending) { M.buffer = await ctx.decodeAudioData(M.pending); M.pending = null; }
    const dest = ctx.createMediaStreamDestination();
    const src = ctx.createBufferSource();
    src.connect(dest);
    if (M.src) try { M.src.stop(); } catch {}
    M.src = src;
    M.waiting = async ({ when, offset, node }) => {
      if (M.src !== src) return;
      src.buffer = M.buffer || node.buffer;
      const heard = when + M.out + (ctx.baseLatency || 0);   /* the speaker plays it */
      const sing = heard + M.inLat - (M.loop || 0);          /* the mic has it */
      const at = Math.max(sing, ctx.currentTime + 0.02);
      start.call(src, at, offset + (at - sing));
      M.at = { when, heard, sing, at, offset, loop: M.loop };
    };
    const track = dest.stream.getAudioTracks()[0];
    const gs = track.getSettings.bind(track);
    track.getSettings = () => ({ ...gs(), latency: M.inLat });
    track.stop = function () { try { src.stop(); } catch {} return MediaStreamTrack.prototype.stop.call(this); };
    return dest.stream;
  };
})();`;

/* An Android phone's sound, as the old app learned it (RULEBOOK 4, Sound,
   Android), on top of desktop Chrome, which hides all of it. Install
   BEFORE the probe. Every switch is off until a test turns it on:
     born: 'suspended'   new sound starts out suspended, its clock at 0
     resume: 'hang'      resume() never answers
     resume: 'gesture'   resume() works only inside a tap (otherwise it
                         never answers, as on Android)
     sticky: true        sound the app suspended never comes back
     freeze()            every sound made so far: its clock stops, while it
                         still says "running"
   It counts every suspend() the app makes, and notes the order of mic and
   sound events. */
export const ANDROID = `(() => {
  const E = window.__android = { born: 'running', resume: 'ok', sticky: false, suspends: 0, refused: 0, contexts: [], order: [] };
  const AC = window.AudioContext;
  const base = Object.getPrototypeOf(AC.prototype);
  const get = (k) => (Object.getOwnPropertyDescriptor(AC.prototype, k) || Object.getOwnPropertyDescriptor(base, k)).get;
  const realTime = get('currentTime'), realState = get('state');
  const realResume = AC.prototype.resume, realSuspend = AC.prototype.suspend;
  window.AudioContext = class extends AC {
    constructor(...a) {
      super(...a);
      this.__held = E.born === 'suspended';
      this.__frozen = null;
      this.__stuck = false;
      E.contexts.push(this);
      E.order.push('context');
    }
    get currentTime() { return this.__held ? 0 : this.__frozen ?? realTime.call(this); }
    get state() { const s = realState.call(this); return this.__held && s !== 'closed' ? 'suspended' : s; }
    resume() {
      E.order.push('resume');
      if (this.__stuck || E.resume === 'hang') return new Promise(() => {});
      if (E.resume === 'gesture' && !navigator.userActivation.isActive) { E.refused++; return new Promise(() => {}); }
      this.__held = false;
      return realResume.call(this);
    }
    suspend() { E.suspends++; if (E.sticky) this.__stuck = true; return realSuspend.call(this); }
  };
  E.freeze = () => E.contexts.forEach((c) => { if (c.__frozen == null) c.__frozen = realTime.call(c); });
  E.newest = () => E.contexts[E.contexts.length - 1] || null;
  /* the newest sound's clock moves, over a quarter of a second */
  E.moving = () => new Promise((ok) => { const c = E.newest(); if (!c) return ok(false); const t = c.currentTime; setTimeout(() => ok(c.currentTime > t), 250); });
  const md = navigator.mediaDevices, gum = md.getUserMedia.bind(md);
  md.getUserMedia = (c) => { E.order.push('mic-asked'); return gum(c).then((s) => { E.order.push('mic-open'); return s; }); };
})();`;
