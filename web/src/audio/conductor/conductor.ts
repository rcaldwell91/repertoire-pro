import type { AudioEngine, Source, Sample } from '../engine';
import { MIC_LADDER, ladderOrder } from '../mic-ladder';

/* THE CONDUCTOR - the only owner of sound and the microphone (RULEBOOK 2.1).

     idle -> armed -> counting-in -> running -> finished | stopped

   - Anything that plays or listens needs a start token, and only a tap
     makes one: a real (trusted) tap, used once, within a second.
   - One source at a time. Starting something else stops what was going;
     pressing Start again on what is already going does nothing.
   - Leaving the screen, switching tab, the back button, hiding the app, or
     a call or interruption: silence, and the microphone closed.
   - Nothing resumes by itself. Every step that waits (loading a sample,
     the count-in, asking for the mic) checks on its way back that its
     session is still the current one; if it is not, it does nothing more,
     and a mic that opened too late is closed again.
   - Finished releases everything. */

export type State = 'idle' | 'armed' | 'counting-in' | 'running' | 'finished' | 'stopped';
export type LeaveReason = 'screen' | 'tab' | 'back' | 'hidden' | 'interrupted';
export type MicState = 'closed' | 'opening' | 'open' | 'refused' | 'unavailable' | 'failed';

export type Step =
  | { kind: 'note'; url: string; rate?: number; gain?: number }
  | { kind: 'listen' };

export interface Plan {
  readonly owner: string;
  /** seconds of count-in before the first step; none if 0 */
  readonly countIn?: number;
  readonly steps: readonly Step[];
}

export interface Snapshot {
  readonly state: State;
  readonly owner: string | null;
  readonly step: number;
  readonly mic: MicState;
  readonly why: LeaveReason | 'stop' | null;
  /** engine time the session started running (RULEBOOK 2.2: one clock) */
  readonly startedAt: number | null;
}

/** What the browser says about the press that is starting something. */
export interface Tap {
  readonly isTrusted: boolean;
  readonly type: string;
}

declare const tokenBrand: unique symbol;
/** Made only by Conductor.tap. Opaque: nothing else can make one. */
export interface StartToken {
  readonly [tokenBrand]: true;
}

export interface Env {
  /** milliseconds of wall time, for how old a tap is */
  wallMs(): number;
  hidden(): boolean;
  /** called when the app is hidden (switched away, screen locked) */
  onHidden(cb: () => void): () => void;
  wait(seconds: number): Promise<void>;
}

export interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const TAP_TYPES = new Set(['click', 'pointerup', 'touchend', 'keydown', 'keyup']);
export const TOKEN_LIFE_MS = 1000;
export const MIC_KEY = 'rp.mic.set';
const ACTIVE: readonly State[] = ['armed', 'counting-in', 'running'];

export class Conductor {
  private snap: Snapshot = { state: 'idle', owner: null, step: 0, mic: 'closed', why: null, startedAt: null };
  private gen = 0;
  private readonly tokens = new WeakMap<object, number>();
  private source: Source | null = null;
  private readonly listeners = new Set<(s: Snapshot) => void>();
  private readonly engine: AudioEngine;
  private readonly env: Env;
  private readonly store: Store;

  constructor(engine: AudioEngine, env: Env, store: Store) {
    this.engine = engine;
    this.env = env;
    this.store = store;
    env.onHidden(() => this.leave('hidden'));
    engine.onInterrupt(() => this.leave('interrupted'));
  }

  snapshot(): Snapshot {
    return this.snap;
  }

