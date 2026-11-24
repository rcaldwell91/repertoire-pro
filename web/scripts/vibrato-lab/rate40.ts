/* Would reading more often catch the narrow wobbles 20 a second misses?
   The singers' own held seconds, read by the same reading (YIN, gate,
   1024-sample stretch) at 20, 40 and 100 a second, each fitted the same way. */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { SR, reference } from './common.ts';
import { yinHz, yinOffset, CLARITY, GATE_LEVEL } from '../../src/audio/pitch/yin.ts';
import { WIN } from '../../src/audio/pitch/core.ts';
import { fitSecond } from '../../src/core/vibrato.ts';

const REC = (process.env.RP_VOCALS_DIR ?? '') + '/';
function pcm(file: string) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  const b = r.stdout as Buffer;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}
function readAt(x: Float32Array, t: number) {
  const s = Math.round(t * SR) - (WIN >> 1);
  if (s < 0 || s + WIN > x.length) return NaN;
  const w = x.subarray(s, s + WIN);
  let e = 0;
  for (let i = 0; i < w.length; i++) e += w[i] * w[i];
  if (Math.sqrt(e / w.length) < GATE_LEVEL) return NaN;
  const f = yinHz(w.subarray(yinOffset(WIN, SR)), SR, CLARITY);
  return f > 0 ? 69 + 12 * Math.log2(f / 440) : NaN;
}
const med = (v: number[]) => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
function held(ft: { t: number[]; m: number[] }, min: number) {
  const out: Array<{ from: number; to: number }> = [];
  let i = 0;
  while (i < ft.t.length) {
    if (!Number.isFinite(ft.m[i])) { i++; continue; }
    let j = i;
    while (j + 1 < ft.t.length && Number.isFinite(ft.m[j + 1]) && Math.abs(ft.m[j + 1] - ft.m[i]) < 1.5) j++;
    if (ft.t[j] - ft.t[i] >= min) out.push({ from: ft.t[i], to: ft.t[j] });
    i = j + 1;
  }
  return out;
}
const tally: Record<number, { found: number; of: number; dr: number[]; dw: number[]; falseW: number; notRef: number }> = {};
for (const per of [20, 40, 100]) tally[per] = { found: 0, of: 0, dr: [], dw: [], falseW: 0, notRef: 0 };
for (const f of ['allofme-vocals.mp3', 'ride-vocals.mp3']) {
  const x = pcm(REC + f);
  const ft = JSON.parse(readFileSync(REC + f + '.fine.json', 'utf8'));
  ft.m = ft.m.map((v: number | null) => (v == null ? NaN : v));
  for (const h of held(ft, 1.2)) {
    for (let a = h.from; a + 1 <= h.to + 1e-6; a += 0.25) {
      const ref = reference(ft, a, a + 1);
      const refW = !!ref && ref.cycles >= 3 && ref.rate >= 3.5 && ref.rate <= 9 && ref.width >= 20;
      for (const per of [20, 40, 100]) {
        const ts: number[] = [], ms: number[] = [];
        for (let t = Math.ceil(a * per) / per; t < a + 1; t += 1 / per) { const m = readAt(x, t); if (Number.isFinite(m)) { ts.push(t); ms.push(m); } }
        if (ts.length < 0.7 * per) continue;
        const r = fitSecond(ts, ms);
        const T = tally[per];
        if (refW) {
          T.of++;
          if (r?.kind === 'wobble' && ref) { T.found++; T.dr.push(r.rate - ref.rate); T.dw.push(r.width - ref.width); }
        } else { T.notRef++; if (r?.kind === 'wobble') T.falseW++; }
      }
    }
  }
}
for (const per of [20, 40, 100]) {
  const T = tally[per];
  const mabs = (v: number[]) => med(v.map(Math.abs));
  console.log(`${per} a second: wobble found in ${T.found} of ${T.of} seconds the reference calls a wobble; false wobble ${T.falseW} of ${T.notRef}; median |speed err| ${mabs(T.dr)?.toFixed(2)}, median |width err| ${mabs(T.dw)?.toFixed(1)}`);
}
