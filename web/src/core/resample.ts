/* A take's voice, made smaller as it is recorded: from the phone's rate
   (often 48 kHz) to TAKE_RATE, through a windowed-sinc low-pass so nothing
   above the new limit folds back as noise. Centred taps: no delay, so the
   take keeps its place in the song to the sample. Pure maths; tested in
   resample.test.ts. */

export const TAKE_RATE = 22050;
const HALF = 16;                     /* taps either side */

export class Resampler {
  private readonly ratio: number;
  private readonly cut: number;
  private hist: Float32Array = new Float32Array(0);
  /** input samples seen before `hist` starts */
  private base = 0;
  /** output samples made so far */
  private made = 0;

  constructor(readonly inRate: number, readonly outRate: number = TAKE_RATE) {
    this.ratio = inRate / outRate;
    this.cut = Math.min(1, outRate / inRate) * 0.9;     /* of the input's Nyquist */
  }

  private h(x: number): number {
    if (x === 0) return this.cut;
    if (Math.abs(x) >= HALF) return 0;
    const w = 0.5 + 0.5 * Math.cos((Math.PI * x) / HALF);       /* Hann */
    return (Math.sin(Math.PI * this.cut * x) / (Math.PI * x)) * w;
  }

  /** feed input; returns the output samples now complete */
  push(x: Float32Array): Float32Array {
    const all = new Float32Array(this.hist.length + x.length);
    all.set(this.hist);
    all.set(x, this.hist.length);
    const end = this.base + all.length;                 /* input samples seen */
    const out: number[] = [];
    for (;;) {
      const p = this.made * this.ratio;                 /* this output sample, in input samples */
      const i0 = Math.floor(p);
      if (i0 + HALF >= end) break;                      /* needs input not here yet */
      let s = 0;
      for (let k = i0 - HALF + 1; k <= i0 + HALF; k++) {
        const j = k - this.base;
        if (j >= 0) s += all[j] * this.h(p - k);
      }
      out.push(s);
      this.made++;
    }
    /* keep what the next samples still need */
    const keepFrom = Math.max(0, Math.floor(this.made * this.ratio) - HALF - this.base);
    this.hist = all.slice(keepFrom);
    this.base += keepFrom;
    return Float32Array.from(out);
  }
}

/** -1..1 to 16-bit */
export function toInt16(x: Float32Array): Int16Array {
  const out = new Int16Array(x.length);
  for (let i = 0; i < x.length; i++) {
    const v = Math.max(-1, Math.min(1, x[i]));
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

/** A plain mono 16-bit WAV file. */
export function wav(samples: readonly Int16Array[], rate: number): ArrayBuffer {
  const n = samples.reduce((a, c) => a + c.length, 0);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  let o = 44;
  for (const c of samples) for (let i = 0; i < c.length; i++, o += 2) v.setInt16(o, c[i], true);
  return buf;
}
