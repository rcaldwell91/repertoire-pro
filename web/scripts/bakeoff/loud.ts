/* A candidate in the bake-off, not in the app: a gate on the file's own
   loudness (RULEBOOK 4, Pitch: Otsu on the file's own loudness), keeping a
   point of the singer's line only where the voice is loud. Measured on
   5 Oct: it took the line out of the quiet parts but also lowered "follows
   the voice" below the old app's, so the app does not use it. */

/** Loudness (RMS) of `hop` seconds centred on each point k*hop. */
export function loudness(mono: Float32Array, sr: number, hop: number): Float32Array {
  const n = Math.floor(mono.length / sr / hop), W = Math.round(hop * sr), out = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const a = Math.max(0, Math.round(k * hop * sr) - (W >> 1)), b = Math.min(mono.length, a + W);
    let s = 0;
    for (let i = a; i < b; i++) s += mono[i] * mono[i];
    out[k] = Math.sqrt(s / Math.max(1, b - a));
  }
  return out;
}

/** Otsu's cut between quiet and loud, as a loudness. */
export function otsu(rms: Float32Array, bins = 200): number {
  const logs = Array.from(rms, (v) => Math.log10(v || 1e-9));
  let lo = Infinity, hi = -Infinity;
  for (const v of logs) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!(hi > lo)) return 0;
  const hist = new Array<number>(bins).fill(0);
  for (const v of logs) hist[Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins))]++;
  const n = logs.length;
  let sum = 0;
  for (let i = 0; i < bins; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, bestT = 0;
  for (let i = 0; i < bins; i++) {
    wB += hist[i];
    if (!wB) continue;
    const wF = n - wB;
    if (!wF) break;
    sumB += i * hist[i];
    const v = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2;
    if (v > best) {
      best = v;
      bestT = i;
    }
  }
  return Math.pow(10, lo + ((bestT + 0.5) / bins) * (hi - lo));
}

/** Which points are loud: 1 loud, 0 quiet. */
export function loudPoints(mono: Float32Array, sr: number, hop: number): Uint8Array {
  const rms = loudness(mono, sr, hop), cut = otsu(rms), out = new Uint8Array(rms.length);
  for (let k = 0; k < rms.length; k++) out[k] = rms[k] >= cut ? 1 : 0;
  return out;
}
