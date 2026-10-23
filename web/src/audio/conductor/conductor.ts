import type { AudioEngine, Ensemble, MicBlock, MicResult, SoundReport, Source, Sample } from '../engine';
import { Recorder, type Recording } from '../recorder';
import { MIC_MODES, modeIndex } from '../mic-modes';
import { songLevel } from '../../core/song';

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
   - Finished releases everything.
   - Sound is proved, never assumed (RULEBOOK 4, Sound, Android): a plan
     that listens opens the mic first; then the sound is woken and its
     clock must move before anything is said to be playing. If it will not
     start, or its clock stops while playing, the session stops and says
     so; only the next tap rebuilds the sound, and carries on. */

export type State = 'idle' | 'armed' | 'counting-in' | 'running' | 'finished' | 'stopped';
export type LeaveReason = 'screen' | 'tab' | 'back' | 'hidden' | 'interrupted';
export type MicState = 'closed' | 'opening' | 'open' | 'refused' | 'unavailable' | 'failed' | 'held';
/** Why no sound, as the clock showed it. blocked: it would not start;
    tap: it needs another tap; stalled: it stopped while playing; load: a
    sound file would not load. */
export type SoundTrouble = 'blocked' | 'tap' | 'stalled' | 'load';

export type Step =
  | { kind: 'note'; url: string; rate?: number; gain?: number }
  | { kind: 'listen' }
  /** a song's parts (voice, music) together, from a point, maybe looping;
      with `listen`, the mic opens first (a refused mic still lets the song
      play) and `monitor` plays it back at that volume */
  | { kind: 'song'; urls: readonly string[]; from: number; gains: readonly number[]; loop?: { start: number; end: number };
      listen?: boolean; monitor?: number;
      /** with `listen`: keep what the mic hears as a take (not while looping) */
      record?: boolean;
      /** where in the song each part begins (a take begins where it was sung) */
      starts?: readonly number[];
      /** the song's level (its loudest moment to -1 dBFS), as kept with it;
          if none is kept, it is measured once from the parts and handed to
          `onLevel` to keep. It lifts the first `songParts` parts alike
          (all of them, unless a take follows the song). */
      level?: number;
      onLevel?: (level: number) => void;
      songParts?: number;
      /** an exercise's notes: each part's rate and length, and it ends with
          its last part (EnsembleOptions) */
      rates?: readonly number[];
      lengths?: readonly number[];
      untilLast?: boolean };

export interface Plan {
  readonly owner: string;
  /** seconds of count-in before the first step; none if 0 */
  readonly countIn?: number;
  /** the count-in in this many beats (3-2-1 is 3), each shown as it comes */
  readonly countBeats?: number;
  /** "Test without mic": seconds with the mic let go before the sound is
      made anew (rebuild), so the phone can settle its route */
  readonly quiet?: number;
  readonly rebuild?: boolean;
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
  /** how many takes have been finished, so a screen knows to look */
  readonly takes: number;
  /** sound that would not start, or stopped by itself; null if none */
  readonly sound: SoundTrouble | null;
  /** the beat of the count-in being shown (3, 2, 1); null when not counting */
  readonly count: number | null;
}

/** A take, finished: what the mic heard while a song played, and whose. */
export interface Take extends Recording {
  readonly owner: string;
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
  remove(key: string): void;
}

const TAP_TYPES = new Set(['click', 'pointerup', 'touchend', 'keydown', 'keyup']);
export const TOKEN_LIFE_MS = 1000;
/** the mic mode chosen by hand in the Sound check (the only one remembered) */
export const MODE_KEY = 'rp.mic.mode';
/** what the old automatic ladder remembered: cleared, never read */
export const OLD_RUNG_KEY = 'rp.mic.set';
const ACTIVE: readonly State[] = ['armed', 'counting-in', 'running'];

