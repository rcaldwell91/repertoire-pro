/* The one door to sound and the microphone.

   RULEBOOK 1: later the app is wrapped as a phone app and only this engine
   is swapped for a native one. So everything here is in the app's own
   terms - a sample, a source, a mic set - never a browser object. The
   conductor holds the engine; nothing else does (RULEBOOK 2.1). */

export interface Sample {
  readonly url: string;
  readonly seconds: number;
}

export interface Source {
  /** stop it now; safe to call twice */
  stop(): void;
  /** settles when it has stopped, however it stopped */
  readonly ended: Promise<void>;
}

/** Several parts of one song (the voice and the music) started on the same
    tick of the one clock, so they stay together to the sample. */
export interface Ensemble extends Source {
  /** engine time at which the part at `from` sounds */
  readonly startedAt: number;
  /** change one part's volume while it plays */
  setGain(part: number, gain: number): void;
}

export interface EnsembleOptions {
  /** where in the song to start, in seconds */
  readonly from: number;
  /** one volume per part; 1 is the song's own level */
  readonly gains: readonly number[];
  /** play this stretch over and over */
  readonly loop?: { readonly start: number; readonly end: number };
  /** where in the song each part begins (a take begins where it was
      sung); 0 if not given */
  readonly starts?: readonly number[];
}

/** One rung of the mic ladder. Every value is a wish, never a demand:
    RULEBOOK 4 "Never require raw capture." */
export interface MicSet {
  readonly name: string;
  readonly echoCancellation?: boolean;
  readonly noiseSuppression?: boolean;
  readonly autoGainControl?: boolean;
}

/** A stretch of what the mic heard. */
export interface MicBlock {
  readonly samples: Float32Array;
  /** engine time at which the last sample reached the mic: the mic's own
      delay is already taken off, here at its source (RULEBOOK 2.2) */
  readonly end: number;
  readonly sampleRate: number;
}

export type MicResult =
  | { ok: true; set: number; held?: boolean }
  /** held: another app has the microphone */
  | { ok: false; why: 'refused' | 'unavailable' | 'failed' | 'held' };

/** Whether sound really started (RULEBOOK 4, Sound, Android 3): the clock
    moved. blocked: it never got going; stalled: it says running but its
    clock stands still. tap: the browser still counted it as part of the
    tap when it was asked (if not, another tap may be all it needs). */
export type Wake = { ok: true } | { ok: false; why: 'blocked' | 'stalled'; tap: boolean };

/** What the phone says about its sound, for the Sound check. */
export interface SoundReport {
  /** the sound clock moved while it was watched */
  readonly moving: boolean;
  /** the phone's own word for its sound ("running", "suspended"...), or
      "none" if sound has not been started */
  readonly state: string;
  /** the microphone in use: its name, and whether another app has it */
  readonly mic: { readonly label: string; readonly live: boolean; readonly muted: boolean } | null;
  /** headphones the phone lists, by name; empty if none */
  readonly headphones: readonly string[];
  /** where sound goes, by name, if the phone says */
  readonly output: string | null;
  /** the loudest sound the app sent out while it was watched, 0 to 1 */
  readonly outLevel: number;
  /** the loudest the mic heard while it was watched, 0 to 1 */
  readonly micLevel: number;
}

export interface AudioEngine {
  /** Wake the sound and prove it with the clock. Only ever on the way from
      a tap: browsers only let sound begin from one. With `rebuild`, the old
      sound is closed and a new one made (after a stall); never otherwise. */
  wake(rebuild: boolean): Promise<Wake>;
  /** The one clock (RULEBOOK 2.2), in seconds. */
  now(): number;
  load(url: string): Promise<Sample>;
  play(sample: Sample, opts?: { rate?: number; gain?: number }): Source;
  /** start every part together, on one tick of the clock */
  playTogether(samples: readonly Sample[], opts: EnsembleOptions): Ensemble;
  /** drop a loaded sample, to give its memory back */
  forget(url: string): void;
  /** how many sources are sounding right now */
  sounding(): number;
  /** Tries the sets in the given order and keeps the first that opens. */
  openMic(sets: readonly MicSet[], order: readonly number[]): Promise<MicResult>;
  micOpen(): boolean;
  /** Close the mic only; sound already playing carries on. */
  closeMic(): void;
  /** loudness of the mic right now, 0 to 1 */
  micLevel(): number;
  /** what the mic hears, block by block, while it is open */
  onMic(cb: (block: MicBlock) => void): () => void;
  /** Play the mic back to the person at this volume (0 is off). Only
      while the mic is open; closing the mic ends it. */
  monitor(gain: number): void;
  /** seconds from a sound's engine time to when it is heard */
  outputLatency(): number;
  /** Silence every source and close the mic. The sound itself is never
      suspended (RULEBOOK 4, Sound, Android 1). */
  release(): void;
  /** The phone took the sound away (a call, another app). */
  onInterrupt(cb: () => void): () => void;
  /** The clock stood still while sound was playing: a stall. */
  onStall(cb: () => void): () => void;
  /** Another app took the mic (true), or gave it back (false). */
  onMicHeld(cb: (held: boolean) => void): () => void;
  /** What the phone says about its sound, watched for a moment. */
  report(): Promise<SoundReport>;
}
