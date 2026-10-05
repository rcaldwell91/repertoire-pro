import { anchored, bridge, Median5, type Anchors, type Point } from './line.ts';

/* Reading a whole file into a line: a point every `hop` seconds from a
   window of `win` samples, a loudness gate on the window, a pitch method on
   the part of it that method reads, then the shared line steps. */
export interface TraceOptions {
  readonly hop: number;
  readonly win: number;
  readonly gate: number;
  /** pitch in Hz of a window, or -1 */
  readonly detect: (win: Float32Array, sr: number) => number;
  /** where in the window the method's reading is centred */
  readonly offset: number;
  readonly anchors: Anchors | null;
}

export function traceFile(mono: Float32Array, sr: number, o: TraceOptions, from = 0, to = Infinity): Point[] {
  const out: Point[] = [];
  const med = new Median5();
  const win = new Float32Array(o.win);
  const n = Math.min(Math.floor(mono.length / sr / o.hop), to);
  for (let k = from; k < n; k++) {
    const t = k * o.hop;
    const start = Math.round(t * sr) - (o.win >> 1);
    let rms = 0;
    for (let j = 0; j < o.win; j++) {
      const sp = start + j;
      const v = sp >= 0 && sp < mono.length ? mono[sp] : 0;
      win[j] = v;
      rms += v * v;
    }
    rms = Math.sqrt(rms / o.win);
    let m: number | null = null;
    if (rms >= o.gate) {
      const f = o.detect(o.offset ? win.subarray(o.offset) : win, sr);
      if (f > 0) m = anchored(69 + 12 * Math.log2(f / 440), t, o.anchors);
    }
    const s = med.push(m);
    out.push({ t: +t.toFixed(2), m: s == null ? null : +s.toFixed(2) });
  }
  return bridge(out);
}