export class Conductor {
  private snap: Snapshot = { state: 'idle', owner: null, step: 0, mic: 'closed', why: null, startedAt: null, takes: 0, sound: null, count: null };
  /** the next tap makes the sound anew (after it stalled or would not start) */
  private rebuild = false;
  /** the one recorder, while a take is being made */
  private recorder: Recorder | null = null;
  private lastTake: Take | null = null;
  private gen = 0;
  private readonly tokens = new WeakMap<object, number>();
  private source: Source | null = null;
  /** the song playing now, for its position and its volumes */
  private song: { ensemble: Ensemble; from: number; loop?: { start: number; end: number }; level: number; parts: number } | null = null;
  private readonly listeners = new Set<(s: Snapshot) => void>();
  private readonly micListeners = new Set<(b: MicBlock) => void>();
  /** "Hear yourself": only while a song is listening (RULEBOOK 4, Mic) */
  private monitorGain = 0;
  private monitoring = false;
  private readonly engine: AudioEngine;
  private readonly env: Env;
  private readonly store: Store;

  constructor(engine: AudioEngine, env: Env, store: Store) {
    this.engine = engine;
    this.env = env;
    this.store = store;
    store.remove(OLD_RUNG_KEY);          /* the old ladder's rung: never used again */
    env.onHidden(() => this.leave('hidden'));
    /* the phone took the sound (a call, another app). While the sound is
       still being woken its state means nothing: the clock decides that */
    engine.onInterrupt(() => {
      if (this.snap.state !== 'armed') this.leave('interrupted');
    });
    /* the clock stood still while playing: stop, say so, and wait for a tap */
    engine.onStall(() => {
      if (this.snap.state !== 'running') return;
      this.rebuild = true;
      this.halt('stopped', null);
      this.set({ sound: 'stalled' });
    });
    engine.onMicHeld((held) => {
      if (!this.active()) return;
      if (held && this.snap.mic === 'open') this.set({ mic: 'held' });
      else if (!held && this.snap.mic === 'held') this.set({ mic: 'open' });
    });
    engine.onMic((b) => {
      if (this.snap.mic !== 'open' || this.snap.state !== 'running') return;
      /* the recorder first: listeners may hand the samples on */
      this.recorder?.push(b, (at) => this.songTime(at));
      this.micListeners.forEach((f) => f(b));
    });
  }

  /** The last take this owner made, if it has not been taken away. */
  take(owner: string): Take | null {
    return this.lastTake && this.lastTake.owner === owner ? this.lastTake : null;
  }

  /** Done with the last take (kept, sent or thrown away). */
  dropTake(): void {
    this.lastTake = null;
  }

  /** A take thrown away, taken back (Undo). */
  restoreTake(t: Take): void {
    this.lastTake = t;
    this.set({ takes: this.snap.takes + 1 });
  }

  /** What the mic hears while a session is listening; nothing otherwise. */
  onMic(fn: (b: MicBlock) => void): () => void {
    this.micListeners.add(fn);
    return () => {
      this.micListeners.delete(fn);
    };
  }

