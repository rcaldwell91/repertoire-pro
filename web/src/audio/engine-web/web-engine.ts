import type { AudioEngine, Ensemble, EnsembleOptions, MicBlock, MicResult, MicSet, Sample, SoundReport, Source, Wake } from '../engine';

/* The browser's sound and microphone, behind the engine interface. Only the
   conductor holds it. A native engine replaces this file later; nothing
   else changes (RULEBOOK 1). */

/** A mic set as the browser takes it. Every value is "ideal": asked for,
    never required (RULEBOOK 4, "Never require raw capture"). The last rung
    asks for nothing at all. */
export function toConstraints(set: MicSet): MediaTrackConstraints | true {
  const c: MediaTrackConstraints = {};
  if (set.echoCancellation !== undefined) c.echoCancellation = { ideal: set.echoCancellation };
  if (set.noiseSuppression !== undefined) c.noiseSuppression = { ideal: set.noiseSuppression };
  if (set.autoGainControl !== undefined) c.autoGainControl = { ideal: set.autoGainControl };
  return Object.keys(c).length ? c : true;
}

/** Errors that are the person's answer, or that no other set can change. */
function finalAnswer(err: unknown): MicResult | null {
  const name = (err as { name?: string } | null)?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return { ok: false, why: 'refused' };
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return { ok: false, why: 'unavailable' };
  /* the phone could not start it: almost always another app has it */
  if (name === 'NotReadableError' || name === 'TrackStartError') return { ok: false, why: 'held' };
  return null;
}

/* RULEBOOK 4, Sound, Android 2: every sound promise races a timeout. On
   Android they can hang forever. */
export const LATE = Symbol('late');
export function race<T>(p: Promise<T>, ms: number): Promise<T | typeof LATE> {
  return new Promise((ok, bad) => {
    const t = setTimeout(() => ok(LATE), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        ok(v);
      },
      (e) => {
        clearTimeout(t);
        bad(e);
      },
    );
  });
}
const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** How long each thing may take before it counts as hung, in ms. */
export const LIMITS = {
  resume: 1500,
  /** the clock must move within this, after resume (Android 3) */
  clock: 1500,
  /** a clock standing still this long while sound plays is a stall (Android 5) */
  stall: 1500,
  close: 1500,
  decode: 30000,
  module: 3000,
  /** the mic, when it is already allowed; and when the phone may be asking */
  micAllowed: 8000,
  micAsking: 60000,
};

/** names that mean headphones, in the phone's list of devices */
const HEADPHONES = /headset|headphone|earphone|earbud|buds|airpods|bluetooth|usb|wired/i;

/* The mic tap: runs on the sound thread, hands over the mic's samples in
   blocks of 1024, each stamped with the engine time of its last sample. */
const TAP = `
class Tap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(1024); this.n = 0; }
  process(inputs) {
    const ch = inputs[0];
    if (ch && ch.length) {
      const a = ch[0], b = ch[1];
      for (let i = 0; i < a.length; i++) {
        this.buf[this.n++] = b ? (a[i] + b[i]) / 2 : a[i];
        if (this.n === 1024) {
          this.port.postMessage({ s: this.buf, end: currentTime + i / sampleRate }, [this.buf.buffer]);
          this.buf = new Float32Array(1024);
          this.n = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('rp-mic-tap', Tap);
`;

export class WebEngine implements AudioEngine {
  private ctx: AudioContext | null = null;
  private readonly sources = new Set<AudioBufferSourceNode>();
  private readonly buffers = new Map<string, AudioBuffer>();
  private stream: MediaStream | null = null;
  /** the context the mic's nodes belong to */
  private attached: AudioContext | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private readonly frame = new Float32Array(2048);
  private readonly interruptCbs = new Set<() => void>();
  private readonly stallCbs = new Set<() => void>();
  private readonly heldCbs = new Set<(held: boolean) => void>();
  private tapReady: { ctx: AudioContext; ready: Promise<boolean> } | null = null;
  private tap: AudioWorkletNode | null = null;
  private monitorGain: GainNode | null = null;
  private monitorLevel = 0;
  private inputLatency = 0;
  private readonly micCbs = new Set<(b: MicBlock) => void>();
  /** everything played goes out through here, so the Sound check can see it */
  private out: GainNode | null = null;
  private outMeter: AnalyserNode | null = null;
  private watchTimer: ReturnType<typeof setInterval> | null = null;

  /** A new context, and its way out. Only from wake (or, if nothing has
      woken yet, to decode): never on its own. */
  private make(): AudioContext {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    ctx.addEventListener('statechange', () => {
      if (ctx !== this.ctx) return;               /* an old one, closing */
      const st = ctx.state as string;
      /* the phone took it (a call, another app): we never suspend it ourselves */
      if (st === 'interrupted' || st === 'suspended') this.interruptCbs.forEach((f) => f());
    });
    this.out = ctx.createGain();
    this.outMeter = ctx.createAnalyser();
    this.outMeter.fftSize = 2048;
    this.out.connect(ctx.destination);
    this.out.connect(this.outMeter);
    return ctx;
  }

