/* CREPE tiny (MIT), the old app's octave anchor, ported from its pure-JS
   inference (ANALYZER_SRC crepeBuild / crepePredict / actToMidiConf, with
   the faster four-by-four conv layer from rp-filemap.js: same arithmetic).
   The weights are ml5's published CREPE model, identical byte for byte to
   the ones the old app carried; they are fetched at run time and checked,
   never committed (RULEBOOK 3). */

export interface Spec {
  readonly name: string;
  readonly shape: readonly number[];
}

interface Layer {
  K: number; Cin: number; Cout: number; stride: number;
  kf: Float32Array; bias: Float32Array; scale: Float32Array; shift: Float32Array;
}

export interface Crepe {
  layers: Layer[];
  dk: Float32Array;
  db: Float32Array;
}

export function crepeBuild(specs: readonly Spec[], data: Float32Array): Crepe {
  const W: Record<string, { shape: readonly number[]; w: Float32Array }> = {};
  let off = 0;
  for (const s of specs) {
    const n = s.shape.reduce((a, b) => a * b, 1);
    W[s.name] = { shape: s.shape, w: data.subarray(off, off + n) };
    off += n;
  }
  const layers: Layer[] = [];
  ['crepe_conv1', 'crepe_conv2', 'crepe_conv3', 'crepe_conv4', 'crepe_conv5', 'crepe_conv6'].forEach((name, i) => {
    const kern = W[name + '/kernel'];
    const K = kern.shape[0], Cin = kern.shape[2], Cout = kern.shape[3];
    const kf = new Float32Array(Cout * K * Cin);
    for (let t = 0; t < K; t++)
      for (let c = 0; c < Cin; c++)
        for (let j = 0; j < Cout; j++) kf[j * (K * Cin) + t * Cin + c] = kern.w[(t * Cin + c) * Cout + j];
    const g = W[name + '_BN/gamma'].w, bt = W[name + '_BN/beta'].w;
    const mu = W[name + '_BN/moving_mean'].w, va = W[name + '_BN/moving_variance'].w;
    const scale = new Float32Array(Cout), shift = new Float32Array(Cout);
    for (let j = 0; j < Cout; j++) {
      scale[j] = g[j] / Math.sqrt(va[j] + 1e-3);
      shift[j] = bt[j] - mu[j] * scale[j];
    }
    layers.push({ K, Cin, Cout, stride: i === 0 ? 4 : 1, kf, bias: W[name + '/bias'].w, scale, shift });
  });
  return { layers, dk: W['crepe_classifier/kernel'].w, db: W['crepe_classifier/bias'].w };
}

/* one conv layer: 'same' padding, relu, batch-norm, max-pool 2; four
   filters by four positions at a time */
