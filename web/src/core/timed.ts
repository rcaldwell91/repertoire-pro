/* The timed hiss (next.html 9110-9135; Robert, 1 Oct): it times itself
   from the first sound, and after a second of quiet the clock stops where
   you did and the result stays. Nothing starts after it. */

/** louder than this is a sound: about -40 dB */
export const LOUD_RMS = 0.01;
/** this long quiet after a sound, and it is over */
export const QUIET_END = 1;

export class SoundClock {
  private heardAt: number | null = null;
  private lastLoud = 0;
  private end: number | null = null;

  /** how loud the mic is (0 to 1) at time t, in seconds */
  feed(t: number, rms: number): void {
    if (this.end !== null) return;
    if (rms > LOUD_RMS) {
      if (this.heardAt === null) this.heardAt = t;
      this.lastLoud = t;
    } else if (this.heardAt !== null && t - this.lastLoud >= QUIET_END) {
      this.end = this.lastLoud;
    }
    this.now = t;
  }

  private now = 0;

  state(): { heard: boolean; held: number; done: boolean } {
    if (this.heardAt === null) return { heard: false, held: 0, done: false };
    const to = this.end ?? this.now;
    return { heard: true, held: Math.max(0, to - this.heardAt), done: this.end !== null };
  }
}