  private context(): AudioContext {
    return this.ctx && this.ctx.state !== 'closed' ? this.ctx : this.make();
  }

  async wake(rebuild: boolean): Promise<Wake> {
    const ua = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
    const tap = ua ? ua.isActive : true;
    if (rebuild && this.ctx) {
      /* Android 5: close the old one, wait for it, then a new one */
      const old = this.ctx;
      this.stopAll();
      this.detachMic();
      this.ctx = null;
      this.out = null;
      this.outMeter = null;
      try {
        await race(old.close(), LIMITS.close);
      } catch {
        /* closed already */
      }
    }
    const ctx = this.context();
    /* Android 3: await resume (raced), one silent sample, then the clock */
    try {
      await race(ctx.resume(), LIMITS.resume);
    } catch {
      /* not allowed: the clock says so below */
    }
    if (ctx !== this.ctx) return { ok: false, why: 'blocked', tap };
    this.kick(ctx);
    if (!(await this.clockMoves(ctx, LIMITS.clock)) || ctx !== this.ctx) {
      return { ok: false, why: ctx.state === 'running' ? 'stalled' : 'blocked', tap };
    }
    if (this.stream) await this.attachMic(ctx);
    return { ok: true };
  }

  /** one silent sample: Chrome on Android may not open the way out until something plays */
  private kick(ctx: AudioContext): void {
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.onended = () => {
        try {
          src.disconnect();
        } catch {
          /* gone */
        }
      };
      src.start();
    } catch {
      /* nothing to play it on: the clock will say */
    }
  }

  /** the only proof that sound works: the clock moves (never ctx.state) */
  private async clockMoves(ctx: AudioContext, ms: number): Promise<boolean> {
    const t0 = ctx.currentTime;
    const end = performance.now() + ms;
    while (performance.now() < end) {
      await pause(30);
      if (ctx.currentTime > t0) return true;
    }
    return false;
  }

  /* While anything plays, watch the clock. Standing still is a stall: say
     so, and do nothing else (Android 6: only a tap rebuilds). */
  private watch(): void {
    if (this.watchTimer) return;
    let last = this.ctx ? this.ctx.currentTime : 0;
    let movedAt = performance.now();
    this.watchTimer = setInterval(() => {
      const ctx = this.ctx;
      if (!ctx || !this.sources.size) {
        this.unwatch();
        return;
      }
      if (ctx.currentTime !== last) {
        last = ctx.currentTime;
        movedAt = performance.now();
        return;
      }
      if (performance.now() - movedAt > LIMITS.stall) {
        this.unwatch();
        this.stallCbs.forEach((f) => f());
      }
    }, 250);
  }

  private unwatch(): void {
    if (this.watchTimer) clearInterval(this.watchTimer);
    this.watchTimer = null;
  }

  now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  async load(url: string): Promise<Sample> {
    let buf = this.buffers.get(url);
    if (!buf) {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Could not load ' + url + ': ' + res.status);
      const got = await race(this.context().decodeAudioData(await res.arrayBuffer()), LIMITS.decode);
      if (got === LATE) throw new Error('Decoding hung: ' + url);
      buf = got;
      this.buffers.set(url, buf);
    }
    return { url, seconds: buf.duration };
  }

  private way(ctx: AudioContext): AudioNode {
    return this.out && this.out.context === ctx ? this.out : ctx.destination;
  }

  play(sample: Sample, opts?: { rate?: number; gain?: number }): Source {
    const ctx = this.context();
    const buf = this.buffers.get(sample.url);
    if (!buf) throw new Error('Not loaded: ' + sample.url);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts?.rate ?? 1;
    const g = ctx.createGain();
    g.gain.value = opts?.gain ?? 0.8;
    src.connect(g);
    g.connect(this.way(ctx));
    this.sources.add(src);
    let done!: () => void;
    const ended = new Promise<void>((r) => (done = r));
    src.onended = () => {
      this.sources.delete(src);
      try {
        g.disconnect();
      } catch {
        /* gone */
      }
      done();
    };
    src.start();
    this.watch();
    return {
      ended,
      stop: () => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      },
    };
  }

  playTogether(samples: readonly Sample[], opts: EnsembleOptions): Ensemble {
    const ctx = this.context();
    /* a moment ahead, so every part is scheduled before the tick comes */
    const when = ctx.currentTime + 0.05;
    const gains: GainNode[] = [];
    const ends: Promise<void>[] = [];
    const nodes: AudioBufferSourceNode[] = [];
    samples.forEach((sample, i) => {
      const buf = this.buffers.get(sample.url);
      if (!buf) throw new Error('Not loaded: ' + sample.url);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      if (opts.loop) {
        src.loop = true;
        src.loopStart = opts.loop.start;
        src.loopEnd = opts.loop.end;
      }
      const g = ctx.createGain();
      g.gain.value = opts.gains[i] ?? 1;
      src.connect(g);
      g.connect(this.way(ctx));
      this.sources.add(src);
      ends.push(
        new Promise<void>((done) => {
          src.onended = () => {
            this.sources.delete(src);
            try {
              g.disconnect();
            } catch {
              /* gone */
            }
            done();
          };
        }),
      );
      gains.push(g);
      nodes.push(src);
    });
    nodes.forEach((src, i) => {
      /* a part that begins later in the song (a take) waits for its place */
      const begins = opts.starts?.[i] ?? 0;
      if (opts.from >= begins) src.start(when, opts.from - begins);
      else src.start(when + (begins - opts.from), 0);
    });
    this.watch();
    const stop = () =>
      nodes.forEach((src) => {
        try {
          src.stop();
        } catch {
          /* already stopped */
        }
      });
    return {
      startedAt: when,
      /* the parts are the same length; when one ends, the song has ended */
      ended: Promise.race(ends).then(() => stop()),
      stop,
      setGain: (part, gain) => {
        const g = gains[part];
        if (g) g.gain.setTargetAtTime(gain, ctx.currentTime, 0.015);
      },
    };
  }

  forget(url: string): void {
    this.buffers.delete(url);
  }

  sounding(): number {
    return this.sources.size;
  }

  /** how long to wait for the mic: a phone that may be asking the person
      gets a minute; one that has said yes already, a few seconds */
  private async micWait(): Promise<number> {
    try {
      const q = navigator.permissions?.query({ name: 'microphone' as PermissionName });
      const st = q ? await race(q, 500) : LATE;
      if (st !== LATE && st.state === 'granted') return LIMITS.micAllowed;
    } catch {
      /* this browser will not say */
    }
    return LIMITS.micAsking;
  }

  /* Android 4: the mic opens before the sound is made or woken, so the
     sound is born on the route the mic chose. Here only the stream is
     opened; its nodes join the sound when it wakes, which always follows. */
  async openMic(sets: readonly MicSet[], order: readonly number[]): Promise<MicResult> {
    this.closeMic();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return { ok: false, why: 'unavailable' };
    const wait = await this.micWait();
    for (const i of order) {
      try {
        const asked = navigator.mediaDevices.getUserMedia({ audio: toConstraints(sets[i]) });
        const stream = await race(asked, wait);
        if (stream === LATE) {
          /* hung (Android 2): if it ever answers, close it at once */
          void asked.then((s) => s.getTracks().forEach((t) => t.stop()), () => undefined);
          return { ok: false, why: 'failed' };
        }
        this.stream = stream;
        const track = stream.getAudioTracks()[0];
        if (track) {
          /* Android 9: another app took the mic, or gave it back */
          track.onmute = () => this.stream === stream && this.heldCbs.forEach((f) => f(true));
          track.onunmute = () => this.stream === stream && this.heldCbs.forEach((f) => f(false));
          track.onended = () => this.stream === stream && this.heldCbs.forEach((f) => f(true));
        }
        /* its nodes join the sound when the sound wakes (never a stalled one) */
        return { ok: true, set: i, held: !!track && (track.muted || track.readyState === 'ended') };
      } catch (err) {
        const final = finalAnswer(err);
        if (final) return final;
        /* this rung failed for another reason: try the next */
      }
    }
    return { ok: false, why: 'failed' };
  }

  /** the open mic's nodes, on this context (again, after a rebuild) */
  private async attachMic(ctx: AudioContext): Promise<void> {
    const stream = this.stream;
    if (!stream || this.attached === ctx) return;
    this.detachMic();
    this.attached = ctx;
    const micNode = ctx.createMediaStreamSource(stream);
    this.micNode = micNode;
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    micNode.connect(this.analyser);     /* measured */
    /* the mic's own delay, as the phone reports it, taken off at the source */
    const lat = (stream.getAudioTracks()[0]?.getSettings() as { latency?: number } | undefined)?.latency;
    this.inputLatency = typeof lat === 'number' && lat > 0 && lat < 1 ? lat : 0;
    this.monitorGain = ctx.createGain();
    this.monitorGain.gain.value = this.monitorLevel;
    micNode.connect(this.monitorGain);
    this.monitorGain.connect(ctx.destination);
    await this.openTap(ctx, micNode);
  }

  private detachMic(): void {
    for (const n of [this.micNode, this.tap, this.monitorGain]) {
      try {
        n?.disconnect();
      } catch {
        /* gone */
      }
    }
    if (this.tap) this.tap.port.onmessage = null;
    this.micNode = null;
    this.analyser = null;
    this.tap = null;
    this.monitorGain = null;
    this.attached = null;
  }

  private async openTap(ctx: AudioContext, from: MediaStreamAudioSourceNode): Promise<void> {
    if (!ctx.audioWorklet) return;
    if (!this.tapReady || this.tapReady.ctx !== ctx) {
      const url = URL.createObjectURL(new Blob([TAP], { type: 'text/javascript' }));
      const ready = race(ctx.audioWorklet.addModule(url), LIMITS.module).then((r) => r !== LATE, () => false);
      this.tapReady = { ctx, ready };
    }
    if (!(await this.tapReady.ready) || this.micNode !== from) return;
    const tap = new AudioWorkletNode(ctx, 'rp-mic-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    tap.port.onmessage = (e: MessageEvent<{ s: Float32Array; end: number }>) => {
      if (this.tap !== tap) return;
      const block: MicBlock = { samples: e.data.s, end: e.data.end - this.inputLatency, sampleRate: ctx.sampleRate };
      this.micCbs.forEach((f) => f(block));
    };
    from.connect(tap);
    tap.connect(ctx.destination);              /* it writes nothing: silent */
    this.tap = tap;
  }

  onMic(cb: (b: MicBlock) => void): () => void {
    this.micCbs.add(cb);
    return () => {
      this.micCbs.delete(cb);
    };
  }

  monitor(gain: number): void {
    this.monitorLevel = Math.max(0, gain);
    const g = this.monitorGain;
    if (g && this.ctx) g.gain.setTargetAtTime(this.monitorLevel, this.ctx.currentTime, 0.015);
  }

  outputLatency(): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    return (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  }

  micOpen(): boolean {
    return !!this.stream && this.stream.getAudioTracks().some((t) => t.readyState === 'live');
  }

  closeMic(): void {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.detachMic();
    this.monitorLevel = 0;               /* the next time, it starts silent again */
  }

  private rms(a: AnalyserNode | null): number {
    if (!a) return 0;
    a.getFloatTimeDomainData(this.frame);
    let sum = 0;
    for (let i = 0; i < this.frame.length; i++) sum += this.frame[i] * this.frame[i];
    return Math.min(1, Math.sqrt(sum / this.frame.length));
  }

  micLevel(): number {
    return this.rms(this.analyser);
  }

  private stopAll(): void {
    this.unwatch();
    for (const s of [...this.sources]) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
  }

  release(): void {
    this.stopAll();
    this.closeMic();
    /* RULEBOOK 4, Sound, Android 1: silence is the sounds stopped and the
       mic closed. The sound itself is never suspended: on Android a
       suspended one often never comes back. */
  }

  onInterrupt(cb: () => void): () => void {
    this.interruptCbs.add(cb);
    return () => {
      this.interruptCbs.delete(cb);
    };
  }

  onStall(cb: () => void): () => void {
    this.stallCbs.add(cb);
    return () => {
      this.stallCbs.delete(cb);
    };
  }

  onMicHeld(cb: (held: boolean) => void): () => void {
    this.heldCbs.add(cb);
    return () => {
      this.heldCbs.delete(cb);
    };
  }

  async report(): Promise<SoundReport> {
    const ctx = this.ctx;
    const t0 = ctx ? ctx.currentTime : 0;
    let outLevel = 0;
    let micLevel = 0;
    let moving = false;
    const end = performance.now() + 600;
    while (performance.now() < end) {
      await pause(40);
      if (ctx && ctx.currentTime > t0) moving = true;
      outLevel = Math.max(outLevel, this.rms(this.outMeter));
      micLevel = Math.max(micLevel, this.micLevel());
    }
    const track = this.stream?.getAudioTracks()[0];
    let devices: MediaDeviceInfo[] = [];
    try {
      const d = await race(navigator.mediaDevices.enumerateDevices(), 1000);
      if (d !== LATE) devices = d;
    } catch {
      /* the phone will not say */
    }
    const audio = devices.filter((d) => d.kind !== 'videoinput' && d.label);
    const outs = audio.filter((d) => d.kind === 'audiooutput');
    return {
      moving,
      state: ctx ? ctx.state : 'none',
      mic: track ? { label: track.label, live: track.readyState === 'live', muted: track.muted } : null,
      headphones: [...new Set(audio.filter((d) => HEADPHONES.test(d.label)).map((d) => d.label))],
      output: (outs.find((d) => d.deviceId === 'default') ?? outs[0])?.label || null,
      outLevel,
      micLevel,
    };
  }
}