function layer(x: Float32Array, L: number, lay: Layer): { x: Float32Array; L: number } {
  const { K, Cin, Cout, stride, kf, bias, scale, shift } = lay;
  const outLen = Math.ceil(L / stride);
  const total = Math.max((outLen - 1) * stride + K - L, 0), pl = total >> 1;
  const xp = new Float32Array((L + total) * Cin + 3 * stride * Cin);
  xp.set(x.subarray(0, L * Cin), pl * Cin);
  const y = new Float32Array(outLen * Cout);
  const KC = K * Cin, SC = stride * Cin, acc = new Float64Array(16);
  for (let p = 0; p < outLen; p += 4) {
    const b0 = p * SC, b1 = b0 + SC, b2 = b1 + SC, b3 = b2 + SC;
    for (let j = 0; j < Cout; j += 4) {
      const r0 = j * KC, r1 = r0 + KC, r2 = r1 + KC, r3 = r2 + KC;
      let a0 = 0, a1 = 0, a2 = 0, a3 = 0, c0 = 0, c1 = 0, c2 = 0, c3 = 0;
      let d0 = 0, d1 = 0, d2 = 0, d3 = 0, e0 = 0, e1 = 0, e2 = 0, e3 = 0;
      for (let t = 0; t < KC; t++) {
        const k0 = kf[r0 + t], k1 = kf[r1 + t], k2 = kf[r2 + t], k3 = kf[r3 + t];
        let u = xp[b0 + t]; a0 += u * k0; a1 += u * k1; a2 += u * k2; a3 += u * k3;
        u = xp[b1 + t]; c0 += u * k0; c1 += u * k1; c2 += u * k2; c3 += u * k3;
        u = xp[b2 + t]; d0 += u * k0; d1 += u * k1; d2 += u * k2; d3 += u * k3;
        u = xp[b3 + t]; e0 += u * k0; e1 += u * k1; e2 += u * k2; e3 += u * k3;
      }
      acc[0] = a0; acc[1] = a1; acc[2] = a2; acc[3] = a3; acc[4] = c0; acc[5] = c1; acc[6] = c2; acc[7] = c3;
      acc[8] = d0; acc[9] = d1; acc[10] = d2; acc[11] = d3; acc[12] = e0; acc[13] = e1; acc[14] = e2; acc[15] = e3;
      for (let pp = 0; pp < 4 && p + pp < outLen; pp++) {
        const o = (p + pp) * Cout;
        for (let q = 0; q < 4; q++) {
          let s = acc[pp * 4 + q] + bias[j + q];
          if (s < 0) s = 0;
          y[o + j + q] = s * scale[j + q] + shift[j + q];
        }
      }
    }
  }
  const half = outLen >> 1, z = new Float32Array(half * Cout);
  for (let p = 0; p < half; p++)
    for (let j = 0; j < Cout; j++) {
      const a = y[2 * p * Cout + j], b = y[(2 * p + 1) * Cout + j];
      z[p * Cout + j] = a > b ? a : b;
    }
  return { x: z, L: half };
}

/** 1024 samples at 16 kHz -> 360 activations (20-cent bins) */
export function crepePredict(model: Crepe, frame: Float32Array): Float32Array {
  let m = 0;
  for (let i = 0; i < 1024; i++) m += frame[i];
  m /= 1024;
  let e = 0;
  for (let i = 0; i < 1024; i++) {
    const v = frame[i] - m;
    e += v * v;
  }
  let sd = Math.sqrt(e / 1024);
  if (sd < 1e-8) sd = 1;
  const x = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) x[i] = (frame[i] - m) / sd;
  let cur: { x: Float32Array; L: number } = { x, L: 1024 };
  for (const lay of model.layers) cur = layer(cur.x, cur.L, lay);
  const flat = cur.x, act = new Float32Array(360), { dk, db } = model;
  for (let j = 0; j < 360; j++) {
    let s = db[j];
    for (let i = 0; i < 256; i++) s += flat[i] * dk[i * 360 + j];
    act[j] = 1 / (1 + Math.exp(-s));
  }
  return act;
}

export function actToMidiConf(act: Float32Array): { midi: number; conf: number } {
  let gi = 0, gv = 0;
  for (let k = 0; k < 360; k++) if (act[k] > gv) { gv = act[k]; gi = k; }
  const a = Math.max(0, gi - 4), b = Math.min(360, gi + 5);
  let num = 0, den = 0;
  for (let k = a; k < b; k++) { num += (k * 20 + 1997.3794084376191) * act[k]; den += act[k]; }
  const cents = den > 0 ? num / den : gi * 20 + 1997.3794084376191;
  return { midi: 69 + 12 * Math.log2((10 * Math.pow(2, cents / 1200)) / 440), conf: gv };
}

/** The 64 ms around time tc, resampled to the model's 1024 samples
    (old app, ancFrames). */
export function crepeFrame(mono: Float32Array, sr: number, tc: number): Float32Array {
  const need = Math.round(0.064 * sr), step = need / 1024, len = mono.length;
  const out = new Float32Array(1024);
  const off = tc * sr - need / 2;
  for (let i = 0; i < 1024; i++) {
    const sp = off + i * step, lo = Math.floor(sp), fr = sp - lo;
    const a = lo >= 0 && lo < len ? mono[lo] : 0;
    const b = lo + 1 >= 0 && lo + 1 < len ? mono[lo + 1] : 0;
    out[i] = a + (b - a) * fr;
  }
  return out;
}
