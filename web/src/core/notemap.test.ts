import { describe, expect, it } from 'vitest';
import { foldTo, keyName, penDown, pinnedRange, singerAt } from './notemap';

describe('the note map', () => {
  it('names the keys', () => {
    expect(keyName(60)).toBe('C4');
    expect(keyName(69)).toBe('A4');
    expect(keyName(61.4)).toBe('C♯4');
  });
  it('pins the view to the song\'s own range, three semitones either side', () => {
    const line = new Float32Array(500).fill(NaN);
    for (let i = 0; i < 400; i++) line[i] = 57 + (i % 12);         /* A3 .. G#4 */
    line[450] = 90;                                                   /* one stray reading */
    expect(pinnedRange(line)).toEqual({ lo: 54, hi: 71 });
    expect(pinnedRange(new Float32Array([NaN, 60]))).toBeNull();
  });
  it('leaves out brief slips an octave or more from the notes around them', () => {
    const line = Float32Array.from({ length: 2000 }, (_, i) => 55 + (i % 200) / 20);   /* G3 .. F#4, rising */
    for (let s = 100; s < 2000; s += 150) for (let k = 0; k < 6; k++) line[s + k] = 43;   /* a slip down every 7 s */
    expect(pinnedRange(line)).toEqual({ lo: 52, hi: 68 });
    /* a low phrase that is really sung counts */
    for (let k = 0; k < 60; k++) line[1000 + k] = 45;
    expect(pinnedRange(line)?.lo).toBe(42);
  });
  it('is the same range wherever the song has got to: never recentred', () => {
    const line = Float32Array.from({ length: 300 }, (_, i) => 60 + Math.sin(i / 10) * 5);
    expect(pinnedRange(line)).toEqual(pinnedRange(line.slice().reverse()));
  });
  it('folds your note onto the singer\'s octave only when asked', () => {
    expect(foldTo(48.2, 60)).toBeCloseTo(60.2);
    expect(foldTo(71.8, 60)).toBeCloseTo(59.8);
    expect(foldTo(60.4, 60)).toBeCloseTo(60.4);
  });
  it('finds the singer\'s note at a time, or the last one before it', () => {
    const line = Float32Array.from([60, 61, NaN, NaN, 64]);
    expect(singerAt(line, 0.05, 0.05)).toBe(61);
    expect(singerAt(line, 0.05, 0.15)).toBe(61);
    expect(singerAt(line, 0.05, 0.2)).toBe(64);
  });
  it('lifts the pen across gaps and big jumps', () => {
    expect(penDown(60, 62)).toBe(true);
    expect(penDown(60, 67)).toBe(false);
    expect(penDown(NaN, 60)).toBe(false);
  });
});
