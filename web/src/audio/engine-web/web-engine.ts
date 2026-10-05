import type { AudioEngine, Ensemble, EnsembleOptions, MicBlock, MicResult, MicSet, Sample, Source } from '../engine';

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
  return null;
}

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
  private micNode: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private readonly frame = new Float32Array(2048);
  private readonly interruptCbs = new Set<() => void>();
  private letGo = false;
  private sleepTimer: ReturnType<typeof setTimeout> | null = null;
  private sleeping: Promise<void> | null = null;
  private tapReady: Promise<boolean> | null = null;
  private tap: AudioWorkletNode | null = null;
  private monitorGain: GainNode | null = null;
  private monitorLevel = 0;
  private inputLatency = 0;
  private readonly micCbs = new Set<(b: MicBlock) => void>();

  private context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      this.ctx.addEventListener('statechange', () => {
        const st = this.ctx?.state as string;
        /* the phone took it (a call, another app) - not us letting it go */
        if (st === 'interrupted' || (st === 'suspended' && !this.letGo && !this.sleeping)) this.interruptCbs.forEach((f) => f());
      });
    }
    return this.ctx;
  }

  unlock(): void {
    const ctx = this.context();
    if (this.sleepTimer) clearTimeout(this.sleepTimer);   /* starting again: keep the device */
    this.sleepTimer = null;
    this.letGo = false;
    if (ctx.state !== 'running') void ctx.resume();
  }

  now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  async load(url: string): Promise<Sample> {
    let buf = this.buffers.get(url);
    if (!buf) {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Could not load ' + url + ': ' + res.status);
      buf = await this.context().decodeAudioData(await res.arrayBuffer());
      this.buffers.set(url, buf);
    }
    return { url, seconds: buf.duration };
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
    g.connect(ctx.destination);
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
      g.connect(ctx.destination);
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
    nodes.forEach((src) => src.start(when, opts.from));
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

  async openMic(sets: readonly MicSet[], order: readonly number[]): Promise<MicResult> {
    this.closeMic();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return { ok: false, why: 'unavailable' };
    for (const i of order) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: toConstraints(sets[i]) });
        this.stream = stream;
        const ctx = this.context();
        this.micNode = ctx.createMediaStreamSource(stream);
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.micNode.connect(this.analyser);     /* measured */
        /* the mic's own delay, as the phone reports it, taken off at the source */
        const lat = (stream.getAudioTracks()[0]?.getSettings() as { latency?: number } | undefined)?.latency;
        this.inputLatency = typeof lat === 'number' && lat > 0 && lat < 1 ? lat : 0;
        this.monitorGain = ctx.createGain();
        this.monitorGain.gain.value = this.monitorLevel;
        this.micNode.connect(this.monitorGain);
        this.monitorGain.connect(ctx.destination);
        await this.openTap(ctx, this.micNode);
        if (this.stream !== stream) return { ok: false, why: 'failed' };   /* closed meanwhile */
        return { ok: true, set: i };
      } catch (err) {
        const final = finalAnswer(err);
        if (final) return final;
        /* this rung failed for another reason: try the next */
      }
    }
    return { ok: false, why: 'failed' };
  }

  private async openTap(ctx: AudioContext, from: MediaStreamAudioSourceNode): Promise<void> {
    if (!ctx.audioWorklet) return;
    if (!this.tapReady) {
      const url = URL.createObjectURL(new Blob([TAP], { type: 'text/javascript' }));
      this.tapReady = ctx.audioWorklet.addModule(url).then(() => true, () => false);
    }
    if (!(await this.tapReady) || this.micNode !== from) return;
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
    for (const n of [this.micNode, this.tap, this.monitorGain]) {
      try {
        n?.disconnect();
      } catch {
        /* gone */
      }
    }
    if (this.tap) this.tap.port.onmessage = null;
    this.stream = null;
    this.micNode = null;
    this.analyser = null;
    this.tap = null;
    this.monitorGain = null;
    this.monitorLevel = 0;               /* the next time, it starts silent again */
  }

  micLevel(): number {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.frame);
    let sum = 0;
    for (let i = 0; i < this.frame.length; i++) sum += this.frame[i] * this.frame[i];
    return Math.min(1, Math.sqrt(sum / this.frame.length));
  }

  release(): void {
    for (const s of [...this.sources]) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.closeMic();
    /* Silence is immediate (every source is stopped above). The device is
       let go a moment later, unless something starts again first: a song
       restarted by "back 10 s" stops and starts in one tap, and a device
       still going to sleep then looked like the phone taking the sound. */
    if (this.sleepTimer) clearTimeout(this.sleepTimer);
    this.sleepTimer = setTimeout(() => {
      this.sleepTimer = null;
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'running' || this.sources.size) return;
      this.letGo = true;
      const p = ctx.suspend().finally(() => {
        if (this.sleeping === p) this.sleeping = null;
      });
      this.sleeping = p;
    }, 400);
  }

  onInterrupt(cb: () => void): () => void {
    this.interruptCbs.add(cb);
    return () => {
      this.interruptCbs.delete(cb);
    };
  }
}
