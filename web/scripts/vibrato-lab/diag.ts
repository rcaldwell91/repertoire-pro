/* Why the singers' own vibrato reads "none": each measure's speed, width
   and fit, beside the reference over the same second. */
import { spawnSync } from 'node:child_process';
import { SR, live, fine, reference } from './common.ts';
import { fitWave } from '../../src/core/vibrato.ts';

const REC = (process.env.RP_VOCALS_DIR ?? '') + '/';
function pcm(file: string, from: number, secs: number) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-ss', String(from), '-t', String(secs), '-i', file, '-ac', '1', '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  const b = r.stdout as Buffer;
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.length));
}
const spots: Array<[string, number, number]> = [
  ['allofme-vocals.mp3', 64.42, 65.76], ['allofme-vocals.mp3', 68.18, 69.59], ['allofme-vocals.mp3', 75.62, 77.5], ['allofme-vocals.mp3', 83.24, 84.44],
  ['allofme-vocals.mp3', 167.03, 168.85], ['allofme-vocals.mp3', 170.57, 171.84], ['allofme-vocals.mp3', 174.66, 176.45], ['allofme-vocals.mp3', 235.62, 236.84],
  ['allofme-vocals.mp3', 240.09, 241.33], ['ride-vocals.mp3', 150.53, 153.22],
];
for (const [f, a, b] of spots) {
  const pad = 0.5, x = pcm(REC + f, a - pad, b - a + 2 * pad);
  const lv = live(x), ft = fine(x);
  console.log(`\n${f} ${a}-${b}`);
  const raw = lv.t.map((t, i) => (t >= pad && t <= b - a + pad ? `${(lv.r[i] * 100 % 1200).toFixed(0)}` : '')).filter(Boolean);
  console.log('  raw readings (cents in octave): ' + raw.join(' '));
  for (let w0 = pad; w0 + 1 <= b - a + pad + 1e-6; w0 += 0.25) {
    const ts: number[] = [], ms: number[] = [];
    for (let i = 0; i < lv.t.length; i++) if (lv.t[i] >= w0 && lv.t[i] < w0 + 1 && Number.isFinite(lv.r[i])) { ts.push(lv.t[i]); ms.push(lv.r[i]); }
    const fw = ts.length >= 10 ? fitWave(ts, ms) : null;
    const ref = reference(ft, w0, w0 + 1);
    console.log(`  ${(w0 - pad).toFixed(2)}+1s: ${ts.length} readings; app ${fw ? `${fw.rate.toFixed(2)}/s ${fw.width.toFixed(0)}c fit ${fw.fit.toFixed(2)}` : '-'}; reference ${ref ? `${ref.rate.toFixed(2)}/s ${ref.width.toFixed(0)}c (${ref.cycles} cycles)` : '-'}`);
  }
}
