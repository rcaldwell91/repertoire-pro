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
  | { ok: true; set: number }
  | { ok: false; why: 'refused' | 'unavailable' | 'failed' };

export interface AudioEngine {
  /** Must be called inside the tap that starts something: browsers only
      let sound begin from a tap. */
  unlock(): void;
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
  /** Silence every source, close the mic, let the device go. */
  release(): void;
  /** The phone took the sound away (a call, another app). */
  onInterrupt(cb: () => void): () => void;
}