  subscribe(fn: (s: Snapshot) => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /** loudness of the voice right now, 0 to 1; 0 whenever the mic is not open */
  level(): number {
    return this.snap.mic === 'open' ? this.engine.micLevel() : 0;
  }

  active(): boolean {
    return ACTIVE.includes(this.snap.state);
  }

  /** The only way to make a start token: from the press itself. */
  tap(ev: Tap | null | undefined): StartToken | null {
    if (!ev || ev.isTrusted !== true) return null;
    if (!TAP_TYPES.has(ev.type)) return null;
    const token = Object.freeze({}) as StartToken;
    this.tokens.set(token, this.env.wallMs());
    return token;
  }

  private spend(token: StartToken | null | undefined): boolean {
    if (!token) return false;
    const at = this.tokens.get(token);
    if (at === undefined) return false;
    this.tokens.delete(token);                       /* once only */
    return this.env.wallMs() - at <= TOKEN_LIFE_MS;  /* and only straight after the tap */
  }

  /** Start a plan. False, and nothing touched, unless it is allowed. */
  start(token: StartToken | null | undefined, plan: Plan): boolean {
    if (this.active() && this.snap.owner === plan.owner) return false;   /* a repeat press mid-note */
    if (!this.spend(token)) return false;
    if (this.env.hidden()) return false;                                /* nothing starts out of sight */
    if (this.active()) this.halt('stopped', null);                      /* one source at a time */
    this.engine.unlock();                                               /* inside the tap */
    const gen = ++this.gen;
    this.set({ state: 'armed', owner: plan.owner, step: 0, mic: 'closed', why: null, startedAt: null });
    void this.run(gen, plan);
    return true;
  }

  /** The person pressed Stop. */
  stop(): void {
    if (this.active()) this.halt('stopped', 'stop');
  }

  /** The screen is going away, or the app is hidden or interrupted. */
  leave(why: LeaveReason): void {
    if (this.active()) this.halt('stopped', why);
    else this.engine.release();          /* whatever the state, nothing sounds or listens now */
  }

  /* ---------------------------------------------------------------- */

  private remembered(): number | null {
    const v = this.store.get(MIC_KEY);
    if (v == null) return null;
    const n = Number(v);
    return Number.isInteger(n) ? n : null;
  }

  private async run(gen: number, plan: Plan): Promise<void> {
    try {
      const samples = new Map<string, Sample>();
      for (const st of plan.steps) {
        if (st.kind === 'note' && !samples.has(st.url)) samples.set(st.url, await this.engine.load(st.url));
        if (gen !== this.gen) return;
      }
      if (plan.countIn && plan.countIn > 0) {
        this.set({ state: 'counting-in' });
        await this.env.wait(plan.countIn);
        if (gen !== this.gen) return;
      }
      this.set({ state: 'running', startedAt: this.engine.now() });
      for (let i = 0; i < plan.steps.length; i++) {
        const st = plan.steps[i];
        this.set({ step: i });
        if (st.kind === 'note') {
          const src = this.engine.play(samples.get(st.url) as Sample, { rate: st.rate, gain: st.gain });
          this.source = src;
          await src.ended;
          if (gen !== this.gen) return;
          this.source = null;
          continue;
        }
        /* listen: open the mic, and keep listening until Stop or leaving */
        this.set({ mic: 'opening' });
        const r = await this.engine.openMic(MIC_LADDER, ladderOrder(this.remembered()));
        if (gen !== this.gen) {
          /* it opened after its session ended: close it again, unless a
             newer session is using the mic itself */
          if (r.ok && this.snap.mic !== 'open' && this.snap.mic !== 'opening') this.engine.closeMic();
          return;
        }
        if (r.ok) {
          this.store.set(MIC_KEY, String(r.set));
          this.set({ mic: 'open' });
          return;                         /* running, listening, until Stop or leaving */
        }
        this.set({ mic: r.why });         /* refused or missing: the rest carries on without it */
      }
      if (gen === this.gen) this.halt('finished', null);
    } catch {
      if (gen === this.gen) this.halt('stopped', null);
    }
  }

  /** Silence, the mic closed, the device let go - and every step still
      waiting is made stale, so none of them can start anything later. */
  private halt(state: 'finished' | 'stopped', why: Snapshot['why']): void {
    this.gen++;
    const src = this.source;
    this.source = null;
    try {
      src?.stop();
    } catch {
      /* already stopped */
    }
    this.engine.release();
    const mic: MicState = this.snap.mic === 'open' || this.snap.mic === 'opening' ? 'closed' : this.snap.mic;
    this.set({ state, why, mic });
  }

  private set(patch: Partial<Snapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const fn of this.listeners) fn(this.snap);
  }
}
