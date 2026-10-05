import { useEffect } from 'react';
import type { Conductor } from '../audio/conductor/conductor';
import { livePitch } from '../audio/pitch/client';
import type { LivePoint } from '../audio/pitch/core';

/* Your line: what the mic hears, read by the same pitch core as the
   singer's line, dated on the one clock and placed in the song by the
   conductor (the mic's delay is taken off by the engine, the speaker's by
   the conductor: each line corrected at its own source). */
export class YourLine {
  readonly t: number[] = [];
  readonly m: number[] = [];
  private readonly at = new Map<number, number>();

  clear(): void {
    this.t.length = 0;
    this.m.length = 0;
    this.at.clear();
  }

  /** a point, or a better reading of one already given */
  add(p: LivePoint, songT: number | null): void {
    const known = this.at.get(p.i);
    if (known !== undefined) {
      this.m[known] = p.m;
      return;
    }
    if (songT == null) return;
    /* a repeated part came round again: the last time round goes */
    const last = this.t.length ? this.t[this.t.length - 1] : -Infinity;
    if (songT < last - 0.5) {
      let keep = this.t.length;
      while (keep > 0 && this.t[keep - 1] >= songT - 0.01) keep--;
      this.t.length = keep;
      this.m.length = keep;
      this.at.clear();
    }
    this.at.set(p.i, this.t.length);
    this.at.delete(p.i - 4);
    this.t.push(songT);
    this.m.push(p.m);
  }
}

/* one line per song, kept while the app is open, so a take's line is
   still there after leaving its screen and coming back */
const lines = new Map<string, YourLine>();
export function yourLine(owner: string): YourLine {
  let l = lines.get(owner);
  if (!l) lines.set(owner, (l = new YourLine()));
  return l;
}

/** Your line while this screen's session is listening; kept after it ends. */
export function useYourLine(c: Conductor, owner: string, listening: boolean, session: number | null): YourLine {
  const line = yourLine(owner);
  useEffect(() => {
    if (!listening) return;
    line.clear();
    let started = false;
    const off = c.onMic((b) => {
      if (!started) {
        started = true;
        livePitch.start(b.sampleRate, (pts) => pts.forEach((p) => line.add(p, c.songTime(p.at))));
      }
      livePitch.push(b.samples, b.end);
    });
    return () => {
      off();
      livePitch.stop();
    };
  }, [c, listening, session, line]);
  return line;
}
