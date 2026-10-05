import { describe, expect, it } from 'vitest';
import { bridgeLine } from './line';

describe('bridging the singer\'s line', () => {
  const N = NaN;
  it('bridges a gap of 0.15 s (three points) when both sides are within six semitones', () => {
    expect(Array.from(bridgeLine(Float32Array.from([60, N, N, N, 64])))).toEqual([60, 61, 62, 63, 64]);
  });
  it('leaves a longer gap, a big leap, and the ends alone', () => {
    expect(Array.from(bridgeLine(Float32Array.from([60, N, N, N, N, 60])))).toEqual([60, N, N, N, N, 60]);
    expect(Array.from(bridgeLine(Float32Array.from([60, N, 67])))).toEqual([60, N, 67]);
    expect(Array.from(bridgeLine(Float32Array.from([N, 60, N])))).toEqual([N, 60, N]);
  });
  it('only looks at what has been read so far', () => {
    expect(Array.from(bridgeLine(Float32Array.from([60, N, 62, N, 64]), 2))).toEqual([60, N, 62, N, 64]);
  });
});
