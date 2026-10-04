import type { AudioEngine, Ensemble, EnsembleOptions, MicResult, MicSet, Sample, Source } from '../engine';

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
        this.micNode.connect(this.analyser);     /* measured, never played back */
        return { ok: true, set: i };
      } catch (err) {
        const final = finalAnswer(err);
        if (final) return final;
        /* this rung failed for another reason: try the next */
      }
    }
    return { ok: false, why: 'failed' };
  }

  micOpen(): boolean {
    return !!this.stream && this.stream.getAudioTracks().some((t) => t.readyState === 'live');
  }

  closeMic(): void {
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    try {
      this.micNode?.disconnect();
    } catch {
      /* gone */
    }
    this.stream = null;
    this.micNode = null;
    this.analyser = null;
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
