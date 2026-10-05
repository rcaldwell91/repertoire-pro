import { describe, expect, it } from 'vitest';
import { Resampler, TAKE_RATE, toInt16, wav } from './resample';

/* Bookkeeping only (RULEBOOK 4, Tests: real voices are for measuring the
   app; these check the sums): length, place and the file's layout. */
describe('making a take smaller', () => {
  it('keeps a sound at its place, to the sample, whatever the blocks', () => {
    const inRate = 48000, x = new Float32Array(48000);
    x[24000] = 1;                                   /* a click at 0.5 s */
    const r = new Resampler(inRate);
    const out: number[] = [];
    for (let i = 0; i < x.length; i += 1000) out.push(...r.push(x.subarray(i, i + 1000)));
    let peak = 0;
    for (let i = 1; i < out.length; i++) if (Math.abs(out[i]) > Math.abs(out[peak])) peak = i;
    expect(Math.abs(peak / TAKE_RATE - 0.5)).toBeLessThan(1 / TAKE_RATE);
    expect(out.length).toBeGreaterThan(TAKE_RATE - 20);
  });
  it('takes out what is too high to keep, and keeps the voice', () => {
    const inRate = 48000, n = 48000;
    const tone = (f: number) => Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * f * i) / inRate));
    const level = (y: Float32Array) => Math.sqrt(y.slice(2000, -2000).reduce((a, v) => a + v * v, 0) / (y.length - 4000));
    expect(level(new Resampler(inRate).push(tone(440)))).toBeGreaterThan(0.65);
    expect(level(new Resampler(inRate).push(tone(15000)))).toBeLessThan(0.05);
  });
  it('writes a 16-bit mono WAV', () => {
    const b = wav([toInt16(Float32Array.of(0, 1, -1))], TAKE_RATE);
    const v = new DataView(b);
    expect(b.byteLength).toBe(44 + 6);
    expect(v.getUint32(24, true)).toBe(TAKE_RATE);
    expect(v.getInt16(46, true)).toBe(32767);
    expect(v.getInt16(48, true)).toBe(-32768);
  });
});
