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

/** One rung of the mic ladder. Every value is a wish, never a demand:
    RULEBOOK 4 "Never require raw capture." */
export interface MicSet {
  readonly name: string;
  readonly echoCancellation?: boolean;
  readonly noiseSuppression?: boolean;
  readonly autoGainControl?: boolean;
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
  /** how many sources are sounding right now */
  sounding(): number;
  /** Tries the sets in the given order and keeps the first that opens. */
  openMic(sets: readonly MicSet[], order: readonly number[]): Promise<MicResult>;
  micOpen(): boolean;
  /** Close the mic only; sound already playing carries on. */
  closeMic(): void;
  /** loudness of the mic right now, 0 to 1 */
  micLevel(): number;
  /** Silence every source, close the mic, let the device go. */
  release(): void;
  /** The phone took the sound away (a call, another app). */
  onInterrupt(cb: () => void): () => void;
}
