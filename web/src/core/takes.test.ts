import { describe, expect, it } from 'vitest';
import { isRight, rightPct, MIN_SCORED } from './takes';

describe('right notes', () => {
  it('is right within half a semitone, in the singer\'s octave unless "Any octave" is on', () => {
    expect(isRight(60.4, 60, false)).toBe(true);
    expect(isRight(60.6, 60, false)).toBe(false);
    expect(isRight(48.2, 60, false)).toBe(false);
    expect(isRight(48.2, 60, true)).toBe(true);
    expect(isRight(NaN, 60, true)).toBe(false);
    expect(isRight(60, NaN, true)).toBe(false);
  });
  it('counts only your notes sung where the singer sings, and says nothing from too few', () => {
    const singer = Float32Array.from({ length: 100 }, (_, k) => (k < 50 ? 60 : NaN));
    const t = Array.from({ length: 100 }, (_, k) => k * 0.05);
    const m = t.map((_, k) => (k < 40 ? 60.2 : 62));            /* 40 right, 10 wrong, 50 where the singer rests */
    expect(rightPct(t, m, singer, 0.05, false)).toBe(80);
    expect(rightPct(t.slice(0, MIN_SCORED - 1), m, singer, 0.05, false)).toBeNull();
  });
});