  /** "Hear yourself" at this volume (0 is off). It sounds only while a
      song is playing and listening; set before then (while counting in,
      or while the mic opens), it takes as the song starts. */
  setMonitor(gain: number): void {
    this.monitorGain = Math.max(0, gain);
    if (this.monitoring) this.engine.monitor(this.monitorGain);
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

  /** What the phone says about its sound, for the Sound check. It looks
      and listens; it never starts or changes anything. */
  report(): Promise<SoundReport> {
    return this.engine.report();
  }

  /** "Use the phone's own mic": its device picked by id and used on the
      first request from now on. Opens nothing by itself; the next Start does. */
  usePhoneMic(): void {
    this.engine.setMicChoice('phone');
  }

  /** back to the phone's own choice of mic */
  letPhoneChoose(): void {
    this.engine.setMicChoice(null);
  }

  micChoice(): 'phone' | null {
    return this.engine.micChoice();
  }

  /** a mic chosen by hand took the phone down last time (said once) */
  micCrashed(): boolean {
    return this.engine.micCrashed();
  }

  /** loudness of the voice right now, 0 to 1; 0 whenever the mic is not open */
  level(): number {
    return this.snap.mic === 'open' ? this.engine.micLevel() : 0;
  }

  /** Where the song playing now has got to, as it is heard: in seconds;
      null if none is. */
  position(): number | null {
    return this.songTime(this.engine.now());
  }

  /** The point in the song heard at engine time `at` (RULEBOOK 2.2: one
      clock; the speaker's delay is taken off here, at the song's source).
      Null if no song is playing, or `at` is before it started. */
  songTime(at: number): number | null {
    const song = this.song;
    if (!song || this.snap.state !== 'running') return null;
    const d = at - this.engine.outputLatency() - song.ensemble.startedAt;
    if (d < -0.001) return at === this.engine.now() ? song.from : null;
    const p = song.from + Math.max(0, d);
    const loop = song.loop;
    if (loop && p >= loop.end && loop.end > loop.start) return loop.start + ((p - loop.start) % (loop.end - loop.start));
    return p;
  }

  /** Change one part's volume (0 to 1) on the song playing now. */
  setGain(part: number, gain: number): void {
    const song = this.song;
    song?.ensemble.setGain(part, part < song.parts ? gain * song.level : gain);
  }

  /** The screen is done with these parts: give their memory back. */
  forget(urls: readonly string[]): void {
    urls.forEach((u) => this.engine.forget(u));
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
    const gen = ++this.gen;
    /* Hear yourself as the screen has it now; a change from here on, even
       before the song starts, is kept */
    const sung = plan.steps.find((st) => st.kind === 'song' && st.listen);
    this.monitorGain = sung && sung.kind === 'song' ? sung.monitor ?? 0 : 0;
    this.set({ state: 'armed', owner: plan.owner, step: 0, mic: 'closed', why: null, startedAt: null, sound: null });
    void this.run(gen, plan);                                           /* its first call is inside the tap */
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

  /** the mic mode: raw, unless another was chosen by hand */
  micMode(): string {
    return MIC_MODES[modeIndex(this.store.get(MODE_KEY))].name;
  }

  /** "Try another mode", by hand only: the next of the old app's modes,
      remembered; it opens nothing by itself (the next Start does) */
  tryAnotherMode(): string {
    const next = (modeIndex(this.store.get(MODE_KEY)) + 1) % MIC_MODES.length;
    this.store.set(MODE_KEY, String(next));
    return MIC_MODES[next].name;
  }

  private async run(gen: number, plan: Plan): Promise<void> {
    try {
      /* "Test without mic": the mic already let go (start halted it); a
         moment for the phone's route to settle, then the sound made anew */
      if (plan.quiet) {
        this.engine.release();
        await this.env.wait(plan.quiet);
        if (gen !== this.gen) return;
      }
      if (plan.rebuild) this.rebuild = true;
      /* the mic first, so the sound is born on the route it chose */
      if (plan.steps.some((st) => st.kind === 'listen' || (st.kind === 'song' && st.listen))) {
        if (!(await this.openMic(gen))) return;
      }
      const woke = await this.engine.wake(this.rebuild);
      if (gen !== this.gen) return;
      if (!woke.ok) {
        /* never sit there looking as if it plays: stop and say so */
        this.rebuild = true;
        this.halt('stopped', null);
        this.set({ sound: woke.why === 'blocked' && !woke.tap ? 'tap' : woke.why });
        return;
      }
      this.rebuild = false;
      const samples = new Map<string, Sample>();
      for (const st of plan.steps) {
        if (st.kind === 'note' && !samples.has(st.url)) samples.set(st.url, await this.engine.load(st.url));
        if (st.kind === 'song') {
          for (const u of st.urls) {
            if (!samples.has(u)) samples.set(u, await this.engine.load(u));
            if (gen !== this.gen) return;
          }
        }
        if (gen !== this.gen) return;
      }
      /* each song's level: as kept with it, or measured now, before the
         count-in, from what is loaded, and handed back to keep */
      const levels = new Map<Step, number>();
      for (const st of plan.steps) {
        if (st.kind !== 'song') continue;
        const parts = Math.min(st.songParts ?? st.urls.length, st.urls.length);
        let level = st.level;
        if (level == null) {
          level = songLevel(this.engine.songPeak(st.urls.slice(0, parts).map((u) => samples.get(u) as Sample)));
          st.onLevel?.(level);
        }
        levels.set(st, level);
      }
      /* the count-in comes only once the sound is proved and loaded, a beat at a time */
      if (plan.countIn && plan.countIn > 0) {
        const beats = Math.max(1, Math.round(plan.countBeats ?? 1));
        for (let k = beats; k >= 1; k--) {
          this.set({ state: 'counting-in', count: beats > 1 ? k : null });
          await this.env.wait(plan.countIn / beats);
          if (gen !== this.gen) return;
        }
      }
      this.set({ state: 'running', startedAt: this.engine.now(), count: null });
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
        if (st.kind === 'song') {
          const parts = Math.min(st.songParts ?? st.urls.length, st.urls.length);
          const lv = levels.get(st) ?? 1;
          const ensemble = this.engine.playTogether(st.urls.map((u) => samples.get(u) as Sample),
            { from: st.from, gains: st.gains.map((g, k) => (k < parts ? g * lv : g)), loop: st.loop, starts: st.starts,
              rates: st.rates, lengths: st.lengths, untilLast: st.untilLast });
          this.source = ensemble;
          this.song = { ensemble, from: st.from, loop: st.loop, level: lv, parts };
          if (st.listen) {
            if (st.record && !st.loop) this.recorder = new Recorder();
            this.listen(true);
          }
          await ensemble.ended;
          if (gen !== this.gen) return;
          this.source = null;
          this.song = null;
          continue;
        }
        /* listen: keep listening until Stop or leaving */
        if (this.listen(false)) return;
      }
      if (gen === this.gen) this.halt('finished', null);
    } catch {
      /* never back to Start without a word (RULEBOOK 4, Sound, Android 8) */
      if (gen === this.gen) {
        this.halt('stopped', null);
        this.set({ sound: 'load' });
      }
    }
  }

  /* stopping, leaving or the song ending ends the take */
  private endTake(): void {
    const r = this.recorder;
    this.recorder = null;
    const rec = r?.finish();
    if (!rec) return;
    this.lastTake = { ...rec, owner: this.snap.owner ?? '' };
    this.snap = { ...this.snap, takes: this.snap.takes + 1 };
  }

  /** Open the mic for this session, before the sound wakes. False if the
      session ended meanwhile (and then a mic that opened is closed again). */
  private async openMic(gen: number): Promise<boolean> {
    this.set({ mic: 'opening' });
    /* once, raw (or the mode chosen by hand): never another by itself */
    const r: MicResult = await this.engine.openMic(MIC_MODES[modeIndex(this.store.get(MODE_KEY))]);
    if (gen !== this.gen) {
      /* it opened after its session ended: close it again, unless a
         newer session is using the mic itself */
      if (r.ok && this.snap.mic !== 'open' && this.snap.mic !== 'opening' && this.snap.mic !== 'held') this.engine.closeMic();
      return false;
    }
    /* refused or missing: the rest carries on without it */
    this.set({ mic: r.ok ? (r.held ? 'held' : 'open') : r.why });
    return true;
  }

  /** Listen, on the mic opened at the start. True if it is listening. */
  private listen(withSong: boolean): boolean {
    if (this.snap.mic !== 'open' && this.snap.mic !== 'held') return false;
    this.monitoring = withSong;
    if (withSong) this.engine.monitor(this.monitorGain);
    return true;
  }

  /** Silence and the mic closed - and every step still
      waiting is made stale, so none of them can start anything later. */
  private halt(state: 'finished' | 'stopped', why: Snapshot['why']): void {
    this.gen++;
    this.endTake();
    const src = this.source;
    this.source = null;
    this.song = null;
    this.monitoring = false;
    try {
      src?.stop();
    } catch {
      /* already stopped */
    }
    this.engine.release();
    const mic: MicState = this.snap.mic === 'open' || this.snap.mic === 'opening' || this.snap.mic === 'held' ? 'closed' : this.snap.mic;
    this.set({ state, why, mic, count: null });
  }

  private set(patch: Partial<Snapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const fn of this.listeners) fn(this.snap);
  }
}
