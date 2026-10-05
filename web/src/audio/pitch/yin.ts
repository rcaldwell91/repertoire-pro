/* YIN, ported exactly from the old app (next.html yinHz, 25 Sep): the
   difference function over the first 1024 samples, cumulative-mean
   normalised, the first dip under 0.15 (or the lowest), refused when its
   value is above `clarity`, parabolic interpolation, 60-1400 Hz.
   Returns Hz, or -1 for no clear pitch. */
export function yinHz(buf: Float32Array, sr: number, clarity: number): number {
  const SIZE = buf.length;
  const W = 1024;
  const tmin = Math.max(2, Math.floor(sr / 1400));
  const tmax = Math.min(SIZE - W - 1, Math.floor(sr / 65));
  if (tmax <= tmin + 1) return -1;
  const d = new Float32Array(tmax + 1);
  for (let tau = tmin; tau <= tmax; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) {
      const df = buf[i] - buf[i + tau];
      s += df * df;
    }
    d[tau] = s;
  }
  let run = 0;
  let best = -1;
  let bestVal = 1;
  const dp = new Float32Array(tmax + 1);
  for (let tau = tmin; tau <= tmax; tau++) {
    run += d[tau];
    dp[tau] = run > 1e-12 ? (d[tau] * (tau - tmin + 1)) / run : 1;
  }
  for (let tau = tmin + 1; tau < tmax; tau++) {
    if (dp[tau] < 0.15) {
      while (tau + 1 < tmax && dp[tau + 1] < dp[tau]) tau++;
      best = tau;
      bestVal = dp[tau];
      break;
    }
  }
  if (best < 0) {
    for (let tau = tmin + 1; tau < tmax; tau++)
      if (dp[tau] < bestVal) {
        bestVal = dp[tau];
        best = tau;
      }
  }
  if (best < tmin + 1 || bestVal > clarity) return -1;
  const x1 = dp[best - 1];
  const x2 = dp[best];
  const x3 = dp[best + 1] || x2;
  const a = (x1 + x3 - 2 * x2) / 2;
  const bq = (x3 - x1) / 2;
  let T0 = best;
  if (Math.abs(a) > 1e-12) {
    const sh = -bq / (2 * a);
    if (sh > -1 && sh < 1) T0 = best + sh;
  }
  const freq = sr / T0;
  if (freq < 60 || freq > 1400) return -1;
  return freq;
}

export function freqMidi(f: number): number {
  return 69 + 12 * Math.log2(f / 440);
}

/* The old app's gate at its default setting (ngateApply(20)): a loudness
   floor and the clarity YIN must reach. */
export const GATE_LEVEL = 0.002 + 0.2 * 0.2 * 0.13;
export const CLARITY = 0.42 - 0.2 * 0.16;

/** Where in a WIN-sample window yinHz's reading is centred, so a file's
    point is dated at the sound it read (old app, yinOffset, 25 Sep). */
export function yinOffset(win: number, sr: number): number {
  return (win >> 1) - Math.round(512 + 0.002 * sr);
}
