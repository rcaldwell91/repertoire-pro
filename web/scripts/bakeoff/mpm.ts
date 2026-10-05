/* The McLeod Pitch Method (McLeod & Wyvill, 2005): the normalised square
   difference function, its key maxima, the first one within 0.93 of the
   highest, parabolic interpolation. Its height there is the clarity: below
   `minClarity` there is no clear pitch. A bake-off candidate. */
export function mpmHz(buf: Float32Array, sr: number, minClarity = 0.6, W = 2048): number {
  const maxLag = Math.min(Math.floor(sr / 65), buf.length - W - 1);
  const minLag = Math.max(2, Math.floor(sr / 1400));
  if (maxLag <= minLag + 2) return -1;
  const nsdf = new Float32Array(maxLag + 1);
  for (let tau = 0; tau <= maxLag; tau++) {
    let acf = 0, m = 0;
    for (let i = 0; i < W; i++) {
      const a = buf[i], b = buf[i + tau];
      acf += a * b;
      m += a * a + b * b;
    }
    nsdf[tau] = m > 1e-12 ? (2 * acf) / m : 0;
  }
  /* key maxima: the highest point between each positive-going zero
     crossing and the next negative-going one */
  const peaks: number[] = [];
  let tau = 1;
  while (tau < maxLag && nsdf[tau] > 0) tau++;
  while (tau < maxLag) {
    while (tau < maxLag && nsdf[tau] <= 0) tau++;
    let best = -1;
    while (tau < maxLag && nsdf[tau] > 0) {
      if (tau >= minLag && (best < 0 || nsdf[tau] > nsdf[best])) best = tau;
      tau++;
    }
    if (best > 0) peaks.push(best);
  }
  if (!peaks.length) return -1;
  let top = 0;
  for (const p of peaks) top = Math.max(top, nsdf[p]);
  const pick = peaks.find((p) => nsdf[p] >= 0.93 * top) as number;
  if (nsdf[pick] < minClarity) return -1;
  const x1 = nsdf[pick - 1], x2 = nsdf[pick], x3 = nsdf[pick + 1] ?? x2;
  const a = (x1 + x3 - 2 * x2) / 2, b = (x3 - x1) / 2;
  const T0 = Math.abs(a) > 1e-12 && Math.abs(-b / (2 * a)) < 1 ? pick - b / (2 * a) : pick;
  const f = sr / T0;
  return f >= 60 && f <= 1400 ? f : -1;
}
