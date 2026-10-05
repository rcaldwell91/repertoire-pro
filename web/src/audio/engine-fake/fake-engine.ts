import type { AudioEngine, Ensemble, EnsembleOptions, MicBlock, MicResult, MicSet, Sample, Source } from '../engine';
import type { Env, Store } from '../conductor/conductor';

/* A stand-in engine for the conductor's tests. It makes no sound; it keeps
   a log of everything asked of it, and lets a test decide when a sample
   finishes loading, when a note ends, and what each mic set does. */

type MicOutcome = 'ok' | 'busy' | 'refused' | 'unavailable';

class FakeSource implements Source {
  done = false;
  readonly ended: Promise<void>;
  private resolve!: () => void;
  constructor(private readonly onEnd: (s: FakeSource) => void) {
    this.ended = new Promise((r) => (this.resolve = r));
  }
  stop(): void {
    this.finish();
  }
  finish(): void {
    if (this.done) return;
    this.done = true;
    this.onEnd(this);
    this.resolve();
  }
}

export class FakeEngine implements AudioEngine {
  readonly log: string[] = [];
  unlocks = 0;
  releases = 0;
  clock = 0;
  /** what each rung of the mic ladder does, by index */
  micPlan: MicOutcome[] = ['ok', 'ok', 'ok'];
  level = 0.25;
  holdLoads = false;
  holdMic = false;
  /** the most sources ever sounding at once */
  peak = 0;
  private readonly sources = new Set<FakeSource>();
  private mic = false;
  private readonly heldLoads: Array<() => void> = [];
  private readonly heldMic: Array<() => void> = [];
  private readonly interruptCbs = new Set<() => void>();

  unlock(): void {
    this.unlocks++;
    this.log.push('unlock');
  }
  now(): number {
    return this.clock;
  }
  load(url: string): Promise<Sample> {
    this.log.push('load:' + url);
    const sample = { url, seconds: 3 };
    if (!this.holdLoads) return Promise.resolve(sample);
    return new Promise((res) => this.heldLoads.push(() => res(sample)));
  }
  /** let every held load finish */
  finishLoads(): void {
    this.heldLoads.splice(0).forEach((f) => f());
  }
  play(sample: Sample): Source {
    this.log.push('play:' + sample.url);
    const s = new FakeSource((x) => this.sources.delete(x));
    this.sources.add(s);
    this.peak = Math.max(this.peak, this.sources.size);
    return s;
  }
  /** the last song started: its parts, options and volumes as they are now */
  song: { urls: string[]; opts: EnsembleOptions; gains: number[]; source: FakeSource } | null = null;
  readonly forgotten: string[] = [];
  playTogether(samples: readonly Sample[], opts: EnsembleOptions): Ensemble {
    const urls = samples.map((x) => x.url);
    this.log.push('together:' + urls.join('+') + '@' + opts.from + (opts.loop ? `~${opts.loop.start}-${opts.loop.end}` : ''));
    const s = new FakeSource((x) => this.sources.delete(x));
    this.sources.add(s);
    this.peak = Math.max(this.peak, this.sources.size);
    const song = { urls, opts, gains: [...opts.gains], source: s };
    this.song = song;
    return {
      startedAt: this.clock,
      ended: s.ended,
      stop: () => s.stop(),
      setGain: (part, gain) => {
        song.gains[part] = gain;
      },
    };
  }
  forget(url: string): void {
    this.forgotten.push(url);
  }
  /** the notes playing reach their natural end */
  endNotes(): void {
    [...this.sources].forEach((s) => s.finish());
  }
  sounding(): number {
    return this.sources.size;
  }
  async openMic(_sets: readonly MicSet[], order: readonly number[]): Promise<MicResult> {
    this.log.push('openMic:' + order.join(','));
    if (this.holdMic) await new Promise<void>((r) => this.heldMic.push(r));
    for (const i of order) {
      const what = this.micPlan[i] ?? 'busy';
      this.log.push('try:' + i);
      if (what === 'ok') {
        this.mic = true;
        return { ok: true, set: i };
      }
      if (what === 'refused') return { ok: false, why: 'refused' };
      if (what === 'unavailable') return { ok: false, why: 'unavailable' };
    }
    return { ok: false, why: 'failed' };
  }
  /** let a held mic request answer */
  answerMic(): void {
    this.heldMic.splice(0).forEach((f) => f());
  }
  micOpen(): boolean {
    return this.mic;
  }
  closeMic(): void {
    if (this.mic) this.log.push('closeMic');
    this.mic = false;
    this.monitorGain = 0;
  }
  micLevel(): number {
    return this.mic ? this.level : 0;
  }
  release(): void {
    this.releases++;
    this.log.push('release');
    [...this.sources].forEach((s) => s.stop());
    this.mic = false;
    this.monitorGain = 0;
  }
  /** the mic played back, as it is now (0 when the mic is closed) */
  monitorGain = 0;
  latency = 0;
  private readonly micCbs = new Set<(b: MicBlock) => void>();
  onMic(cb: (b: MicBlock) => void): () => void {
    this.micCbs.add(cb);
    return () => {
      this.micCbs.delete(cb);
    };
  }
  /** the mic hears something (only while it is open) */
  hear(block: MicBlock): void {
    if (this.mic) this.micCbs.forEach((f) => f(block));
  }
  monitor(gain: number): void {
    this.log.push('monitor:' + gain);
    if (this.mic) this.monitorGain = gain;
  }
  outputLatency(): number {
    return this.latency;
  }
  onInterrupt(cb: () => void): () => void {
    this.interruptCbs.add(cb);
    return () => {
      this.interruptCbs.delete(cb);
    };
  }
  /** the phone takes the sound away */
  interrupt(): void {
    this.interruptCbs.forEach((f) => f());
  }
}

export class FakeEnv implements Env {
  ms = 0;
  isHidden = false;
  private readonly hiddenCbs = new Set<() => void>();
  private readonly waits: Array<() => void> = [];
  wallMs(): number {
    return this.ms;
  }
  hidden(): boolean {
    return this.isHidden;
  }
  onHidden(cb: () => void): () => void {
    this.hiddenCbs.add(cb);
    return () => {
      this.hiddenCbs.delete(cb);
    };
  }
  wait(): Promise<void> {
    return new Promise((r) => this.waits.push(r));
  }
  /** the count-in finishes */
  endWaits(): void {
    this.waits.splice(0).forEach((f) => f());
  }
  hide(): void {
    this.isHidden = true;
    this.hiddenCbs.forEach((f) => f());
  }
  show(): void {
    this.isHidden = false;
  }
}

export class MemoryStore implements Store {
  readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
}
